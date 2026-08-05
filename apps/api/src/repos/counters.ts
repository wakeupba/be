import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { counters } from '../db/schema';

/**
 * A counter that cannot be pushed past its ceiling, however many requests
 * arrive at once.
 *
 * The alternative in this codebase is claimRateSlot, which claims one row per
 * unit and so costs a write per unit it probes. That is the right shape for
 * "five settings changes per window" and the wrong shape for a budget measured
 * in thousandths of a dollar: near the ceiling every refusal would cost
 * thousands of writes, exactly when traffic is highest.
 */
export class CounterRepo {
  constructor(private readonly db: Db) {}

  /**
   * Adds `amount` if doing so stays within `ceiling`, and reports whether it
   * did. One statement, so the check and the increment cannot be interleaved:
   * two simultaneous callers cannot both be told yes when only one fits.
   */
  async spend(key: string, amount: number, ceiling: number): Promise<boolean> {
    // the insert branch has no WHERE to guard it, so an amount that could
    // never fit is refused before it can create the row
    if (amount > ceiling) return false;
    const now = Date.now();
    const result = await this.db
      .insert(counters)
      .values({ key, value: amount, updatedAt: now })
      .onConflictDoUpdate({
        target: counters.key,
        set: { value: sql`${counters.value} + ${amount}`, updatedAt: now },
        setWhere: sql`${counters.value} + ${amount} <= ${ceiling}`,
      });
    return result.meta.changes > 0;
  }

  /** gives an amount back, for spend that turned out not to happen. Floors at
   * zero so a double refund cannot mint headroom that was never used */
  async refund(key: string, amount: number): Promise<void> {
    await this.db
      .update(counters)
      .set({ value: sql`MAX(0, ${counters.value} - ${amount})`, updatedAt: Date.now() })
      .where(eq(counters.key, key));
  }

  async read(key: string): Promise<number> {
    const row = await this.db.query.counters.findFirst({ where: eq(counters.key, key) });
    return row?.value ?? 0;
  }
}
