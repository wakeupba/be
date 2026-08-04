import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { demoCalls } from '../src/db/schema';
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
      body: JSON.stringify({ phone, token: GOOD_TOKEN }),
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
    expect(await response.json()).toEqual({ available: true });
  });
});

describe('demo call refusals', () => {
  it('refuses outright when the demo is not configured', async () => {
    const response = await callDemo(
      { phone: CALLABLE, token: GOOD_TOKEN },
      { TURNSTILE_SECRET: undefined },
    );
    expect(response.status).toBe(503);
  });

  it('refuses a missing or wrong challenge token before touching anything else', async () => {
    expect((await callDemo({ phone: CALLABLE })).status).toBe(400);
    expect((await callDemo({ phone: CALLABLE, token: 'forged' })).status).toBe(403);
  });

  it('refuses an unparseable number', async () => {
    const response = await callDemo({ phone: 'call me maybe', token: GOOD_TOKEN });
    expect(response.status).toBe(400);
  });

  it('refuses a number too expensive to ring, same cap as signup', async () => {
    const response = await callDemo({ phone: '+4915112345678', token: GOOD_TOKEN }); // DE, $0.3763
    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('region_unsupported');
  });

  it('rings a number only once, whoever asks for it', async () => {
    const phone = uniquePhone();
    // the first attempt gets as far as Twilio, which the bogus creds reject
    await callDemoFrom(`ip-${crypto.randomUUID()}`, phone).catch(() => undefined);

    // a different visitor, same number: refused, and the wording gives away
    // nothing about who rang it before
    const second = await callDemoFrom(`ip-${crypto.randomUUID()}`, phone);
    expect(second.status).toBe(429);
    expect(((await second.json()) as { error: string }).error).toContain('number');
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
    // a week's worth of spend already on the books
    await db.insert(demoCalls).values({
      id: `dmo_${crypto.randomUUID()}`,
      phoneHash: 'spent',
      ipHash: 'spent',
      costUsd: 10,
      createdAt: Date.now(),
    });

    const response = await callDemo({ phone: uniquePhone(), token: GOOD_TOKEN });
    expect(response.status).toBe(429);

    const availability = await createApp().request(
      new Request('https://api.test/demo/availability'),
      undefined,
      demoEnv(),
    );
    expect(await availability.json()).toEqual({ available: false });
  });
});

describe('demo call reservations', () => {
  it('hands the reservation back when the carrier refuses, so a failed call costs nothing', async () => {
    const db = testDb();
    const before = await db.$count(demoCalls);

    /* storage is shared across this file and an earlier test parked a week's
     * worth of spend, so this one needs headroom of its own to get as far as
     * the carrier */
    const response = await callDemo(
      { phone: uniquePhone(), token: GOOD_TOKEN },
      { DEMO_WEEKLY_BUDGET_USD: '1000' },
    );
    // bogus twilio credentials, so placeCall throws
    expect(response.status).toBe(500);

    // the row exists (it still counts against the per-number cap) but costs
    // nothing, because Twilio will never bill for a call it refused
    const rows = await db.select().from(demoCalls);
    expect(rows.length).toBe(before + 1);
    expect(rows.at(-1)?.costUsd).toBe(0);
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

