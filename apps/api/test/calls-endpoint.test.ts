import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { seedCall, seedUser, testDb } from './helpers';

async function sessionCookie(userId: string): Promise<string> {
  const { hmacSign, SESSION_COOKIE } = await import('@wakeupbabe/shared');
  const body = btoa(JSON.stringify({ userId, expiresAt: Date.now() + 60_000 }));
  return `${SESSION_COOKIE}=${body}.${await hmacSign(body, env.SESSION_SECRET)}`;
}

const get = async (path: string, userId: string) =>
  createApp().request(
    new Request(`https://api.test${path}`, { headers: { cookie: await sessionCookie(userId) } }),
    undefined,
    env,
  );

describe('GET /me/calls/:id', () => {
  it('returns the outcome of your own call', async () => {
    const db = testDb();
    const user = await seedUser(db);
    const call = await seedCall(db, user.id, { outcome: 'no_answer' });

    const response = await get(`/me/calls/${call.id}`, user.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: 'no_answer' });
  });

  it("someone else's call is a 404, not a leak", async () => {
    const db = testDb();
    const owner = await seedUser(db);
    const snoop = await seedUser(db);
    const call = await seedCall(db, owner.id, { outcome: 'answered_ack' });

    expect((await get(`/me/calls/${call.id}`, snoop.id)).status).toBe(404);
  });
});
