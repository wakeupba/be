const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export const OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  /** space-delimited scopes the user actually granted; Google's consent
   * screen lets them decline individual checkboxes */
  scope: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string | null;
}

export interface GoogleEventItem {
  id: string;
  status: string;
  summary?: string;
  colorId?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
}

export interface EventsDelta {
  items: GoogleEventItem[];
  nextSyncToken: string | null;
  /** True when Google invalidated the sync token (HTTP 410) and a full resync ran. */
  resynced: boolean;
}

export class SyncTokenExpiredError extends Error {}

export class GoogleClient {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  buildAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: OAUTH_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
    return this.tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
    return this.tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  /**
   * Best-effort revocation at Google: the token may already be dead, and a
   * failed revoke must not block the local disconnect.
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      });
    } catch (error) {
      console.warn('google token revoke failed (continuing local disconnect):', error);
    }
  }

  async fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`userinfo failed: ${response.status}`);
    const data = (await response.json()) as { sub: string; email: string; name?: string };
    return { sub: data.sub, email: data.email, name: data.name ?? null };
  }

  /**
   * Incremental sync of the primary calendar. First run (no sync token) pulls
   * a bounded upcoming window; later runs only receive what changed. On a 410
   * the token is dead and we transparently fall back to a fresh full window.
   */
  async listEventsDelta(accessToken: string, syncToken: string | null): Promise<EventsDelta> {
    try {
      return await this.pageThroughEvents(accessToken, syncToken);
    } catch (error) {
      if (error instanceof SyncTokenExpiredError) {
        const fresh = await this.pageThroughEvents(accessToken, null);
        return { ...fresh, resynced: true };
      }
      throw error;
    }
  }

  private async pageThroughEvents(accessToken: string, syncToken: string | null): Promise<EventsDelta> {
    const items: GoogleEventItem[] = [];
    let pageToken: string | null = null;
    let nextSyncToken: string | null = null;

    do {
      const params = new URLSearchParams({ singleEvents: 'true', maxResults: '250' });
      if (syncToken) {
        params.set('syncToken', syncToken);
      } else {
        const now = new Date();
        const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        params.set('timeMin', now.toISOString());
        params.set('timeMax', horizon.toISOString());
      }
      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(`${CALENDAR_EVENTS_URL}?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 410) throw new SyncTokenExpiredError();
      if (!response.ok) throw new Error(`events list failed: ${response.status}`);

      const data = (await response.json()) as {
        items?: GoogleEventItem[];
        nextPageToken?: string;
        nextSyncToken?: string;
      };
      items.push(...(data.items ?? []));
      pageToken = data.nextPageToken ?? null;
      nextSyncToken = data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    return { items, nextSyncToken, resynced: false };
  }

  private async tokenRequest(params: Record<string, string>): Promise<GoogleTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`google token request failed: ${response.status} ${body}`);
    }
    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresInSeconds: data.expires_in,
      scope: data.scope ?? '',
    };
  }
}
