DROP INDEX IF EXISTS `attendance_report_user_period_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `attendance_report_business_period_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `attendance_report_generated_at_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `attendance_report_unique`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `attendance_reports_user_period_idx` ON `attendance_reports` (`user_id`,`period_start_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `attendance_reports_business_period_idx` ON `attendance_reports` (`business_id`,`period_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `attendance_reports_report_generated_at_idx` ON `attendance_reports` (`report_generated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `attendance_reports_unique` ON `attendance_reports` (`user_id`,`period_start_date`,`period_end_date`,`business_id`);--> statement-breakpoint
DROP INDEX IF EXISTS `shift_report_view_shift_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shift_report_view_business_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shift_report_view_user_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shift_report_view_period_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `shift_report_view_generated_at_idx`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pos_shift_reports_shift_id_idx` ON `pos_shift_reports` (`shift_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pos_shift_reports_business_id_idx` ON `pos_shift_reports` (`business_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pos_shift_reports_user_id_idx` ON `pos_shift_reports` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pos_shift_reports_period_covered_idx` ON `pos_shift_reports` (`period_covered`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pos_shift_reports_report_generated_at_idx` ON `pos_shift_reports` (`report_generated_at`);