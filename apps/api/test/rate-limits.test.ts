import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '@wakeupbabe/shared';
import { createApp } from '../src/app';
import { hmacSign } from '../src/lib/crypto';
import { seedUser, testDb } from './helpers';

async function sessionCookie(userId: string): Promise<string> {
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

  it('oauth callbacks are capped per ip, but only past the state check', async () => {
    const app = createApp();
    const ip = `test-ip-${crypto.randomUUID()}`;
    const validState = async () => {
      const body = btoa(JSON.stringify({ nonce: crypto.randomUUID(), expiresAt: Date.now() + 60_000 }));
      return `${body}.${await hmacSign(body, env.SESSION_SECRET)}`;
    };
    const attempt = (state: string) =>
      app.request(
        new Request(`https://api.test/auth/callback?code=junk&state=${encodeURIComponent(state)}`, {
          headers: { 'CF-Connecting-IP': ip },
        }),
        undefined,
        env,
      );

    // garbage fails fast and burns nothing: a shared (cgnat) ip full of junk
    // must not lock out the neighbor actually completing oauth
    for (let n = 0; n < 15; n++) expect((await attempt('junk')).status).toBe(400);

    // valid-state requests are the ones that can reach google, so they are
    // the ones that spend slots. What matters is that they are not refused,
    // whatever the callback does with a junk code today
    for (let n = 0; n < 10; n++) expect((await attempt(await validState())).status).not.toBe(429);
    expect((await attempt(await validState())).status).toBe(429);
  });

  it('calendar disconnects are capped per user', async () => {
    const db = testDb();
    const user = await seedUser(db);
    const app = createApp();

    const attempt = async () =>
      app.request(
        new Request('https://api.test/me/calendar/disconnect', {
          method: 'POST',
          headers: { cookie: await sessionCookie(user.id) },
        }),
        undefined,
        env,
      );

    // no token on file, so each is a cheap idempotent 200; slots spend anyway
    for (let n = 0; n < 5; n++) expect((await attempt()).status).toBe(200);
    expect((await attempt()).status).toBe(429);
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
