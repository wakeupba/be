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
    /** where operational mail goes; absent means we only log */
    private readonly ownerEmail: string | null = null,
  ) {}

  /**
   * The demo call budget for this week is gone, so the landing CTA has stopped
   * rendering. Worth an email because the failure is silent by design: visitors
   * see no demo rather than a broken one, and nobody would otherwise notice
   * whether that was demand or abuse.
   *
   * The caller already claimed a per-week key, so there is no dedup here.
   */
  async demoBudgetSpent(budgetUsd: number): Promise<void> {
    if (!this.ownerEmail) return;
    await this.guard('demoBudgetSpent', () =>
      this.email.opsAlert(
        this.ownerEmail as string,
        'Demo calls are out for this week',
        [
          `The landing page demo has spent its $${budgetUsd.toFixed(2)} weekly budget.`,
          'The CTA is now hidden, and no further demo calls will be placed until the window rolls over.',
          '',
          'If this happened faster than expected, check the demo_calls table: per-IP and',
          'per-number caps should have bounded any single visitor, so a fast burn is either',
          'real demand or a lot of distinct addresses.',
        ].join('\n'),
        `demo-budget:${Math.floor(Date.now() / WEEK_MS)}`,
      ),
    );
  }

  /** per event, no dedup: each missed meeting is a distinct failure */
  async missedCall(user: UserRow, event: UpcomingMeeting, reason: MissedReason): Promise<void> {
    await this.guard('missedCall', () =>
      this.email.missedCall({
        to: user.email,
        eventId: event.id,
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
      // the dedup claim doubles as the transport idempotency key
      const key = `email:lastcall:${user.id}:${user.periodStartedAt}`;
      if (!(await this.dedup.claim(key, 'email-dedup'))) return;
      await this.email.outOfCalls(user.email, upcoming, user.timezone, key);
    });
  }

  /** once a week while the state persists */
  async numberUnverified(user: UserRow): Promise<void> {
    await this.guard('numberUnverified', async () => {
      const key = this.weeklyKey(`email:unverified:${user.id}`);
      if (!(await this.dedup.claim(key, 'email-dedup'))) return;
      await this.email.numberUnverified(user.email, key);
    });
  }

  /** once a week while the state persists */
  async calendarBroken(user: UserRow): Promise<void> {
    await this.guard('calendarBroken', async () => {
      const key = this.weeklyKey(`email:calbroken:${user.id}`);
      if (!(await this.dedup.claim(key, 'email-dedup'))) return;
      await this.email.calendarBroken(user.email, key);
    });
  }

  private weeklyKey(prefix: string): string {
    return `${prefix}:${Math.floor(Date.now() / WEEK_MS)}`;
  }

  private async guard(kind: string, send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (error) {
      logEvent('error', 'email.notify_failed', { kind, ...errorFields(error) });
    }
  }
}
