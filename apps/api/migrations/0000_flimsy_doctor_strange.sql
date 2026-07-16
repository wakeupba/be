CREATE TABLE `calls` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`user_id` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`provider` text DEFAULT 'plivo' NOT NULL,
	`provider_call_id` text,
	`placed_at` integer,
	`answered_at` integer,
	`ended_at` integer,
	`outcome` text DEFAULT 'pending' NOT NULL,
	`is_test` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `tracked_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_calls_user` ON `calls` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `feature_votes` (
	`feature_key` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`feature_key`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`user_id` text PRIMARY KEY NOT NULL,
	`refresh_token_enc` text NOT NULL,
	`access_token_enc` text,
	`access_token_expires_at` integer,
	`calendar_sync_token` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tracked_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`google_event_id` text NOT NULL,
	`calendar_id` text NOT NULL,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`event_timezone` text NOT NULL,
	`attendee_count` integer DEFAULT 0 NOT NULL,
	`color_id` text NOT NULL,
	`call_at` integer NOT NULL,
	`state` text DEFAULT 'scheduled' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tracked_events_identity` ON `tracked_events` (`user_id`,`calendar_id`,`google_event_id`);--> statement-breakpoint
CREATE INDEX `idx_tracked_events_due` ON `tracked_events` (`state`,`call_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`phone_e164` text,
	`region` text DEFAULT 'US' NOT NULL,
	`plan` text DEFAULT 'situationship' NOT NULL,
	`calls_used_this_period` integer DEFAULT 0 NOT NULL,
	`period_started_at` integer NOT NULL,
	`extra_call_credits` integer DEFAULT 0 NOT NULL,
	`trigger_color_id` text DEFAULT '11' NOT NULL,
	`lead_minutes` integer DEFAULT 15 NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`dnd_verified_at` integer,
	`dodo_customer_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);