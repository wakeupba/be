import type { CallOutcome } from '@wakeupbabe/shared';
import { newId } from '../lib/id';

export interface CallRow {
  id: string;
  event_id: string | null;
  user_id: string;
  attempt: number;
  provider: string;
  provider_call_id: string | null;
  placed_at: number | null;
  answered_at: number | null;
  ended_at: number | null;
  outcome: CallOutcome;
  is_test: number;
  created_at: number;
}

export class CallRepo {
  constructor(private readonly db: D1Database) {}

  async create(input: {
    eventId: string | null;
    userId: string;
    attempt: number;
    isTest?: boolean;
  }): Promise<CallRow> {
    const id = newId('call');
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO calls (id, event_id, user_id, attempt, is_test, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.eventId, input.userId, input.attempt, input.isTest ? 1 : 0, now)
      .run();
    return {
      id,
      event_id: input.eventId,
      user_id: input.userId,
      attempt: input.attempt,
      provider: 'plivo',
      provider_call_id: null,
      placed_at: null,
      answered_at: null,
      ended_at: null,
      outcome: 'pending',
      is_test: input.isTest ? 1 : 0,
      created_at: now,
    };
  }

  async findById(id: string): Promise<CallRow | null> {
    return this.db.prepare('SELECT * FROM calls WHERE id = ?').bind(id).first<CallRow>();
  }

  async markPlaced(id: string, providerCallId: string): Promise<void> {
    await this.db
      .prepare('UPDATE calls SET provider_call_id = ?, placed_at = ? WHERE id = ?')
      .bind(providerCallId, Date.now(), id)
      .run();
  }

  async markAnswered(id: string): Promise<void> {
    await this.db.prepare('UPDATE calls SET answered_at = ? WHERE id = ?').bind(Date.now(), id).run();
  }

  async finish(id: string, outcome: CallOutcome): Promise<void> {
    await this.db
      .prepare('UPDATE calls SET outcome = ?, ended_at = ? WHERE id = ?')
      .bind(outcome, Date.now(), id)
      .run();
  }

  async latestAttemptForEvent(eventId: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT MAX(attempt) AS max_attempt FROM calls WHERE event_id = ?')
      .bind(eventId)
      .first<{ max_attempt: number | null }>();
    return row?.max_attempt ?? 0;
  }

  async countTestCallsSince(userId: string, sinceMs: number): Promise<number> {
    const row = await this.db
      .prepare('SELECT COUNT(*) AS n FROM calls WHERE user_id = ? AND is_test = 1 AND created_at >= ?')
      .bind(userId, sinceMs)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async listHistoryForUser(userId: string): Promise<Array<CallRow & { event_title: string }>> {
    const result = await this.db
      .prepare(
        `SELECT calls.*, COALESCE(tracked_events.title, 'Verification call') AS event_title FROM calls
         LEFT JOIN tracked_events ON tracked_events.id = calls.event_id
         WHERE calls.user_id = ?
         ORDER BY calls.created_at DESC LIMIT 50`,
      )
      .bind(userId)
      .all<CallRow & { event_title: string }>();
    return result.results;
  }
}
