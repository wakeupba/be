import { desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { regionInterest } from '../db/schema';

export interface RegionInterestInput {
  country: string | null;
  prefix: string | null;
  rateUsd: number | null;
}

/*
 * Demand from destinations we do not ring yet, so "which region do we open
 * next" is answerable from data rather than guesswork.
 *
 * Destinations, not people: no phone number is stored. Country and rate answer
 * that question completely, and these rows describe users we turned away, which
 * makes this the last place worth keeping extra detail about them.
 */
export class RegionInterestRepo {
  constructor(private readonly db: Db) {}

  /** upserts on userId: trying again bumps attempts instead of adding a row,
   * and a second destination replaces the first */
  async record(userId: string, input: RegionInterestInput): Promise<void> {
    const now = Date.now();
    await this.db
      .insert(regionInterest)
      .values({ userId, ...input, attempts: 1, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: regionInterest.userId,
        set: {
          country: input.country,
          prefix: input.prefix,
          rateUsd: input.rateUsd,
          attempts: sql`${regionInterest.attempts} + 1`,
          updatedAt: now,
        },
      });
  }

  async findByUser(userId: string) {
    return this.db.query.regionInterest.findFirst({ where: eq(regionInterest.userId, userId) });
  }

  /**
   * Demand grouped by country, most wanted first. This is the shape the decision
   * actually needs: how many people are waiting, how hard they asked, and what
   * the cheapest range in that country currently costs, since a country can be
   * dear in one range and affordable in another.
   */
  async demandByCountry() {
    return this.db
      .select({
        country: regionInterest.country,
        people: sql<number>`COUNT(*)`,
        attempts: sql<number>`SUM(${regionInterest.attempts})`,
        cheapestUsd: sql<number | null>`MIN(${regionInterest.rateUsd})`,
      })
      .from(regionInterest)
      .groupBy(regionInterest.country)
      .orderBy(desc(sql`SUM(${regionInterest.attempts})`));
  }
}
