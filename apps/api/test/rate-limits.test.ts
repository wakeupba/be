import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { seedUser, testDb } from './helpers';

async function sessionCookie(userId: string): Promise<string> {
  const { hmacSign, SESSION_COOKIE } = await import('@wakeupbabe/shared');
  const body = btoa(JSON.stringify({ userId, expiresAt: Date.now() + 60_000 }));
  return `${SESSION_COOKIE}=${body}.${await hmacSign(body, env.SESSION_SECRET)}`;
}

describe('rate limits', () => {
  it('waitlist signups are capped per ip', async () => {
    const app = createApp();
    // storage is shared across tests; a unique ip keeps runs independent
    const ip = `test-ip-${crypto.randomUUID()}`;
    const post = (n: number) =>
      app.request(
        new Request('https://api.test/waitlist', {
          method: 'POST',
          body: JSON.stringify({ email: `babe${n}@example.com`, region: 'India' }),
          headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
        }),
        undefined,
        env,
      );

    for (let n = 0; n < 5; n++) expect((await post(n)).status).toBe(200);
    expect((await post(5)).status).toBe(429);
  });

  it('verification calls are capped per number across accounts', async () => {
    const db = testDb();
    // one victim number, two attacker accounts; bogus twilio creds so no
    // real call can ever leave the building
    const phone = `+1415555${Math.floor(1000 + Math.random() * 9000)}`;
    const alpha = await seedUser(db, { phoneE164: phone });
    const beta = await seedUser(db, { phoneE164: phone });
    const app = createApp();
    const brokenTelephony = { ...env, TWILIO_ACCOUNT_SID: 'ACnotreal', TWILIO_AUTH_TOKEN: 'notreal' };

    const attempt = async (userId: string) =>
      app.request(
        new Request('https://api.test/me/verify-call', {
          method: 'POST',
          headers: { cookie: await sessionCookie(userId) },
        }),
        undefined,
        brokenTelephony,
      );

    // three attempts consume the number's hourly slots (each 500s at the
    // fake twilio creds, which is fine: the slot spends before placement)
    expect((await attempt(alpha.id)).status).toBe(500);
    expect((await attempt(alpha.id)).status).toBe(500);
    expect((await attempt(beta.id)).status).toBe(500);

    // the fourth ring at this number is refused even though this account
    // has plenty of per-user budget left
    const blocked = await attempt(beta.id);
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as { error: string }).error).toContain('number');
  });

  it('settings writes are capped per user', async () => {
    const db = testDb();
    const user = await seedUser(db);
    const app = createApp();

    const patch = async () =>
      app.request(
        new Request('https://api.test/me/settings', {
          method: 'PATCH',
          body: JSON.stringify({ timezone: 'UTC' }),
          headers: { 'content-type': 'application/json', cookie: await sessionCookie(user.id) },
        }),
        undefined,
        env,
      );

    for (let n = 0; n < 30; n++) expect((await patch()).status).toBe(200);
    expect((await patch()).status).toBe(429);
  });
});
