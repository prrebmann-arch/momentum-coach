-- ============================================================
-- CHECK-INS COMPÉTITION — check-ins horodatés multi-fois/jour
-- Date: 2026-08-20
-- Contexte: mode "compétition" de COACH-MOBILE — un athlète en préparation
-- de compétition envoie plusieurs check-ins par jour (pas un seul bilan
-- quotidien comme daily_reports). Le coach répond en 2 taps : garder ou
-- ajuster le prochain repas, l'eau, le sodium, les glucides, la séance.
-- Execute in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,  -- auth uid de l'athlète (comme daily_reports.user_id)

  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  weight          NUMERIC(6,2),
  aspect          TEXT CHECK (aspect IN ('plat','normal','plein')),
  energy          SMALLINT CHECK (energy BETWEEN 0 AND 10),
  note            TEXT,
  photo_path      TEXT,  -- storage path, bucket athlete-photos (même convention)

  -- Cumuls déclarés par l'athlète à l'instant du check-in (pas recalculés
  -- serveur — l'athlète saisit son suivi du jour, le coach ajuste ensuite).
  water_ml        INT,
  sodium_g        NUMERIC(4,1),
  glucides_g      INT,

  reviewed_at     TIMESTAMPTZ,   -- coach a traité ce check-in (miroir daily_reports.coach_reviewed_at)
  reviewed_by     UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS checkins_athlete_idx ON checkins (athlete_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS checkins_pending_idx ON checkins (athlete_id, reviewed_at) WHERE reviewed_at IS NULL;

-- ── RLS ──
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

-- Coach : lit/traite les check-ins de ses propres athlètes.
DROP POLICY IF EXISTS checkins_coach_select ON checkins;
CREATE POLICY checkins_coach_select ON checkins FOR SELECT
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));

DROP POLICY IF EXISTS checkins_coach_update ON checkins;
CREATE POLICY checkins_coach_update ON checkins FOR UPDATE
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));

-- Athlète : crée/lit ses propres check-ins (app ATHLETE, non modifiée dans
-- cette migration mais RLS prête pour quand l'app athlète implémentera l'envoi).
DROP POLICY IF EXISTS checkins_athlete_select ON checkins;
CREATE POLICY checkins_athlete_select ON checkins FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS checkins_athlete_insert ON checkins;
CREATE POLICY checkins_athlete_insert ON checkins FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ── Mode compétition : flag + fenêtre active sur athletes ──
-- athlete.competition_mode = true bascule COACH-MOBILE en file de check-ins
-- horodatés pour cet athlète, plutôt que le suivi bilan classique.
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS competition_mode BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS competition_date DATE;
