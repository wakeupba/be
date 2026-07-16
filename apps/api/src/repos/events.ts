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
        gt(trackedEvents.startsAt, nowMs),
      ),
      orderBy: asc(trackedEvents.callAt),
      limit,
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
