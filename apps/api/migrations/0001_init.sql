-- Wake Up Babe initial schema
-- All timestamps are unix epoch milliseconds (UTC). Event-local timezones are
-- stored separately because call scheduling must survive DST transitions.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  phone_e164 TEXT,
  region TEXT NOT NULL DEFAULT 'US',
  plan TEXT NOT NULL DEFAULT 'situationship' CHECK (plan IN ('situationship', 'ride_or_die')),
  calls_used_this_period INTEGER NOT NULL DEFAULT 0,
  period_started_at INTEGER NOT NULL,
  extra_call_credits INTEGER NOT NULL DEFAULT 0,
  trigger_color_id TEXT NOT NULL DEFAULT '11', -- Google Calendar 'Tomato'
  lead_minutes INTEGER NOT NULL DEFAULT 15 CHECK (lead_minutes IN (10, 15, 30)),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  dnd_verified_at INTEGER,
  dodo_customer_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE oauth_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_enc TEXT NOT NULL,
  access_token_enc TEXT,
  access_token_expires_at INTEGER,
  calendar_sync_token TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE tracked_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  title TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  event_timezone TEXT NOT NULL,
  attendee_count INTEGER NOT NULL DEFAULT 0,
  color_id TEXT NOT NULL,
  call_at INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (state IN ('scheduled', 'calling', 'acknowledged', 'snoozed', 'missed', 'cancelled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, calendar_id, google_event_id)
);

CREATE INDEX idx_tracked_events_due
  ON tracked_events (state, call_at)
  WHERE state IN ('scheduled', 'snoozed');

CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES tracked_events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'plivo',
  provider_call_id TEXT,
  placed_at INTEGER,
  answered_at INTEGER,
  ended_at INTEGER,
  outcome TEXT NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'answered_ack', 'answered_snooze', 'answered_no_input', 'no_answer', 'failed')),
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_calls_user ON calls (user_id, created_at DESC);

CREATE TABLE feature_votes (
  feature_key TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (feature_key, user_id)
);
