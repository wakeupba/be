import { env } from 'cloudflare:test';
import { SESSION_COOKIE } from '@wakeupbabe/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { regionInterest, users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { CALL_RATES_USD } from '../src/data/call-rates';
import { callRateUsd, isCallableNumber, MAX_CALL_RATE_USD, MAX_PREFIX_DIGITS } from '../src/lib/call-rates';
import { hmacSign } from '../src/lib/crypto';
import { seedUser, testDb } from './helpers';

async function sessionCookie(userId: string): Promise<string> {
  const body = btoa(JSON.stringify({ userId, expiresAt: Date.now() + 60_000 }));
  return `${SESSION_COOKIE}=${body}.${await hmacSign(body, env.SESSION_SECRET)}`;
}

describe('the rate table itself', () => {
  /* The generator is internal tooling and lives outside this repo, so the
   * invariants it upholds are asserted here instead. Without these, a
   * regenerated table could break lookup silently rather than loudly. */

  it('has no prefix longer than lookup will reach', () => {
    const longest = Math.max(...Object.keys(CALL_RATES_USD).map((key) => key.length));
    // a longer key is unreachable, and its numbers would fall through to a
    // shorter and cheaper prefix: the exact failure this gate must not have
    expect(longest).toBeLessThanOrEqual(MAX_PREFIX_DIGITS);
  });

  it('is keyed by bare digits with a usable price', () => {
    for (const [prefix, usd] of Object.entries(CALL_RATES_USD)) {
      // a '+' or a space in a key can never match, so it would be dead weight
      // that silently widens the fall-through
      expect(prefix).toMatch(/^[0-9]+$/);
      expect(Number.isFinite(usd)).toBe(true);
      expect(usd).toBeGreaterThan(0);
    }
  });

  it('still prices the destinations the gate is documented against', () => {
    // the comments and the PR reasoning quote these; if a regeneration moves
    // them, the explanations stop matching the code
    expect(CALL_RATES_USD['1']).toBe(0.014);
    expect(CALL_RATES_USD['44']).toBe(0.0158);
    expect(CALL_RATES_USD['4470']).toBeCloseTo(0.5577, 4);
    expect(CALL_RATES_USD['449']).toBeCloseTo(1.0479, 4);
  });
});

describe('call rate lookup', () => {
  it('prices a number from its longest matching prefix', () => {
    // +1 is a single table entry covering all of NANP
    expect(callRateUsd('+14155550123')).toBe(0.014);
    // India resolves through its own entry, not through a shorter neighbour
    expect(callRateUsd('+917890123456')).toBeCloseTo(0.0496, 4);
  });

  it('prefers the specific prefix over the country code', () => {
    // the case that makes longest-prefix mandatory: +44 itself is $0.0158
    // while +4470 is $0.5577, a 35x spread under one country code
    const london = callRateUsd('+442079460958');
    const premium = callRateUsd('+447003001234');
    expect(london).toBeDefined();
    expect(premium).toBeDefined();
    expect(premium as number).toBeGreaterThan(london as number);
    expect(premium as number).toBeGreaterThan(MAX_CALL_RATE_USD);
  });

  it('refuses a number whose prefix it has never heard of', () => {
    // +999 is unassigned, so there is nothing to price it with
    expect(callRateUsd('+9995550123')).toBeUndefined();
    expect(isCallableNumber('+9995550123')).toBe(false);
  });

  it('allows the cheap destinations and blocks the dear ones', () => {
    expect(isCallableNumber('+14155550123')).toBe(true); // US, $0.014
    expect(isCallableNumber('+917890123456')).toBe(true); // India, $0.0496
    expect(isCallableNumber('+4915112345678')).toBe(false); // German mobile, $0.3763
    expect(isCallableNumber('+9607901234')).toBe(false); // Maldives, $1.7687
  });

  it('splits the two real destinations either side of the cap', () => {
    /* Thailand is priced at exactly the cap, which is the case worth pinning:
     * the comparison is inclusive, so being level with the cap is in, and a
     * change to `<` would strand a real destination. Indonesia at $0.1066 is
     * the nearest one out, two thirds of a cent above. */
    expect(callRateUsd('+66812345678')).toBeCloseTo(0.1, 4);
    expect(callRateUsd('+62812345678')).toBeCloseTo(0.1066, 4);
    expect(isCallableNumber('+66812345678')).toBe(true);
    expect(isCallableNumber('+62812345678')).toBe(false);
  });

  /* The cap is a product decision, so it gets to move. These are the countries
   * Twilio will actually connect for this account, and what the cap does to
   * them: a change that quietly drops one should be a change someone chose.
   *
   * The price is asserted next to the verdict rather than written in a comment.
   * A comment would go quietly out of date the first time Twilio repriced a
   * destination across the cap, and the verdict alone would flip without ever
   * saying why. */
  it('records which of the reachable countries the cap admits, and at what price', () => {
    const roster: [string, string, number, boolean][] = [
      ['US', '+12015550123', 0.014, true],
      ['Canada', '+15062345678', 0.014, true],
      ['UK', '+447400123456', 0.0305, true],
      ['India', '+918123456789', 0.0496, true],
      ['Brazil', '+5511961234567', 0.0663, true],
      ['Australia', '+61412345678', 0.075, true],
      ['France', '+33612345678', 0.1603, false],
      ['Japan', '+819012345678', 0.185, false],
      ['Israel', '+972502345678', 0.1868, false],
      ['Germany', '+4915123456789', 0.3763, false],
    ];
    for (const [name, number, usd, admitted] of roster) {
      expect(callRateUsd(number), `${name} price`).toBeCloseTo(usd, 4);
      expect(isCallableNumber(number), `${name} admitted`).toBe(admitted);
    }
  });
});

describe('unsupported regions', () => {
  it('turns the number away without saving it, and records the destination', async () => {
    const db = testDb();
    const user = await seedUser(db, { phoneE164: null, dndVerifiedAt: null });
    const app = createApp();

    const response = await app.request(
      new Request('https://api.test/me/settings', {
        method: 'PATCH',
        body: JSON.stringify({ phone: '+4915112345678' }), // valid German mobile
        headers: { 'content-type': 'application/json', cookie: await sessionCookie(user.id) },
      }),
      undefined,
      env,
    );

    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('region_unsupported');

    // nothing downstream may believe this account has a reachable phone
    const after = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    expect(after?.phoneE164 ?? null).toBeNull();

    const interest = await db.query.regionInterest.findFirst({
      where: eq(regionInterest.userId, user.id),
    });
    // the destination, not the person: no phone number is kept here
    expect(interest?.country).toBe('DE');
    expect(interest?.prefix).toBe('4915');
    expect(interest?.rateUsd).toBeCloseTo(0.3763, 4);
    expect(interest?.attempts).toBe(1);
    expect(Object.keys(interest ?? {})).not.toContain('phoneE164');
  });

  it('counts a second attempt instead of duplicating the row', async () => {
    const db = testDb();
    const user = await seedUser(db, { phoneE164: null, dndVerifiedAt: null });
    const app = createApp();
    const patch = async (phone: string) =>
      app.request(
        new Request('https://api.test/me/settings', {
          method: 'PATCH',
          body: JSON.stringify({ phone }),
          headers: { 'content-type': 'application/json', cookie: await sessionCookie(user.id) },
        }),
        undefined,
        env,
      );

    await patch('+4915112345678');
    await patch('+393123456789'); // Italy, also above the cap

    const rows = await db.select().from(regionInterest).where(eq(regionInterest.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.attempts).toBe(2);
    // the latest destination replaces the first
    expect(rows[0]?.country).toBe('IT');
  });

  it('still accepts a supported number afterwards', async () => {
    const db = testDb();
    const user = await seedUser(db, { phoneE164: null, dndVerifiedAt: null });
    const app = createApp();
    const patch = async (phone: string) =>
      app.request(
        new Request('https://api.test/me/settings', {
          method: 'PATCH',
          body: JSON.stringify({ phone }),
          headers: { 'content-type': 'application/json', cookie: await sessionCookie(user.id) },
        }),
        undefined,
        env,
      );

    expect((await patch('+4915112345678')).status).toBe(422);
    expect((await patch('+14155550199')).status).toBe(200);

    const after = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    expect(after?.phoneE164).toBe('+14155550199');
  });

  it('refuses the verification call for a number already on file', async () => {
    const db = testDb();
    // a number saved before the gate existed: settings never sees it again,
    // so the ring path has to check for itself
    const user = await seedUser(db, { phoneE164: '+4915112345678' });
    const app = createApp();

    const response = await app.request(
      new Request('https://api.test/me/verify-call', {
        method: 'POST',
        headers: { cookie: await sessionCookie(user.id) },
      }),
      undefined,
      env,
    );

    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('region_unsupported');
  });
});
