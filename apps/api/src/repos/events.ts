import type { EventState } from '@wakeupbabe/shared';
import { and, asc, eq, gt, inArray, lte, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { type TrackedEventRow, trackedEvents } from '../db/schema';
import { newId } from '../lib/id';

export type { TrackedEventRow };

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

const ACTIVE_STATES: EventState[] = ['scheduled', 'snoozed'];

/** a late call still beats silence: events stay dispatchable until this long
 * after their start, then the sweep marks them missed */
export const LATE_GRACE_MS = 10 * 60_000;

export class EventRepo {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<TrackedEventRow | null> {
    const row = await this.db.query.trackedEvents.findFirst({ where: eq(trackedEvents.id, id) });
    return row ?? null;
  }

  /**
   * Insert or refresh a flagged event. A reschedule of an event that has not
   * been called yet resets it to 'scheduled' with the new call time; events
   * already acknowledged or missed are left alone.
   */
  async upsert(input: EventUpsert): Promise<void> {
    const now = Date.now();
    await this.db
      .insert(trackedEvents)
      .values({
        id: newId('evt'),
        userId: input.userId,
        googleEventId: input.googleEventId,
        calendarId: input.calendarId,
        title: input.title,
        startsAt: input.startsAt,
        eventTimezone: input.eventTimezone,
        attendeeCount: input.attendeeCount,
        colorId: input.colorId,
        callAt: input.callAt,
        state: 'scheduled',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [trackedEvents.userId, trackedEvents.calendarId, trackedEvents.googleEventId],
        set: {
          title: input.title,
          startsAt: input.startsAt,
          eventTimezone: input.eventTimezone,
          attendeeCount: input.attendeeCount,
          colorId: input.colorId,
          callAt: input.callAt,
          state: sql`CASE
            WHEN ${trackedEvents.state} IN ('scheduled', 'snoozed', 'cancelled') THEN 'scheduled'
            ELSE ${trackedEvents.state}
          END`,
          updatedAt: now,
        },
      });
  }

  /**
   * Cancels every active event for a user, e.g. when the calendar
   * disconnects: without calendar access we can no longer know whether an
   * event moved or was cancelled, so ringing would be guessing.
   */
  async cancelAllActiveForUser(userId: string): Promise<number> {
    const result = await this.db
      .update(trackedEvents)
      .set({ state: 'cancelled', updatedAt: Date.now() })
      .where(
        and(
          eq(trackedEvents.userId, userId),
          inArray(trackedEvents.state, ['scheduled', 'snoozed', 'calling']),
        ),
      );
    return result.meta.changes;
  }

  /**
   * Applies a new lead time to meetings we already track. The delta sync only
   * ever returns what Google says changed, so without this a lead-time change
   * would never reach an event already in the table.
   *
   * Only upcoming 'scheduled' rows: a snoozed event's callAt came from the
   * snooze, not from the lead time, and recomputing it would drag the call
   * back to before the snooze the user just asked for.
   */
  async recomputeCallTimes(userId: string, leadMinutes: number): Promise<number> {
    const now = Date.now();
    const result = await this.db
      .update(trackedEvents)
      .set({ callAt: sql`${trackedEvents.startsAt} - ${leadMinutes * 60_000}`, updatedAt: now })
      .where(
        and(
          eq(trackedEvents.userId, userId),
          eq(trackedEvents.state, 'scheduled'),
          gt(trackedEvents.startsAt, now),
        ),
      );
    return result.meta.changes;
  }

  async cancelByGoogleId(userId: string, calendarId: string, googleEventId: string): Promise<void> {
    await this.db
      .update(trackedEvents)
      .set({ state: 'cancelled', updatedAt: Date.now() })
      .where(
        and(
          eq(trackedEvents.userId, userId),
          eq(trackedEvents.calendarId, calendarId),
          eq(trackedEvents.googleEventId, googleEventId),
          inArray(trackedEvents.state, ['scheduled', 'snoozed', 'calling']),
        ),
      );
  }

  async listDue(nowMs: number, limit: number): Promise<TrackedEventRow[]> {
    return this.db.query.trackedEvents.findMany({
      where: and(
        inArray(trackedEvents.state, ACTIVE_STATES),
        lte(trackedEvents.callAt, nowMs),
        gt(sql`${trackedEvents.startsAt} + ${LATE_GRACE_MS}`, nowMs),
      ),
      orderBy: asc(trackedEvents.callAt),
      limit,
    });
  }

  /** anything still active this long past its start was missed; say so
   * instead of letting it rot in scheduled. Returns the swept rows so the
   * caller can tell their owners. */
  async sweepMissed(
    nowMs: number,
  ): Promise<Array<{ id: string; userId: string; title: string; startsAt: number }>> {
    return this.db
      .update(trackedEvents)
      .set({ state: 'missed', updatedAt: nowMs })
      .where(
        and(
          inArray(trackedEvents.state, ['scheduled', 'snoozed', 'calling']),
          lte(sql`${trackedEvents.startsAt} + ${LATE_GRACE_MS}`, nowMs),
        ),
      )
      .returning({
        id: trackedEvents.id,
        userId: trackedEvents.userId,
        title: trackedEvents.title,
        startsAt: trackedEvents.startsAt,
      });
  }

  /**
   * Claims an event for dispatch. The state guard makes the per-minute cron
   * idempotent: only one tick can move scheduled/snoozed to calling.
   */
  async tryClaimForCalling(id: string): Promise<boolean> {
    const result = await this.db
      .update(trackedEvents)
      .set({ state: 'calling', updatedAt: Date.now() })
      .where(and(eq(trackedEvents.id, id), inArray(trackedEvents.state, ACTIVE_STATES)));
    return result.meta.changes > 0;
  }

  async setState(id: string, state: EventState, callAt?: number): Promise<void> {
    await this.db
      .update(trackedEvents)
      .set({ state, updatedAt: Date.now(), ...(callAt !== undefined ? { callAt } : {}) })
      .where(eq(trackedEvents.id, id));
  }

  async listUpcomingForUser(userId: string, nowMs: number): Promise<TrackedEventRow[]> {
    return this.db.query.trackedEvents.findMany({
      where: and(
        eq(trackedEvents.userId, userId),
        gt(trackedEvents.startsAt, nowMs),
        ne(trackedEvents.state, 'cancelled'),
      ),
      orderBy: asc(trackedEvents.startsAt),
      limit: 25,
    });
  }
}
