-- Migration: Add verification_notes column to age_verification_records
-- Safe migration that works with existing production databases
-- Old columns (id_scan_data, manager_override_id, override_reason) are left in place for backward compatibility

ALTER TABLE age_verification_records ADD COLUMN verification_notes TEXT;
