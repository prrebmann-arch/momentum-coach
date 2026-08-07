-- ============================================================
-- Point the "réponse au questionnaire" coach notification at the
-- new cross-athlete /questionnaires overview instead of the
-- per-athlete /athletes/{id}/questionnaires tab.
-- Date: 2026-08-07
-- ============================================================

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
    '/questionnaires',
    'questionnaire_responses',
    NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure abort the athlete's own write.
  RETURN NEW;
END;
$$;
