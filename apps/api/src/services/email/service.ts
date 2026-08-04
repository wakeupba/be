import { Resend } from 'resend';
import { errorFields, logEvent } from '../../lib/log';

/*
 * Transactional email, and nothing else. The product's whole pitch is that
 * notifications are noise, so email is reserved for exactly two moments
 * where the phone call itself can no longer do the talking:
 *
 *   1. a call we promised did not reach you (missed after retries, failed
 *      placement, or you ran out of calls)
 *   2. calendar access broke, so no calls are coming at all
 *
 * No welcome mail, no digests, no upsells, no receipts (Dodo is the
 * merchant of record and already sends those).
 */

export type MissedReason = 'no_answer' | 'failed' | 'out_of_calls';

export interface MissedCallEmail {
  to: string;
  /** pins the idempotency key: retries can never double-send one event's email */
  eventId: string;
  eventTitle: string;
  startsAt: number;
  timezone: string;
  reason: MissedReason;
}

export interface UpcomingMeeting {
  id: string;
  title: string;
  startsAt: number;
}

export interface EmailService {
  missedCall(input: MissedCallEmail): Promise<void>;
  calendarBroken(to: string, idempotencyKey: string): Promise<void>;
  outOfCalls(
    to: string,
    upcoming: UpcomingMeeting[],
    timezone: string,
    idempotencyKey: string,
  ): Promise<void>;
  numberUnverified(to: string, idempotencyKey: string): Promise<void>;
}

const FROM = 'Wake Up Babe <info@wakeupba.be>';

const REASON_LINES: Record<MissedReason, string> = {
  no_answer: 'we called. no answer.',
  failed: 'we tried to call, the call could not be placed.',
  out_of_calls: 'you were out of calls this month, so the phone never rang.',
};

function dayAndTime(startsAt: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(startsAt));
  } catch {
    return new Date(startsAt).toISOString();
  }
}

function timeIn(startsAt: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(startsAt));
  } catch {
    return new Date(startsAt).toISOString();
  }
}

export class ResendEmailService implements EmailService {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly appOrigin: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  /** a failed email must never take a call flow down with it */
  private async send(to: string, subject: string, text: string, idempotencyKey: string): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({ from: FROM, to, subject, text }, { idempotencyKey });
      if (error) throw new Error(error.message);
      logEvent('info', 'email.sent', { to, subject });
    } catch (error) {
      logEvent('error', 'email.send_failed', { to, subject, ...errorFields(error) });
    }
  }

  async missedCall(input: MissedCallEmail): Promise<void> {
    const time = timeIn(input.startsAt, input.timezone);
    await this.send(
      input.to,
      `you missed "${input.eventTitle}"`,
      [
        `babe. "${input.eventTitle}" started at ${time} and we couldn't reach you.`,
        '',
        REASON_LINES[input.reason],
        '',
        `what happened: ${this.appOrigin}/calls/`,
        '',
        'wake up babe · this email only exists because the phone call failed',
      ].join('\n'),
      `missed-call/${input.eventId}/${input.reason}`,
    );
  }

  async outOfCalls(
    to: string,
    upcoming: UpcomingMeeting[],
    timezone: string,
    idempotencyKey: string,
  ): Promise<void> {
    const lines = upcoming.slice(0, 5).map((m) => `  ${dayAndTime(m.startsAt, timezone)}  ${m.title}`);
    await this.send(
      to,
      'that was your last call this month',
      [
        'babe. that was your last call this month. these meetings are still',
        'flagged, and the phone will not ring for them:',
        '',
        ...lines,
        '',
        `more calls: ${this.appOrigin}/billing/`,
        '',
        'wake up babe · this email only exists because the phone call failed',
      ].join('\n'),
      idempotencyKey,
    );
  }

  async numberUnverified(to: string, idempotencyKey: string): Promise<void> {
    await this.send(
      to,
      'calls are paused, your number is not verified',
      [
        'babe. your number never passed the test call, so nothing we',
        'schedule can actually ring you. flagged meetings are being missed.',
        '',
        `verify it: ${this.appOrigin}/call-setup/`,
        '',
        'wake up babe · this email only exists because the phone call failed',
      ].join('\n'),
      idempotencyKey,
    );
  }

  async calendarBroken(to: string, idempotencyKey: string): Promise<void> {
    await this.send(
      to,
      'we lost sight of your calendar',
      [
        'babe. google stopped letting us read your calendar. meetings we',
        'already flagged will still ring at their last known times, but new',
        'ones, moves, and cancellations are invisible to us until you',
        'reconnect.',
        '',
        `reconnect: ${this.appOrigin}/call-setup/`,
        '',
        'wake up babe · this email only exists because the phone call failed',
      ].join('\n'),
      idempotencyKey,
    );
  }
}
