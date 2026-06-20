-- ═══════════════════════════════════════════════════════════════
-- athlete_supplements: add end_date for temporal accuracy
-- ═══════════════════════════════════════════════════════════════
-- Without end_date, we cannot tell when a supplementation cycle
-- was stopped — which means the roadmap weekly view cannot
-- truthfully say "X was active on week S5" after the cycle ended.
--
-- Backfill: rows where actif=false but end_date is null get
-- end_date = COALESCE(updated_at, created_at) so historical
-- toggles still get a date.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE athlete_supplements
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Backfill stopped rows: use updated_at if available, else created_at
UPDATE athlete_supplements
SET end_date = COALESCE(updated_at::date, created_at::date)
WHERE actif = false AND end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_athlete_supps_date_range
  ON athlete_supplements(athlete_id, start_date, end_date);
