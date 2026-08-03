import * as Sentry from '@sentry/cloudflare';
import { creditsUsable, PLAN_LIMITS } from '@wakeupbabe/shared';
import { hmacSign } from '../../lib/crypto';
import { errorFields, logEvent } from '../../lib/log';
import type { CallRepo } from '../../repos/calls';
import type { EventRepo } from '../../repos/events';
import type { UserRepo, UserRow } from '../../repos/users';
import type { EmailNotifier } from '../email/notifier';
import type { TelephonyProvider } from '../telephony/provider';

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const RING_TIMEOUT_SECONDS = 25;
const DISPATCH_BATCH_SIZE = 20;
export const MAX_ATTEMPTS = 2;
export const RETRY_DELAY_MS = 2 * 60_000;
export const SNOOZE_DELAY_MS = 5 * 60_000;

export interface DispatcherConfig {
  apiOrigin: string;
  fromNumber: string;
  urlSigningSecret: string;
}

export class CallDispatchService {
  constructor(
    private readonly users: UserRepo,
    private readonly events: EventRepo,
    private readonly calls: CallRepo,
    private readonly provider: TelephonyProvider,
    private readonly config: DispatcherConfig,
    private readonly notifier: EmailNotifier | null = null,
  ) {}

  async dispatchDue(nowMs: number): Promise<void> {
    const swept = await this.events.sweepMissed(nowMs);
    // a swept event is a call we promised and never placed: the product
    // failed for that user even though nothing threw
    if (swept.length > 0) {
      logEvent('warn', 'call.events_swept_missed', { count: swept.length });
      for (const row of swept) {
        const user = await this.users.findById(row.userId);
        if (!user) continue;
        // the honest reason: an unverified number means we never dialed
        if (!user.phoneE164 || !user.dndVerifiedAt) {
          await this.notifier?.numberUnverified(user);
        } else {
          await this.notifier?.missedCall(user, row, 'failed');
        }
      }
    }

    const due = await this.events.listDue(nowMs, DISPATCH_BATCH_SIZE);
    for (const event of due) {
      try {
        await this.dispatchOne(event.id, event.userId);
      } catch (error) {
        logEvent('error', 'call.dispatch_failed', {
          eventId: event.id,
          userId: event.userId,
          ...errorFields(error),
        });
        Sentry.captureException(error);
      }
    }
  }

  private async dispatchOne(eventId: string, userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user?.phoneE164 || !user.dndVerifiedAt) return;

    // claim before spending quota or dialing so a second cron tick is a no-op
    if (!(await this.events.tryClaimForCalling(eventId))) return;

    await this.users.resetPeriodIfElapsed(user, PERIOD_MS);
    const limit = PLAN_LIMITS[user.plan].callsPerMonth;
    if (!(await this.users.consumeCall(user, limit))) {
      await this.events.setState(eventId, 'missed');
      logEvent('warn', 'call.quota_exhausted', { userId: user.id, eventId, plan: user.plan });
      const event = await this.events.findById(eventId);
      if (event) await this.notifier?.missedCall(user, event, 'out_of_calls');
      return;
    }

    const attempt = (await this.calls.latestAttemptForEvent(eventId)) + 1;
    const call = await this.calls.create({ eventId, userId: user.id, attempt });
    await this.placeCall(call.id, user.phoneE164);
    await this.warnIfThatWasTheLastCall(user.id);
  }

  /**
   * The one proactive email: the moment runway hits zero with flagged
   * meetings still ahead, say so, while there is still time to act. The
   * per-event missed email stays as the backstop for whoever ignores it.
   */
  private async warnIfThatWasTheLastCall(userId: string): Promise<void> {
    if (!this.notifier) return;
    const user = await this.users.findById(userId);
    if (!user) return;
    const allowanceLeft = PLAN_LIMITS[user.plan].callsPerMonth - user.callsUsedThisPeriod;
    const creditsLeft = creditsUsable(user.plan) ? user.extraCallCredits : 0;
    if (allowanceLeft + creditsLeft > 0) return;

    const upcoming = (await this.events.listUpcomingForUser(user.id, Date.now())).filter(
      (event) => event.state === 'scheduled' || event.state === 'snoozed',
    );
    if (upcoming.length > 0) await this.notifier.lastCallSpent(user, upcoming);
  }

  async placeVerificationCall(user: UserRow): Promise<string> {
    if (!user.phoneE164) throw new Error('no phone number on file');
    const call = await this.calls.create({ eventId: null, userId: user.id, attempt: 1, isTest: true });
    await this.placeCall(call.id, user.phoneE164);
    return call.id;
  }

  private async placeCall(callId: string, to: string): Promise<void> {
    const placed = await this.provider.placeCall({
      to,
      from: this.config.fromNumber,
      answerUrl: await this.callbackUrl('answer', callId),
      hangupUrl: await this.callbackUrl('hangup', callId),
      ringTimeoutSeconds: RING_TIMEOUT_SECONDS,
    });
    await this.calls.markPlaced(callId, placed.providerCallId);
  }

  /**
   * Callback URLs carry their own HMAC token. Combined with the provider
   * signature check this means forging a webhook requires both the carrier auth
   * token and our signing secret.
   */
  async callbackUrl(kind: 'answer' | 'hangup' | 'input', callId: string): Promise<string> {
    const token = await signCallbackToken(callId, this.config.urlSigningSecret);
    return `${this.config.apiOrigin}/hooks/call/${kind}?call=${callId}&tok=${token}`;
  }
}

export async function signCallbackToken(callId: string, secret: string): Promise<string> {
  return hmacSign(`call-callback:${callId}`, secret);
}
