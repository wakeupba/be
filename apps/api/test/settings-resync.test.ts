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

async function patchSettings(userId: string, patch: Record<string, unknown>): Promise<Response> {
  return createApp().request(
    new Request('https://api.test/me/settings', {
      method: 'PATCH',
      headers: { cookie: await sessionCookie(userId), 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
    undefined,
    env,
  );
}

/*
 * Both settings decide something about meetings already in our table, and
 * neither is a change Google reports: the delta sync returns only what Google
 * thinks changed, so nothing would ever revisit them.
 */
describe('settings changes reach meetings we already track', () => {
  it('a new lead time moves the call time on meetings already flagged', async () => {
    const db = testDb();
    const events = new EventRepo(db);
    const user = await seedUser(db, { leadMinutes: 15 });
    const startsAt = Date.now() + 3 * 60 * 60_000;
    const tracked = await seedEvent(db, user.id, { startsAt, callAt: startsAt - 15 * 60_000 });

    expect((await patchSettings(user.id, { leadMinutes: 30 })).status).toBe(200);

    expect((await events.findById(tracked.id))?.callAt).toBe(startsAt - 30 * 60_000);
  });

  it('leaves a snoozed event alone: its call time came from the snooze, not the lead', async () => {
    const db = testDb();
    const events = new EventRepo(db);
    const user = await seedUser(db, { leadMinutes: 15 });
    const startsAt = Date.now() + 3 * 60 * 60_000;
    // a snooze pushes callAt past the original ring, nowhere near start-minus-lead
    const snoozedCallAt = Date.now() + 5 * 60_000;
    const snoozed = await seedEvent(db, user.id, { startsAt, callAt: snoozedCallAt, state: 'snoozed' });

    expect((await patchSettings(user.id, { leadMinutes: 30 })).status).toBe(200);

    expect((await events.findById(snoozed.id))?.callAt).toBe(snoozedCallAt);
  });

  it('raising the lead time past a meeting does not ring it immediately', async () => {
    const db = testDb();
    const events = new EventRepo(db);
    const user = await seedUser(db, { leadMinutes: 15 });
    // 20 minutes out: start-minus-30 is already ten minutes behind us, and
    // listDue takes callAt <= now, so a rewrite here dials on the next tick
    const startsAt = Date.now() + 20 * 60_000;
    const soon = await seedEvent(db, user.id, { startsAt, callAt: startsAt - 15 * 60_000 });

    expect((await patchSettings(user.id, { leadMinutes: 30 })).status).toBe(200);

    const after = await events.findById(soon.id);
    expect(after?.callAt).toBe(startsAt - 15 * 60_000);
    expect(after?.callAt).toBeGreaterThan(Date.now());
  });

  it('lowering the lead time on a meeting inside the old window still applies', async () => {
    const db = testDb();
    const events = new EventRepo(db);
    const user = await seedUser(db, { leadMinutes: 30 });
    const startsAt = Date.now() + 20 * 60_000;
    const soon = await seedEvent(db, user.id, { startsAt, callAt: startsAt - 30 * 60_000 });

    expect((await patchSettings(user.id, { leadMinutes: 10 })).status).toBe(200);

    // 20 minutes out is beyond the new 10-minute lead, so it moves and lands ahead
    const after = await events.findById(soon.id);
    expect(after?.callAt).toBe(startsAt - 10 * 60_000);
    expect(after?.callAt).toBeGreaterThan(Date.now());
  });

  it('never rewrites a meeting that already happened', async () => {
    const db = testDb();
    const events = new EventRepo(db);
    const user = await seedUser(db, { leadMinutes: 15 });
    const startsAt = Date.now() - 60 * 60_000;
    const past = await seedEvent(db, user.id, { startsAt, callAt: startsAt - 15 * 60_000 });

    expect((await patchSettings(user.id, { leadMinutes: 30 })).status).toBe(200);

    expect((await events.findById(past.id))?.callAt).toBe(startsAt - 15 * 60_000);
  });

  it('re-setting the same lead time touches nothing', async () => {
    const db = testDb();
    const events = new EventRepo(db);
    const user = await seedUser(db, { leadMinutes: 15 });
    const startsAt = Date.now() + 3 * 60 * 60_000;
    const tracked = await seedEvent(db, user.id, { startsAt, callAt: startsAt - 15 * 60_000 });
    const before = (await events.findById(tracked.id))?.updatedAt;

    expect((await patchSettings(user.id, { leadMinutes: 15 })).status).toBe(200);

    expect((await events.findById(tracked.id))?.updatedAt).toBe(before);
  });

  it('a new trigger color drops the sync token so the next pass re-reads every event', async () => {
    const db = testDb();
    const tokens = new TokenRepo(db);
    const user = await seedUser(db, { triggerColorId: '11' });
    await tokens.upsertRefreshToken(user.id, await encryptSecret('refresh', env.TOKEN_ENC_KEY));
    await tokens.saveSyncToken(user.id, 'sync_live');

    expect((await patchSettings(user.id, { triggerColorId: '5' })).status).toBe(200);

    expect((await tokens.find(user.id))?.calendarSyncToken).toBeNull();
  });

  it('a forced resync also clears the cooldown, or the refresh right after it is a no-op', async () => {
    const db = testDb();
    const tokens = new TokenRepo(db);
    const user = await seedUser(db, { triggerColorId: '11' });
    await tokens.upsertRefreshToken(user.id, await encryptSecret('refresh', env.TOKEN_ENC_KEY));
    // a refresh moments ago would otherwise answer the post-change one
    await tokens.tryClaimSync(user.id, Date.now());
    expect((await tokens.find(user.id))?.lastSyncAttemptAt).not.toBeNull();

    expect((await patchSettings(user.id, { triggerColorId: '5' })).status).toBe(200);

    expect((await tokens.find(user.id))?.lastSyncAttemptAt).toBeNull();
  });

  it('re-picking the colour already set keeps the sync token', async () => {
    const db = testDb();
    const tokens = new TokenRepo(db);
    const user = await seedUser(db, { triggerColorId: '11' });
    await tokens.upsertRefreshToken(user.id, await encryptSecret('refresh', env.TOKEN_ENC_KEY));
    await tokens.saveSyncToken(user.id, 'sync_live');

    expect((await patchSettings(user.id, { triggerColorId: '11' })).status).toBe(200);

    // a full resync for a no-op change would be a free 14-day window pull
    expect((await tokens.find(user.id))?.calendarSyncToken).toBe('sync_live');
  });

  it('a lead-time change on someone with no calendar is still just a lead-time change', async () => {
    const db = testDb();
    const events = new EventRepo(db);
    const user = await seedUser(db, { leadMinutes: 10 });
    const startsAt = Date.now() + 2 * 60 * 60_000;
    const tracked = await seedEvent(db, user.id, { startsAt, callAt: startsAt - 10 * 60_000 });

    expect((await patchSettings(user.id, { leadMinutes: 30 })).status).toBe(200);

    expect((await events.findById(tracked.id))?.callAt).toBe(startsAt - 30 * 60_000);
  });
});
