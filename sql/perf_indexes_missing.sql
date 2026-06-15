-- Missing performance indexes — found by audit Phase 4.
-- These tables are filtered on these columns in RLS subqueries AND in
-- read paths on both COACH web and ATHLETE mobile. Without indexes,
-- Postgres does sequential scans → 10s+ data load on dashboards.
--
-- Run in Supabase SQL Editor. CREATE INDEX CONCURRENTLY would be safer
-- on big tables but requires running outside a transaction (Supabase
-- SQL Editor wraps everything in a transaction). If a CREATE INDEX
-- locks the table briefly, that's acceptable for these small/medium
-- tables. If you have >100K rows on any of them, run each statement
-- separately in its own session via a direct psql connection with
-- CONCURRENTLY.
--
-- Estimated impact: 10x-100x faster queries on dashboard/athlete pages.

-- ── RLS hot paths (coach reads athlete data via subquery) ──

CREATE INDEX IF NOT EXISTS idx_daily_tracking_user_id
  ON daily_tracking(user_id);

CREATE INDEX IF NOT EXISTS idx_menstrual_logs_athlete_id
  ON menstrual_logs(athlete_id);

CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_athlete_id
  ON questionnaire_responses(athlete_id);

CREATE INDEX IF NOT EXISTS idx_exercise_settings_user_id
  ON exercise_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_bilan_retours_athlete_id
  ON bilan_retours(athlete_id);

-- ── Composite indexes for "filter + ORDER BY" queries ──
-- Coach dashboard "latest workouts across my athletes" pattern.

CREATE INDEX IF NOT EXISTS idx_workout_logs_coach_created
  ON workout_logs(coach_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_history_coach_created
  ON payment_history(coach_id, created_at DESC);

-- ── Coach template management ──

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_coach_id
  ON nutrition_plans(coach_id);

-- ── Notifications: unread badge counts hit this every dashboard mount ──
-- Partial index keeps it small + hyper-fast for "unread" queries.

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id, created_at DESC)
  WHERE read = false;

-- ── Already-present check (no-op if exists from previous migrations) ──
-- Verify these exist; if not, perf_indexes.sql migration was incomplete.
-- (Listed here for documentation only — they have IF NOT EXISTS guards
-- so re-running is safe.)

CREATE INDEX IF NOT EXISTS idx_workout_logs_athlete_date
  ON workout_logs(athlete_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_athlete_date
  ON nutrition_logs(athlete_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date
  ON daily_reports(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_supplement_logs_athlete_date
  ON supplement_logs(athlete_id, taken_date DESC);

-- After applying, verify with:
--   SELECT schemaname, tablename, indexname
--   FROM pg_indexes
--   WHERE indexname LIKE 'idx_%' ORDER BY tablename;
