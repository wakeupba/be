import { and, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { demoCalls } from '../db/schema';
import { newId } from '../lib/id';

export class DemoCallRepo {
  constructor(private readonly db: Db) {}

  /**
   * Records a call the budget has already admitted. costUsd is kept here as the
   * audit trail and as what a refund reverses, but it is not what gates spend:
   * the counter is, so the two cannot disagree about whether a call was allowed.
   */
  async reserve(input: { phoneHash: string; ipHash: string; costUsd: number }): Promise<string> {
    const id = newId('dmo');
    await this.db.insert(demoCalls).values({ ...input, id, createdAt: Date.now() });
    return id;
  }

  async markPlaced(id: string, providerCallId: string): Promise<void> {
    await this.db.update(demoCalls).set({ providerCallId }).where(eq(demoCalls.id, id));
  }

  async markAnswered(id: string): Promise<void> {
    await this.db.update(demoCalls).set({ answeredAt: Date.now() }).where(eq(demoCalls.id, id));
  }

  /** an unanswered call costs nothing, so its reservation goes back to the
   * budget. The row stays: it still counts against the per-number cap, which
   * is what stops the demo being used to ring someone repeatedly for free */
  async release(id: string): Promise<void> {
    await this.db.update(demoCalls).set({ costUsd: 0 }).where(eq(demoCalls.id, id));
  }

  async findById(id: string) {
    return this.db.query.demoCalls.findFirst({ where: eq(demoCalls.id, id) });
  }

  async countByPhoneSince(phoneHash: string, sinceMs: number): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(demoCalls)
      .where(and(eq(demoCalls.phoneHash, phoneHash), gte(demoCalls.createdAt, sinceMs)));
    return row?.count ?? 0;
  }

  async countByIpSince(ipHash: string, sinceMs: number): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(demoCalls)
      .where(and(eq(demoCalls.ipHash, ipHash), gte(demoCalls.createdAt, sinceMs)));
    return row?.count ?? 0;
  }
}
