        FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade

);

CREATE INDEX `batches_product_idx` ON `product_batches` (`product_id`);
CREATE INDEX `batches_expiry_idx` ON `product_batches` (`expiry_date`);
CREATE INDEX `batches_status_idx` ON `product_batches` (`status`);
CREATE INDEX `batches_business_idx` ON `product_batches` (`business_id`);
CREATE INDEX `batches_number_idx` ON `product_batches` (`batch_number`);
CREATE INDEX `batches_supplier_idx` ON `product_batches` (`supplier_id`);
CREATE INDEX `batches_product_status_expiry_idx` ON `product_batches` (`product_id`,`status`,`expiry_date`);
CREATE INDEX `batches_business_status_expiry_idx` ON `product_batches` (`business_id`,`status`,`expiry_date`);
CREATE INDEX `batches_product_status_quantity_idx` ON `product_batches` (`product_id`,`status`,`current_quantity`);
CREATE UNIQUE INDEX `batch_number_product_business_unique` ON `product_batches` (`batch_number`,`product_id`,`business_id`);
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

CREATE INDEX `products_business_idx` ON `products` (`business_id`);
CREATE INDEX `products_category_idx` ON `products` (`category_id`);
CREATE INDEX `products_sku_idx` ON `products` (`sku`);
CREATE INDEX `products_barcode_idx` ON `products` (`barcode`);
CREATE INDEX `products_plu_idx` ON `products` (`plu`);
CREATE INDEX `products_type_idx` ON `products` (`product_type`);
CREATE INDEX `products_age_restriction_idx` ON `products` (`age_restriction_level`);
CREATE UNIQUE INDEX `product_sku_business_unique` ON `products` (`sku`,`business_id`);
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

CREATE INDEX `idx_roles_business` ON `roles` (`business_id`);
CREATE INDEX `idx_roles_name` ON `roles` (`name`);
CREATE UNIQUE INDEX `unique_role_name_per_business` ON `roles` (`business_id`,`name`);
CREATE TABLE `sales_unit_settings` (
`id` text PRIMARY KEY NOT NULL,
`business_id` text NOT NULL,
`sales_unit_mode` text DEFAULT 'Varying' NOT NULL,
`fixed_sales_unit` text DEFAULT 'KG' NOT NULL,
`created_at` integer NOT NULL,
`updated_at` integer,
FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `sales_unit_settings_business_idx` ON `sales_unit_settings` (`business_id`);
CREATE UNIQUE INDEX `sales_unit_settings_business_unique` ON `sales_unit_settings` (`business_id`);
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

CREATE UNIQUE INDEX `saved_baskets_basket_code_unique` ON `saved_baskets` (`basket_code`);
CREATE INDEX `saved_baskets_business_idx` ON `saved_baskets` (`business_id`);
CREATE INDEX `saved_baskets_saved_by_idx` ON `saved_baskets` (`saved_by`);
CREATE INDEX `saved_baskets_saved_at_idx` ON `saved_baskets` (`saved_at`);
CREATE INDEX `saved_baskets_cart_session_idx` ON `saved_baskets` (`cart_session_id`);
CREATE INDEX `saved_baskets_shift_idx` ON `saved_baskets` (`shift_id`);
CREATE INDEX `saved_baskets_code_idx` ON `saved_baskets` (`basket_code`);
CREATE INDEX `saved_baskets_status_idx` ON `saved_baskets` (`status`);
CREATE INDEX `saved_baskets_expires_idx` ON `saved_baskets` (`expires_at`);
CREATE UNIQUE INDEX `saved_baskets_code_unique` ON `saved_baskets` (`basket_code`);
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

CREATE TABLE `sessions` (
`id` text PRIMARY KEY NOT NULL,
`userId` text NOT NULL,
`token` text NOT NULL,
`expiresAt` text NOT NULL,
`created_at` integer NOT NULL,
`updated_at` integer,
FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);
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

CREATE INDEX `shift_report_view_shift_idx` ON `pos_shift_reports` (`shift_id`);
CREATE INDEX `shift_report_view_business_idx` ON `pos_shift_reports` (`business_id`);
CREATE INDEX `shift_report_view_user_idx` ON `pos_shift_reports` (`user_id`);
CREATE INDEX `shift_report_view_period_idx` ON `pos_shift_reports` (`period_covered`);
CREATE INDEX `shift_report_view_generated_at_idx` ON `pos_shift_reports` (`report_generated_at`);
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

CREATE INDEX `validation_issues_validation_idx` ON `shift_validation_issues` (`validation_id`);
CREATE INDEX `validation_issues_type_idx` ON `shift_validation_issues` (`type`);
CREATE INDEX `validation_issues_severity_idx` ON `shift_validation_issues` (`severity`);
CREATE INDEX `validation_issues_category_idx` ON `shift_validation_issues` (`category`);
CREATE INDEX `validation_issues_resolved_idx` ON `shift_validation_issues` (`resolved`);
CREATE INDEX `validation_issues_business_idx` ON `shift_validation_issues` (`business_id`);
CREATE INDEX `validation_issues_related_entity_idx` ON `shift_validation_issues` (`related_entity_type`,`related_entity_id`);
CREATE INDEX `validation_issues_status_severity_idx` ON `shift_validation_issues` (`resolved`,`severity`);
CREATE UNIQUE INDEX `shift_validation_issues_public_id_unique` ON `shift_validation_issues` (`public_id`);
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

CREATE INDEX `shift_validations_shift_idx` ON `shift_validations` (`shift_id`);
CREATE INDEX `shift_validations_business_idx` ON `shift_validations` (`business_id`);
CREATE INDEX `shift_validations_valid_idx` ON `shift_validations` (`valid`);
CREATE INDEX `shift_validations_requires_review_idx` ON `shift_validations` (`requires_review`);
CREATE INDEX `shift_validations_resolution_idx` ON `shift_validations` (`resolution`);
CREATE INDEX `shift_validations_unresolved_count_idx` ON `shift_validations` (`unresolved_issue_count`);
CREATE UNIQUE INDEX `shift_validations_public_id_unique` ON `shift_validations` (`public_id`);
CREATE UNIQUE INDEX `shift_validations_shift_unique` ON `shift_validations` (`shift_id`);
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

CREATE INDEX `shifts_user_idx` ON `shifts` (`user_id`);
CREATE INDEX `shifts_business_idx` ON `shifts` (`business_id`);
CREATE INDEX `shifts_status_idx` ON `shifts` (`status`);
CREATE INDEX `shifts_schedule_idx` ON `shifts` (`schedule_id`);
CREATE INDEX `shifts_clock_in_idx` ON `shifts` (`clock_in_id`);
CREATE INDEX `shifts_clock_out_idx` ON `shifts` (`clock_out_id`);
CREATE INDEX `shifts_terminal_idx` ON `shifts` (`terminal_id`);
CREATE INDEX `shifts_user_status_idx` ON `shifts` (`user_id`,`status`);
CREATE INDEX `shifts_business_created_idx` ON `shifts` (`business_id`,`created_at`);
CREATE INDEX `shifts_user_created_idx` ON `shifts` (`user_id`,`created_at`);
CREATE UNIQUE INDEX `shifts_clock_in_unique` ON `shifts` (`clock_in_id`);
CREATE UNIQUE INDEX `shifts_clock_out_unique` ON `shifts` (`clock_out_id`);
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

CREATE INDEX `movements_product_idx` ON `stock_movements` (`product_id`);
CREATE INDEX `movements_batch_idx` ON `stock_movements` (`batch_id`);
CREATE INDEX `movements_timestamp_idx` ON `stock_movements` (`timestamp`);
CREATE INDEX `movements_type_idx` ON `stock_movements` (`movement_type`);
CREATE INDEX `movements_business_idx` ON `stock_movements` (`business_id`);
CREATE INDEX `movements_batch_timestamp_idx` ON `stock_movements` (`batch_id`,`timestamp`);
CREATE INDEX `movements_product_timestamp_idx` ON `stock_movements` (`product_id`,`timestamp`);
CREATE INDEX `movements_reference_idx` ON `stock_movements` (`reference`);
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

CREATE INDEX `suppliers_business_idx` ON `suppliers` (`business_id`);
CREATE INDEX `suppliers_name_idx` ON `suppliers` (`name`);
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

CREATE UNIQUE INDEX `terminals_device_token_unique` ON `terminals` (`device_token`);
CREATE INDEX `terminals_business_idx` ON `terminals` (`business_id`);
CREATE INDEX `terminals_status_idx` ON `terminals` (`status`);
CREATE INDEX `terminals_token_idx` ON `terminals` (`device_token`);
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

CREATE INDEX `time_corrections_clock_event_idx` ON `time_corrections` (`clock_event_id`);
CREATE INDEX `time_corrections_shift_idx` ON `time_corrections` (`shift_id`);
CREATE INDEX `time_corrections_break_idx` ON `time_corrections` (`break_id`);
CREATE INDEX `time_corrections_user_idx` ON `time_corrections` (`user_id`);
CREATE INDEX `time_corrections_business_idx` ON `time_corrections` (`business_id`);
CREATE INDEX `time_corrections_status_idx` ON `time_corrections` (`status`);
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
`currency` text DEFAULT 'GBP' NOT NULL,
FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null,
FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action,
FOREIGN KEY (`originalTransactionId`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
FOREIGN KEY (`managerApprovalId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

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

CREATE INDEX `idx_user_permissions_user` ON `user_permissions` (`user_id`);
CREATE UNIQUE INDEX `idx_user_permissions_unique` ON `user_permissions` (`user_id`,`permission`);
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

CREATE INDEX `idx_user_roles_user` ON `user_roles` (`user_id`);
CREATE INDEX `idx_user_roles_role` ON `user_roles` (`role_id`);
CREATE UNIQUE INDEX `idx_user_roles_unique` ON `user_roles` (`user_id`,`role_id`);
CREATE TABLE `users` (
`id` text PRIMARY KEY NOT NULL,
`username` text NOT NULL,
`email` text,
`password_hash` text,
`pin_hash` text NOT NULL,
`salt` text NOT NULL,
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

CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
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

CREATE INDEX `vat_business_idx` ON `vat_categories` (`business_id`);
CREATE INDEX `vat_code_idx` ON `vat_categories` (`code`);

[✓] Changes applied

╭─    ~/Doc/D/F/aurswift/desktop    main \*1 !23 ?20 ────────── ✔  33s   01:43:22 PM  ─╮
╰─ npm run start ─╯

> aurswift@1.26.0 start
> node packages/dev-mode.js

1:43:29 PM [vite] (client) Re-optimizing dependencies because lockfile has changed
npm warn Unknown env config "build-from-source". This will stop working in the next major version of npm.
npm warn Unknown env config "target-platform". This will stop working in the next major version of npm.
npm warn config cache-max This option has been deprecated in favor of `--prefer-online`
npm warn Unknown env config "target-arch". This will stop working in the next major version of npm.
npm warn Unknown env config "python". This will stop working in the next major version of npm.
npm warn config cache-min This option has been deprecated in favor of `--prefer-offline`.
npm warn Unknown env config "msvs-version". This will stop working in the next major version of npm.
npm warn Unknown project config "build-from-source". This will stop working in the next major version of npm.
npm warn Unknown project config "target_platform". This will stop working in the next major version of npm.
npm warn Unknown project config "target_arch". This will stop working in the next major version of npm.
npm warn Unknown project config "cache_max". This will stop working in the next major version of npm.
npm warn Unknown project config "cache_min". This will stop working in the next major version of npm.
npm warn Unknown project config "msvs-version". This will stop working in the next major version of npm.
npm warn Unknown project config "python". This will stop working in the next major version of npm.
vite v7.1.6 building SSR bundle for development...

watching for file changes...

build started...
transforming (1) ../../virtual:browser.jsvite v7.1.6 building SSR bundle for development...

watching for file changes...

build started...
✓ 29 modules transformed.
dist/\_virtual_browser.mjs 0.38 kB │ map: 0.10 kB
dist/exposed.mjs 138.99 kB │ map: 80.00 kB
built in 124ms.
✓ 127 modules transformed.
[plugin vite:reporter]
(!) /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/config.ts is dynamically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/recovery/transaction-recovery.ts but also statically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/index.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/terminal-discovery.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/vivaWalletService.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter]
(!) /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/logger.ts is dynamically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/auditManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/log-path-migration.ts but also statically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/db-manager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/drizzle-migrator.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/drizzle.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/index.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/categoryManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/importManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/inventoryManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/productManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/shiftManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/userManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/userPermissionManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/userRoleManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/seed-data/generators/category-generator.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/seed-data/generators/product-generator.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/seed-data/index.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/utils/db-compatibility.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/utils/db-path-migration.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/utils/db-recovery-dialog.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/utils/db-repair.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/utils/dbInfo.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/index.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/age-verification.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/auth.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/basket.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/batch.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/bookerImportHandlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/business.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/cart.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/cash-drawer.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/category.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/dashboard.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/db.handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/expiryProduct.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/license.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/loggerHandlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/product.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/role.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/sales-unit-settings.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/seed.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/shift.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/supplier.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/terminal.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/time-tracking.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/transaction.handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/update.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/modules/AutoUpdater.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/modules/BlockNotAllowdOrigins.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/modules/ExternalUrls.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/modules/WindowManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/email-service.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/expiryNotificationService.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/licenseService.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/officePrinterService.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/pdfReceiptService.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/scaleService.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/config.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/error-handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/errors/error-logger.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/http-client.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/network-scanner.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/recovery/state-persistence.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/recovery/transaction-recovery.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/retry/circuit-breaker.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/terminal-cache.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/terminal-connection.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/terminal-discovery.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/transaction-builder.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/transaction-manager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/transaction-poller.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/transaction-state-machine.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/vivaWalletService.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/authHelpers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/breakComplianceValidator.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/machineFingerprint.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/rateLimiter.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/rbacHelpers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/scheduleValidator.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/shiftDataValidator.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/shiftRequirementResolver.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/transactionValidator.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter]
(!) /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/shiftRequirementResolver.ts is dynamically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/userManager.ts but also statically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/transactionManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/shift.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/time-tracking.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/transactionValidator.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter]
(!) /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/index.ts is dynamically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/timeTrackingManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/userManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/userManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/userManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/db.handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/db.handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/db.handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/db.handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/db.handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/db.handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/recovery/state-persistence.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/recovery/state-persistence.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/recovery/transaction-recovery.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/recovery/transaction-recovery.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/recovery/transaction-recovery.ts but also statically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/index.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/age-verification.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/auth.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/basket.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/batch.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/bookerImportHandlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/business.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/cart.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/cash-drawer.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/category.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/dashboard.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/db.handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/expiryProduct.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/product.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/role.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/sales-unit-settings.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/seed.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/shift.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/supplier.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/terminal.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/time-tracking.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/transaction.handler.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/officePrinterService.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/pdfReceiptService.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vatCategoryService.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/vivaWallet/config.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter]
(!) /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/rbacHelpers.ts is dynamically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/role.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/role.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/role.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/role.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/role.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/role.handlers.ts but also statically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/auth.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/authHelpers.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter]
(!) /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/authHelpers.ts is dynamically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/role.handlers.ts but also statically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/auth.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/business.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/dashboard.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/role.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/terminal.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/transaction.handler.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter]
(!) /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/email-service.ts is dynamically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/index.ts but also statically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/basket.handlers.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter]
(!) /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/services/expiryNotificationService.ts is dynamically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/index.ts but also statically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/expiryProduct.handlers.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter]
(!) /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/utils/scheduleValidator.ts is dynamically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/managers/userManager.ts but also statically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/shift.handlers.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/time-tracking.handlers.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter]
(!) /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/index.ts is dynamically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/modules/WindowManager.ts, /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/modules/WindowManager.ts but also statically imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/ipc/update.handlers.ts, dynamic import will not move module into another chunk.

dist/shiftDataValidator-Dfs-xxva.js 19.82 kB │ map: 10.63 kB
dist/breakComplianceValidator-vUu7Hunt.js 25.75 kB │ map: 13.67 kB
dist/thermalPrinterService-4dvvwycH.js 26.95 kB │ map: 14.99 kB
dist/pdfReceiptService-DE9fDVN6.js 34.17 kB │ map: 19.02 kB
dist/paymentService-DCwOS1iA.js 53.85 kB │ map: 29.75 kB
dist/scaleService-DIAEaAad.js 63.61 kB │ map: 35.13 kB
dist/officePrinterService-D9fnI9eo.js 80.19 kB │ map: 43.36 kB
dist/index-D1-BNUPx.js 339.36 kB │ map: 195.52 kB
dist/index.js 3,093.74 kB │ map: 1,688.74 kB
built in 771ms.
✅ Migrations copied from /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/migrations/meta to /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/dist/migrations/meta
✅ Migrations copied from /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/src/database/migrations to /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/dist/migrations
(!) Failed to run dependency scan. Skipping dependency pre-bundling. Error: The following dependencies are imported but could not be resolved:

qrcode.react (imported by /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/renderer/src/features/sales/utils/qr-code.ts)

Are they installed?
at file:///Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/node_modules/vite/dist/node/chunks/dep-D5b0Zz6C.js:10962:33
at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
at async file:///Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/node_modules/vite/dist/node/chunks/dep-D5b0Zz6C.js:34429:15
Debugger listening on ws://127.0.0.1:9229/64f0093d-d2fa-4e51-9604-33021353a638
For help, see: https://nodejs.org/en/docs/inspector
info: Business handlers registered {"service":"businessHandlers","timestamp":"2025-12-30 13:43:32"}
info: License handlers registered {"service":"licenseHandlers","timestamp":"2025-12-30 13:43:32"}
info: Terminal handlers registered {"service":"terminalHandlers","timestamp":"2025-12-30 13:43:32"}
info: Update IPC handlers registered {"service":"update-handlers","timestamp":"2025-12-30 13:43:32"}
info: 🔄 Database initialization attempt 1/3 {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
info: Development mode: Using project directory for database {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
info: Project root: /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
info: Database path: /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/data/pos_system.db {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
info: Database at: /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/data/pos_system.db {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
info: Database path: /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/data/pos_system.db {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
error: ❌ Failed to open database: The module '/Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 139. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`). {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
warn: ⚠️ Database Corruption Detected: Your database appears to be corrupted. {"service":"db-recovery-dialog","timestamp":"2025-12-30 13:43:32"}
warn: Detail: Automatic repair attempts failed. Your database may have been damaged.

Options:
• Backup & Start Fresh: Creates a backup and starts with a new database (recommended)
• Try Repair: Attempts advanced repair techniques (may lose some data)

A backup will be created before any action is taken. {"service":"db-recovery-dialog","timestamp":"2025-12-30 13:43:32"}
warn: ⚠️ App not ready, using default recovery action: backup-and-fresh {"service":"db-recovery-dialog","timestamp":"2025-12-30 13:43:32"}
info: 🔄 Creating fresh database... {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
info: 📦 Old database backed up to: /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/data/backups/aurswift-fresh-start-backup-20251230-134332.db {"service":"db-repair","timestamp":"2025-12-30 13:43:32"}
info: 📦 Old database renamed to: /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/data/pos_system.db.old.20251230-134332 {"service":"db-repair","timestamp":"2025-12-30 13:43:32"}
info: ✅ Fresh database prepared {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
info: Development mode: Using project directory for database {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
info: Project root: /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
info: Database path: /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/data/pos_system.db {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
info: Database at: /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/data/pos_system.db {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
error: ❌ Database initialization error: {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
error: Path: /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/data/pos_system.db {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
error: Error: The module '/Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 139. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`). {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
error: Stack: Error: The module '/Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 139. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
at process.func [as dlopen] (node:electron/js2c/node_init:2:2617)
at Module.\_extensions..node (node:internal/modules/cjs/loader:1874:18)
at Object.func [as .node] (node:electron/js2c/node_init:2:2617)
at Module.load (node:internal/modules/cjs/loader:1448:32)
at Module.\_load (node:internal/modules/cjs/loader:1270:12)
at c.\_load (node:electron/js2c/node_init:2:17993)
at TracingChannel.traceSync (node:diagnostics_channel:328:14)
at wrapModuleLoad (node:internal/modules/cjs/loader:244:24)
at Module.require (node:internal/modules/cjs/loader:1470:12)
at require (node:internal/modules/helpers:147:16) {"service":"db-manager","timestamp":"2025-12-30 13:43:32"}
Error: Database initialization failed at /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/data/pos_system.db: The module '/Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 139. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
at file:///Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/dist/index.js:5621:15
at async file:///Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/dist/index.js:14660:5
at async initApp (file:///Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/dist/index.js:24467:14) {
[cause]: Error: The module '/Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 139. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
at process.func [as dlopen] (node:electron/js2c/node_init:2:2617)
at Module.\_extensions..node (node:internal/modules/cjs/loader:1874:18)
at Object.func [as .node] (node:electron/js2c/node_init:2:2617)
at Module.load (node:internal/modules/cjs/loader:1448:32)
at Module.\_load (node:internal/modules/cjs/loader:1270:12)
at c.\_load (node:electron/js2c/node_init:2:17993)
at TracingChannel.traceSync (node:diagnostics_channel:328:14)
at wrapModuleLoad (node:internal/modules/cjs/loader:244:24)
at Module.require (node:internal/modules/cjs/loader:1470:12)
at require (node:internal/modules/helpers:147:16) {
code: 'ERR_DLOPEN_FAILED'
}
} Promise {
<rejected> Error: Database initialization failed at /Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/data/pos_system.db: The module '/Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 139. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
at file:///Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/dist/index.js:5621:15
at async file:///Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/dist/index.js:14660:5
at async initApp (file:///Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/packages/main/dist/index.js:24467:14) {
[cause]: Error: The module '/Users/admin/Documents/Developer/FullStackDev/aurswift/desktop/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 139. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
at process.func [as dlopen] (node:electron/js2c/node_init:2:2617)
at Module.\_extensions..node (node:internal/modules/cjs/loader:1874:18)
at Object.func [as .node] (node:electron/js2c/node_init:2:2617)
at Module.load (node:internal/modules/cjs/loader:1448:32)
at Module.\_load (node:internal/modules/cjs/loader:1270:12)
at c.\_load (node:electron/js2c/node_init:2:17993)
at TracingChannel.traceSync (node:diagnostics_channel:328:14)
at wrapModuleLoad (node:internal/modules/cjs/loader:244:24)
at Module.require (node:internal/modules/cjs/loader:1470:12)
at require (node:internal/modules/helpers:147:16) {
code: 'ERR_DLOPEN_FAILED'
}
}
}
