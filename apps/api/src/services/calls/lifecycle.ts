import type { CallRepo, CallRow } from '../../repos/calls';
import type { EventRepo } from '../../repos/events';
import type { UserRepo } from '../../repos/users';
import type { Analytics } from '../analytics';
import type { EmailNotifier } from '../email/notifier';
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
    private readonly notifier: EmailNotifier | null = null,
    private readonly analytics: Analytics | null = null,
  ) {}

  async onAnswered(call: CallRow): Promise<void> {
    await this.calls.markAnswered(call.id);
  }

  async onDigit(call: CallRow, digit: string): Promise<'ack' | 'snooze' | 'noop'> {
    if (call.isTest) {
      if (digit === '1') {
        await this.calls.finish(call.id, 'answered_ack');
        await this.users.markDndVerified(call.userId);
        // the make-or-break funnel's final gate: DND pierced, account armed
        await this.analytics?.capture(call.userId, 'dnd verified');
        return 'ack';
      }
      return 'noop';
    }

    if (!call.eventId) return 'noop';

    if (digit === '1') {
      await this.calls.finish(call.id, 'answered_ack');
      await this.events.setState(call.eventId, 'acknowledged');
      await this.analytics?.capture(call.userId, 'call acknowledged', { attempt: call.attempt });
      return 'ack';
    }
    if (digit === '2') {
      await this.calls.finish(call.id, 'answered_snooze');
      await this.events.setState(call.eventId, 'snoozed', Date.now() + SNOOZE_DELAY_MS);
      await this.analytics?.capture(call.userId, 'call snoozed', { attempt: call.attempt });
      return 'snooze';
    }
    return 'noop';
  }

  async onHangup(call: CallRow): Promise<void> {
    const current = await this.calls.findById(call.id);
    if (current?.outcome !== 'pending') return;

    if (current.answeredAt) {
      // they picked up and heard the briefing but pressed nothing: job done
      await this.calls.finish(call.id, 'answered_no_input');
      if (current.eventId) await this.events.setState(current.eventId, 'acknowledged');
      await this.analytics?.capture(call.userId, 'call acknowledged', {
        attempt: call.attempt,
        silent: true,
      });
      return;
    }

    await this.calls.finish(call.id, 'no_answer');
    if (current.isTest || !current.eventId) return;

    if (current.attempt < MAX_ATTEMPTS) {
      await this.events.setState(current.eventId, 'scheduled', Date.now() + RETRY_DELAY_MS);
    } else {
      await this.events.setState(current.eventId, 'missed');
      await this.analytics?.capture(call.userId, 'call missed', { attempts: current.attempt });
      // both attempts rang out: the phone has said all it can, email takes over
      const [user, event] = await Promise.all([
        this.users.findById(current.userId),
        this.events.findById(current.eventId),
      ]);
      if (user && event) await this.notifier?.missedCall(user, event, 'no_answer');
    }
  }
}
