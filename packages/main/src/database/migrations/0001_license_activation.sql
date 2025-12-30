-- License Activation table
-- Stores the activated license for this installation
CREATE TABLE IF NOT EXISTS `license_activation` (
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
	`is_active` integer DEFAULT 1 NOT NULL,
	`subscription_status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`activated_at` integer NOT NULL,
	`last_heartbeat` integer NOT NULL,
	`last_validated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `license_activation_license_key_unique` ON `license_activation` (`license_key`);
--> statement-breakpoint
-- License Validation Log table
-- Tracks validation attempts for debugging
CREATE TABLE IF NOT EXISTS `license_validation_log` (
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
CREATE INDEX IF NOT EXISTS `idx_license_validation_log_action` ON `license_validation_log` (`action`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_license_validation_log_timestamp` ON `license_validation_log` (`timestamp`);
