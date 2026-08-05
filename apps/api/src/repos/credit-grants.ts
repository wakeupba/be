import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { creditGrants } from '../db/schema';

/*
 * The ledger that makes a reversal possible. Dodo's refund and dispute events
 * carry a payment_id and nothing about what was bought, so the only way to
 * take back the right number of credits is to have written down what each
 * payment granted.
 */
export class CreditGrantRepo {
  constructor(private readonly db: Db) {}

  /** ignores a repeat for the same payment: webhook redelivery must not make
   * the ledger disagree with what was actually granted */
  async record(input: {
    paymentId: string;
    userId: string;
    kind: 'topup' | 'subscription';
    packs: number;
    calls: number;
  }): Promise<void> {
    await this.db
      .insert(creditGrants)
      .values({ ...input, grantedAt: Date.now() })
      .onConflictDoNothing();
  }

  /**
   * Claims a grant for reversal, returning it only the first time. A dispute
   * lost and then refunded is two events about one payment, and the credits
   * come off once.
   */
  async claimForRevocation(paymentId: string, reason: string) {
    const [row] = await this.db
      .update(creditGrants)
      .set({ revokedAt: Date.now(), revokedReason: reason })
      .where(and(eq(creditGrants.paymentId, paymentId), isNull(creditGrants.revokedAt)))
      .returning();
    return row ?? null;
  }

  async find(paymentId: string) {
    return this.db.query.creditGrants.findFirst({ where: eq(creditGrants.paymentId, paymentId) });
  }
}
