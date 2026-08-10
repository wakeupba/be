import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { counters, demoCalls } from '../src/db/schema';
import { isSupportedCountry } from '../src/lib/call-rates';
import { CounterRepo } from '../src/repos/counters';
import { DemoCallRepo } from '../src/repos/demo-calls';
import { budgetKeyFor } from '../src/routes/demo';
import { testDb } from './helpers';

/*
 * The demo endpoint spends money for a visitor with no account, so these tests
 * are mostly about what it refuses. Twilio credentials are deliberately bogus
 * throughout: no test in this file may ever place a real call.
 */

const GOOD_TOKEN = 'turnstile-ok';
const CALLABLE = '+14155550123'; // US, $0.014

function demoEnv(overrides: Record<string, unknown> = {}) {
  return {
    ...env,
    TURNSTILE_SECRET: 'test-secret',
    DEMO_WEEKLY_BUDGET_USD: '10',
    TWILIO_ACCOUNT_SID: 'ACnotreal',
    TWILIO_AUTH_TOKEN: 'notreal',
    ...overrides,
  };
}

/** stands in for Cloudflare's siteverify: accepts one token, and only for the
 * action the widget is bound to */
function stubTurnstile() {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('challenges.cloudflare.com')) {
      const form = init?.body as FormData;
      const token = form.get('response');
      return Response.json({ success: token === GOOD_TOKEN, action: 'demo-call' });
    }
    // anything else is Twilio, which the bogus credentials will reject anyway
    return original(input as RequestInfo, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

/* every test in this file talks to the stub, and none of them may leave it
 * installed for the next file: siteverify is a real network call otherwise */
let restoreFetch: () => void = () => {};
beforeEach(() => {
  restoreFetch = stubTurnstile();
});
afterEach(() => {
  restoreFetch();
});

async function callDemo(body: unknown, envOverrides: Record<string, unknown> = {}) {
  return createApp().request(
    new Request('https://api.test/demo/call', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': `ip-${crypto.randomUUID()}` },
    }),
    undefined,
    demoEnv(envOverrides),
  );
}

/** same visitor across calls, for the per-IP caps */
async function callDemoFrom(ip: string, phone: string, envOverrides: Record<string, unknown> = {}) {
  return createApp().request(
    new Request('https://api.test/demo/call', {
      method: 'POST',
      body: JSON.stringify({ phone, token: GOOD_TOKEN, owns: true }),
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    }),
    undefined,
    demoEnv(envOverrides),
  );
}

function uniquePhone(): string {
  return `+1415555${Math.floor(1000 + Math.random() * 9000)}`;
}

describe('demo availability', () => {
  it('is off when no challenge secret is configured', async () => {
    const response = await createApp().request(
      new Request('https://api.test/demo/availability'),
      undefined,
      { ...env, TURNSTILE_SECRET: undefined, DEMO_WEEKLY_BUDGET_USD: '10' },
    );
    expect(await response.json()).toEqual({ available: false });
  });

  it('is off when the budget is zero, even with a secret', async () => {
    const response = await createApp().request(
      new Request('https://api.test/demo/availability'),
      undefined,
      demoEnv({ DEMO_WEEKLY_BUDGET_USD: '0' }),
    );
    expect(await response.json()).toEqual({ available: false });
  });

  it('is on once both are configured', async () => {
    const response = await createApp().request(
      new Request('https://api.test/demo/availability'),
      undefined,
      demoEnv(),
    );
    expect(await response.json()).toEqual({ available: true, country: null });
  });

  it('is off for a visitor in a country we cannot ring', async () => {
    /* they can still sign up, and the limit turns up at onboarding where their
     * country gets recorded. Offering a demo call on the landing page and then
     * refusing it reads as "this product is not for you" */
    const response = await createApp().request(
      new Request('https://api.test/demo/availability', { headers: { 'CF-IPCountry': 'DE' } }),
      undefined,
      demoEnv(),
    );
    expect(await response.json()).toEqual({ available: false });
  });

  it('is off for a visitor in a country the carrier will not connect', async () => {
    /* Germany above is refused on price; Spain is refused on geography. Its
     * mobiles happen to be over the cap too, but the permission gate answers
     * first and would refuse it at any price: the account holds no dialing
     * permission for it, so a demo call would die at the carrier with error
     * 21215 after the page had offered it. */
    const response = await createApp().request(
      new Request('https://api.test/demo/availability', { headers: { 'CF-IPCountry': 'ES' } }),
      undefined,
      demoEnv(),
    );
    expect(await response.json()).toEqual({ available: false });
  });

  it('is off even where the price alone would have said yes', async () => {
    // Wallis and Futuna mobiles are $0.02, well under the cap, so this is the
    // one gate doing the refusing: geography, not price
    const response = await createApp().request(
      new Request('https://api.test/demo/availability', { headers: { 'CF-IPCountry': 'WF' } }),
      undefined,
      demoEnv(),
    );
    expect(await response.json()).toEqual({ available: false });
  });

  it('is on for a visitor in a country we can ring', async () => {
    const response = await createApp().request(
      new Request('https://api.test/demo/availability', { headers: { 'CF-IPCountry': 'IN' } }),
      undefined,
      demoEnv(),
    );
    expect(await response.json()).toEqual({ available: true, country: 'IN' });
  });

  it('shows the demo when the country is unknown, since nothing spends on it', async () => {
    // XX is Cloudflare's unknown-network value; a missing header is dev
    for (const headers of [{ 'CF-IPCountry': 'XX' }, {}]) {
      const response = await createApp().request(
        new Request('https://api.test/demo/availability', { headers }),
        undefined,
        demoEnv(),
      );
      expect(await response.json()).toEqual({ available: true, country: null });
    }
  });
});

describe('country support', () => {
  it('judges a country by a typical mobile number there, not by its calling code', () => {
    // +49 prices a German landline at 3 cents, so the calling code alone would
    // say Germany is fine while German mobile is 38 cents
    expect(isSupportedCountry('DE')).toBe(false);
    expect(isSupportedCountry('IN')).toBe(true);
    expect(isSupportedCountry('US')).toBe(true);
    expect(isSupportedCountry('GB')).toBe(true);
  });

  it('says yes to a country it has never heard of', () => {
    // this only decides what to offer, and being coy with someone we could
    // serve is the worse mistake
    expect(isSupportedCountry('ZZ')).toBe(true);
  });

  it('says no to a country the account may not dial, whatever it costs', () => {
    // Wallis and Futuna is $0.02 a call; the refusal is the missing dialing
    // permission, and a known country gets no benefit of the doubt
    expect(isSupportedCountry('WF')).toBe(false);
    expect(isSupportedCountry('ES')).toBe(false);
  });
});

describe('demo call refusals', () => {
  it('refuses outright when the demo is not configured', async () => {
    const response = await callDemo(
      { phone: CALLABLE, token: GOOD_TOKEN, owns: true },
      { TURNSTILE_SECRET: undefined },
    );
    expect(response.status).toBe(503);
  });

  it('refuses a missing or wrong challenge token before touching anything else', async () => {
    expect((await callDemo({ phone: CALLABLE, owns: true })).status).toBe(400);
    expect((await callDemo({ phone: CALLABLE, token: 'forged', owns: true })).status).toBe(403);
  });

  it('refuses without the ownership attestation, not only in the form', async () => {
    /* the checkbox disables a button, which gates nothing on its own: anything
     * posting straight here would skip it, and there would be no artifact for a
     * specific call afterwards */
    const response = await callDemo({ phone: CALLABLE, token: GOOD_TOKEN });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toContain('your own');
  });

  it('refuses an unparseable number', async () => {
    const response = await callDemo({ phone: 'call me maybe', token: GOOD_TOKEN, owns: true });
    expect(response.status).toBe(400);
  });

  it('refuses a number too expensive to ring, same cap as signup', async () => {
    const response = await callDemo({ phone: '+4915112345678', token: GOOD_TOKEN, owns: true }); // DE, $0.3763
    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('region_unsupported');
  });

  it('caps a number across visitors, not just per visitor', async () => {
    const phone = uniquePhone();
    // two attempts from unrelated addresses use up the number's daily pair
    for (let n = 0; n < 2; n++) {
      await callDemoFrom(`ip-${crypto.randomUUID()}`, phone).catch(() => undefined);
    }

    // a third visitor is refused on the number's allowance, and the wording
    // gives away nothing about who rang it before
    const third = await callDemoFrom(`ip-${crypto.randomUUID()}`, phone);
    expect(third.status).toBe(429);
    expect(((await third.json()) as { error: string }).error).toContain('number');
  });

  it('caps one visitor across different numbers', async () => {
    const ip = `ip-${crypto.randomUUID()}`;
    for (let n = 0; n < 2; n++) {
      await callDemoFrom(ip, uniquePhone()).catch(() => undefined);
    }
    const third = await callDemoFrom(ip, uniquePhone());
    expect(third.status).toBe(429);
    expect(((await third.json()) as { error: string }).error).toContain('demo calls');
  });

  it('stops when the week is spent, and says so through availability', async () => {
    const db = testDb();
    // park a full week's budget in the counter that gates spend
    await new CounterRepo(db).spend(budgetKeyFor(Date.now()), 10_000, 10_000);

    const response = await callDemo({ phone: uniquePhone(), token: GOOD_TOKEN, owns: true });
    expect(response.status).toBe(429);

    const availability = await createApp().request(
      new Request('https://api.test/demo/availability'),
      undefined,
      demoEnv(),
    );
    expect(await availability.json()).toEqual({ available: false, country: null });
  });
});

describe('the budget counter', () => {
  /* This is what replaced a per-10-minutes cap. That cap existed because the
   * old budget was read-then-write and could be raced, and it meant a viral
   * page would refuse people while the budget still had room. It can only be
   * gone if the counter is genuinely exact, so that is what these check. */

  it('admits spend up to the ceiling and refuses the unit that would exceed it', async () => {
    const repo = new CounterRepo(testDb());
    const key = `test:${crypto.randomUUID()}`;
    expect(await repo.spend(key, 6, 10)).toBe(true);
    expect(await repo.spend(key, 4, 10)).toBe(true); // exactly at the ceiling
    expect(await repo.spend(key, 1, 10)).toBe(false);
    expect(await repo.read(key)).toBe(10);
  });

  it('refuses an amount larger than the ceiling without creating the row', async () => {
    // the insert branch has no WHERE to guard it, so this is the one case that
    // could have slipped a single oversized spend through
    const repo = new CounterRepo(testDb());
    const key = `test:${crypto.randomUUID()}`;
    expect(await repo.spend(key, 11, 10)).toBe(false);
    expect(await repo.read(key)).toBe(0);
  });

  it('cannot be raced past the ceiling by simultaneous callers', async () => {
    const repo = new CounterRepo(testDb());
    const key = `test:${crypto.randomUUID()}`;
    // twenty at once against room for five: exactly five may win, whatever
    // order they interleave in
    const results = await Promise.all(Array.from({ length: 20 }, () => repo.spend(key, 1, 5)));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(await repo.read(key)).toBe(5);
  });

  it('gives spend back, and floors at zero so a double refund mints nothing', async () => {
    const repo = new CounterRepo(testDb());
    const key = `test:${crypto.randomUUID()}`;
    await repo.spend(key, 5, 10);
    await repo.refund(key, 3);
    expect(await repo.read(key)).toBe(2);
    await repo.refund(key, 50);
    expect(await repo.read(key)).toBe(0);
  });

  it('charges a fresh window when the week rolls over', async () => {
    const week = 7 * 24 * 60 * 60_000;
    expect(budgetKeyFor(0)).not.toBe(budgetKeyFor(week));
    // a call placed near the boundary refunds where it was charged
    expect(budgetKeyFor(week - 1)).toBe(budgetKeyFor(0));
  });
});

describe('demo call reservations', () => {
  it('hands the reservation back when the call fails, and answers in words', async () => {
    const db = testDb();
    const before = await db.$count(demoCalls);

    /* storage is shared across this file and an earlier test parked a week's
     * worth of spend, so this one needs headroom of its own to get as far as
     * the carrier. Without the override the request is turned away at the
     * budget gate with a 429 and never reaches the code under test. */
    const budget = { DEMO_WEEKLY_BUDGET_USD: '1000' };
    const key = budgetKeyFor(Date.now());
    const spentBefore = await new CounterRepo(db).read(key);

    const response = await callDemo({ phone: uniquePhone(), token: GOOD_TOKEN, owns: true }, budget);

    /* bogus twilio credentials, so placeCall throws. What the visitor is told
     * matters as much as the status: rethrowing reached the app-wide handler,
     * which answers `internal error`, and that is what someone saw when their
     * number would not connect. */
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toContain('internal');
    expect(body.error).toMatch(/could not place/);

    // the row exists (it still counts against the per-number cap) but costs
    // nothing, because Twilio will never bill for a call it refused
    const rows = await db.select().from(demoCalls);
    expect(rows.length).toBe(before + 1);
    expect(rows.at(-1)?.costUsd).toBe(0);
    // and the week is handed back what the reservation took
    expect(await new CounterRepo(db).read(key)).toBe(spentBefore);
  });
});

describe('the hangup refund is self-idempotent', () => {
  it('a released call cannot be refunded again', async () => {
    /* release() zeroes costUsd but leaves answeredAt alone, so a guard on
     * answeredAt alone passed on every redelivery, and costMills floors at 1,
     * crediting a tenth of a cent each time. costUsd > 0 is what closes it. */
    const db = testDb();
    const repo = new DemoCallRepo(db);
    const counters = new CounterRepo(db);
    const key = `test:${crypto.randomUUID()}`;

    await counters.spend(key, 50, 1000);
    const id = await repo.reserve({ phoneHash: 'p', ipHash: 'i', costUsd: 0.05, ownerAttested: true });
    await repo.release(id);

    const row = await repo.findById(id);
    expect(row?.answeredAt ?? null).toBeNull(); // still unanswered
    expect(row?.costUsd).toBe(0); // and already released

    // the condition the hook applies: unanswered AND still holding cost
    expect(row !== undefined && row.answeredAt === null && row.costUsd > 0).toBe(false);
  });
});

describe('demo callbacks', () => {
  it('refuses an unsigned callback', async () => {
    const response = await createApp().request(
      new Request('https://api.test/hooks/demo/answer?demo=dmo_whatever&tok=forged', { method: 'POST' }),
      undefined,
      demoEnv(),
    );
    expect(response.status).toBe(403);
  });

  it('refuses a callback with no token at all', async () => {
    const response = await createApp().request(
      new Request('https://api.test/hooks/demo/answer?demo=dmo_whatever', { method: 'POST' }),
      undefined,
      demoEnv(),
    );
    expect(response.status).toBe(403);
  });
});

describe('the demo script says what it is', () => {
  it('names the product and the reason for the call in the first sentence', async () => {
    const { DEMO_SCRIPT } = await import('../src/services/calls/script');
    const firstSentence = DEMO_SCRIPT.split('. ')[0] ?? '';
    // whoever picks up may not be the person who typed the number, so an
    // unexplained robocall is the one outcome this must never be
    expect(firstSentence).toContain('Wake Up Babe');
    expect(firstSentence.toLowerCase()).toContain('demo');
    expect(DEMO_SCRIPT).not.toContain('Press');
  });
});

