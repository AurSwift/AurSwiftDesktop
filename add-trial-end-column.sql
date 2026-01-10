-- Add trialEnd column to license_activation table
-- This migration adds support for tracking trial end dates

ALTER TABLE license_activation ADD COLUMN trial_end INTEGER;

-- Update existing records: if subscriptionStatus is 'trialing', we can't retroactively add the date
-- So we'll leave it NULL for existing activations, and it will be populated on next heartbeat
