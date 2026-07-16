import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { featureVotes } from '../db/schema';

export class VoteRepo {
  constructor(private readonly db: Db) {}

  async toggle(featureKey: string, userId: string, note: string | null): Promise<void> {
    const existing = await this.db.query.featureVotes.findFirst({
      where: and(eq(featureVotes.featureKey, featureKey), eq(featureVotes.userId, userId)),
    });
    if (existing) {
      await this.db
        .delete(featureVotes)
        .where(and(eq(featureVotes.featureKey, featureKey), eq(featureVotes.userId, userId)));
      return;
    }
    await this.db.insert(featureVotes).values({ featureKey, userId, note, createdAt: Date.now() });
  }

  async countsWithMine(userId: string): Promise<Map<string, { votes: number; mine: boolean }>> {
    const rows = await this.db
      .select({
        featureKey: featureVotes.featureKey,
        votes: sql<number>`COUNT(*)`,
        mine: sql<number>`MAX(CASE WHEN ${featureVotes.userId} = ${userId} THEN 1 ELSE 0 END)`,
      })
      .from(featureVotes)
      .groupBy(featureVotes.featureKey);
    return new Map(rows.map((row) => [row.featureKey, { votes: row.votes, mine: row.mine === 1 }]));
  }
}
