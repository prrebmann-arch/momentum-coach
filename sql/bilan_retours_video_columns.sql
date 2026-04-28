-- ============================================================
-- Native screen recorder — additive columns on bilan_retours
-- Date: 2026-04-28
-- Spec: docs/superpowers/specs/2026-04-28-native-screen-recorder-design.md
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE bilan_retours
  ADD COLUMN IF NOT EXISTS video_path text,
  ADD COLUMN IF NOT EXISTS thumbnail_path text,
  ADD COLUMN IF NOT EXISTS duration_s int,
  ADD COLUMN IF NOT EXISTS width int,
  ADD COLUMN IF NOT EXISTS height int,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Index for cron archival query
CREATE INDEX IF NOT EXISTS idx_bilan_retours_archive_candidates
  ON bilan_retours (created_at)
  WHERE archived_at IS NULL AND video_path IS NOT NULL;

-- Comment for self-documentation
COMMENT ON COLUMN bilan_retours.video_path IS 'Path in coach-video bucket: <coach_id>/<retour_id>.mp4';
COMMENT ON COLUMN bilan_retours.thumbnail_path IS 'Path in coach-video bucket: <coach_id>/<retour_id>.jpg';
COMMENT ON COLUMN bilan_retours.archived_at IS 'Set by /api/videos/archive-old-retours cron after 30 days';
