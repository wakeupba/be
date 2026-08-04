import { describe, expect, it } from 'vitest';
import { encryptSecret } from '../src/lib/crypto';
import { CallRepo } from '../src/repos/calls';
import { EventRepo, LATE_GRACE_MS } from '../src/repos/events';
import { TokenRepo } from '../src/repos/tokens';
import { UserRepo } from '../src/repos/users';
import { WebhookEventRepo } from '../src/repos/webhook-events';
import { GoogleAuthRevokedError, type GoogleClient } from '../src/services/calendar/google-client';
import { CalendarSyncService } from '../src/services/calendar/sync';
import { CallDispatchService } from '../src/services/calls/dispatcher';
import { CallLifecycleService } from '../src/services/calls/lifecycle';
import { EmailNotifier } from '../src/services/email/notifier';
import type { EmailService, MissedCallEmail, UpcomingMeeting } from '../src/services/email/service';
import type { PlaceCallInput, TelephonyProvider } from '../src/services/telephony/provider';
import { seedCall, seedEvent, seedUser, testDb } from './helpers';

const ENC_KEY = 'dGVzdC1rZXktbXVzdC1iZS0zMi1ieXRlcy1sb25nISE';

class FakeEmail implements EmailService {
  missed: MissedCallEmail[] = [];
  outOf: Array<{ to: string; upcoming: UpcomingMeeting[] }> = [];
  unverified: string[] = [];
  broken: string[] = [];

  async missedCall(input: MissedCallEmail) {
    this.missed.push(input);
  }
  async outOfCalls(to: string, upcoming: UpcomingMeeting[]) {
    this.outOf.push({ to, upcoming });
  }
  async numberUnverified(to: string) {
    this.unverified.push(to);
  }
  async calendarBroken(to: string) {
    this.broken.push(to);
  }
}

class FakeProvider implements TelephonyProvider {
  readonly name = 'fake';
  placed: PlaceCallInput[] = [];
  async placeCall(input: PlaceCallInput) {
    this.placed.push(input);
    return { providerCallId: `fake_${this.placed.length}` };
  }
  async verifyWebhook() {
    return true;
  }
}

function build() {
  const db = testDb();
  const users = new UserRepo(db);
  const events = new EventRepo(db);
  const calls = new CallRepo(db);
  const email = new FakeEmail();
  const notifier = new EmailNotifier(email, new WebhookEventRepo(db));
  const dispatcher = new CallDispatchService(
    users,
    events,
    calls,
    new FakeProvider(),
    { apiOrigin: 'https://api.test', fromNumber: '+15550000000', urlSigningSecret: 'test-secret' },
    notifier,
  );
  const lifecycle = new CallLifecycleService(calls, events, users, notifier);
  return { db, users, events, calls, email, notifier, dispatcher, lifecycle };
}

describe('transactional emails', () => {
  it('quota exhaustion at dispatch emails the missed meeting with the honest reason', async () => {
    const { db, email, dispatcher } = build();
    const user = await seedUser(db, { callsUsedThisPeriod: 5, extraCallCredits: 0 });
    await seedEvent(db, user.id, { callAt: Date.now() - 1000, title: 'Standup' });

    await dispatcher.dispatchDue(Date.now());

    expect(email.missed).toHaveLength(1);
    expect(email.missed[0]?.reason).toBe('out_of_calls');
    expect(email.missed[0]?.eventTitle).toBe('Standup');
    expect(email.missed[0]?.to).toBe(user.email);
  });

  it('spending the last call warns once about the flagged meetings ahead', async () => {
    const { db, email, dispatcher } = build();
    // free plan, 4 of 5 used: the next dispatch spends the last one
    const user = await seedUser(db, { callsUsedThisPeriod: 4 });
    await seedEvent(db, user.id, { callAt: Date.now() - 1000, title: 'Now' });
    const future = Date.now() + 3 * 60 * 60_000;
    await seedEvent(db, user.id, {
      googleEventId: 'gev_future',
      title: 'Board meeting',
      startsAt: future,
      callAt: future - 15 * 60_000,
    });

    await dispatcher.dispatchDue(Date.now());
    expect(email.outOf).toHaveLength(1);
    expect(email.outOf[0]?.upcoming.map((m) => m.title)).toEqual(['Board meeting']);

    // the dedup holds across ticks within the same period
    await dispatcher.dispatchDue(Date.now());
    expect(email.outOf).toHaveLength(1);
  });

  it('sweeping an unverified user says the truth instead of pretending we called', async () => {
    const { db, email, dispatcher } = build();
    const unverified = await seedUser(db, { dndVerifiedAt: null });
    const verified = await seedUser(db);
    const past = Date.now() - LATE_GRACE_MS - 60_000;
    await seedEvent(db, unverified.id, { startsAt: past, callAt: past - 900_000 });
    await seedEvent(db, verified.id, {
      googleEventId: 'gev_v',
      startsAt: past,
      callAt: past - 900_000,
      title: 'Skipped',
    });

    await dispatcher.dispatchDue(Date.now());

    expect(email.unverified).toEqual([unverified.email]);
    expect(email.missed).toHaveLength(1);
    expect(email.missed[0]?.reason).toBe('failed');
    expect(email.missed[0]?.to).toBe(verified.email);
  });

  it('the final unanswered attempt emails the miss', async () => {
    const { db, email, lifecycle } = build();
    const user = await seedUser(db);
    const event = await seedEvent(db, user.id, { state: 'calling', title: 'One on one' });
    const call = await seedCall(db, user.id, { eventId: event.id, attempt: 2, outcome: 'pending' });

    await lifecycle.onHangup(call);

    expect(email.missed).toHaveLength(1);
    expect(email.missed[0]?.reason).toBe('no_answer');
    expect(email.missed[0]?.eventTitle).toBe('One on one');
  });

  it('a swept event we actually dialed says we called, not that placement failed', async () => {
    const { db, email, dispatcher } = build();
    const user = await seedUser(db);
    const past = Date.now() - LATE_GRACE_MS - 60_000;
    // a snooze chain that ran past the grace window: one real attempt exists
    const event = await seedEvent(db, user.id, {
      state: 'snoozed',
      startsAt: past,
      callAt: past - 900_000,
      title: 'Snoozed away',
    });
    await seedCall(db, user.id, { eventId: event.id, attempt: 1, outcome: 'answered_snooze' });

    await dispatcher.dispatchDue(Date.now());

    expect(email.missed).toHaveLength(1);
    expect(email.missed[0]?.reason).toBe('no_answer');
  });

  it('a throwing email subsystem never blocks call dispatch', async () => {
    const { db, email, dispatcher } = build();
    for (const key of ['missedCall', 'outOfCalls', 'numberUnverified', 'calendarBroken'] as const) {
      email[key] = async () => {
        throw new Error('email infra is down');
      };
    }
    const user = await seedUser(db);
    const past = Date.now() - LATE_GRACE_MS - 60_000;
    // one event to sweep (email throws) and one due call that must still ring
    await seedEvent(db, user.id, { startsAt: past, callAt: past - 900_000 });
    await seedEvent(db, user.id, { googleEventId: 'gev_due', callAt: Date.now() - 1000 });

    await dispatcher.dispatchDue(Date.now());

    const placed = await new CallRepo(db).listHistoryForUser(user.id);
    expect(placed).toHaveLength(1);
  });

  it('a revoked google grant emails once, not once per sync tick', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const tokens = new TokenRepo(db);
    const email = new FakeEmail();
    const notifier = new EmailNotifier(email, new WebhookEventRepo(db));
    const user = await seedUser(db);
    await tokens.upsertRefreshToken(user.id, await encryptSecret('refresh-token', ENC_KEY));
    const revokedGoogle = {
      refreshAccessToken: async () => {
        throw new GoogleAuthRevokedError('google grant revoked: 400 {"error":"invalid_grant"}');
      },
    } as unknown as GoogleClient;
    const sync = new CalendarSyncService(revokedGoogle, users, tokens, new EventRepo(db), ENC_KEY, notifier);

    await sync.syncAllUsers();
    await sync.syncAllUsers();

    expect(email.broken).toEqual([user.email]);
  });
});
