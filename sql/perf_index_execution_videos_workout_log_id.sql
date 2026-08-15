-- Missing index found via Supabase Query Performance report (2026-08-15):
-- the workout_logs -> execution_videos LATERAL join (used to count videos per
-- log, e.g. app/(app)/athletes/[id]/training and ATHLETE's workout history)
-- had no index on execution_videos.workout_log_id, forcing a full table scan
-- of execution_videos for every workout_logs row returned. execution_videos
-- already has indexes on athlete_id/user_id but never on the FK actually
-- used by this join.
CREATE INDEX IF NOT EXISTS idx_execution_videos_workout_log_id
  ON execution_videos(workout_log_id);
