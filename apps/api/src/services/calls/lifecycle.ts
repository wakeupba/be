import type { CallRepo, CallRow } from '../../repos/calls';
import type { EventRepo } from '../../repos/events';
import type { UserRepo } from '../../repos/users';
import { MAX_ATTEMPTS, RETRY_DELAY_MS, SNOOZE_DELAY_MS } from './dispatcher';

/**
 * Reacts to telephony webhooks and drives the event state machine:
 *
 *   scheduled/snoozed -> calling -> acknowledged   (digit 1, or heard but silent)
 *                                -> snoozed        (digit 2, ring again in 5)
 *                                -> scheduled      (no answer, attempt 1: retry in 2,
 *                                                   which is also the DND repeated-call bypass)
 *                                -> missed         (no answer, out of attempts)
 */
export class CallLifecycleService {
  constructor(
    private readonly calls: CallRepo,
    private readonly events: EventRepo,
    private readonly users: UserRepo,
  ) {}

  async onAnswered(call: CallRow): Promise<void> {
    await this.calls.markAnswered(call.id);
  }

  async onDigit(call: CallRow, digit: string): Promise<'ack' | 'snooze' | 'noop'> {
    if (call.is_test === 1) {
      if (digit === '1') {
        await this.calls.finish(call.id, 'answered_ack');
        await this.users.markDndVerified(call.user_id);
        return 'ack';
      }
      return 'noop';
    }

    if (!call.event_id) return 'noop';

    if (digit === '1') {
      await this.calls.finish(call.id, 'answered_ack');
      await this.events.setState(call.event_id, 'acknowledged');
      return 'ack';
    }
    if (digit === '2') {
      await this.calls.finish(call.id, 'answered_snooze');
      await this.events.setState(call.event_id, 'snoozed', Date.now() + SNOOZE_DELAY_MS);
      return 'snooze';
    }
    return 'noop';
  }

  async onHangup(call: CallRow): Promise<void> {
    const current = await this.calls.findById(call.id);
    if (current?.outcome !== 'pending') return;

    if (current.answered_at) {
      // they picked up and heard the briefing but pressed nothing: job done
      await this.calls.finish(call.id, 'answered_no_input');
      if (current.event_id) await this.events.setState(current.event_id, 'acknowledged');
      return;
    }

    await this.calls.finish(call.id, 'no_answer');
    if (current.is_test === 1 || !current.event_id) return;

    if (current.attempt < MAX_ATTEMPTS) {
      await this.events.setState(current.event_id, 'scheduled', Date.now() + RETRY_DELAY_MS);
    } else {
      await this.events.setState(current.event_id, 'missed');
    }
  }
}
