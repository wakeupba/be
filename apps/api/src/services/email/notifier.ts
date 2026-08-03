import { errorFields, logEvent } from '../../lib/log';
import type { UserRow } from '../../repos/users';
import type { WebhookEventRepo } from '../../repos/webhook-events';
import type { EmailService, MissedReason, UpcomingMeeting } from './service';

const WEEK_MS = 7 * 24 * 60 * 60_000;

/**
 * Send policy over the email transport: what fires once, what repeats, and
 * on which cadence. Dedup rides the claims table (one row per suppressed
 * repeat, pruned by the cron sweep after 30 days).
 *
 * The no-crash guarantee lives HERE, not just in the transport: dedup is
 * DB I/O and every caller is a call or sync flow that must survive an
 * email subsystem failure. Nothing a notifier method does may throw.
 */
export class EmailNotifier {
  constructor(
    private readonly email: EmailService,
    private readonly dedup: WebhookEventRepo,
  ) {}

  /** per event, no dedup: each missed meeting is a distinct failure */
  async missedCall(user: UserRow, event: UpcomingMeeting, reason: MissedReason): Promise<void> {
    await this.guard('missedCall', () =>
      this.email.missedCall({
        to: user.email,
        eventTitle: event.title,
        startsAt: event.startsAt,
        timezone: user.timezone,
        reason,
      }),
    );
  }

  /** once per billing period: the period start pins the claim key */
  async lastCallSpent(user: UserRow, upcoming: UpcomingMeeting[]): Promise<void> {
    await this.guard('lastCallSpent', async () => {
      if (!(await this.dedup.claim(`email:lastcall:${user.id}:${user.periodStartedAt}`, 'email-dedup'))) {
        return;
      }
      await this.email.outOfCalls(user.email, upcoming, user.timezone);
    });
  }

  /** once a week while the state persists */
  async numberUnverified(user: UserRow): Promise<void> {
    await this.guard('numberUnverified', async () => {
      if (!(await this.claimWeekly(`email:unverified:${user.id}`))) return;
      await this.email.numberUnverified(user.email);
    });
  }

  /** once a week while the state persists */
  async calendarBroken(user: UserRow): Promise<void> {
    await this.guard('calendarBroken', async () => {
      if (!(await this.claimWeekly(`email:calbroken:${user.id}`))) return;
      await this.email.calendarBroken(user.email);
    });
  }

  private claimWeekly(key: string): Promise<boolean> {
    return this.dedup.claim(`${key}:${Math.floor(Date.now() / WEEK_MS)}`, 'email-dedup');
  }

  private async guard(kind: string, send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (error) {
      logEvent('error', 'email.notify_failed', { kind, ...errorFields(error) });
    }
  }
}
