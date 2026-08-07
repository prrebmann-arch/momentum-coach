-- ============================================================
-- coach_notifications — centre de notifications coach
-- Alimentée exclusivement par triggers sur les tables source
-- (aucune écriture applicative, aucune modif du repo ATHLETE)
-- Date: 2026-08-06
-- ============================================================

CREATE TABLE IF NOT EXISTS coach_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bilan', 'questionnaire', 'execution_video', 'posing_video', 'fodmap')),
  title text NOT NULL,
  body text,
  resource_link text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_notifications_unread
  ON coach_notifications(coach_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coach_notifications_athlete_type
  ON coach_notifications(athlete_id, type)
  WHERE read_at IS NULL;

ALTER TABLE coach_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_read_own_notifications" ON coach_notifications;
CREATE POLICY "coach_read_own_notifications" ON coach_notifications FOR SELECT
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "coach_update_own_notifications" ON coach_notifications;
CREATE POLICY "coach_update_own_notifications" ON coach_notifications FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- No INSERT/DELETE policy for authenticated role — rows are created only by
-- the SECURITY DEFINER trigger functions below, which bypass RLS.

-- ============================================================
-- Trigger function factory pattern: one function per source table
-- (kept separate, not parameterized, so each stays simple SQL)
-- ============================================================

-- daily_reports identifies the athlete via user_id (auth uid of the
-- athlete), not athlete_id like the other source tables — resolve
-- athletes.id + coach_id together via that column.
--
-- daily_reports is a per-(user_id, date) upsert target written by many
-- unrelated flows (background step sync, debounced draft autosave while
-- typing, quick-weight entry, coach's own photo upload) — a plain
-- AFTER INSERT fires on the first partial write, not on submission. A
-- bilan is "complete" per the app's own definition (ATHLETE/src/api/
-- bilan.js: energy + sleep_quality both set) — fire only on the
-- transition into that state, exactly once, whether it happens via
-- INSERT (already complete on first write) or UPDATE (completed later).
CREATE OR REPLACE FUNCTION notify_coach_on_bilan()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_athlete_id uuid;
  v_coach_id uuid;
BEGIN
  SELECT id, coach_id INTO v_athlete_id, v_coach_id FROM athletes WHERE user_id = NEW.user_id;
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO coach_notifications (coach_id, athlete_id, type, title, body, resource_link, source_table, source_id)
  VALUES (
    v_coach_id,
    v_athlete_id,
    'bilan',
    'Nouveau bilan',
    'Un bilan a été soumis.',
    '/athletes/' || v_athlete_id || '/bilans',
    'daily_reports',
    NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure abort the athlete's own bilan write.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_bilan ON daily_reports;
CREATE TRIGGER trg_notify_coach_on_bilan
  AFTER INSERT OR UPDATE ON daily_reports
  FOR EACH ROW
  WHEN (
    NEW.energy IS NOT NULL AND NEW.sleep_quality IS NOT NULL
    AND (TG_OP = 'INSERT' OR OLD.energy IS NULL OR OLD.sleep_quality IS NULL)
  )
  EXECUTE FUNCTION notify_coach_on_bilan();

CREATE OR REPLACE FUNCTION notify_coach_on_questionnaire()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT coach_id INTO v_coach_id FROM athletes WHERE id = NEW.athlete_id;
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO coach_notifications (coach_id, athlete_id, type, title, body, resource_link, source_table, source_id)
  VALUES (
    v_coach_id,
    NEW.athlete_id,
    'questionnaire',
    'Réponse au questionnaire',
    'Un athlète a répondu à un questionnaire.',
    '/athletes/' || NEW.athlete_id || '/questionnaires',
    'questionnaire_responses',
    NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure abort the athlete's own write.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_questionnaire ON questionnaire_responses;
CREATE TRIGGER trg_notify_coach_on_questionnaire
  AFTER INSERT ON questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION notify_coach_on_questionnaire();

CREATE OR REPLACE FUNCTION notify_coach_on_execution_video()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT coach_id INTO v_coach_id FROM athletes WHERE id = NEW.athlete_id;
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO coach_notifications (coach_id, athlete_id, type, title, body, resource_link, source_table, source_id)
  VALUES (
    v_coach_id,
    NEW.athlete_id,
    'execution_video',
    'Nouvelle vidéo technique',
    'Un athlète a ajouté une vidéo d''exécution.',
    '/videos',
    'execution_videos',
    NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure abort the athlete's own write.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_execution_video ON execution_videos;
CREATE TRIGGER trg_notify_coach_on_execution_video
  AFTER INSERT ON execution_videos
  FOR EACH ROW EXECUTE FUNCTION notify_coach_on_execution_video();

CREATE OR REPLACE FUNCTION notify_coach_on_posing_video()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT coach_id INTO v_coach_id FROM athletes WHERE id = NEW.athlete_id;
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO coach_notifications (coach_id, athlete_id, type, title, body, resource_link, source_table, source_id)
  VALUES (
    v_coach_id,
    NEW.athlete_id,
    'posing_video',
    'Nouvelle vidéo posing',
    'Un athlète a ajouté une vidéo de posing.',
    '/athletes/' || NEW.athlete_id || '/posing',
    'posing_videos',
    NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure abort the athlete's own write.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_posing_video ON posing_videos;
CREATE TRIGGER trg_notify_coach_on_posing_video
  AFTER INSERT ON posing_videos
  FOR EACH ROW EXECUTE FUNCTION notify_coach_on_posing_video();

CREATE OR REPLACE FUNCTION notify_coach_on_fodmap()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT coach_id INTO v_coach_id FROM athletes WHERE id = NEW.athlete_id;
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO coach_notifications (coach_id, athlete_id, type, title, body, resource_link, source_table, source_id)
  VALUES (
    v_coach_id,
    NEW.athlete_id,
    'fodmap',
    'Log FODMAP',
    'Un athlète a ajouté un log FODMAP.',
    '/athletes/' || NEW.athlete_id || '/fodmap',
    'athlete_fodmap_logs',
    NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure abort the athlete's own write.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_fodmap ON athlete_fodmap_logs;
CREATE TRIGGER trg_notify_coach_on_fodmap
  AFTER INSERT ON athlete_fodmap_logs
  FOR EACH ROW EXECUTE FUNCTION notify_coach_on_fodmap();

-- ============================================================
-- Realtime: add table to the supabase_realtime publication so
-- postgres_changes subscriptions fire for INSERT/UPDATE.
-- Guarded for idempotent re-runs (ALTER PUBLICATION ... ADD TABLE has
-- no IF NOT EXISTS form).
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'coach_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE coach_notifications;
  END IF;
END;
$$;
