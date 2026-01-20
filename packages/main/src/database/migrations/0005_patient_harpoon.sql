ALTER TABLE `businesses` ADD `receipt_email_gmail_user` text DEFAULT '';--> statement-breakpoint
ALTER TABLE `businesses` ADD `receipt_email_gmail_app_password` text DEFAULT '';--> statement-breakpoint
ALTER TABLE `businesses` ADD `receipt_email_gmail_app_password_encrypted` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `businesses` ADD `receipt_email_updated_at` integer;

