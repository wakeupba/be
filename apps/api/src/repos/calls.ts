import type { CallOutcome } from '@wakeupbabe/shared';
import { and, desc, eq, gte, max, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { type CallRow, calls, trackedEvents } from '../db/schema';
import { newId } from '../lib/id';

export type { CallRow };

export class CallRepo {
  constructor(private readonly db: Db) {}

  async create(input: {
    eventId: string | null;
    userId: string;
    attempt: number;
    isTest?: boolean;
  }): Promise<CallRow> {
    const [created] = await this.db
      .insert(calls)
      .values({
        id: newId('call'),
        eventId: input.eventId,
        userId: input.userId,
        attempt: input.attempt,
        isTest: input.isTest ?? false,
        createdAt: Date.now(),
      })
      .returning();
    if (!created) throw new Error('call insert did not persist');
    return created;
  }

  async findById(id: string): Promise<CallRow | null> {
    const row = await this.db.query.calls.findFirst({ where: eq(calls.id, id) });
    return row ?? null;
  }

  async markPlaced(id: string, providerCallId: string): Promise<void> {
    await this.db.update(calls).set({ providerCallId, placedAt: Date.now() }).where(eq(calls.id, id));
  }

  async markAnswered(id: string): Promise<void> {
    await this.db.update(calls).set({ answeredAt: Date.now() }).where(eq(calls.id, id));
  }

  async finish(id: string, outcome: CallOutcome): Promise<void> {
    await this.db.update(calls).set({ outcome, endedAt: Date.now() }).where(eq(calls.id, id));
  }

  async latestAttemptForEvent(eventId: string): Promise<number> {
    const [row] = await this.db
      .select({ maxAttempt: max(calls.attempt) })
      .from(calls)
      .where(eq(calls.eventId, eventId));
    return row?.maxAttempt ?? 0;
  }

  async countTestCallsSince(userId: string, sinceMs: number): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`COUNT(*)` })
      .from(calls)
      .where(and(eq(calls.userId, userId), eq(calls.isTest, true), gte(calls.createdAt, sinceMs)));
    return row?.n ?? 0;
  }

  async listHistoryForUser(userId: string): Promise<
    Array<
      CallRow & {
        eventTitle: string;
        eventStartsAt: number | null;
        attendeeCount: number | null;
        colorId: string | null;
        googleEventId: string | null;
      }
    >
  > {
    const rows = await this.db
      .select({
        call: calls,
        eventTitle: sql<string>`COALESCE(${trackedEvents.title}, 'Verification call')`,
        eventStartsAt: trackedEvents.startsAt,
        attendeeCount: trackedEvents.attendeeCount,
        colorId: trackedEvents.colorId,
        googleEventId: trackedEvents.googleEventId,
      })
      .from(calls)
      .leftJoin(trackedEvents, eq(trackedEvents.id, calls.eventId))
      .where(eq(calls.userId, userId))
      .orderBy(desc(calls.createdAt))
      .limit(50);
    return rows.map((row) => ({
      ...row.call,
      eventTitle: row.eventTitle,
      eventStartsAt: row.eventStartsAt ?? null,
      attendeeCount: row.attendeeCount ?? null,
      colorId: row.colorId ?? null,
      googleEventId: row.googleEventId ?? null,
    }));
  }
}
