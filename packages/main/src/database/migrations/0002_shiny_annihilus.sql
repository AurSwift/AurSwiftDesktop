CREATE TABLE `_app_version` (
	`version` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_baskets` (
	`id` text PRIMARY KEY NOT NULL,
	`basket_code` text NOT NULL,
	`name` text NOT NULL,
	`cart_session_id` text NOT NULL,
	`business_id` text NOT NULL,
	`saved_by` text NOT NULL,
	`shift_id` text,
	`customer_email` text,
	`saved_at` integer NOT NULL,
	`expires_at` integer,
	`retrieved_at` integer,
	`retrieved_count` integer DEFAULT 0,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`cart_session_id`) REFERENCES `cart_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`saved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_baskets_basket_code_unique` ON `saved_baskets` (`basket_code`);--> statement-breakpoint
CREATE INDEX `saved_baskets_business_idx` ON `saved_baskets` (`business_id`);--> statement-breakpoint
CREATE INDEX `saved_baskets_saved_by_idx` ON `saved_baskets` (`saved_by`);--> statement-breakpoint
CREATE INDEX `saved_baskets_saved_at_idx` ON `saved_baskets` (`saved_at`);--> statement-breakpoint
CREATE INDEX `saved_baskets_cart_session_idx` ON `saved_baskets` (`cart_session_id`);--> statement-breakpoint
CREATE INDEX `saved_baskets_shift_idx` ON `saved_baskets` (`shift_id`);--> statement-breakpoint
CREATE INDEX `saved_baskets_code_idx` ON `saved_baskets` (`basket_code`);--> statement-breakpoint
CREATE INDEX `saved_baskets_status_idx` ON `saved_baskets` (`status`);--> statement-breakpoint
CREATE INDEX `saved_baskets_expires_idx` ON `saved_baskets` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `saved_baskets_code_unique` ON `saved_baskets` (`basket_code`);