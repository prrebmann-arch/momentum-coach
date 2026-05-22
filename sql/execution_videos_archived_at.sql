-- ============================================================
-- execution_videos: archive column for 45-day retention cleanup
-- Run in Supabase SQL Editor on production
-- Date: 2026-05-22
-- ============================================================
-- Adds archived_at so the daily cron can mark rows whose
-- storage assets have been purged, mirroring bilan_retours.
-- Partial index keeps the candidate scan O(N_active) only.
-- ============================================================

ALTER TABLE execution_videos
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_execution_videos_archive_candidates
  ON execution_videos (created_at)
  WHERE archived_at IS NULL AND storage_path IS NOT NULL;
