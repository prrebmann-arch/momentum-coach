-- ============================================================
-- Système de templates de bilan dynamiques
-- ============================================================

-- 1. Bibliothèque de questions disponibles
CREATE TABLE IF NOT EXISTS bilan_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'slider_1_10', 'number', 'text_short', 'text_long',
    'boolean', 'time', 'single_choice', 'multiple_choice', 'photo'
  )),
  options JSONB,
  unit TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  category TEXT CHECK (category IN (
    'physical', 'mental', 'sleep', 'training', 'nutrition', 'health', 'other'
  )),
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Templates de bilan
CREATE TABLE IF NOT EXISTS bilan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Questions dans un template (une ligne par question)
CREATE TABLE IF NOT EXISTS bilan_template_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES bilan_templates(id) ON DELETE CASCADE,
  bilan_type TEXT NOT NULL CHECK (bilan_type IN ('quotidien', 'complet')),
  builtin_field TEXT,
  question_id UUID REFERENCES bilan_questions(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT question_xor CHECK (
    (builtin_field IS NOT NULL AND question_id IS NULL) OR
    (builtin_field IS NULL AND question_id IS NOT NULL)
  )
);

-- 4. Assignation template → athlète (snapshot)
CREATE TABLE IF NOT EXISTS athlete_bilan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES athletes(id) ON DELETE CASCADE,
  template_id UUID REFERENCES bilan_templates(id) ON DELETE SET NULL,
  template_snapshot JSONB NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id)
);

-- 5. Colonne custom_data sur daily_reports
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}';

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE bilan_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bilan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bilan_template_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_bilan_templates ENABLE ROW LEVEL SECURITY;

-- bilan_questions : coaches CRUD les leurs, SELECT sur is_system
CREATE POLICY "coaches_crud_own_questions" ON bilan_questions
  FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "coaches_read_system_questions" ON bilan_questions
  FOR SELECT USING (is_system = TRUE);
CREATE POLICY "athletes_no_access_questions" ON bilan_questions
  FOR SELECT USING (FALSE);

-- bilan_templates : coaches CRUD les leurs
CREATE POLICY "coaches_crud_templates" ON bilan_templates
  FOR ALL USING (coach_id = auth.uid());

-- bilan_template_questions : via template ownership
CREATE POLICY "coaches_crud_template_questions" ON bilan_template_questions
  FOR ALL USING (
    template_id IN (
      SELECT id FROM bilan_templates WHERE coach_id = auth.uid()
    )
  );

-- athlete_bilan_templates : coaches CRUD, athlètes SELECT leur propre
CREATE POLICY "coaches_crud_athlete_templates" ON athlete_bilan_templates
  FOR ALL USING (
    assigned_by = auth.uid() OR
    athlete_id IN (
      SELECT id FROM athletes WHERE coach_id = auth.uid()
    )
  );
CREATE POLICY "athletes_read_own_template" ON athlete_bilan_templates
  FOR SELECT USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- Seed : questions système prédéfinies
-- ============================================================

INSERT INTO bilan_questions (key, label, type, category, is_system, min_value, max_value) VALUES
  -- Mental
  ('humeur', 'Humeur générale', 'slider_1_10', 'mental', TRUE, 1, 10),
  ('motivation', 'Motivation', 'slider_1_10', 'mental', TRUE, 1, 10),
  ('libido', 'Libido', 'slider_1_10', 'mental', TRUE, 1, 10),
  ('confiance', 'Niveau de confiance', 'slider_1_10', 'mental', TRUE, 1, 10),
  ('focus', 'Qualité de concentration', 'slider_1_10', 'mental', TRUE, 1, 10),
  -- Health
  ('douleur_zone', 'Douleur (zone)', 'text_short', 'health', TRUE, NULL, NULL),
  ('douleur_intensite', 'Intensité douleur', 'slider_1_10', 'health', TRUE, 1, 10),
  ('cycle_symptomes', 'Symptômes cycle menstruel', 'boolean', 'health', TRUE, NULL, NULL),
  ('coherence_cardiaque', 'Cohérence cardiaque (min)', 'number', 'health', TRUE, 0, 60),
  -- Nutrition
  ('faim', 'Niveau de faim', 'slider_1_10', 'nutrition', TRUE, 1, 10),
  ('contexte_alimentaire', 'Contexte alimentaire', 'text_short', 'nutrition', TRUE, NULL, NULL),
  ('complements_pris', 'Compléments pris ?', 'boolean', 'nutrition', TRUE, NULL, NULL),
  -- Training
  ('performance_subjective', 'Performance subjective', 'slider_1_10', 'training', TRUE, 1, 10),
  ('hydratation', 'Hydratation (litres)', 'number', 'training', TRUE, 0, 10)
ON CONFLICT DO NOTHING;

INSERT INTO bilan_questions (key, label, type, category, is_system, options) VALUES
  ('type_seance', 'Type de séance', 'single_choice', 'training', TRUE,
    '["Musculation", "Cardio", "Mixte", "Repos actif", "Repos complet"]'::jsonb),
  ('qualite_recuperation', 'Qualité de récupération', 'single_choice', 'sleep', TRUE,
    '["Excellente", "Bonne", "Moyenne", "Mauvaise"]'::jsonb)
ON CONFLICT DO NOTHING;
