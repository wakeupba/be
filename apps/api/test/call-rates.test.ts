import { env } from 'cloudflare:test';
import { SESSION_COOKIE } from '@wakeupbabe/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { regionInterest, users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { callRateUsd, isCallableNumber, MAX_CALL_RATE_USD } from '../src/lib/call-rates';
import { hmacSign } from '../src/lib/crypto';
import { seedUser, testDb } from './helpers';

async function sessionCookie(userId: string): Promise<string> {
  const body = btoa(JSON.stringify({ userId, expiresAt: Date.now() + 60_000 }));
  return `${SESSION_COOKIE}=${body}.${await hmacSign(body, env.SESSION_SECRET)}`;
}

describe('call rate lookup', () => {
  it('prices a number from its longest matching prefix', () => {
    // +1 is a single table entry covering all of NANP
    expect(callRateUsd('+14155550123')).toBe(0.014);
    // India resolves through its own entry, not through a shorter neighbour
    expect(callRateUsd('+917890123456')).toBeCloseTo(0.0496, 4);
  });

  it('prefers the specific prefix over the country code', () => {
    // the case that makes longest-prefix mandatory: a UK landline is cheap
    // while UK premium rate is two orders of magnitude dearer, and both live
    // under +44
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
    /* nothing is priced at exactly $0.20, so the boundary is pinned with the
     * closest mobile destinations on each side: Taiwan at $0.1985 is in, Egypt
     * at $0.2056 is out. Seven hundredths of a cent apart, so moving the cap
     * in either direction breaks this. */
    expect(callRateUsd('+886912345678')).toBeCloseTo(0.1985, 4);
    expect(callRateUsd('+201001234567')).toBeCloseTo(0.2056, 4);
    expect(isCallableNumber('+886912345678')).toBe(true);
    expect(isCallableNumber('+201001234567')).toBe(false);
  });
});

describe('unsupported regions', () => {
  it('turns the number away without saving it, and records the interest', async () => {
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
    expect(interest?.phoneE164).toBe('+4915112345678');
    expect(interest?.rateUsd).toBeCloseTo(0.3763, 4);
    expect(interest?.attempts).toBe(1);
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
    // the latest number they tried is the one worth contacting
    expect(rows[0]?.phoneE164).toBe('+393123456789');
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
