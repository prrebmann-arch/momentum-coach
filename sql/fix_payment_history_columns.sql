-- Fix: payment_history table is missing coach_id and currency columns
-- These columns are defined in stripe_migration.sql but were not applied to the live DB
-- Without them, ALL webhook inserts to payment_history fail silently (HTTP 400)
-- Run this in Supabase SQL Editor

ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS coach_id UUID;
ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'eur';

-- Add index on coach_id for dashboard queries
CREATE INDEX IF NOT EXISTS idx_payment_history_coach ON payment_history(coach_id);

-- Verify RLS policies exist (they reference coach_id)
-- If the policy already exists this will error harmlessly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_history' AND policyname = 'coach_read_own_payments'
  ) THEN
    EXECUTE 'CREATE POLICY "coach_read_own_payments" ON payment_history FOR SELECT USING (coach_id = auth.uid())';
  END IF;
END $$;
