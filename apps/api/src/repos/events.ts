import type { EventState } from '@wakeupbabe/shared';
import { newId } from '../lib/id';

export interface TrackedEventRow {
  id: string;
  user_id: string;
  google_event_id: string;
  calendar_id: string;
  title: string;
  starts_at: number;
  event_timezone: string;
  attendee_count: number;
  color_id: string;
  call_at: number;
  state: EventState;
  created_at: number;
  updated_at: number;
}

export interface EventUpsert {
  userId: string;
  googleEventId: string;
  calendarId: string;
  title: string;
  startsAt: number;
  eventTimezone: string;
  attendeeCount: number;
  colorId: string;
  callAt: number;
}

export class EventRepo {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<TrackedEventRow | null> {
    return this.db.prepare('SELECT * FROM tracked_events WHERE id = ?').bind(id).first<TrackedEventRow>();
  }

  /**
   * Insert or refresh a flagged event. A reschedule of an event that has not
   * been called yet resets it to 'scheduled' with the new call time; events
   * already acknowledged or missed are left alone.
   */
  async upsert(input: EventUpsert): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO tracked_events
           (id, user_id, google_event_id, calendar_id, title, starts_at, event_timezone,
            attendee_count, color_id, call_at, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)
         ON CONFLICT (user_id, calendar_id, google_event_id) DO UPDATE SET
           title = excluded.title,
           starts_at = excluded.starts_at,
           event_timezone = excluded.event_timezone,
           attendee_count = excluded.attendee_count,
           color_id = excluded.color_id,
           call_at = excluded.call_at,
           state = CASE
             WHEN tracked_events.state IN ('scheduled', 'snoozed', 'cancelled') THEN 'scheduled'
             ELSE tracked_events.state
           END,
           updated_at = excluded.updated_at`,
      )
      .bind(
        newId('evt'),
        input.userId,
        input.googleEventId,
        input.calendarId,
        input.title,
        input.startsAt,
        input.eventTimezone,
        input.attendeeCount,
        input.colorId,
        input.callAt,
        now,
        now,
      )
      .run();
  }

  async cancelByGoogleId(userId: string, calendarId: string, googleEventId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE tracked_events SET state = 'cancelled', updated_at = ?
         WHERE user_id = ? AND calendar_id = ? AND google_event_id = ?
           AND state IN ('scheduled', 'snoozed', 'calling')`,
      )
      .bind(Date.now(), userId, calendarId, googleEventId)
      .run();
  }

  async listDue(nowMs: number, limit: number): Promise<TrackedEventRow[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM tracked_events
         WHERE state IN ('scheduled', 'snoozed') AND call_at <= ? AND starts_at > ?
         ORDER BY call_at ASC LIMIT ?`,
      )
      .bind(nowMs, nowMs, limit)
      .all<TrackedEventRow>();
    return result.results;
  }

  /**
   * Claims an event for dispatch. The state guard makes the per-minute cron
   * idempotent: only one tick can move scheduled/snoozed to calling.
   */
  async tryClaimForCalling(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        `UPDATE tracked_events SET state = 'calling', updated_at = ?
         WHERE id = ? AND state IN ('scheduled', 'snoozed')`,
      )
      .bind(Date.now(), id)
      .run();
    return result.meta.changes > 0;
  }

  async setState(id: string, state: EventState, callAt?: number): Promise<void> {
    if (callAt !== undefined) {
      await this.db
        .prepare('UPDATE tracked_events SET state = ?, call_at = ?, updated_at = ? WHERE id = ?')
        .bind(state, callAt, Date.now(), id)
        .run();
      return;
    }
    await this.db
      .prepare('UPDATE tracked_events SET state = ?, updated_at = ? WHERE id = ?')
      .bind(state, Date.now(), id)
      .run();
  }

  async listUpcomingForUser(userId: string, nowMs: number): Promise<TrackedEventRow[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM tracked_events
         WHERE user_id = ? AND starts_at > ? AND state != 'cancelled'
         ORDER BY starts_at ASC LIMIT 25`,
      )
      .bind(userId, nowMs)
      .all<TrackedEventRow>();
    return result.results;
  }
}
