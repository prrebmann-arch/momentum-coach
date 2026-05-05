-- ============================================================
-- Supplement templates (coach-side reusable supplement packs)
-- Date: 2026-05-05
-- Goal: let coaches build packs of supplements once, import them
-- in one click on any athlete's supplements page.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  category text,
  type text NOT NULL CHECK (type IN ('complement', 'supplementation')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplement_templates_coach
  ON supplement_templates(coach_id, type, created_at DESC);

ALTER TABLE supplement_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_manage_supplement_templates" ON supplement_templates;
CREATE POLICY "coach_manage_supplement_templates" ON supplement_templates FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- items jsonb expected shape (array):
-- [
--   {
--     "nom": "Creatine monohydrate",
--     "marque": "Bulk Powders",
--     "lien_achat": "https://...",
--     "dosage": "5",
--     "unite": "g",
--     "frequence": "1x/jour",
--     "intervalle_jours": 1,
--     "moment_prise": "post_training",
--     "concentration_mg_ml": null,
--     "notes": "Avec un grand verre d'eau"
--   }
-- ]
