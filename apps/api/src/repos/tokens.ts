import { and, eq, isNull, lt, or } from 'drizzle-orm';
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

  /**
   * Makes the next sync pull a fresh window instead of a delta. A decision that
   * depends on every event — which color counts as flagged — cannot be revisited
   * from an incremental token, because that token only returns what Google says
   * changed, and recoloring our own trigger changes nothing there.
   *
   * Drops the cooldown stamp with it: this is exactly the moment a refresh has
   * to reach Google, so it must not be answered from the last check.
   */
  async forceFullResync(userId: string): Promise<void> {
    await this.db
      .update(oauthTokens)
      .set({ calendarSyncToken: null, lastSyncAttemptAt: null, updatedAt: Date.now() })
      .where(eq(oauthTokens.userId, userId));
  }

  /**
   * Claims this user's on-demand sync slot, stamping the attempt in the same
   * statement. The state guard is the rate limit: a double-tapped refresh
   * finds the slot held and is served the data we already have. Same idiom as
   * events.tryClaimForCalling, and like it, safe across isolates.
   *
   * Deliberately the one write here that leaves `updatedAt` alone: it marks
   * when we last asked Google, which is not a change to the credential, and
   * bumping it on every refresh would make the column useless for the thing
   * it exists to date.
   */
  async tryClaimSync(userId: string, notSince: number): Promise<boolean> {
    const result = await this.db
      .update(oauthTokens)
      .set({ lastSyncAttemptAt: Date.now() })
      .where(
        and(
          eq(oauthTokens.userId, userId),
          or(isNull(oauthTokens.lastSyncAttemptAt), lt(oauthTokens.lastSyncAttemptAt, notSince)),
        ),
      );
    return result.meta.changes > 0;
  }

  /** disconnecting the calendar removes every credential we hold */
  async delete(userId: string): Promise<void> {
    await this.db.delete(oauthTokens).where(eq(oauthTokens.userId, userId));
  }
}
