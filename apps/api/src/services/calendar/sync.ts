import * as Sentry from '@sentry/cloudflare';
import { decryptSecret, encryptSecret } from '../../lib/crypto';
import { errorFields, logEvent } from '../../lib/log';
import type { EventRepo } from '../../repos/events';
import type { TokenRepo } from '../../repos/tokens';
import type { UserRepo, UserRow } from '../../repos/users';
import type { EmailNotifier } from '../email/notifier';
import {
  type EventsDelta,
  type GoogleClient,
  type GoogleEventItem,
  GoogleInvalidGrantError,
  GoogleUnauthorizedError,
} from './google-client';

const PRIMARY_CALENDAR = 'primary';
const ACCESS_TOKEN_SLACK_MS = 60_000;

/** a serial pass costs one Google round trip per user, so it grows until a
 * tick outlives its own interval. Bounded rather than unbounded so a large
 * user table cannot burst past Google's per-minute quota in one tick. */
const SYNC_CONCURRENCY = 10;

/** how long one on-demand refresh answers for. Short enough that the
 * dashboard feels live, long enough that leaning on the button is free. */
export const ON_DEMAND_COOLDOWN_MS = 60_000;

export type OnDemandSyncStatus = 'synced' | 'cooling_down' | 'failed';

export interface OnDemandSyncResult {
  status: OnDemandSyncStatus;
  /** when Google was last asked, whether or not this call did the asking */
  lastAttemptAt: number;
}

export class CalendarSyncService {
  constructor(
    private readonly google: GoogleClient,
    private readonly users: UserRepo,
    private readonly tokens: TokenRepo,
    private readonly events: EventRepo,
    private readonly encKey: string,
    private readonly notifier: EmailNotifier | null = null,
  ) {}

  async syncAllUsers(): Promise<void> {
    const queue = await this.users.listWithConnectedCalendar();
    const workers = Array.from({ length: Math.min(SYNC_CONCURRENCY, queue.length) }, async () => {
      // shift is safe to share: nothing else runs between the await points
      for (let user = queue.shift(); user; user = queue.shift()) {
        await this.syncUserGuarded(user);
      }
    });
    await Promise.all(workers);
  }

  /**
   * The dashboard's refresh. The cron is what guarantees a call gets placed;
   * this is for the person who flagged a meeting ten seconds ago and is
   * reloading the page waiting to see it. The cron deliberately does not go
   * through here: it must never be turned away by a cooldown, and stamping
   * every user every tick would put back the per-tick write we just removed.
   */
  async syncOnDemand(user: UserRow): Promise<OnDemandSyncResult> {
    const now = Date.now();
    if (!(await this.tokens.tryClaimSync(user.id, now - ON_DEMAND_COOLDOWN_MS))) {
      const row = await this.tokens.find(user.id);
      return { status: 'cooling_down', lastAttemptAt: row?.lastSyncAttemptAt ?? now };
    }
    // guarded, not thrown: a revoked grant should reach the user as the
    // calendar-broken email the cron would have sent, not as a dead button
    const ok = await this.syncUserGuarded(user);
    return { status: ok ? 'synced' : 'failed', lastAttemptAt: now };
  }

  /** one user's broken token must not stall everyone else's calls, but a user
   * who stops syncing silently stops getting calls */
  private async syncUserGuarded(user: UserRow): Promise<boolean> {
    try {
      await this.syncUser(user);
      return true;
    } catch (error) {
      logEvent('error', 'calendar.sync_failed', { userId: user.id, ...errorFields(error) });
      Sentry.captureException(error);
      // definitive revocation, not a blip: the user revoked us (or google
      // expired the grant) and only they can fix it. Deliberate conservative
      // choice: the token row stays, so already-flagged events keep ringing
      // at their last known times; the email copy matches that reality
      if (error instanceof GoogleInvalidGrantError) {
        await this.notifier?.calendarBroken(user);
      }
      return false;
    }
  }

  async syncUser(user: UserRow): Promise<void> {
    const tokenRow = await this.tokens.find(user.id);
    if (!tokenRow) return;

    const accessToken = await this.freshAccessToken(user.id, tokenRow.refreshTokenEnc, tokenRow);
    const delta = await this.listEvents(user.id, tokenRow, accessToken);

    for (const item of delta.items) {
      await this.applyEvent(user, item);
    }
    // most ticks change nothing, and Google only returns a token on the last
    // page: writing unconditionally spent a D1 write per user per tick, and
    // writing a missing token back as null threw away a still-valid one
    if (delta.nextSyncToken && delta.nextSyncToken !== tokenRow.calendarSyncToken) {
      await this.tokens.saveSyncToken(user.id, delta.nextSyncToken);
    }
  }

  /**
   * Lists events, and treats a 401 as what it is: Google telling us the token
   * we cached is wrong.
   *
   * The cache decides freshness from a clock, but Google invalidates access
   * tokens long before the expiry it quoted us, on a revoke, a password
   * change, a re-consent, a scope change. Without this the stale token was
   * re-sent every tick until the clock caught up, so a user could be silently
   * unsynced for the better part of an hour, and not even be emailed about it:
   * a 401 is not GoogleInvalidGrantError, so the calendar-broken path never
   * ran.
   *
   * Retried exactly once. If the freshly minted token is refused as well, the
   * problem is not staleness and pretending otherwise would only spin.
   */
  private async listEvents(
    userId: string,
    tokenRow: { refreshTokenEnc: string; calendarSyncToken: string | null },
    accessToken: string,
  ): Promise<EventsDelta> {
    try {
      return await this.google.listEventsDelta(accessToken, tokenRow.calendarSyncToken);
    } catch (error) {
      if (!(error instanceof GoogleUnauthorizedError)) throw error;
      logEvent('info', 'calendar.access_token_rejected', { userId });
      // empty cache, so this has to go to Google rather than read back the
      // token that was just refused
      const minted = await this.freshAccessToken(userId, tokenRow.refreshTokenEnc, {
        accessTokenEnc: null,
        accessTokenExpiresAt: null,
      });
      return await this.google.listEventsDelta(minted, tokenRow.calendarSyncToken);
    }
  }

  private async applyEvent(user: UserRow, item: GoogleEventItem): Promise<void> {
    if (item.status === 'cancelled') {
      await this.events.cancelByGoogleId(user.id, PRIMARY_CALENDAR, item.id);
      return;
    }

    const startsAtIso = item.start?.dateTime;
    const isFlagged = item.colorId === user.triggerColorId;
    const isDeclinedByMe = (item.attendees ?? []).some(
      (a) => a.self === true && a.responseStatus === 'declined',
    );

    // all-day events (date, no dateTime) never ring: there is no moment to be late for
    if (!startsAtIso || !isFlagged || isDeclinedByMe) {
      await this.events.cancelByGoogleId(user.id, PRIMARY_CALENDAR, item.id);
      return;
    }

    const startsAt = Date.parse(startsAtIso);
    const callAt = startsAt - user.leadMinutes * 60_000;
    if (Number.isNaN(startsAt) || startsAt <= Date.now()) return;

    await this.events.upsert({
      userId: user.id,
      googleEventId: item.id,
      calendarId: PRIMARY_CALENDAR,
      title: item.summary ?? 'Untitled meeting',
      startsAt,
      eventTimezone: item.start?.timeZone ?? user.timezone,
      attendeeCount: item.attendees?.length ?? 0,
      colorId: item.colorId ?? '',
      callAt,
    });
  }

  private async freshAccessToken(
    userId: string,
    refreshTokenEnc: string,
    cached: { accessTokenEnc: string | null; accessTokenExpiresAt: number | null },
  ): Promise<string> {
    if (
      cached.accessTokenEnc &&
      cached.accessTokenExpiresAt &&
      cached.accessTokenExpiresAt - ACCESS_TOKEN_SLACK_MS > Date.now()
    ) {
      return decryptSecret(cached.accessTokenEnc, this.encKey);
    }

    const refreshToken = await decryptSecret(refreshTokenEnc, this.encKey);
    const tokens = await this.google.refreshAccessToken(refreshToken);
    const expiresAt = Date.now() + tokens.expiresInSeconds * 1000;
    await this.tokens.cacheAccessToken(
      userId,
      await encryptSecret(tokens.accessToken, this.encKey),
      expiresAt,
    );
    return tokens.accessToken;
  }
}
