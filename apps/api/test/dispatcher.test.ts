import { describe, expect, it } from 'vitest';
import { CallRepo } from '../src/repos/calls';
import { EventRepo, LATE_GRACE_MS } from '../src/repos/events';
import { UserRepo } from '../src/repos/users';
import { CallDispatchService } from '../src/services/calls/dispatcher';
import type { PlaceCallInput, TelephonyProvider } from '../src/services/telephony/provider';
import { seedEvent, seedUser, testDb } from './helpers';

class FakeProvider implements TelephonyProvider {
  readonly name = 'fake';
  placed: PlaceCallInput[] = [];

  async placeCall(input: PlaceCallInput) {
    this.placed.push(input);
    return { providerCallId: `fake_${this.placed.length}` };
  }

  async verifyWebhook(): Promise<boolean> {
    return true;
  }
}

function build() {
  const db = testDb();
  const users = new UserRepo(db);
  const events = new EventRepo(db);
  const calls = new CallRepo(db);
  const provider = new FakeProvider();
  const dispatcher = new CallDispatchService(users, events, calls, provider, {
    apiOrigin: 'https://api.test',
    fromNumber: '+15550000000',
    urlSigningSecret: 'test-secret',
  });
  return { db, users, events, calls, provider, dispatcher };
}

describe('call dispatcher', () => {
  it('dials a due event, spends quota, and records the attempt', async () => {
    const { db, users, events, calls, provider, dispatcher } = build();
    const user = await seedUser(db);
    const event = await seedEvent(db, user.id, { callAt: Date.now() - 1000 });

    await dispatcher.dispatchDue(Date.now());

    expect(provider.placed).toHaveLength(1);
    expect(provider.placed[0]?.to).toBe(user.phoneE164);
    expect((await events.findById(event.id))?.state).toBe('calling');
    expect((await users.findById(user.id))?.callsUsedThisPeriod).toBe(1);
    const history = await calls.listHistoryForUser(user.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.attempt).toBe(1);
  });

  it('a second cron tick is a no-op: the claim is exclusive', async () => {
    const { db, provider, dispatcher } = build();
    const user = await seedUser(db);
    await seedEvent(db, user.id, { callAt: Date.now() - 1000 });

    await dispatcher.dispatchDue(Date.now());
    await dispatcher.dispatchDue(Date.now());

    expect(provider.placed).toHaveLength(1);
  });

  it('never dials an unverified or phoneless user', async () => {
    const { db, events, provider, dispatcher } = build();
    const unverified = await seedUser(db, { dndVerifiedAt: null });
    const phoneless = await seedUser(db, { phoneE164: null });
    const e1 = await seedEvent(db, unverified.id, { callAt: Date.now() - 1000 });
    const e2 = await seedEvent(db, phoneless.id, { callAt: Date.now() - 1000 });

    await dispatcher.dispatchDue(Date.now());

    expect(provider.placed).toHaveLength(0);
    // the events stay claimable, not silently burned
    expect((await events.findById(e1.id))?.state).toBe('scheduled');
    expect((await events.findById(e2.id))?.state).toBe('scheduled');
  });

  it('out of quota marks the event missed without dialing', async () => {
    const { db, events, provider, dispatcher } = build();
    const user = await seedUser(db, { callsUsedThisPeriod: 5, extraCallCredits: 0 });
    const event = await seedEvent(db, user.id, { callAt: Date.now() - 1000 });

    await dispatcher.dispatchDue(Date.now());

    expect(provider.placed).toHaveLength(0);
    expect((await events.findById(event.id))?.state).toBe('missed');
  });

  it('spends prepaid credits after the allowance runs out', async () => {
    const { db, users, provider, dispatcher } = build();
    const user = await seedUser(db, {
      plan: 'ride_or_die',
      callsUsedThisPeriod: 50,
      extraCallCredits: 2,
    });
    await seedEvent(db, user.id, { callAt: Date.now() - 1000 });

    await dispatcher.dispatchDue(Date.now());

    expect(provider.placed).toHaveLength(1);
    expect((await users.findById(user.id))?.extraCallCredits).toBe(1);
  });

  it('frozen credits on the free plan do not dial: the event goes missed', async () => {
    const { db, users, events, provider, dispatcher } = build();
    // downgraded with a stockpile: credits sit frozen, no free rides
    const user = await seedUser(db, { callsUsedThisPeriod: 5, extraCallCredits: 40 });
    const event = await seedEvent(db, user.id, { callAt: Date.now() - 1000 });

    await dispatcher.dispatchDue(Date.now());

    expect(provider.placed).toHaveLength(0);
    expect((await events.findById(event.id))?.state).toBe('missed');
    expect((await users.findById(user.id))?.extraCallCredits).toBe(40);
  });

  it('resets the monthly period when elapsed', async () => {
    const { db, users, provider, dispatcher } = build();
    const user = await seedUser(db, {
      callsUsedThisPeriod: 5,
      extraCallCredits: 0,
      periodStartedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    });
    await seedEvent(db, user.id, { callAt: Date.now() - 1000 });

    await dispatcher.dispatchDue(Date.now());

    expect(provider.placed).toHaveLength(1);
    expect((await users.findById(user.id))?.callsUsedThisPeriod).toBe(1);
  });

  it('sweeps events long past their start to missed instead of calling late', async () => {
    const { db, events, provider, dispatcher } = build();
    const user = await seedUser(db);
    const start = Date.now() - LATE_GRACE_MS - 60_000;
    const event = await seedEvent(db, user.id, { startsAt: start, callAt: start - 15 * 60_000 });

    await dispatcher.dispatchDue(Date.now());

    expect(provider.placed).toHaveLength(0);
    expect((await events.findById(event.id))?.state).toBe('missed');
  });

  it('numbers follow-up attempts from the prior call', async () => {
    const { db, events, calls, provider, dispatcher } = build();
    const user = await seedUser(db);
    const event = await seedEvent(db, user.id, { callAt: Date.now() - 1000 });

    await dispatcher.dispatchDue(Date.now());
    // simulate the retry path: lifecycle put it back to scheduled
    await events.setState(event.id, 'scheduled', Date.now() - 1);
    await dispatcher.dispatchDue(Date.now());

    expect(provider.placed).toHaveLength(2);
    const history = await calls.listHistoryForUser(user.id);
    expect(history.map((c) => c.attempt).sort()).toEqual([1, 2]);
  });
});
