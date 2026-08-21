-- ============================================================
-- coach_notifications — 6e trigger : checkins (mode compétition)
-- Date: 2026-08-21
-- Même pattern que sql/coach_notifications.sql (SECURITY DEFINER,
-- exception-guarded, resolves coach_id from the athlete row).
-- ============================================================

ALTER TABLE coach_notifications DROP CONSTRAINT IF EXISTS coach_notifications_type_check;
ALTER TABLE coach_notifications ADD CONSTRAINT coach_notifications_type_check
  CHECK (type IN ('bilan', 'questionnaire', 'execution_video', 'posing_video', 'fodmap', 'checkin'));

CREATE OR REPLACE FUNCTION notify_coach_on_checkin()
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
    'checkin',
    'Nouveau check-in',
    'Un athlète a soumis un check-in compétition.',
    '/athletes/' || NEW.athlete_id,
    'checkins',
    NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_checkin ON checkins;
CREATE TRIGGER trg_notify_coach_on_checkin
  AFTER INSERT ON checkins
  FOR EACH ROW EXECUTE FUNCTION notify_coach_on_checkin();
