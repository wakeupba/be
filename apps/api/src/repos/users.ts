import type { LeadMinutes, Plan } from '@wakeupbabe/shared';
import { newId } from '../lib/id';

export interface UserRow {
  id: string;
  google_sub: string;
  email: string;
  display_name: string | null;
  phone_e164: string | null;
  region: string;
  plan: Plan;
  calls_used_this_period: number;
  period_started_at: number;
  extra_call_credits: number;
  trigger_color_id: string;
  lead_minutes: LeadMinutes;
  timezone: string;
  dnd_verified_at: number | null;
  dodo_customer_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface UserSettingsPatch {
  phone_e164?: string;
  trigger_color_id?: string;
  lead_minutes?: LeadMinutes;
  timezone?: string;
}

export class UserRepo {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<UserRow | null> {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  }

  async findByGoogleSub(googleSub: string): Promise<UserRow | null> {
    return this.db.prepare('SELECT * FROM users WHERE google_sub = ?').bind(googleSub).first<UserRow>();
  }

  async create(input: { googleSub: string; email: string; displayName: string | null }): Promise<UserRow> {
    const now = Date.now();
    const id = newId('usr');
    await this.db
      .prepare(
        `INSERT INTO users (id, google_sub, email, display_name, period_started_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.googleSub, input.email, input.displayName, now, now, now)
      .run();
    const created = await this.findById(id);
    if (!created) throw new Error('user insert did not persist');
    return created;
  }

  async updateSettings(id: string, patch: UserSettingsPatch): Promise<void> {
    const fields = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return;
    const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
    const values = fields.map(([, v]) => v);
    await this.db
      .prepare(`UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`)
      .bind(...values, Date.now(), id)
      .run();
  }

  async markDndVerified(id: string): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare('UPDATE users SET dnd_verified_at = ?, updated_at = ? WHERE id = ?')
      .bind(now, now, id)
      .run();
  }

  async setPlan(id: string, plan: Plan, dodoCustomerId: string | null): Promise<void> {
    await this.db
      .prepare(
        'UPDATE users SET plan = ?, dodo_customer_id = COALESCE(?, dodo_customer_id), updated_at = ? WHERE id = ?',
      )
      .bind(plan, dodoCustomerId, Date.now(), id)
      .run();
  }

  async addCallCredits(id: string, credits: number): Promise<void> {
    await this.db
      .prepare('UPDATE users SET extra_call_credits = extra_call_credits + ?, updated_at = ? WHERE id = ?')
      .bind(credits, Date.now(), id)
      .run();
  }

  /**
   * Consumes one call from the monthly allowance, falling back to prepaid
   * credits. Returns false when the user has nothing left. The guarded
   * UPDATE keeps two concurrent cron ticks from double-spending.
   */
  async consumeCall(user: UserRow, monthlyLimit: number): Promise<boolean> {
    const now = Date.now();
    const withinAllowance = await this.db
      .prepare(
        `UPDATE users SET calls_used_this_period = calls_used_this_period + 1, updated_at = ?
         WHERE id = ? AND calls_used_this_period < ?`,
      )
      .bind(now, user.id, monthlyLimit)
      .run();
    if (withinAllowance.meta.changes > 0) return true;

    const fromCredits = await this.db
      .prepare(
        `UPDATE users SET extra_call_credits = extra_call_credits - 1, updated_at = ?
         WHERE id = ? AND extra_call_credits > 0`,
      )
      .bind(now, user.id)
      .run();
    return fromCredits.meta.changes > 0;
  }

  async resetPeriodIfElapsed(user: UserRow, periodMs: number): Promise<void> {
    if (Date.now() - user.period_started_at < periodMs) return;
    await this.db
      .prepare(
        'UPDATE users SET calls_used_this_period = 0, period_started_at = ?, updated_at = ? WHERE id = ?',
      )
      .bind(Date.now(), Date.now(), user.id)
      .run();
  }

  async listWithConnectedCalendar(): Promise<UserRow[]> {
    const result = await this.db
      .prepare(
        `SELECT users.* FROM users
         JOIN oauth_tokens ON oauth_tokens.user_id = users.id
         WHERE users.phone_e164 IS NOT NULL AND users.dnd_verified_at IS NOT NULL`,
      )
      .all<UserRow>();
    return result.results;
  }
}
