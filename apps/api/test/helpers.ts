import { env } from 'cloudflare:test';
import type { CallOutcome, EventState, Plan } from '@wakeupbabe/shared';
import { createDb, type Db } from '../src/db/client';
import { calls, trackedEvents, users } from '../src/db/schema';
import { newId } from '../src/lib/id';

export function testDb(): Db {
  return createDb(env.DB);
}

export async function seedUser(
  db: Db,
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<typeof users.$inferSelect> {
  const now = Date.now();
  const [row] = await db
    .insert(users)
    .values({
      id: newId('usr'),
      googleSub: newId('sub'),
      email: 'babe@example.com',
      displayName: 'Babe',
      phoneE164: '+14155550123',
      plan: 'situationship' as Plan,
      callsUsedThisPeriod: 0,
      periodStartedAt: now,
      dndVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) throw new Error('seed user failed');
  return row;
}

export async function seedEvent(
  db: Db,
  userId: string,
  overrides: Partial<typeof trackedEvents.$inferInsert> = {},
): Promise<typeof trackedEvents.$inferSelect> {
  const now = Date.now();
  const startsAt = overrides.startsAt ?? now + 15 * 60_000;
  const [row] = await db
    .insert(trackedEvents)
    .values({
      id: newId('evt'),
      userId,
      googleEventId: newId('gev'),
      calendarId: 'primary',
      title: 'Standup',
      startsAt,
      eventTimezone: 'UTC',
      attendeeCount: 3,
      colorId: '11',
      callAt: startsAt - 15 * 60_000,
      state: 'scheduled' as EventState,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) throw new Error('seed event failed');
  return row;
}

export async function seedCall(
  db: Db,
  userId: string,
  overrides: Partial<typeof calls.$inferInsert> = {},
): Promise<typeof calls.$inferSelect> {
  const now = Date.now();
  const [row] = await db
    .insert(calls)
    .values({
      id: newId('cal'),
      userId,
      eventId: null,
      attempt: 1,
      provider: 'twilio',
      placedAt: now,
      outcome: 'pending' as CallOutcome,
      isTest: false,
      createdAt: now,
      ...overrides,
    })
    .returning();
  if (!row) throw new Error('seed call failed');
  return row;
}
