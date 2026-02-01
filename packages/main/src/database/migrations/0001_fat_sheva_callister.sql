CREATE TABLE `quick_sell_buttons` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text,
	`color` text DEFAULT '#3b82f6',
	`text_color` text DEFAULT '#ffffff',
	`shape` text DEFAULT 'rounded' NOT NULL,
	`link_type` text DEFAULT 'unassigned' NOT NULL,
	`product_id` text,
	`category_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`business_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`page_id`) REFERENCES `quick_sell_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quick_sell_buttons_page_idx` ON `quick_sell_buttons` (`page_id`);--> statement-breakpoint
CREATE INDEX `quick_sell_buttons_business_idx` ON `quick_sell_buttons` (`business_id`);--> statement-breakpoint
CREATE INDEX `quick_sell_buttons_product_idx` ON `quick_sell_buttons` (`product_id`);--> statement-breakpoint
CREATE INDEX `quick_sell_buttons_category_idx` ON `quick_sell_buttons` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quick_sell_buttons_page_position_unique` ON `quick_sell_buttons` (`page_id`,`position`);--> statement-breakpoint
CREATE TABLE `quick_sell_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`page_index` integer NOT NULL,
	`is_main_screen` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`business_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quick_sell_pages_business_idx` ON `quick_sell_pages` (`business_id`);--> statement-breakpoint
CREATE INDEX `quick_sell_pages_index_idx` ON `quick_sell_pages` (`page_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `quick_sell_pages_business_index_unique` ON `quick_sell_pages` (`business_id`,`page_index`);