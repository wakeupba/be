export interface TokenRow {
  user_id: string;
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: number | null;
  calendar_sync_token: string | null;
  updated_at: number;
}

export class TokenRepo {
  constructor(private readonly db: D1Database) {}

  async find(userId: string): Promise<TokenRow | null> {
    return this.db.prepare('SELECT * FROM oauth_tokens WHERE user_id = ?').bind(userId).first<TokenRow>();
  }

  async upsertRefreshToken(userId: string, refreshTokenEnc: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO oauth_tokens (user_id, refresh_token_enc, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET refresh_token_enc = excluded.refresh_token_enc, updated_at = excluded.updated_at`,
      )
      .bind(userId, refreshTokenEnc, Date.now())
      .run();
  }

  async cacheAccessToken(userId: string, accessTokenEnc: string, expiresAt: number): Promise<void> {
    await this.db
      .prepare(
        'UPDATE oauth_tokens SET access_token_enc = ?, access_token_expires_at = ?, updated_at = ? WHERE user_id = ?',
      )
      .bind(accessTokenEnc, expiresAt, Date.now(), userId)
      .run();
  }

  async saveSyncToken(userId: string, syncToken: string | null): Promise<void> {
    await this.db
      .prepare('UPDATE oauth_tokens SET calendar_sync_token = ?, updated_at = ? WHERE user_id = ?')
      .bind(syncToken, Date.now(), userId)
      .run();
  }
}
