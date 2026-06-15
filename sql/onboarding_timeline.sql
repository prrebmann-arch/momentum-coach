-- ============================================================
-- Onboarding timeline (per-athlete + reusable templates)
-- Date: 2026-06-02
-- Goal:
--   * Coach builds reusable onboarding templates (e.g. "Premium 7d")
--   * Each step = a touchpoint (message / call / milestone) at day_offset
--   * On athlete creation (or later) the coach applies a template:
--     each template step is instantiated as athlete_onboarding_steps,
--     with scheduled_date = onboarding_start_date + day_offset.
--   * /athletes list reads upcoming steps to display "J-3 R2" badges.
-- ============================================================

-- 1) Reusable templates
CREATE TABLE IF NOT EXISTS onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  -- steps shape: [{ day_offset:int, type:'message'|'call'|'milestone', title:text, description?:text }]
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_templates_coach
  ON onboarding_templates(coach_id, created_at DESC);

ALTER TABLE onboarding_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_manage_onboarding_templates" ON onboarding_templates;
CREATE POLICY "coach_manage_onboarding_templates" ON onboarding_templates FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- 2) athlete.onboarding_start_date — anchor for the timeline (J0)
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS onboarding_start_date date;

-- 3) Per-athlete instances (1 row per touchpoint)
CREATE TABLE IF NOT EXISTS athlete_onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES onboarding_templates(id) ON DELETE SET NULL,
  day_offset int NOT NULL,
  scheduled_date date NOT NULL,
  type text NOT NULL CHECK (type IN ('message', 'call', 'milestone')),
  title text NOT NULL,
  description text,
  done_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Load timeline for one athlete (sorted by date)
CREATE INDEX IF NOT EXISTS idx_aos_athlete
  ON athlete_onboarding_steps(athlete_id, scheduled_date);

-- "What's due for any of my athletes in the next 14 days?" (badges query)
CREATE INDEX IF NOT EXISTS idx_aos_coach_due
  ON athlete_onboarding_steps(coach_id, scheduled_date)
  WHERE done_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE athlete_onboarding_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_manage_athlete_onboarding_steps" ON athlete_onboarding_steps;
CREATE POLICY "coach_manage_athlete_onboarding_steps" ON athlete_onboarding_steps FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- (Optional) athlete-side read: allow the athlete to read their own steps.
-- Disabled by default; the athlete app does not consume this yet.
-- CREATE POLICY "athlete_read_own_onboarding_steps" ON athlete_onboarding_steps FOR SELECT
--   USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- 4) updated_at touch trigger
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_onboarding_templates_touch ON onboarding_templates;
CREATE TRIGGER trg_onboarding_templates_touch
  BEFORE UPDATE ON onboarding_templates
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_aos_touch ON athlete_onboarding_steps;
CREATE TRIGGER trg_aos_touch
  BEFORE UPDATE ON athlete_onboarding_steps
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- Notes:
-- * Default "Premium" template is seeded client-side on first visit
--   of /templates → Onboarding tab (per-coach), to avoid a global
--   trigger that fires on every new auth.users row.
-- * steps jsonb on onboarding_templates is the source of truth for
--   templates. When applied to an athlete, rows are materialized in
--   athlete_onboarding_steps. After that, template edits do not
--   propagate (intentional: per-athlete drift is OK).
-- ============================================================
