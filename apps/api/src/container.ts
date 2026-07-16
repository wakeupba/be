import type { Env } from './env';
import { CallRepo } from './repos/calls';
import { EventRepo } from './repos/events';
import { TokenRepo } from './repos/tokens';
import { UserRepo } from './repos/users';
import { VoteRepo } from './repos/votes';
import { GoogleClient } from './services/calendar/google-client';
import { CalendarSyncService } from './services/calendar/sync';
import { CallDispatchService } from './services/calls/dispatcher';
import { CallLifecycleService } from './services/calls/lifecycle';
import { defaultScriptBuilder } from './services/calls/script';
import { PlivoProvider } from './services/telephony/plivo';

/**
 * Composition root. Everything downstream depends on interfaces and receives
 * its collaborators here, once per request or cron tick.
 */
export function buildContainer(env: Env) {
  const users = new UserRepo(env.DB);
  const tokens = new TokenRepo(env.DB);
  const events = new EventRepo(env.DB);
  const calls = new CallRepo(env.DB);
  const votes = new VoteRepo(env.DB);

  const google = new GoogleClient(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  const telephony = new PlivoProvider(env.PLIVO_AUTH_ID, env.PLIVO_AUTH_TOKEN);

  const sync = new CalendarSyncService(google, users, tokens, events, env.TOKEN_ENC_KEY);
  const dispatcher = new CallDispatchService(users, events, calls, telephony, {
    apiOrigin: env.API_ORIGIN,
    fromNumber: env.PLIVO_FROM_NUMBER_US,
    urlSigningSecret: env.SESSION_SECRET,
  });
  const lifecycle = new CallLifecycleService(calls, events, users);
  const scripts = defaultScriptBuilder();

  return { users, tokens, events, calls, votes, google, telephony, sync, dispatcher, lifecycle, scripts };
}

export type Container = ReturnType<typeof buildContainer>;
