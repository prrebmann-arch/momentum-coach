-- SÉCURITÉ — coach_dashboard_data (sql/rpc_coach_dashboard.sql) est SECURITY DEFINER
-- (contourne la RLS) et ne vérifiait PAS que l'appelant est le coach demandé :
-- n'importe quel client muni de la clé anon publique pouvait lire les bilans
-- (poids, sommeil, énergie…), programmes et vidéos des athlètes d'un coach à
-- partir de son id. Correctif : l'appelant doit être p_coach_id, et la fonction
-- n'est plus exécutable par anon.
-- Le client (DashboardPage) retombe sur des requêtes RLS si la RPC échoue, donc
-- ce changement ne casse rien côté UI.
-- À exécuter dans le SQL Editor Supabase.

CREATE OR REPLACE FUNCTION public.coach_dashboard_data(p_coach_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  athlete_ids UUID[];
  athlete_user_ids UUID[];
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_coach_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.coach_dashboard_data(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_dashboard_data(UUID) TO authenticated;

-- Vérification (doit renvoyer une erreur 'forbidden' / permission denied) :
--   en anon : POST /rest/v1/rpc/coach_dashboard_data {"p_coach_id": "<un id de coach>"}
