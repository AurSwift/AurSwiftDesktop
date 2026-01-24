CREATE TABLE `_app_version` (
	`version` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `age_verification_records` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text,
	`transaction_item_id` text,
	`product_id` text NOT NULL,
	`verification_method` text NOT NULL,
	`customer_birthdate` integer,
	`calculated_age` integer,
	`id_scan_data` text,
	`verified_by` text NOT NULL,
	`manager_override_id` text,
	`override_reason` text,
	`business_id` text NOT NULL,
	`verified_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transaction_item_id`) REFERENCES `transaction_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manager_override_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `age_verification_transaction_idx` ON `age_verification_records` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `age_verification_transaction_item_idx` ON `age_verification_records` (`transaction_item_id`);--> statement-breakpoint
CREATE INDEX `age_verification_product_idx` ON `age_verification_records` (`product_id`);--> statement-breakpoint
CREATE INDEX `age_verification_verified_by_idx` ON `age_verification_records` (`verified_by`);--> statement-breakpoint
CREATE INDEX `age_verification_business_idx` ON `age_verification_records` (`business_id`);--> statement-breakpoint
CREATE INDEX `age_verification_verified_at_idx` ON `age_verification_records` (`verified_at`);--> statement-breakpoint
CREATE INDEX `age_verification_business_date_idx` ON `age_verification_records` (`business_id`,`verified_at`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `attendance_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`period_start_date` text NOT NULL,
	`period_end_date` text NOT NULL,
	`period_type` text NOT NULL,
	`total_shifts` integer DEFAULT 0 NOT NULL,
	`completed_shifts` integer DEFAULT 0 NOT NULL,
	`incomplete_shifts` integer DEFAULT 0 NOT NULL,
	`total_hours` real DEFAULT 0 NOT NULL,
	`regular_hours` real DEFAULT 0 NOT NULL,
	`overtime_hours` real DEFAULT 0 NOT NULL,
	`late_clock_ins` integer DEFAULT 0 NOT NULL,
	`missed_clock_outs` integer DEFAULT 0 NOT NULL,
	`tardiness_minutes` integer DEFAULT 0 NOT NULL,
	`average_hours_per_shift` real DEFAULT 0 NOT NULL,
	`average_tardiness_minutes` real DEFAULT 0 NOT NULL,
	`report_generated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`data_up_to` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attendance_reports_user_period_idx` ON `attendance_reports` (`user_id`,`period_start_date`);--> statement-breakpoint
CREATE INDEX `attendance_reports_business_period_idx` ON `attendance_reports` (`business_id`,`period_type`);--> statement-breakpoint
CREATE INDEX `attendance_reports_report_generated_at_idx` ON `attendance_reports` (`report_generated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_reports_unique` ON `attendance_reports` (`user_id`,`period_start_date`,`period_end_date`,`business_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`details` text,
	`ip_address` text,
	`terminal_id` text,
	`timestamp` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `break_policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`max_consecutive_hours` real DEFAULT 6 NOT NULL,
	`warn_before_required_minutes` integer DEFAULT 30 NOT NULL,
	`auto_enforce_breaks` integer DEFAULT true NOT NULL,
	`allow_skip_break` integer DEFAULT false NOT NULL,
	`require_manager_override` integer DEFAULT false NOT NULL,
	`min_staff_for_break` integer DEFAULT 1,
	`is_active` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `break_policies_business_idx` ON `break_policies` (`business_id`);--> statement-breakpoint
CREATE INDEX `break_policies_active_idx` ON `break_policies` (`is_active`);--> statement-breakpoint
CREATE INDEX `break_policies_default_idx` ON `break_policies` (`is_default`);--> statement-breakpoint
CREATE TABLE `break_policy_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`policy_id` integer NOT NULL,
	`break_type_id` integer NOT NULL,
	`min_shift_hours` real NOT NULL,
	`max_shift_hours` real,
	`allowed_count` integer DEFAULT 1 NOT NULL,
	`is_mandatory` integer DEFAULT false NOT NULL,
	`earliest_after_hours` real,
	`latest_before_end_hours` real,
	`priority` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`policy_id`) REFERENCES `break_policies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`break_type_id`) REFERENCES `break_type_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `break_policy_rules_policy_idx` ON `break_policy_rules` (`policy_id`);--> statement-breakpoint
CREATE INDEX `break_policy_rules_type_idx` ON `break_policy_rules` (`break_type_id`);--> statement-breakpoint
CREATE INDEX `break_policy_rules_shift_hours_idx` ON `break_policy_rules` (`min_shift_hours`);--> statement-breakpoint
CREATE TABLE `break_type_definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`default_duration_minutes` integer DEFAULT 15 NOT NULL,
	`min_duration_minutes` integer DEFAULT 5 NOT NULL,
	`max_duration_minutes` integer DEFAULT 60 NOT NULL,
	`is_paid` integer DEFAULT false NOT NULL,
	`is_required` integer DEFAULT false NOT NULL,
	`counts_as_worked_time` integer DEFAULT false NOT NULL,
	`allowed_window_start` text,
	`allowed_window_end` text,
	`icon` text DEFAULT 'coffee',
	`color` text DEFAULT '#6B7280',
	`sort_order` integer DEFAULT 0,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `break_type_defs_business_idx` ON `break_type_definitions` (`business_id`);--> statement-breakpoint
CREATE INDEX `break_type_defs_code_idx` ON `break_type_definitions` (`code`);--> statement-breakpoint
CREATE INDEX `break_type_defs_active_idx` ON `break_type_definitions` (`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `break_type_defs_business_code_unique` ON `break_type_definitions` (`business_id`,`code`);--> statement-breakpoint
CREATE TABLE `breaks` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`type` text DEFAULT 'rest' NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`duration_seconds` integer,
	`is_paid` integer DEFAULT false,
	`status` text DEFAULT 'active' NOT NULL,
	`is_required` integer DEFAULT false,
	`required_reason` text,
	`minimum_duration_seconds` integer,
	`scheduled_start` integer,
	`scheduled_end` integer,
	`is_missed` integer DEFAULT false,
	`is_short` integer DEFAULT false,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `breaks_shift_idx` ON `breaks` (`shift_id`);--> statement-breakpoint
CREATE INDEX `breaks_user_idx` ON `breaks` (`user_id`);--> statement-breakpoint
CREATE INDEX `breaks_business_idx` ON `breaks` (`business_id`);--> statement-breakpoint
CREATE INDEX `breaks_status_idx` ON `breaks` (`status`);--> statement-breakpoint
CREATE INDEX `breaks_type_idx` ON `breaks` (`type`);--> statement-breakpoint
CREATE INDEX `breaks_start_time_idx` ON `breaks` (`start_time`);--> statement-breakpoint
CREATE INDEX `breaks_shift_status_idx` ON `breaks` (`shift_id`,`status`);--> statement-breakpoint
CREATE INDEX `breaks_user_start_idx` ON `breaks` (`user_id`,`start_time`);--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`firstName` text NOT NULL,
	`lastName` text NOT NULL,
	`businessName` text NOT NULL,
	`ownerId` text NOT NULL,
	`email` text DEFAULT '',
	`phone` text DEFAULT '',
	`website` text DEFAULT '',
	`address` text DEFAULT '',
	`country` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`postalCode` text DEFAULT '',
	`receipt_email_gmail_user` text DEFAULT '',
	`receipt_email_gmail_app_password` text DEFAULT '',
	`receipt_email_gmail_app_password_encrypted` integer DEFAULT false,
	`receipt_email_updated_at` integer,
	`vatNumber` text DEFAULT '',
	`businessType` text DEFAULT 'retail' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`isActive` integer DEFAULT true,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `businesses_vatNumber_unique` ON `businesses` (`vatNumber`);--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_session_id` text NOT NULL,
	`product_id` text,
	`category_id` text,
	`item_name` text,
	`item_type` text NOT NULL,
	`quantity` integer,
	`weight` real,
	`unit_of_measure` text,
	`unit_price` real NOT NULL,
	`total_price` real NOT NULL,
	`tax_amount` real NOT NULL,
	`batch_id` text,
	`batch_number` text,
	`expiry_date` integer,
	`age_restriction_level` text DEFAULT 'NONE',
	`age_verified` integer DEFAULT false,
	`scale_reading_weight` real,
	`scale_reading_stable` integer DEFAULT true,
	`added_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`cart_session_id`) REFERENCES `cart_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`) REFERENCES `product_batches`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `cart_items_session_idx` ON `cart_items` (`cart_session_id`);--> statement-breakpoint
CREATE INDEX `cart_items_product_idx` ON `cart_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `cart_items_category_idx` ON `cart_items` (`category_id`);--> statement-breakpoint
CREATE INDEX `cart_items_batch_idx` ON `cart_items` (`batch_id`);--> statement-breakpoint
CREATE INDEX `cart_items_type_idx` ON `cart_items` (`item_type`);--> statement-breakpoint
CREATE TABLE `cart_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`cashier_id` text NOT NULL,
	`shift_id` text,
	`business_id` text NOT NULL,
	`terminal_id` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`total_amount` real DEFAULT 0,
	`tax_amount` real DEFAULT 0,
	`customer_age_verified` integer DEFAULT false,
	`verification_method` text DEFAULT 'NONE',
	`verified_by` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cart_sessions_status_idx` ON `cart_sessions` (`status`,`cashier_id`);--> statement-breakpoint
CREATE INDEX `cart_sessions_created_idx` ON `cart_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `cart_sessions_shift_idx` ON `cart_sessions` (`shift_id`);--> statement-breakpoint
CREATE INDEX `cart_sessions_business_idx` ON `cart_sessions` (`business_id`);--> statement-breakpoint
CREATE TABLE `cash_drawer_counts` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`terminal_id` text,
	`count_type` text NOT NULL,
	`expected_amount` real NOT NULL,
	`counted_amount` real NOT NULL,
	`variance` real NOT NULL,
	`notes` text,
	`counted_by` text NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`counted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cash_drawer_counts_shift_idx` ON `cash_drawer_counts` (`shift_id`);--> statement-breakpoint
CREATE INDEX `cash_drawer_counts_business_idx` ON `cash_drawer_counts` (`business_id`);--> statement-breakpoint
CREATE INDEX `cash_drawer_counts_timestamp_idx` ON `cash_drawer_counts` (`timestamp`);--> statement-breakpoint
CREATE INDEX `cash_drawer_counts_counted_by_idx` ON `cash_drawer_counts` (`counted_by`);--> statement-breakpoint
CREATE UNIQUE INDEX `cash_drawer_counts_shift_type_unique` ON `cash_drawer_counts` (`shift_id`,`count_type`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`description` text,
	`vat_category_id` text,
	`vat_override_percent` real,
	`business_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`color` text,
	`image` text,
	`is_active` integer DEFAULT true,
	`age_restriction_level` text DEFAULT 'NONE',
	`require_id_scan` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`vat_category_id`) REFERENCES `vat_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_business_idx` ON `categories` (`business_id`);--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `categories_vat_idx` ON `categories` (`vat_category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `category_name_business_unique` ON `categories` (`name`,`business_id`);--> statement-breakpoint
CREATE TABLE `clock_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`terminal_id` text NOT NULL,
	`location_id` text,
	`schedule_id` text,
	`type` text NOT NULL,
	`timestamp` integer NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`geolocation` text,
	`ip_address` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `clock_events_user_idx` ON `clock_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `clock_events_business_idx` ON `clock_events` (`business_id`);--> statement-breakpoint
CREATE INDEX `clock_events_timestamp_idx` ON `clock_events` (`timestamp`);--> statement-breakpoint
CREATE INDEX `clock_events_type_idx` ON `clock_events` (`type`);--> statement-breakpoint
CREATE INDEX `clock_events_status_idx` ON `clock_events` (`status`);--> statement-breakpoint
CREATE INDEX `clock_events_schedule_idx` ON `clock_events` (`schedule_id`);--> statement-breakpoint
CREATE INDEX `clock_events_user_timestamp_idx` ON `clock_events` (`user_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `clock_events_business_timestamp_idx` ON `clock_events` (`business_id`,`timestamp`);--> statement-breakpoint
CREATE TABLE `discounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`value` real NOT NULL,
	`businessId` text NOT NULL,
	`applicableTo` text NOT NULL,
	`categoryIds` text,
	`productIds` text,
	`buyQuantity` integer,
	`getQuantity` integer,
	`getDiscountType` text,
	`getDiscountValue` real,
	`minPurchaseAmount` real,
	`minQuantity` integer,
	`maxDiscountAmount` real,
	`startDate` text,
	`endDate` text,
	`isActive` integer DEFAULT true,
	`usageLimit` integer,
	`usageCount` integer DEFAULT 0,
	`perCustomerLimit` integer,
	`priority` integer DEFAULT 0,
	`daysOfWeek` text,
	`timeStart` text,
	`timeEnd` text,
	`requiresCouponCode` integer DEFAULT false,
	`couponCode` text,
	`combinableWithOthers` integer DEFAULT true,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`createdBy` text NOT NULL,
	FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `expiry_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`product_batch_id` text NOT NULL,
	`notification_type` text NOT NULL,
	`days_until_expiry` integer NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`channels` text DEFAULT '[]' NOT NULL,
	`acknowledged_by` text,
	`acknowledged_at` integer,
	`business_id` text NOT NULL,
	`scheduled_for` integer NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`product_batch_id`) REFERENCES `product_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_batch_idx` ON `expiry_notifications` (`product_batch_id`);--> statement-breakpoint
CREATE INDEX `notifications_status_idx` ON `expiry_notifications` (`status`);--> statement-breakpoint
CREATE INDEX `notifications_scheduled_idx` ON `expiry_notifications` (`scheduled_for`);--> statement-breakpoint
CREATE INDEX `notifications_business_idx` ON `expiry_notifications` (`business_id`);--> statement-breakpoint
CREATE INDEX `notifications_type_idx` ON `expiry_notifications` (`notification_type`);--> statement-breakpoint
CREATE TABLE `expiry_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`critical_alert_days` integer DEFAULT 3 NOT NULL,
	`warning_alert_days` integer DEFAULT 7 NOT NULL,
	`info_alert_days` integer DEFAULT 14 NOT NULL,
	`notify_via_email` integer DEFAULT true,
	`notify_via_push` integer DEFAULT true,
	`notify_via_dashboard` integer DEFAULT true,
	`auto_disable_expired` integer DEFAULT true,
	`allow_sell_near_expiry` integer DEFAULT false,
	`near_expiry_threshold` integer DEFAULT 2,
	`notification_recipients` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `expiry_settings_business_idx` ON `expiry_settings` (`business_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `expiry_settings_business_unique` ON `expiry_settings` (`business_id`);--> statement-breakpoint
CREATE TABLE `license_activation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`license_key` text NOT NULL,
	`machine_id_hash` text NOT NULL,
	`terminal_name` text DEFAULT 'Terminal' NOT NULL,
	`activation_id` text,
	`plan_id` text NOT NULL,
	`plan_name` text NOT NULL,
	`max_terminals` integer DEFAULT 1 NOT NULL,
	`features` text DEFAULT '[]' NOT NULL,
	`business_name` text,
	`is_active` integer DEFAULT true NOT NULL,
	`subscription_status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`trial_end` integer,
	`activated_at` integer NOT NULL,
	`last_heartbeat` integer NOT NULL,
	`last_validated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `license_activation_license_key_unique` ON `license_activation` (`license_key`);--> statement-breakpoint
CREATE TABLE `license_validation_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`license_key` text,
	`machine_id_hash` text,
	`error_message` text,
	`server_response` text,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_license_validation_log_action` ON `license_validation_log` (`action`);--> statement-breakpoint
CREATE INDEX `idx_license_validation_log_timestamp` ON `license_validation_log` (`timestamp`);--> statement-breakpoint
CREATE TABLE `print_job_retries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`attempt` integer NOT NULL,
	`error` text NOT NULL,
	`timestamp` text NOT NULL,
	`next_retry_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `print_jobs`(`job_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`job_id` text PRIMARY KEY NOT NULL,
	`printer_name` text NOT NULL,
	`document_path` text,
	`document_type` text NOT NULL,
	`status` text NOT NULL,
	`options` text,
	`metadata` text,
	`created_by` text,
	`business_id` text,
	`terminal_id` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`last_retry_at` text,
	`retry_count` integer DEFAULT 0,
	`progress` integer DEFAULT 0,
	`pages_total` integer,
	`pages_printed` integer,
	`error` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`batch_number` text NOT NULL,
	`manufacturing_date` integer,
	`expiry_date` integer NOT NULL,
	`initial_quantity` real NOT NULL,
	`current_quantity` real NOT NULL,
	`supplier_id` text,
	`purchase_order_number` text,
	`cost_price` real,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`business_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `batches_product_idx` ON `product_batches` (`product_id`);--> statement-breakpoint
CREATE INDEX `batches_expiry_idx` ON `product_batches` (`expiry_date`);--> statement-breakpoint
CREATE INDEX `batches_status_idx` ON `product_batches` (`status`);--> statement-breakpoint
CREATE INDEX `batches_business_idx` ON `product_batches` (`business_id`);--> statement-breakpoint
CREATE INDEX `batches_number_idx` ON `product_batches` (`batch_number`);--> statement-breakpoint
CREATE INDEX `batches_supplier_idx` ON `product_batches` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `batches_product_status_expiry_idx` ON `product_batches` (`product_id`,`status`,`expiry_date`);--> statement-breakpoint
CREATE INDEX `batches_business_status_expiry_idx` ON `product_batches` (`business_id`,`status`,`expiry_date`);--> statement-breakpoint
CREATE INDEX `batches_product_status_quantity_idx` ON `product_batches` (`product_id`,`status`,`current_quantity`);--> statement-breakpoint
CREATE UNIQUE INDEX `batch_number_product_business_unique` ON `product_batches` (`batch_number`,`product_id`,`business_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`base_price` real NOT NULL,
	`cost_price` real DEFAULT 0,
	`sku` text NOT NULL,
	`barcode` text,
	`plu` text,
	`image` text,
	`category_id` text,
	`product_type` text DEFAULT 'STANDARD' NOT NULL,
	`sales_unit` text DEFAULT 'PIECE' NOT NULL,
	`uses_scale` integer DEFAULT false,
	`price_per_kg` real,
	`is_generic_button` integer DEFAULT false,
	`generic_default_price` real,
	`track_inventory` integer DEFAULT true,
	`stock_level` real DEFAULT 0,
	`min_stock_level` real DEFAULT 0,
	`reorder_point` real DEFAULT 0,
	`vat_category_id` text,
	`vat_override_percent` real,
	`business_id` text NOT NULL,
	`is_active` integer DEFAULT true,
	`allow_price_override` integer DEFAULT false,
	`allow_discount` integer DEFAULT true,
	`has_expiry` integer DEFAULT false,
	`shelf_life_days` integer,
	`requires_batch_tracking` integer DEFAULT false,
	`stock_rotation_method` text DEFAULT 'FIFO',
	`age_restriction_level` text DEFAULT 'NONE' NOT NULL,
	`require_id_scan` integer DEFAULT false,
	`restriction_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`vat_category_id`) REFERENCES `vat_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `products_business_idx` ON `products` (`business_id`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_sku_idx` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_barcode_idx` ON `products` (`barcode`);--> statement-breakpoint
CREATE INDEX `products_plu_idx` ON `products` (`plu`);--> statement-breakpoint
CREATE INDEX `products_type_idx` ON `products` (`product_type`);--> statement-breakpoint
CREATE INDEX `products_age_restriction_idx` ON `products` (`age_restriction_level`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_sku_business_unique` ON `products` (`sku`,`business_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`business_id` text NOT NULL,
	`permissions` text NOT NULL,
	`is_system_role` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`shift_required` integer DEFAULT true,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_roles_business` ON `roles` (`business_id`);--> statement-breakpoint
CREATE INDEX `idx_roles_name` ON `roles` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_role_name_per_business` ON `roles` (`business_id`,`name`);--> statement-breakpoint
CREATE TABLE `sales_unit_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`sales_unit_mode` text DEFAULT 'Varying' NOT NULL,
	`fixed_sales_unit` text DEFAULT 'KG' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sales_unit_settings_business_idx` ON `sales_unit_settings` (`business_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sales_unit_settings_business_unique` ON `sales_unit_settings` (`business_id`);--> statement-breakpoint
CREATE TABLE `saved_baskets` (
	`id` text PRIMARY KEY NOT NULL,
	`basket_code` text NOT NULL,
	`name` text NOT NULL,
	`cart_session_id` text NOT NULL,
	`business_id` text NOT NULL,
	`saved_by` text NOT NULL,
	`shift_id` text,
	`customer_email` text,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`saved_at` integer NOT NULL,
	`expires_at` integer,
	`retrieved_at` integer,
	`retrieved_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`cart_session_id`) REFERENCES `cart_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`saved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_baskets_basket_code_unique` ON `saved_baskets` (`basket_code`);--> statement-breakpoint
CREATE INDEX `saved_baskets_code_idx` ON `saved_baskets` (`basket_code`);--> statement-breakpoint
CREATE INDEX `saved_baskets_business_idx` ON `saved_baskets` (`business_id`);--> statement-breakpoint
CREATE INDEX `saved_baskets_saved_by_idx` ON `saved_baskets` (`saved_by`);--> statement-breakpoint
CREATE INDEX `saved_baskets_status_idx` ON `saved_baskets` (`status`);--> statement-breakpoint
CREATE INDEX `saved_baskets_saved_at_idx` ON `saved_baskets` (`saved_at`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`staffId` text NOT NULL,
	`businessId` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`status` text NOT NULL,
	`assignedRegister` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`staffId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `pos_shift_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`total_sales` real DEFAULT 0 NOT NULL,
	`total_refunds` real DEFAULT 0 NOT NULL,
	`total_voids` real DEFAULT 0 NOT NULL,
	`net_sales` real DEFAULT 0 NOT NULL,
	`transaction_count` integer DEFAULT 0 NOT NULL,
	`average_transaction_value` real DEFAULT 0 NOT NULL,
	`expected_cash_amount` real DEFAULT 0 NOT NULL,
	`counted_cash_amount` real DEFAULT 0 NOT NULL,
	`cash_variance` real DEFAULT 0 NOT NULL,
	`planned_start` text,
	`actual_start` text NOT NULL,
	`planned_end` text,
	`actual_end` text,
	`shift_duration_minutes` integer DEFAULT 0 NOT NULL,
	`late_minutes` integer DEFAULT 0,
	`early_minutes` integer DEFAULT 0,
	`report_generated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`period_covered` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pos_shift_reports_shift_id_idx` ON `pos_shift_reports` (`shift_id`);--> statement-breakpoint
CREATE INDEX `pos_shift_reports_business_id_idx` ON `pos_shift_reports` (`business_id`);--> statement-breakpoint
CREATE INDEX `pos_shift_reports_user_id_idx` ON `pos_shift_reports` (`user_id`);--> statement-breakpoint
CREATE INDEX `pos_shift_reports_period_covered_idx` ON `pos_shift_reports` (`period_covered`);--> statement-breakpoint
CREATE INDEX `pos_shift_reports_report_generated_at_idx` ON `pos_shift_reports` (`report_generated_at`);--> statement-breakpoint
CREATE TABLE `shift_validation_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`business_id` text NOT NULL,
	`validation_id` text NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`code` text NOT NULL,
	`severity` text DEFAULT 'medium',
	`category` text NOT NULL,
	`resolved` integer DEFAULT false,
	`resolved_at` text,
	`resolved_by` text,
	`resolution_notes` text,
	`related_entity_id` text,
	`related_entity_type` text,
	`data_snapshot` text
);
--> statement-breakpoint
CREATE INDEX `validation_issues_validation_idx` ON `shift_validation_issues` (`validation_id`);--> statement-breakpoint
CREATE INDEX `validation_issues_type_idx` ON `shift_validation_issues` (`type`);--> statement-breakpoint
CREATE INDEX `validation_issues_severity_idx` ON `shift_validation_issues` (`severity`);--> statement-breakpoint
CREATE INDEX `validation_issues_category_idx` ON `shift_validation_issues` (`category`);--> statement-breakpoint
CREATE INDEX `validation_issues_resolved_idx` ON `shift_validation_issues` (`resolved`);--> statement-breakpoint
CREATE INDEX `validation_issues_business_idx` ON `shift_validation_issues` (`business_id`);--> statement-breakpoint
CREATE INDEX `validation_issues_related_entity_idx` ON `shift_validation_issues` (`related_entity_type`,`related_entity_id`);--> statement-breakpoint
CREATE INDEX `validation_issues_status_severity_idx` ON `shift_validation_issues` (`resolved`,`severity`);--> statement-breakpoint
CREATE UNIQUE INDEX `shift_validation_issues_public_id_unique` ON `shift_validation_issues` (`public_id`);--> statement-breakpoint
CREATE TABLE `shift_validations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`business_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`valid` integer NOT NULL,
	`requires_review` integer NOT NULL,
	`violation_count` integer DEFAULT 0 NOT NULL,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`critical_issue_count` integer DEFAULT 0 NOT NULL,
	`unresolved_issue_count` integer DEFAULT 0 NOT NULL,
	`validated_at` text,
	`validated_by` text,
	`validation_method` text DEFAULT 'auto',
	`resolution` text DEFAULT 'pending',
	`resolved_at` text,
	`resolved_by` text,
	`resolution_notes` text
);
--> statement-breakpoint
CREATE INDEX `shift_validations_shift_idx` ON `shift_validations` (`shift_id`);--> statement-breakpoint
CREATE INDEX `shift_validations_business_idx` ON `shift_validations` (`business_id`);--> statement-breakpoint
CREATE INDEX `shift_validations_valid_idx` ON `shift_validations` (`valid`);--> statement-breakpoint
CREATE INDEX `shift_validations_requires_review_idx` ON `shift_validations` (`requires_review`);--> statement-breakpoint
CREATE INDEX `shift_validations_resolution_idx` ON `shift_validations` (`resolution`);--> statement-breakpoint
CREATE INDEX `shift_validations_unresolved_count_idx` ON `shift_validations` (`unresolved_issue_count`);--> statement-breakpoint
CREATE UNIQUE INDEX `shift_validations_public_id_unique` ON `shift_validations` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shift_validations_shift_unique` ON `shift_validations` (`shift_id`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`schedule_id` text,
	`clock_in_id` text NOT NULL,
	`clock_out_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`terminal_id` text,
	`starting_cash` real,
	`total_sales` real DEFAULT 0,
	`total_transactions` integer DEFAULT 0,
	`total_refunds` real DEFAULT 0,
	`total_voids` real DEFAULT 0,
	`total_hours` real,
	`regular_hours` real,
	`overtime_hours` real,
	`break_duration_seconds` integer DEFAULT 0,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`clock_in_id`) REFERENCES `clock_events`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`clock_out_id`) REFERENCES `clock_events`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shifts_user_idx` ON `shifts` (`user_id`);--> statement-breakpoint
CREATE INDEX `shifts_business_idx` ON `shifts` (`business_id`);--> statement-breakpoint
CREATE INDEX `shifts_status_idx` ON `shifts` (`status`);--> statement-breakpoint
CREATE INDEX `shifts_schedule_idx` ON `shifts` (`schedule_id`);--> statement-breakpoint
CREATE INDEX `shifts_clock_in_idx` ON `shifts` (`clock_in_id`);--> statement-breakpoint
CREATE INDEX `shifts_clock_out_idx` ON `shifts` (`clock_out_id`);--> statement-breakpoint
CREATE INDEX `shifts_terminal_idx` ON `shifts` (`terminal_id`);--> statement-breakpoint
CREATE INDEX `shifts_user_status_idx` ON `shifts` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `shifts_business_created_idx` ON `shifts` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `shifts_user_created_idx` ON `shifts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `shifts_clock_in_unique` ON `shifts` (`clock_in_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shifts_clock_out_unique` ON `shifts` (`clock_out_id`);--> statement-breakpoint
CREATE TABLE `stock_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`reason` text,
	`note` text,
	`userId` text NOT NULL,
	`businessId` text NOT NULL,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`batch_id` text,
	`movement_type` text NOT NULL,
	`quantity` real NOT NULL,
	`reason` text,
	`reference` text,
	`from_batch_id` text,
	`to_batch_id` text,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`) REFERENCES `product_batches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`from_batch_id`) REFERENCES `product_batches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_batch_id`) REFERENCES `product_batches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `movements_product_idx` ON `stock_movements` (`product_id`);--> statement-breakpoint
CREATE INDEX `movements_batch_idx` ON `stock_movements` (`batch_id`);--> statement-breakpoint
CREATE INDEX `movements_timestamp_idx` ON `stock_movements` (`timestamp`);--> statement-breakpoint
CREATE INDEX `movements_type_idx` ON `stock_movements` (`movement_type`);--> statement-breakpoint
CREATE INDEX `movements_business_idx` ON `stock_movements` (`business_id`);--> statement-breakpoint
CREATE INDEX `movements_batch_timestamp_idx` ON `stock_movements` (`batch_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `movements_product_timestamp_idx` ON `stock_movements` (`product_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `movements_reference_idx` ON `stock_movements` (`reference`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_person` text,
	`email` text,
	`phone` text,
	`address` text,
	`business_id` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `suppliers_business_idx` ON `suppliers` (`business_id`);--> statement-breakpoint
CREATE INDEX `suppliers_name_idx` ON `suppliers` (`name`);--> statement-breakpoint
CREATE TABLE `table` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active',
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `table_business_idx` ON `table` (`business_id`);--> statement-breakpoint
CREATE INDEX `table_name_idx` ON `table` (`name`);--> statement-breakpoint
CREATE INDEX `table_status_idx` ON `table` (`status`);--> statement-breakpoint
CREATE TABLE `terminals` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'pos' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`device_token` text,
	`ip_address` text,
	`mac_address` text,
	`settings` text,
	`last_active_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terminals_device_token_unique` ON `terminals` (`device_token`);--> statement-breakpoint
CREATE INDEX `terminals_business_idx` ON `terminals` (`business_id`);--> statement-breakpoint
CREATE INDEX `terminals_status_idx` ON `terminals` (`status`);--> statement-breakpoint
CREATE INDEX `terminals_token_idx` ON `terminals` (`device_token`);--> statement-breakpoint
CREATE TABLE `time_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`clock_event_id` text,
	`shift_id` text,
	`break_id` text,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`correction_type` text NOT NULL,
	`original_time` integer,
	`corrected_time` integer NOT NULL,
	`time_difference_seconds` integer NOT NULL,
	`reason` text NOT NULL,
	`requested_by` text NOT NULL,
	`approved_by` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`clock_event_id`) REFERENCES `clock_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`break_id`) REFERENCES `breaks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `time_corrections_clock_event_idx` ON `time_corrections` (`clock_event_id`);--> statement-breakpoint
CREATE INDEX `time_corrections_shift_idx` ON `time_corrections` (`shift_id`);--> statement-breakpoint
CREATE INDEX `time_corrections_break_idx` ON `time_corrections` (`break_id`);--> statement-breakpoint
CREATE INDEX `time_corrections_user_idx` ON `time_corrections` (`user_id`);--> statement-breakpoint
CREATE INDEX `time_corrections_business_idx` ON `time_corrections` (`business_id`);--> statement-breakpoint
CREATE INDEX `time_corrections_status_idx` ON `time_corrections` (`status`);--> statement-breakpoint
CREATE TABLE `transaction_items` (
	`id` text PRIMARY KEY NOT NULL,
	`transactionId` text NOT NULL,
	`productId` text,
	`category_id` text,
	`productName` text NOT NULL,
	`item_type` text NOT NULL,
	`quantity` integer,
	`weight` real,
	`unit_of_measure` text,
	`unitPrice` real NOT NULL,
	`totalPrice` real NOT NULL,
	`tax_amount` real NOT NULL,
	`refundedQuantity` integer DEFAULT 0,
	`discountAmount` real DEFAULT 0,
	`appliedDiscounts` text,
	`batch_id` text,
	`batch_number` text,
	`expiry_date` integer,
	`age_restriction_level` text DEFAULT 'NONE',
	`age_verified` integer DEFAULT false,
	`cart_item_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`transactionId`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`batch_id`) REFERENCES `product_batches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cart_item_id`) REFERENCES `cart_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`shiftId` text,
	`businessId` text NOT NULL,
	`terminal_id` text,
	`type` text NOT NULL,
	`subtotal` real NOT NULL,
	`tax` real NOT NULL,
	`total` real NOT NULL,
	`paymentMethod` text NOT NULL,
	`cashAmount` real,
	`cardAmount` real,
	`status` text NOT NULL,
	`voidReason` text,
	`customerId` text,
	`receiptNumber` text NOT NULL,
	`timestamp` text NOT NULL,
	`created_at` integer NOT NULL,
	`originalTransactionId` text,
	`refundReason` text,
	`refundMethod` text,
	`managerApprovalId` text,
	`isPartialRefund` integer DEFAULT false,
	`discountAmount` real DEFAULT 0,
	`appliedDiscounts` text,
	`viva_wallet_transaction_id` text,
	`viva_wallet_terminal_id` text,
	`viva_wallet_auth_code` text,
	`viva_wallet_card_brand` text,
	`viva_wallet_card_last4` text,
	`viva_wallet_card_type` text,
	`currency` text DEFAULT 'GBP' NOT NULL,
	FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`originalTransactionId`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`managerApprovalId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`permission` text NOT NULL,
	`granted_by` text,
	`granted_at` integer NOT NULL,
	`expires_at` integer,
	`reason` text,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_user_permissions_user` ON `user_permissions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_permissions_unique` ON `user_permissions` (`user_id`,`permission`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`assigned_by` text,
	`assigned_at` integer NOT NULL,
	`expires_at` integer,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_user_roles_user` ON `user_roles` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_role` ON `user_roles` (`role_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_roles_unique` ON `user_roles` (`user_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`password_hash` text,
	`pin_hash` text NOT NULL,
	`salt` text NOT NULL,
	`requires_pin_change` integer DEFAULT false NOT NULL,
	`firstName` text NOT NULL,
	`lastName` text NOT NULL,
	`businessName` text NOT NULL,
	`businessId` text NOT NULL,
	`primary_role_id` text,
	`shift_required` integer,
	`active_role_context` text,
	`isActive` integer DEFAULT true,
	`address` text DEFAULT '',
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`primary_role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vat_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rate_percent` real NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`business_id` text NOT NULL,
	`is_default` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vat_business_idx` ON `vat_categories` (`business_id`);--> statement-breakpoint
CREATE INDEX `vat_code_idx` ON `vat_categories` (`code`);