import type { CallOutcome, EventState, LeadMinutes, Plan } from '@wakeupbabe/shared';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

/* Retired. Nothing writes here any more: the landing page no longer asks people
 * to wait for a region, because most of the regions it asked about are live, and
 * the ones that are not are recorded in region_interest at the point a real
 * number is refused. Kept only so the table is dropped in a deliberate
 * migration rather than as a side effect of deleting a route. */
export const waitlist = sqliteTable('waitlist', {
  email: text('email').primaryKey(),
  region: text('region').notNull(),
  createdAt: integer('created_at').notNull(),
});

/*
 * Destinations we turned away because ringing them costs more than the plan
 * earns. One row per user, so a repeated attempt is demand signal rather than a
 * duplicate: attempts says how much someone wants their country covered, and
 * rateUsd says what agreeing would cost.
 *
 * The number itself is deliberately absent. Deciding which region to open next
 * needs the destination, not the subscriber: country and rate answer that
 * question completely, and the digits would only be a thing to disclose and a
 * thing to leak.
 */
export const regionInterest = sqliteTable(
  'region_interest',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** ISO country, or null when the number parsed but belongs to no country
     * libphonenumber recognises */
    country: text('country'),
    /** the table prefix that priced it, so a country with mixed ranges can be
     * told apart from one that is dear throughout */
    prefix: text('prefix'),
    // null when no prefix matched at all, which is its own useful signal
    rateUsd: real('rate_usd'),
    attempts: integer('attempts').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('idx_region_interest_rate').on(table.rateUsd)],
);

/*
 * Integer counters with a ceiling, incremented atomically.
 *
 * Exists because the slot-claiming limiter costs one write per slot it probes,
 * which is fine for a cap of five and unusable for a cap of thousands: the
 * busiest moment would spend the most writes refusing people. A single guarded
 * UPDATE is one round trip whatever the ceiling, and cannot overshoot it.
 */
export const counters = sqliteTable('counters', {
  key: text('key').primaryKey(),
  value: integer('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/*
 * Every demo call the landing page placed. One table serves four jobs, which is
 * why it holds cost rather than just a count: the weekly budget sums costUsd,
 * the per-visitor and per-number caps count rows, and the whole thing is the
 * audit trail for an endpoint that spends money without a session behind it.
 *
 * The number and the IP are stored as HMACs, never in the clear. A demo caller
 * is not a user and we have no reason to keep their number: the only thing we
 * need is to recognise the same one coming back.
 */
export const demoCalls = sqliteTable(
  'demo_calls',
  {
    id: text('id').primaryKey(),
    phoneHash: text('phone_hash').notNull(),
    ipHash: text('ip_hash').notNull(),
    /* what Twilio will bill: reserved before dialling, and zeroed if the call
     * was never answered, since unanswered calls are free */
    costUsd: real('cost_usd').notNull(),
    providerCallId: text('provider_call_id'),
    answeredAt: integer('answered_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_demo_calls_window').on(table.createdAt),
    index('idx_demo_calls_phone').on(table.phoneHash, table.createdAt),
    index('idx_demo_calls_ip').on(table.ipHash, table.createdAt),
  ],
);

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
