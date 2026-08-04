import type { CallOutcome, EventState, LeadMinutes, Plan } from '@wakeupbabe/shared';
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// All timestamps are unix epoch milliseconds (UTC). Event-local timezones are
// stored separately because call scheduling must survive DST transitions.

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  phoneE164: text('phone_e164'),
  region: text('region').notNull().default('US'),
  plan: text('plan').$type<Plan>().notNull().default('situationship'),
  callsUsedThisPeriod: integer('calls_used_this_period').notNull().default(0),
  periodStartedAt: integer('period_started_at').notNull(),
  extraCallCredits: integer('extra_call_credits').notNull().default(0),
  // completed top-up purchases this period, for the per-period pack cap
  topupPacksThisPeriod: integer('topup_packs_this_period').notNull().default(0),
  triggerColorId: text('trigger_color_id').notNull().default('11'), // Google Calendar 'Tomato'
  leadMinutes: integer('lead_minutes').$type<LeadMinutes>().notNull().default(15),
  timezone: text('timezone').notNull().default('UTC'),
  dndVerifiedAt: integer('dnd_verified_at'),
  dodoCustomerId: text('dodo_customer_id'),
  // the one active subscription; lifecycle events for any other id are stale
  dodoSubscriptionId: text('dodo_subscription_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const oauthTokens = sqliteTable('oauth_tokens', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenEnc: text('refresh_token_enc').notNull(),
  accessTokenEnc: text('access_token_enc'),
  accessTokenExpiresAt: integer('access_token_expires_at'),
  calendarSyncToken: text('calendar_sync_token'),
  // when we last *asked* Google, successful or not: the cooldown behind the
  // dashboard's refresh button. A failed attempt has to count, or a revoked
  // grant turns refresh-spam into a stream of failing calls
  lastSyncAttemptAt: integer('last_sync_attempt_at'),
  updatedAt: integer('updated_at').notNull(),
});

export const trackedEvents = sqliteTable(
  'tracked_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    googleEventId: text('google_event_id').notNull(),
    calendarId: text('calendar_id').notNull(),
    title: text('title').notNull(),
    startsAt: integer('starts_at').notNull(),
    eventTimezone: text('event_timezone').notNull(),
    attendeeCount: integer('attendee_count').notNull().default(0),
    colorId: text('color_id').notNull(),
    callAt: integer('call_at').notNull(),
    state: text('state').$type<EventState>().notNull().default('scheduled'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_tracked_events_identity').on(table.userId, table.calendarId, table.googleEventId),
    index('idx_tracked_events_due').on(table.state, table.callAt),
  ],
);

export const calls = sqliteTable(
  'calls',
  {
    id: text('id').primaryKey(),
    // NULL for DND verification test calls, which have no calendar event
    eventId: text('event_id').references(() => trackedEvents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull().default(1),
    provider: text('provider').notNull().default('twilio'),
    providerCallId: text('provider_call_id'),
    placedAt: integer('placed_at'),
    answeredAt: integer('answered_at'),
    endedAt: integer('ended_at'),
    outcome: text('outcome').$type<CallOutcome>().notNull().default('pending'),
    isTest: integer('is_test', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_calls_user').on(table.userId, table.createdAt)],
);

export const featureVotes = sqliteTable(
  'feature_votes',
  {
    featureKey: text('feature_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    note: text('note'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.featureKey, table.userId] })],
);

export const waitlist = sqliteTable('waitlist', {
  email: text('email').primaryKey(),
  region: text('region').notNull(),
  createdAt: integer('created_at').notNull(),
});

// processed billing webhook ids: providers redeliver with the same id on
// retry, and credit grants must not double-apply
export const webhookEvents = sqliteTable('webhook_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  processedAt: integer('processed_at').notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type TokenRow = typeof oauthTokens.$inferSelect;
export type TrackedEventRow = typeof trackedEvents.$inferSelect;
export type CallRow = typeof calls.$inferSelect;
