import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { oauthTokens, type TokenRow } from '../db/schema';

export type { TokenRow };

export class TokenRepo {
  constructor(private readonly db: Db) {}

  async find(userId: string): Promise<TokenRow | null> {
    const row = await this.db.query.oauthTokens.findFirst({ where: eq(oauthTokens.userId, userId) });
    return row ?? null;
  }

  async upsertRefreshToken(userId: string, refreshTokenEnc: string): Promise<void> {
    const now = Date.now();
    await this.db
      .insert(oauthTokens)
      .values({ userId, refreshTokenEnc, updatedAt: now })
      .onConflictDoUpdate({ target: oauthTokens.userId, set: { refreshTokenEnc, updatedAt: now } });
  }

  async cacheAccessToken(userId: string, accessTokenEnc: string, expiresAt: number): Promise<void> {
    await this.db
      .update(oauthTokens)
      .set({ accessTokenEnc, accessTokenExpiresAt: expiresAt, updatedAt: Date.now() })
      .where(eq(oauthTokens.userId, userId));
  }

  async saveSyncToken(userId: string, syncToken: string | null): Promise<void> {
    await this.db
      .update(oauthTokens)
      .set({ calendarSyncToken: syncToken, updatedAt: Date.now() })
      .where(eq(oauthTokens.userId, userId));
  }

  /** disconnecting the calendar removes every credential we hold */
  async delete(userId: string): Promise<void> {
    await this.db.delete(oauthTokens).where(eq(oauthTokens.userId, userId));
  }
}
