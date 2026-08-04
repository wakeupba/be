import { Resend } from 'resend';
import { errorFields, logEvent } from '../../lib/log';
import type { MissedReason, RenderedEmail, UpcomingMeeting } from './templates';

/*
 * The templates pull in react and react-dom/server, which is a quarter of
 * this worker's compressed size. Loading them lazily keeps that parse cost
 * off every isolate start, and specifically off the telephony webhooks,
 * which have to answer a ringing phone immediately. Emails are rare and
 * never latency sensitive, so they can pay for it.
 */
type Templates = typeof import('./templates');
let pending: Promise<Templates> | null = null;
function templates(): Promise<Templates> {
  pending ??= import('./templates');
  return pending;
}

/*
 * Transactional email, and nothing else. Email is reserved for the moments
 * the phone call itself can no longer do the talking: a call that did not
 * connect, a plan out of runway with meetings still flagged, or a broken
 * connection that stops calls entirely.
 *
 * No welcome mail, no digests, no upsells, no receipts (Dodo is the
 * merchant of record and already sends those).
 *
 * This class is transport only. The wording lives in ./templates.
 */

export type { MissedReason, UpcomingMeeting };

export interface MissedCallEmail {
  to: string;
  /** pins the idempotency key: retries can never double-send one event's email */
  eventId: string;
  eventTitle: string;
  startsAt: number;
  timezone: string;
  reason: MissedReason;
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
  numberUnreachable(to: string, idempotencyKey: string): Promise<void>;
}

const FROM = 'Wake Up Babe <info@wakeupba.be>';

export class ResendEmailService implements EmailService {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly appOrigin: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  /** a failed email must never take a call flow down with it. Both parts go
   * out: text keeps the message readable anywhere, html is what gmail shows */
  private async send(to: string, email: RenderedEmail, idempotencyKey: string): Promise<void> {
    try {
      const { error } = await this.resend.emails.send(
        { from: FROM, to, subject: email.subject, text: email.text, html: email.html },
        { idempotencyKey },
      );
      if (error) throw new Error(error.message);
      logEvent('info', 'email.sent', { to, subject: email.subject });
    } catch (error) {
      logEvent('error', 'email.send_failed', { to, subject: email.subject, ...errorFields(error) });
    }
  }

  async missedCall(input: MissedCallEmail): Promise<void> {
    await this.send(
      input.to,
      await (await templates()).missedCallEmail({
        eventTitle: input.eventTitle,
        startsAt: input.startsAt,
        timezone: input.timezone,
        reason: input.reason,
        appOrigin: this.appOrigin,
      }),
      `missed-call/${input.eventId}/${input.reason}`,
    );
  }

  async outOfCalls(
    to: string,
    upcoming: UpcomingMeeting[],
    timezone: string,
    idempotencyKey: string,
  ): Promise<void> {
    await this.send(
      to,
      await (await templates()).outOfCallsEmail({ upcoming, timezone, appOrigin: this.appOrigin }),
      idempotencyKey,
    );
  }

  async numberUnverified(to: string, idempotencyKey: string): Promise<void> {
    const { numberUnverifiedEmail } = await templates();
    await this.send(to, await numberUnverifiedEmail({ appOrigin: this.appOrigin }), idempotencyKey);
  }

  async numberUnreachable(to: string, idempotencyKey: string): Promise<void> {
    const { numberUnreachableEmail } = await templates();
    await this.send(to, await numberUnreachableEmail({ appOrigin: this.appOrigin }), idempotencyKey);
  }

  async calendarBroken(to: string, idempotencyKey: string): Promise<void> {
    const { calendarBrokenEmail } = await templates();
    await this.send(to, await calendarBrokenEmail({ appOrigin: this.appOrigin }), idempotencyKey);
  }
}
