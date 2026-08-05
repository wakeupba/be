CREATE TABLE `credit_grants` (
	`payment_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text DEFAULT 'topup' NOT NULL,
	`packs` integer NOT NULL,
	`calls` integer NOT NULL,
	`granted_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_reason` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_credit_grants_user` ON `credit_grants` (`user_id`);