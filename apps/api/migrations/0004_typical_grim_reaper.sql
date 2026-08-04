CREATE TABLE `region_interest` (
	`user_id` text PRIMARY KEY NOT NULL,
	`phone_e164` text NOT NULL,
	`rate_usd` real,
	`attempts` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_region_interest_rate` ON `region_interest` (`rate_usd`);