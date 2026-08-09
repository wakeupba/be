import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from '../src/lib/crypto';
import { EventRepo } from '../src/repos/events';
import { TokenRepo } from '../src/repos/tokens';
import { UserRepo } from '../src/repos/users';
import {
  type EventsDelta,
  type GoogleClient,
  type GoogleEventItem,
  GoogleUnauthorizedError,
} from '../src/services/calendar/google-client';
import { CalendarSyncService, ON_DEMAND_COOLDOWN_MS } from '../src/services/calendar/sync';
import { seedEvent, seedUser, testDb } from './helpers';

const ENC_KEY = 'dGVzdC1rZXktbXVzdC1iZS0zMi1ieXRlcy1sb25nISE'; // base64url("test-key-must-be-32-bytes-long!!")

/** onList runs on every events.list; throw from it to fake Google failing */
function fakeGoogle(items: GoogleEventItem[], onList?: () => void): GoogleClient {
  return {
    refreshAccessToken: async () => ({ accessToken: 'fresh', expiresInSeconds: 3600 }),
    listEventsDelta: async (): Promise<EventsDelta> => {
      onList?.();
      return { items, nextSyncToken: 'sync_2' };
    },
  } as unknown as GoogleClient;
}

async function build(items: GoogleEventItem[], onList?: () => void) {
  const db = testDb();
  const users = new UserRepo(db);
  const tokens = new TokenRepo(db);
  const events = new EventRepo(db);
  const user = await seedUser(db, { leadMinutes: 15, triggerColorId: '11' });
  await tokens.upsertRefreshToken(user.id, await encryptSecret('refresh-token', ENC_KEY));
  const sync = new CalendarSyncService(fakeGoogle(items, onList), users, tokens, events, ENC_KEY);
  return { db, user, users, tokens, events, sync };
}

function timedEvent(overrides: Partial<GoogleEventItem> = {}): GoogleEventItem {
  return {
    id: 'gev_test',
    status: 'confirmed',
    summary: 'Design review',
    colorId: '11',
    start: { dateTime: new Date(Date.now() + 60 * 60_000).toISOString(), timeZone: 'UTC' },
    attendees: [],
    ...overrides,
  } as GoogleEventItem;
}

describe('calendar sync', () => {
  it('tracks a flagged timed event with callAt = start minus lead time', async () => {
    const startsAtIso = new Date(Date.now() + 60 * 60_000).toISOString();
    const { user, events, sync } = await build([timedEvent({ start: { dateTime: startsAtIso } })]);

    await sync.syncUser(user);

    const [tracked] = await events.listUpcomingForUser(user.id, Date.now());
    expect(tracked).toBeDefined();
    expect(tracked?.title).toBe('Design review');
    expect(tracked?.callAt).toBe(Date.parse(startsAtIso) - 15 * 60_000);
    expect(tracked?.state).toBe('scheduled');
  });

  it('lead-time math is timezone-proof: offsets and DST fall out of UTC parsing', async () => {
    // the US spring-forward morning: 02:30 US/Pacific does not exist; Google
    // sends the offset form. 03:00-07:00 == 10:00Z regardless of DST.
    const { user, events, sync } = await build([
      timedEvent({ start: { dateTime: '2027-03-14T03:00:00-07:00', timeZone: 'America/Los_Angeles' } }),
    ]);

    await sync.syncUser(user);

    const [tracked] = await events.listUpcomingForUser(user.id, Date.now());
    expect(tracked?.startsAt).toBe(Date.parse('2027-03-14T10:00:00Z'));
    expect(tracked?.callAt).toBe(Date.parse('2027-03-14T09:45:00Z'));
    expect(tracked?.eventTimezone).toBe('America/Los_Angeles');
  });

  it('never tracks all-day events: there is no moment to be late for', async () => {
    const { user, events, sync } = await build([
      timedEvent({ start: { date: '2026-08-01' } as GoogleEventItem['start'] }),
    ]);

    await sync.syncUser(user);
    expect(await events.listUpcomingForUser(user.id, Date.now())).toHaveLength(0);
  });

  it('never tracks events the user declined', async () => {
    const { user, events, sync } = await build([
      timedEvent({ attendees: [{ self: true, responseStatus: 'declined' }] }),
    ]);

    await sync.syncUser(user);
    expect(await events.listUpcomingForUser(user.id, Date.now())).toHaveLength(0);
  });

  it('ignores events painted a non-trigger color', async () => {
    const { user, events, sync } = await build([timedEvent({ colorId: '5' })]);

    await sync.syncUser(user);
    expect(await events.listUpcomingForUser(user.id, Date.now())).toHaveLength(0);
  });

  it('cancels a tracked event when the color is removed', async () => {
    const { db, user, events, sync } = await build([timedEvent({ colorId: undefined })]);
    const tracked = await seedEvent(db, user.id, { googleEventId: 'gev_test' });

    await sync.syncUser(user);
    expect((await events.findById(tracked.id))?.state).toBe('cancelled');
  });

  it('cancels a tracked event when Google reports it cancelled', async () => {
    const { db, user, events, sync } = await build([
      { id: 'gev_test', status: 'cancelled' } as GoogleEventItem,
    ]);
    const tracked = await seedEvent(db, user.id, { googleEventId: 'gev_test' });

    await sync.syncUser(user);
    expect((await events.findById(tracked.id))?.state).toBe('cancelled');
  });

  it('a reschedule moves callAt and revives a snoozed event', async () => {
    const newStartIso = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    const { db, user, events, sync } = await build([timedEvent({ start: { dateTime: newStartIso } })]);
    const tracked = await seedEvent(db, user.id, { googleEventId: 'gev_test', state: 'snoozed' });

    await sync.syncUser(user);

    const updated = await events.findById(tracked.id);
    expect(updated?.startsAt).toBe(Date.parse(newStartIso));
    expect(updated?.callAt).toBe(Date.parse(newStartIso) - 15 * 60_000);
    expect(updated?.state).toBe('scheduled');
  });

  it('an edit never resurrects an already-acknowledged event', async () => {
    const { db, user, events, sync } = await build([timedEvent()]);
    const tracked = await seedEvent(db, user.id, { googleEventId: 'gev_test', state: 'acknowledged' });

    await sync.syncUser(user);
    expect((await events.findById(tracked.id))?.state).toBe('acknowledged');
  });

  it('ignores events that already started', async () => {
    const { user, events, sync } = await build([
      timedEvent({ start: { dateTime: new Date(Date.now() - 60_000).toISOString() } }),
    ]);

    await sync.syncUser(user);
    expect(await events.listUpcomingForUser(user.id, Date.now())).toHaveLength(0);
  });

  it('stores the fresh sync token after a pass', async () => {
    const { user, tokens, sync } = await build([]);
    await sync.syncUser(user);
    expect((await tokens.find(user.id))?.calendarSyncToken).toBe('sync_2');
  });

  it('leaves the stored token alone when nothing changed', async () => {
    const { user, tokens, sync } = await build([]);
    await sync.syncUser(user);
    const firstWrite = (await tokens.find(user.id))?.updatedAt;

    await sync.syncUser(user); // same token back from google
    expect((await tokens.find(user.id))?.updatedAt).toBe(firstWrite);
  });

  it('syncs every user when the pass is larger than the concurrency pool', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const tokens = new TokenRepo(db);
    const events = new EventRepo(db);
    let googleCalls = 0;
    const sync = new CalendarSyncService(
      fakeGoogle([], () => {
        googleCalls++;
      }),
      users,
      tokens,
      events,
      ENC_KEY,
    );
    // more users than workers: the shared queue has to drain, not truncate
    for (let i = 0; i < 25; i++) {
      const seeded = await seedUser(db);
      await tokens.upsertRefreshToken(seeded.id, await encryptSecret('refresh-token', ENC_KEY));
    }
    // the file shares one d1, so earlier tests' users are in the pass too
    const connected = (await users.listWithConnectedCalendar()).length;
    expect(connected).toBeGreaterThanOrEqual(25);

    await sync.syncAllUsers();
    expect(googleCalls).toBe(connected);
  });
});

describe('on-demand calendar sync', () => {
  it('brings a just-flagged meeting in without waiting for the cron', async () => {
    const { user, events, sync } = await build([timedEvent()]);

    expect((await sync.syncOnDemand(user)).status).toBe('synced');
    expect(await events.listUpcomingForUser(user.id, Date.now())).toHaveLength(1);
  });

  it('a second refresh inside the cooldown never reaches google', async () => {
    let googleCalls = 0;
    const { user, sync } = await build([timedEvent()], () => {
      googleCalls++;
    });

    expect((await sync.syncOnDemand(user)).status).toBe('synced');
    expect((await sync.syncOnDemand(user)).status).toBe('cooling_down');
    expect(googleCalls).toBe(1);
  });

  it('a failed refresh still burns the cooldown: a dead grant must not become a google flood', async () => {
    let googleCalls = 0;
    const { user, sync } = await build([], () => {
      googleCalls++;
      throw new Error('google said no');
    });

    expect((await sync.syncOnDemand(user)).status).toBe('failed');
    expect((await sync.syncOnDemand(user)).status).toBe('cooling_down');
    expect(googleCalls).toBe(1);
  });

  it('reports when the next refresh is allowed so the ui can say "checked just now"', async () => {
    const { user, sync } = await build([]);

    const first = await sync.syncOnDemand(user);
    const second = await sync.syncOnDemand(user);
    // the cooling-down answer carries the original attempt, not this moment
    expect(second.lastAttemptAt).toBe(first.lastAttemptAt);
  });

  it('the cron is never turned away by a live cooldown', async () => {
    const { user, tokens, events, sync } = await build([timedEvent()]);

    await sync.syncOnDemand(user); // takes the slot
    const claimedAt = (await tokens.find(user.id))?.lastSyncAttemptAt ?? 0;
    await events.cancelAllActiveForUser(user.id); // pretend our copy went stale

    await sync.syncAllUsers();

    // the cooldown was still live, and the cron synced straight through it
    expect(Date.now() - claimedAt).toBeLessThan(ON_DEMAND_COOLDOWN_MS);
    expect(await events.listUpcomingForUser(user.id, Date.now())).toHaveLength(1);
  });
});

/*
 * The failure that shipped: Google invalidates an access token before the
 * expiry it quoted, the cache only checks the clock, and every sync 401s until
 * that clock catches up. Silent, because a 401 is not GoogleInvalidGrantError
 * and so never reached the calendar-broken email.
 */
describe('a rejected access token heals itself', () => {
  /** 401s on the first list, succeeds afterwards, and counts both calls */
  function unauthorizedOnce(items: GoogleEventItem[]) {
    const calls = { refresh: 0, list: 0 };
    const google = {
      refreshAccessToken: async () => {
        calls.refresh++;
        return { accessToken: 'minted', expiresInSeconds: 3600 };
      },
      listEventsDelta: async (accessToken: string): Promise<EventsDelta> => {
        calls.list++;
        if (accessToken !== 'minted') throw new GoogleUnauthorizedError('rejected');
        return { items, nextSyncToken: 'sync_2', resynced: false };
      },
    } as unknown as GoogleClient;
    return { google, calls };
  }

  async function buildWithCachedToken(items: GoogleEventItem[]) {
    const db = testDb();
    const users = new UserRepo(db);
    const tokens = new TokenRepo(db);
    const events = new EventRepo(db);
    const user = await seedUser(db, { leadMinutes: 15, triggerColorId: '11' });
    await tokens.upsertRefreshToken(user.id, await encryptSecret('refresh-token', ENC_KEY));
    // a token the clock still believes in, which Google has already binned
    await tokens.cacheAccessToken(
      user.id,
      await encryptSecret('stale', ENC_KEY),
      Date.now() + 30 * 60_000,
    );
    const { google, calls } = unauthorizedOnce(items);
    const sync = new CalendarSyncService(google, users, tokens, events, ENC_KEY);
    return { user, tokens, events, sync, calls };
  }

  it('mints a new token and retries, instead of failing for the hour the cache had left', async () => {
    const { user, events, sync, calls } = await buildWithCachedToken([timedEvent()]);

    await sync.syncUser(user);

    expect(calls.refresh).toBe(1); // exactly one, not a spin
    expect(calls.list).toBe(2); // the refusal, then the retry
    expect(await events.listUpcomingForUser(user.id, Date.now())).toHaveLength(1);
  });

  it('re-consent drops the credentials derived from the grant it replaces', async () => {
    const db = testDb();
    const tokens = new TokenRepo(db);
    const user = await seedUser(db);
    await tokens.upsertRefreshToken(user.id, await encryptSecret('old-refresh', ENC_KEY));
    await tokens.cacheAccessToken(
      user.id,
      await encryptSecret('old-access', ENC_KEY),
      Date.now() + 30 * 60_000,
    );
    await tokens.saveSyncToken(user.id, 'sync_from_old_grant');

    // the user revoked us, then reconnected: this is that second step
    await tokens.upsertRefreshToken(user.id, await encryptSecret('new-refresh', ENC_KEY));

    const row = await tokens.find(user.id);
    expect(row?.accessTokenEnc).toBeNull();
    expect(row?.accessTokenExpiresAt).toBeNull();
    expect(row?.calendarSyncToken).toBeNull();
    expect(await decryptSecret(row?.refreshTokenEnc ?? '', ENC_KEY)).toBe('new-refresh');
  });
});
