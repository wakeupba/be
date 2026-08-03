import { describe, expect, it } from 'vitest';
import { encryptSecret } from '../src/lib/crypto';
import { EventRepo } from '../src/repos/events';
import { TokenRepo } from '../src/repos/tokens';
import { UserRepo } from '../src/repos/users';
import type { EventsDelta, GoogleClient, GoogleEventItem } from '../src/services/calendar/google-client';
import { CalendarSyncService } from '../src/services/calendar/sync';
import { seedEvent, seedUser, testDb } from './helpers';

const ENC_KEY = 'dGVzdC1rZXktbXVzdC1iZS0zMi1ieXRlcy1sb25nISE'; // base64url("test-key-must-be-32-bytes-long!!")

function fakeGoogle(items: GoogleEventItem[]): GoogleClient {
  return {
    refreshAccessToken: async () => ({ accessToken: 'fresh', expiresInSeconds: 3600 }),
    listEventsDelta: async (): Promise<EventsDelta> => ({ items, nextSyncToken: 'sync_2' }),
  } as unknown as GoogleClient;
}

async function build(items: GoogleEventItem[]) {
  const db = testDb();
  const users = new UserRepo(db);
  const tokens = new TokenRepo(db);
  const events = new EventRepo(db);
  const user = await seedUser(db, { leadMinutes: 15, triggerColorId: '11' });
  await tokens.upsertRefreshToken(user.id, await encryptSecret('refresh-token', ENC_KEY));
  const sync = new CalendarSyncService(fakeGoogle(items), users, tokens, events, ENC_KEY);
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
});
