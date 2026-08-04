import { desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { regionInterest } from '../db/schema';

/*
 * Demand from countries we do not ring yet. Written when onboarding turns a
 * number away, so "we will bring it to you soon" is backed by a list we can
 * actually work from rather than a dead end.
 */
export class RegionInterestRepo {
  constructor(private readonly db: Db) {}

  /** upserts on userId: trying again bumps attempts instead of adding a row,
   * and a corrected number replaces the one we could not call */
  async record(userId: string, phoneE164: string, rateUsd: number | null): Promise<void> {
    const now = Date.now();
    await this.db
      .insert(regionInterest)
      .values({ userId, phoneE164, rateUsd, attempts: 1, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: regionInterest.userId,
        set: {
          phoneE164,
          rateUsd,
          attempts: sql`${regionInterest.attempts} + 1`,
          updatedAt: now,
        },
      });
  }

  async findByUser(userId: string) {
    return this.db.query.regionInterest.findFirst({ where: eq(regionInterest.userId, userId) });
  }

  /** everyone waiting, dearest destinations last, for deciding what to open next */
  async all(limit = 500) {
    return this.db.query.regionInterest.findMany({
      orderBy: [desc(regionInterest.attempts), desc(regionInterest.updatedAt)],
      limit,
    });
  }
}
