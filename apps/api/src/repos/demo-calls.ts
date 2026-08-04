import { and, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { demoCalls } from '../db/schema';
import { newId } from '../lib/id';

export class DemoCallRepo {
  constructor(private readonly db: Db) {}

  /**
   * Reserves the cost before the call is placed. Money is spent in the order
   * it is committed to, not the order it is confirmed: a reservation that ends
   * up unanswered is released, whereas a call placed before its cost was
   * recorded is spend nobody counted.
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

  async spentSince(sinceMs: number): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${demoCalls.costUsd}), 0)` })
      .from(demoCalls)
      .where(gte(demoCalls.createdAt, sinceMs));
    return row?.total ?? 0;
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
