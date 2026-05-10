-- Stripe webhook idempotency table
-- ROOT CAUSE: stripe_audit_log uses TEXT stripe_event_id without UNIQUE.
-- The webhook check (SELECT then INSERT) is RACY — Stripe retries can hit
-- concurrent lambdas, both see "no existing event", both execute the handler,
-- causing double-charges and duplicated DB writes.
--
-- FIX: a dedicated table with PRIMARY KEY on event_id. INSERT-FIRST atomic
-- guard: if the INSERT conflicts, the webhook is a duplicate and exits early.
--
-- Run once in Supabase SQL Editor before deploying the new webhook code.

CREATE TABLE IF NOT EXISTS stripe_processed_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  is_coach_webhook BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_started ON stripe_processed_events(started_at DESC);

-- Optional: TTL cleanup (90-day retention). Skip if you want full audit forever.
-- DELETE FROM stripe_processed_events WHERE started_at < now() - INTERVAL '90 days';

-- RLS: locked down. Only service role writes/reads.
ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;
-- No policies = no public access. Service role bypasses RLS.
