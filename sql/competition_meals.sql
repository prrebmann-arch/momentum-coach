-- ============================================================
-- REPAS COMPÉTITION — séquence de repas ad hoc, jour de comp
-- Date: 2026-08-20
-- Contexte: en mode compétition, le coach ne travaille pas sur la diète
-- classique (nutrition_plans) — il définit/ajuste les repas un par un au
-- fil des check-ins de la journée. Premier repas saisi à la main, puis
-- "garder / ajuster quantités / remplacer" à chaque check-in suivant.
-- Execute in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS competition_meals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id        UUID NOT NULL,

  meal_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_order      INT NOT NULL DEFAULT 1,  -- 1er, 2e, 3e repas de la journée

  label           TEXT,               -- ex "Repas 3" (libre, optionnel)
  foods           JSONB NOT NULL DEFAULT '[]',  -- même shape que nutrition_plans.meals_data[].foods : [{aliment, qte, kcal, p, g, l}]

  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded')),
  based_on_meal_id UUID REFERENCES competition_meals(id) ON DELETE SET NULL,  -- ajustement/remplacement du repas précédent

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS competition_meals_athlete_day_idx
  ON competition_meals (athlete_id, meal_date, meal_order);

-- ── RLS ──
ALTER TABLE competition_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS competition_meals_coach_all ON competition_meals;
CREATE POLICY competition_meals_coach_all ON competition_meals FOR ALL
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()))
  WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));

-- Athlète : lecture seule, pour afficher le repas courant côté ATHLETE.
DROP POLICY IF EXISTS competition_meals_athlete_select ON competition_meals;
CREATE POLICY competition_meals_athlete_select ON competition_meals FOR SELECT
  USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
