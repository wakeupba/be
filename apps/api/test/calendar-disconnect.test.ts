import { env } from 'cloudflare:test';
import { hmacSign, SESSION_COOKIE } from '@wakeupbabe/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { encryptSecret } from '../src/lib/crypto';
import { EventRepo } from '../src/repos/events';
import { TokenRepo } from '../src/repos/tokens';
import { seedEvent, seedUser, testDb } from './helpers';

async function sessionCookie(userId: string): Promise<string> {
  const body = btoa(JSON.stringify({ userId, expiresAt: Date.now() + 60_000 }));
  return `${SESSION_COOKIE}=${body}.${await hmacSign(body, env.SESSION_SECRET)}`;
}

describe('calendar disconnect', () => {
  it('deletes credentials, cancels scheduled calls, and reports disconnected', async () => {
    const db = testDb();
    const tokens = new TokenRepo(db);
    const events = new EventRepo(db);
    const user = await seedUser(db);
    await tokens.upsertRefreshToken(user.id, await encryptSecret('refresh', env.TOKEN_ENC_KEY));
    const scheduled = await seedEvent(db, user.id, { state: 'scheduled' });
    const acknowledged = await seedEvent(db, user.id, { state: 'acknowledged' });
    const cookie = await sessionCookie(user.id);
    const app = createApp();

    const me = (await (
      await app.request(new Request('https://api.test/me', { headers: { cookie } }), undefined, env)
    ).json()) as { calendarConnected: boolean };
    expect(me.calendarConnected).toBe(true);

    const response = await app.request(
      new Request('https://api.test/me/calendar/disconnect', { method: 'POST', headers: { cookie } }),
      undefined,
      env,
    );
    expect(response.status).toBe(200);

    expect(await tokens.find(user.id)).toBeNull();
    expect((await events.findById(scheduled.id))?.state).toBe('cancelled');
    // history stays history: finished events are not rewritten
    expect((await events.findById(acknowledged.id))?.state).toBe('acknowledged');

    const after = (await (
      await app.request(new Request('https://api.test/me', { headers: { cookie } }), undefined, env)
    ).json()) as { calendarConnected: boolean };
    expect(after.calendarConnected).toBe(false);
  });

  it('is idempotent when already disconnected', async () => {
    const db = testDb();
    const user = await seedUser(db);
    const cookie = await sessionCookie(user.id);
    const app = createApp();

    const response = await app.request(
      new Request('https://api.test/me/calendar/disconnect', { method: 'POST', headers: { cookie } }),
      undefined,
      env,
    );
    expect(response.status).toBe(200);
  });
});
