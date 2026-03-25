-- =============================================
-- AUDIT FIXES — Coach App
-- Generated 2026-03-22
-- =============================================
-- Execute in Supabase SQL Editor, section by section.
-- Each section is idempotent (IF NOT EXISTS / CREATE OR REPLACE).
-- =============================================


-- ═══════════════════════════════════════════
-- 1. FK INDEXES (missing indexes on foreign keys)
-- ═══════════════════════════════════════════
-- Without these, JOINs and ON DELETE CASCADE scan full tables.

CREATE INDEX IF NOT EXISTS idx_athletes_coach_id
  ON athletes(coach_id);

CREATE INDEX IF NOT EXISTS idx_athletes_user_id
  ON athletes(user_id);

CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id_date
  ON daily_reports(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_roadmap_phases_athlete_id
  ON roadmap_phases(athlete_id);

CREATE INDEX IF NOT EXISTS idx_roadmap_phases_coach_id
  ON roadmap_phases(coach_id);

CREATE INDEX IF NOT EXISTS idx_workout_programs_athlete_id
  ON workout_programs(athlete_id);

CREATE INDEX IF NOT EXISTS idx_workout_programs_coach_id
  ON workout_programs(coach_id);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_program_id
  ON workout_sessions(program_id);

CREATE INDEX IF NOT EXISTS idx_workout_logs_athlete_id
  ON workout_logs(athlete_id);

CREATE INDEX IF NOT EXISTS idx_workout_logs_session_id
  ON workout_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_workout_logs_date
  ON workout_logs(date DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_athlete_id
  ON nutrition_plans(athlete_id);

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_coach_id
  ON nutrition_plans(coach_id);

CREATE INDEX IF NOT EXISTS idx_formation_videos_formation_id
  ON formation_videos(formation_id);

CREATE INDEX IF NOT EXISTS idx_formation_video_progress_video_id
  ON formation_video_progress(video_id);

CREATE INDEX IF NOT EXISTS idx_athlete_onboarding_athlete_id
  ON athlete_onboarding(athlete_id);

CREATE INDEX IF NOT EXISTS idx_athlete_onboarding_workflow_id
  ON athlete_onboarding(workflow_id);

CREATE INDEX IF NOT EXISTS idx_programming_weeks_athlete_id
  ON programming_weeks(athlete_id);

CREATE INDEX IF NOT EXISTS idx_programming_weeks_coach_id
  ON programming_weeks(coach_id);


-- ═══════════════════════════════════════════
-- 2. TEXT CONSTRAINTS (prevent empty / oversized strings)
-- ═══════════════════════════════════════════

-- athletes
ALTER TABLE athletes
  ADD CONSTRAINT chk_athletes_prenom CHECK (char_length(prenom) BETWEEN 1 AND 100),
  ADD CONSTRAINT chk_athletes_nom    CHECK (char_length(nom) BETWEEN 1 AND 100),
  ADD CONSTRAINT chk_athletes_email  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- NOTE: If constraints already exist, the above will fail gracefully.
-- To make it idempotent, use DO blocks:

DO $$
BEGIN
  -- athletes.poids_actuel range
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_athletes_poids_actuel') THEN
    ALTER TABLE athletes ADD CONSTRAINT chk_athletes_poids_actuel CHECK (poids_actuel IS NULL OR (poids_actuel > 0 AND poids_actuel <= 500));
  END IF;
  -- athletes.poids_objectif range
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_athletes_poids_objectif') THEN
    ALTER TABLE athletes ADD CONSTRAINT chk_athletes_poids_objectif CHECK (poids_objectif IS NULL OR (poids_objectif > 0 AND poids_objectif <= 500));
  END IF;
  -- athletes.bilan_day range 0-6
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_athletes_bilan_day') THEN
    ALTER TABLE athletes ADD CONSTRAINT chk_athletes_bilan_day CHECK (bilan_day IS NULL OR (bilan_day >= 0 AND bilan_day <= 6));
  END IF;
  -- athletes.objectif whitelist
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_athletes_objectif') THEN
    ALTER TABLE athletes ADD CONSTRAINT chk_athletes_objectif CHECK (objectif IS NULL OR objectif IN ('perte_de_poids', 'prise_de_masse', 'maintenance', 'recomposition', 'performance'));
  END IF;
END $$;


-- ═══════════════════════════════════════════
-- 3. UPDATED_AT TRIGGERS
-- ═══════════════════════════════════════════

-- Generic trigger function (reusable)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables that have an updated_at column
DO $$
DECLARE
  tbl TEXT;
  trigger_name TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
      AND table_name NOT IN ('schema_migrations')
  LOOP
    trigger_name := 'trg_' || tbl || '_updated_at';
    -- Drop existing trigger (idempotent)
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, tbl);
    -- Create trigger
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      trigger_name, tbl
    );
  END LOOP;
END $$;


-- ═══════════════════════════════════════════
-- 4. ADD updated_at COLUMN WHERE MISSING
-- ═══════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN VALUES
    ('athletes'), ('workout_programs'), ('workout_sessions'),
    ('roadmap_phases'), ('formations'), ('formation_videos'),
    ('onboarding_workflows'), ('programming_weeks')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_at'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now()', tbl);
    END IF;
  END LOOP;
END $$;

-- Re-run trigger creation after adding columns
DO $$
DECLARE
  tbl TEXT;
  trigger_name TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
  LOOP
    trigger_name := 'trg_' || tbl || '_updated_at';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, tbl);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      trigger_name, tbl
    );
  END LOOP;
END $$;


-- ═══════════════════════════════════════════
-- 5. CLEANUP NOTES
-- ═══════════════════════════════════════════
-- Tables referenced in code but may not exist yet:
--   - workout_logs (training history) — should already exist from mobile app
--   - nutrition_logs — created separately (see nutrition_logs.sql)
--   - aliments_db / aliments — legacy food database tables
--
-- If any CREATE INDEX fails with "relation does not exist",
-- it means that table hasn't been created yet — skip it safely.
-- =============================================
