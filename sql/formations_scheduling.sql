-- ═══════════════════════════════════════════════════════════════
-- Formations: tracking RLS fix + day-based scheduling
-- ═══════════════════════════════════════════════════════════════
-- 1. Allow coach to read athletes' formation_video_progress for
--    videos in their own formations (fixes "0/2 partout" bug)
-- 2. Add available_from_day INT on formation_videos for J+X access
-- ═══════════════════════════════════════════════════════════════

-- 1. Coach SELECT policy on formation_video_progress
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'formation_video_progress' AND policyname = 'coach_read_athlete_progress') THEN
    DROP POLICY "coach_read_athlete_progress" ON formation_video_progress;
  END IF;
  CREATE POLICY "coach_read_athlete_progress" ON formation_video_progress FOR SELECT
    USING (
      video_id IN (
        SELECT fv.id
        FROM formation_videos fv
        JOIN formations f ON f.id = fv.formation_id
        WHERE f.coach_id = auth.uid()
      )
    );
END $$;

-- 2. Schedule column on formation_videos
ALTER TABLE formation_videos
  ADD COLUMN IF NOT EXISTS available_from_day INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN formation_videos.available_from_day IS
  'Day offset from athlete coaching start (athletes.created_at). 0 = immediately available, 1 = J+1, etc.';
