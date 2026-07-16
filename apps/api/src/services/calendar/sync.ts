import { decryptSecret, encryptSecret } from '../../lib/crypto';
import type { EventRepo } from '../../repos/events';
import type { TokenRepo } from '../../repos/tokens';
import type { UserRepo, UserRow } from '../../repos/users';
import type { GoogleClient, GoogleEventItem } from './google-client';

const PRIMARY_CALENDAR = 'primary';
const ACCESS_TOKEN_SLACK_MS = 60_000;

export class CalendarSyncService {
  constructor(
    private readonly google: GoogleClient,
    private readonly users: UserRepo,
    private readonly tokens: TokenRepo,
    private readonly events: EventRepo,
    private readonly encKey: string,
  ) {}

  async syncAllUsers(): Promise<void> {
    const users = await this.users.listWithConnectedCalendar();
    for (const user of users) {
      try {
        await this.syncUser(user);
      } catch (error) {
        // one user's broken token must not stall everyone else's calls
        console.error(`sync failed for ${user.id}:`, error);
      }
    }
  }

  async syncUser(user: UserRow): Promise<void> {
    const tokenRow = await this.tokens.find(user.id);
    if (!tokenRow) return;

    const accessToken = await this.freshAccessToken(user.id, tokenRow.refresh_token_enc, tokenRow);
    const delta = await this.google.listEventsDelta(accessToken, tokenRow.calendar_sync_token);

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
    const isFlagged = item.colorId === user.trigger_color_id;
    const isDeclinedByMe = (item.attendees ?? []).some(
      (a) => a.self === true && a.responseStatus === 'declined',
    );

    // all-day events (date, no dateTime) never ring: there is no moment to be late for
    if (!startsAtIso || !isFlagged || isDeclinedByMe) {
      await this.events.cancelByGoogleId(user.id, PRIMARY_CALENDAR, item.id);
      return;
    }

    const startsAt = Date.parse(startsAtIso);
    const callAt = startsAt - user.lead_minutes * 60_000;
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
    cached: { access_token_enc: string | null; access_token_expires_at: number | null },
  ): Promise<string> {
    if (
      cached.access_token_enc &&
      cached.access_token_expires_at &&
      cached.access_token_expires_at - ACCESS_TOKEN_SLACK_MS > Date.now()
    ) {
      return decryptSecret(cached.access_token_enc, this.encKey);
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
