import { createDb } from './db/client';
import type { Env } from './env';
import { CallRepo } from './repos/calls';
import { CreditGrantRepo } from './repos/credit-grants';
import { EventRepo } from './repos/events';
import { TokenRepo } from './repos/tokens';
import { UserRepo } from './repos/users';
import { VoteRepo } from './repos/votes';
import { WebhookEventRepo } from './repos/webhook-events';
import {
  type BillingProvider,
  DodoBillingProvider,
  FakeBillingProvider,
  fakeBillingActive,
} from './services/billing/dodo';
import { GoogleClient } from './services/calendar/google-client';
import { CalendarSyncService } from './services/calendar/sync';
import { CallDispatchService } from './services/calls/dispatcher';
import { CallLifecycleService } from './services/calls/lifecycle';
import { defaultScriptBuilder } from './services/calls/script';
import { EmailNotifier } from './services/email/notifier';
import { ResendEmailService } from './services/email/service';
import { TwilioProvider } from './services/telephony/twilio';

/**
 * Composition root. Everything downstream depends on interfaces and receives
 * its collaborators here, once per request or cron tick.
 */
export function buildContainer(env: Env) {
  const db = createDb(env.DB);
  const users = new UserRepo(db);
  const tokens = new TokenRepo(db);
  const events = new EventRepo(db);
  const calls = new CallRepo(db);
  const votes = new VoteRepo(db);
  const webhookEvents = new WebhookEventRepo(db);
  const creditGrants = new CreditGrantRepo(db);

  const google = new GoogleClient(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  // callback URLs handed to Twilio (and verified on the way back) must be
  // publicly reachable; in dev that is the tunnel, never localhost
  const telephonyOrigin = env.TELEPHONY_PUBLIC_ORIGIN || env.API_ORIGIN;
  const telephony = new TwilioProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, telephonyOrigin);

  // transactional email stays dark until the key exists; every caller
  // treats the notifier as optional
  const notifier = env.RESEND_API_KEY
    ? new EmailNotifier(new ResendEmailService(env.RESEND_API_KEY, env.APP_ORIGIN), webhookEvents)
    : null;

  const sync = new CalendarSyncService(google, users, tokens, events, env.TOKEN_ENC_KEY, notifier);
  const dispatcher = new CallDispatchService(
    users,
    events,
    calls,
    telephony,
    {
      apiOrigin: telephonyOrigin,
      fromNumber: env.TWILIO_FROM_NUMBER_US,
      urlSigningSecret: env.SESSION_SECRET,
    },
    notifier,
  );
  const lifecycle = new CallLifecycleService(calls, events, users, notifier);
  const scripts = defaultScriptBuilder();
  const billing: BillingProvider | null = env.DODO_API_KEY
    ? new DodoBillingProvider(env.DODO_API_KEY, env.DODO_ENVIRONMENT ?? 'test_mode')
    : fakeBillingActive(env)
      ? new FakeBillingProvider(env.API_ORIGIN)
      : null;

  return {
    users,
    tokens,
    events,
    calls,
    votes,
    webhookEvents,
    creditGrants,
    google,
    telephony,
    sync,
    dispatcher,
    lifecycle,
    scripts,
    billing,
  };
}

export type Container = ReturnType<typeof buildContainer>;
