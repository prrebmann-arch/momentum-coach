-- ═══════════════════════════════════════════════════════════════
-- roadmap_week_notes — per-week coach notes on athlete roadmap
-- ═══════════════════════════════════════════════════════════════
-- One row per (athlete_id, week_start). week_start is the Monday
-- of the ISO week, stored as DATE for cheap range queries.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS roadmap_week_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_roadmap_week_notes_athlete
  ON roadmap_week_notes(athlete_id, week_start);

ALTER TABLE roadmap_week_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "coach_manage_roadmap_notes" ON roadmap_week_notes;
  CREATE POLICY "coach_manage_roadmap_notes" ON roadmap_week_notes FOR ALL
    USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
END $$;

-- updated_at trigger (reuses existing set_updated_at function from audit_fixes.sql)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_roadmap_week_notes_updated_at ON roadmap_week_notes;
    CREATE TRIGGER trg_roadmap_week_notes_updated_at
      BEFORE UPDATE ON roadmap_week_notes
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
