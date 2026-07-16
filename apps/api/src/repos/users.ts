import type { LeadMinutes, Plan } from '@wakeupbabe/shared';
import { and, eq, getTableColumns, gt, isNotNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { oauthTokens, type UserRow, users } from '../db/schema';
import { newId } from '../lib/id';

export type { UserRow };

export interface UserSettingsPatch {
  phoneE164?: string;
  triggerColorId?: string;
  leadMinutes?: LeadMinutes;
  timezone?: string;
}

export class UserRepo {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<UserRow | null> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    return row ?? null;
  }

  async findByGoogleSub(googleSub: string): Promise<UserRow | null> {
    const row = await this.db.query.users.findFirst({ where: eq(users.googleSub, googleSub) });
    return row ?? null;
  }

  async create(input: { googleSub: string; email: string; displayName: string | null }): Promise<UserRow> {
    const now = Date.now();
    const [created] = await this.db
      .insert(users)
      .values({
        id: newId('usr'),
        googleSub: input.googleSub,
        email: input.email,
        displayName: input.displayName,
        periodStartedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!created) throw new Error('user insert did not persist');
    return created;
  }

  async updateSettings(id: string, patch: UserSettingsPatch): Promise<void> {
    if (Object.values(patch).every((value) => value === undefined)) return;
    await this.db
      .update(users)
      .set({ ...patch, updatedAt: Date.now() })
      .where(eq(users.id, id));
  }

  async markDndVerified(id: string): Promise<void> {
    const now = Date.now();
    await this.db.update(users).set({ dndVerifiedAt: now, updatedAt: now }).where(eq(users.id, id));
  }

  async setPlan(id: string, plan: Plan, dodoCustomerId: string | null): Promise<void> {
    await this.db
      .update(users)
      .set({
        plan,
        updatedAt: Date.now(),
        ...(dodoCustomerId !== null ? { dodoCustomerId } : {}),
      })
      .where(eq(users.id, id));
  }

  async addCallCredits(id: string, credits: number): Promise<void> {
    await this.db
      .update(users)
      .set({ extraCallCredits: sql`${users.extraCallCredits} + ${credits}`, updatedAt: Date.now() })
      .where(eq(users.id, id));
  }

  /**
   * Consumes one call from the monthly allowance, falling back to prepaid
   * credits. Returns false when the user has nothing left. The guarded
   * UPDATE keeps two concurrent cron ticks from double-spending.
   */
  async consumeCall(user: UserRow, monthlyLimit: number): Promise<boolean> {
    const now = Date.now();
    const withinAllowance = await this.db
      .update(users)
      .set({ callsUsedThisPeriod: sql`${users.callsUsedThisPeriod} + 1`, updatedAt: now })
      .where(and(eq(users.id, user.id), lt(users.callsUsedThisPeriod, monthlyLimit)));
    if (withinAllowance.meta.changes > 0) return true;

    const fromCredits = await this.db
      .update(users)
      .set({ extraCallCredits: sql`${users.extraCallCredits} - 1`, updatedAt: now })
      .where(and(eq(users.id, user.id), gt(users.extraCallCredits, 0)));
    return fromCredits.meta.changes > 0;
  }

  async resetPeriodIfElapsed(user: UserRow, periodMs: number): Promise<void> {
    if (Date.now() - user.periodStartedAt < periodMs) return;
    const now = Date.now();
    await this.db
      .update(users)
      .set({ callsUsedThisPeriod: 0, periodStartedAt: now, updatedAt: now })
      .where(eq(users.id, user.id));
  }

  async listWithConnectedCalendar(): Promise<UserRow[]> {
    return this.db
      .select(getTableColumns(users))
      .from(users)
      .innerJoin(oauthTokens, eq(oauthTokens.userId, users.id))
      .where(and(isNotNull(users.phoneE164), isNotNull(users.dndVerifiedAt)));
  }
}
