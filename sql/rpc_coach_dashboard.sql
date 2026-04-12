-- RPC for coach dashboard — replaces 4 separate queries with 1
-- Execute in Supabase SQL Editor

CREATE OR REPLACE FUNCTION coach_dashboard_data(p_coach_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  athlete_ids UUID[];
  athlete_user_ids UUID[];
BEGIN
  -- Get athlete IDs for this coach
  SELECT ARRAY_AGG(id), ARRAY_AGG(user_id)
  INTO athlete_ids, athlete_user_ids
  FROM athletes WHERE coach_id = p_coach_id;

  SELECT json_build_object(
    'reports', (
      SELECT COALESCE(json_agg(r), '[]'::json)
      FROM (
        SELECT user_id, date, weight, sessions_executed, session_performance,
               energy, sleep_quality, adherence, steps
        FROM daily_reports
        WHERE user_id = ANY(athlete_user_ids)
        ORDER BY date DESC
        LIMIT 100
      ) r
    ),
    'programs', (
      SELECT COALESCE(json_agg(p), '[]'::json)
      FROM (
        SELECT id, nom, athlete_id, actif
        FROM workout_programs
        WHERE coach_id = p_coach_id
      ) p
    ),
    'pending_videos', (
      SELECT COALESCE(json_agg(v), '[]'::json)
      FROM (
        SELECT id, athlete_id, exercise_name, created_at
        FROM execution_videos
        WHERE athlete_id = ANY(athlete_ids)
        AND status = 'a_traiter'
        ORDER BY created_at DESC
        LIMIT 50
      ) v
    ),
    'settings', (
      SELECT COALESCE(row_to_json(s), '{}'::json)
      FROM (
        SELECT coach_id, max_videos_per_day
        FROM coach_settings
        WHERE coach_id = p_coach_id
        LIMIT 1
      ) s
    )
  ) INTO result;

  RETURN result;
END;
$$;
