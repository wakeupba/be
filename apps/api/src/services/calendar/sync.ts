import * as Sentry from '@sentry/cloudflare';
import { decryptSecret, encryptSecret } from '../../lib/crypto';
import { errorFields, logEvent } from '../../lib/log';
import type { EventRepo } from '../../repos/events';
import type { TokenRepo } from '../../repos/tokens';
import type { UserRepo, UserRow } from '../../repos/users';
import type { EmailNotifier } from '../email/notifier';
import { type GoogleClient, type GoogleEventItem, GoogleInvalidGrantError } from './google-client';

const PRIMARY_CALENDAR = 'primary';
const ACCESS_TOKEN_SLACK_MS = 60_000;

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
    const users = await this.users.listWithConnectedCalendar();
    for (const user of users) {
      try {
        await this.syncUser(user);
      } catch (error) {
        // one user's broken token must not stall everyone else's calls,
        // but a user who stops syncing silently stops getting calls
        logEvent('error', 'calendar.sync_failed', { userId: user.id, ...errorFields(error) });
        Sentry.captureException(error);
        // definitive revocation, not a blip: the user revoked us (or
        // google expired the grant) and only they can fix it. Deliberate
        // conservative choice: the token row stays, so already-flagged
        // events keep ringing at their last known times; the email copy
        // matches that reality
        if (error instanceof GoogleInvalidGrantError) {
          await this.notifier?.calendarBroken(user);
        }
      }
    }
  }

  async syncUser(user: UserRow): Promise<void> {
    const tokenRow = await this.tokens.find(user.id);
    if (!tokenRow) return;

    const accessToken = await this.freshAccessToken(user.id, tokenRow.refreshTokenEnc, tokenRow);
    const delta = await this.google.listEventsDelta(accessToken, tokenRow.calendarSyncToken);

    for (const item of delta.items) {
      await this.applyEvent(user, item);
    }
    await this.tokens.saveSyncToken(user.id, delta.nextSyncToken);
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
