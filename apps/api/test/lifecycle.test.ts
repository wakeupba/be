import { describe, expect, it } from 'vitest';
import { CallRepo } from '../src/repos/calls';
import { EventRepo } from '../src/repos/events';
import { UserRepo } from '../src/repos/users';
import { MAX_ATTEMPTS, RETRY_DELAY_MS, SNOOZE_DELAY_MS } from '../src/services/calls/dispatcher';
import { CallLifecycleService } from '../src/services/calls/lifecycle';
import { seedCall, seedEvent, seedUser, testDb } from './helpers';

function build() {
  const db = testDb();
  const users = new UserRepo(db);
  const events = new EventRepo(db);
  const calls = new CallRepo(db);
  return { db, users, events, calls, lifecycle: new CallLifecycleService(calls, events, users) };
}

describe('call lifecycle state machine', () => {
  it('digit 1 acknowledges the call and the event', async () => {
    const { db, calls, events, lifecycle } = build();
    const user = await seedUser(db);
    const event = await seedEvent(db, user.id, { state: 'calling' });
    const call = await seedCall(db, user.id, { eventId: event.id });

    expect(await lifecycle.onDigit(call, '1')).toBe('ack');
    expect((await calls.findById(call.id))?.outcome).toBe('answered_ack');
    expect((await events.findById(event.id))?.state).toBe('acknowledged');
  });

  it('digit 2 snoozes: ring again in five minutes', async () => {
    const { db, calls, events, lifecycle } = build();
    const user = await seedUser(db);
    const event = await seedEvent(db, user.id, { state: 'calling' });
    const call = await seedCall(db, user.id, { eventId: event.id });

    const before = Date.now();
    expect(await lifecycle.onDigit(call, '2')).toBe('snooze');

    const updated = await events.findById(event.id);
    expect(updated?.state).toBe('snoozed');
    expect(updated?.callAt).toBeGreaterThanOrEqual(before + SNOOZE_DELAY_MS);
    expect(updated?.callAt).toBeLessThan(before + SNOOZE_DELAY_MS + 5_000);
    expect((await calls.findById(call.id))?.outcome).toBe('answered_snooze');
  });

  it('other digits are a noop', async () => {
    const { db, calls, lifecycle } = build();
    const user = await seedUser(db);
    const event = await seedEvent(db, user.id, { state: 'calling' });
    const call = await seedCall(db, user.id, { eventId: event.id });

    expect(await lifecycle.onDigit(call, '7')).toBe('noop');
    expect((await calls.findById(call.id))?.outcome).toBe('pending');
  });

  it('answered but no keypress counts as acknowledged on hangup', async () => {
    const { db, calls, events, lifecycle } = build();
    const user = await seedUser(db);
    const event = await seedEvent(db, user.id, { state: 'calling' });
    const call = await seedCall(db, user.id, { eventId: event.id });
    await calls.markAnswered(call.id);

    await lifecycle.onHangup(call);
    expect((await calls.findById(call.id))?.outcome).toBe('answered_no_input');
    expect((await events.findById(event.id))?.state).toBe('acknowledged');
  });

  it('no answer on the first attempt reschedules the retry (the DND bypass)', async () => {
    const { db, calls, events, lifecycle } = build();
    const user = await seedUser(db);
    const event = await seedEvent(db, user.id, { state: 'calling' });
    const call = await seedCall(db, user.id, { eventId: event.id, attempt: 1 });

    const before = Date.now();
    await lifecycle.onHangup(call);

    expect((await calls.findById(call.id))?.outcome).toBe('no_answer');
    const updated = await events.findById(event.id);
    expect(updated?.state).toBe('scheduled');
    expect(updated?.callAt).toBeGreaterThanOrEqual(before + RETRY_DELAY_MS);
  });

  it('no answer with attempts exhausted marks the event missed', async () => {
    const { db, calls, events, lifecycle } = build();
    const user = await seedUser(db);
    const event = await seedEvent(db, user.id, { state: 'calling' });
    const call = await seedCall(db, user.id, { eventId: event.id, attempt: MAX_ATTEMPTS });

    await lifecycle.onHangup(call);
    expect((await events.findById(event.id))?.state).toBe('missed');
  });

  it('hangup after the call already finished is a noop', async () => {
    const { db, calls, events, lifecycle } = build();
    const user = await seedUser(db);
    const event = await seedEvent(db, user.id, { state: 'calling' });
    const call = await seedCall(db, user.id, { eventId: event.id });

    await lifecycle.onDigit(call, '1');
    await lifecycle.onHangup(call);

    expect((await calls.findById(call.id))?.outcome).toBe('answered_ack');
    expect((await events.findById(event.id))?.state).toBe('acknowledged');
  });

  it('digit 1 on a test call verifies DND and never touches events', async () => {
    const { db, users, calls, lifecycle } = build();
    const user = await seedUser(db, { dndVerifiedAt: null });
    const call = await seedCall(db, user.id, { isTest: true });

    expect(await lifecycle.onDigit(call, '1')).toBe('ack');
    expect((await users.findById(user.id))?.dndVerifiedAt).not.toBeNull();
    expect((await calls.findById(call.id))?.outcome).toBe('answered_ack');
  });

  it('unanswered test call never schedules a retry', async () => {
    const { db, calls, lifecycle } = build();
    const user = await seedUser(db, { dndVerifiedAt: null });
    const call = await seedCall(db, user.id, { isTest: true, attempt: 1 });

    await lifecycle.onHangup(call);
    expect((await calls.findById(call.id))?.outcome).toBe('no_answer');
  });
});
