CREATE TABLE `counters` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `demo_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_hash` text NOT NULL,
	`ip_hash` text NOT NULL,
	`cost_usd` real NOT NULL,
	`provider_call_id` text,
	`answered_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_demo_calls_window` ON `demo_calls` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_demo_calls_phone` ON `demo_calls` (`phone_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_demo_calls_ip` ON `demo_calls` (`ip_hash`,`created_at`);