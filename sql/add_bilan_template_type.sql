-- ============================================================
-- Migration : colonnes manquantes + templates classiques système
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Colonne template_type sur bilan_templates
ALTER TABLE bilan_templates
  ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'quotidien'
  CHECK (template_type IN ('quotidien', 'complet'));

-- 2. Colonne bilan_type sur athlete_bilan_templates
ALTER TABLE athlete_bilan_templates
  ADD COLUMN IF NOT EXISTS bilan_type TEXT NOT NULL DEFAULT 'quotidien'
  CHECK (bilan_type IN ('quotidien', 'complet'));

-- 3. RLS : coaches peuvent voir les templates système (coach_id IS NULL)
DROP POLICY IF EXISTS "coaches_read_system_templates" ON bilan_templates;
CREATE POLICY "coaches_read_system_templates" ON bilan_templates
  FOR SELECT USING (coach_id IS NULL);

DROP POLICY IF EXISTS "coaches_read_system_template_questions" ON bilan_template_questions;
CREATE POLICY "coaches_read_system_template_questions" ON bilan_template_questions
  FOR SELECT USING (
    template_id IN (SELECT id FROM bilan_templates WHERE coach_id IS NULL)
  );

-- ============================================================
-- 4. Templates classiques système (coach_id = NULL → visible par tous les coaches)
-- ============================================================

-- Template : Bilan Quotidien Standard
WITH tpl AS (
  INSERT INTO bilan_templates (coach_id, name, description, template_type)
  VALUES (NULL, 'Bilan Quotidien Standard', 'Questions classiques du bilan quotidien', 'quotidien')
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO bilan_template_questions (template_id, bilan_type, builtin_field, is_required, sort_order)
SELECT tpl.id, 'quotidien', q.field, q.required::boolean, q.pos
FROM tpl,
(VALUES
  ('energy',            'true',  1),
  ('stress',            'true',  2),
  ('sleep_quality',     'true',  3),
  ('soreness',          'false', 4),
  ('session_enjoyment', 'false', 5),
  ('weight',            'false', 6),
  ('cardio_minutes',    'false', 7),
  ('bedtime',           'false', 8),
  ('wakeup',            'false', 9),
  ('sleep_efficiency',  'false', 10),
  ('sick_signs',        'false', 11),
  ('adherence',         'false', 12),
  ('positive_week',     'false', 13),
  ('negative_week',     'false', 14),
  ('general_notes',     'false', 15)
) AS q(field, required, pos);

-- Template : Bilan Complet Standard
WITH tpl AS (
  INSERT INTO bilan_templates (coach_id, name, description, template_type)
  VALUES (NULL, 'Bilan Complet Standard', 'Mensurations + photos (jours de bilan complet)', 'complet')
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO bilan_template_questions (template_id, bilan_type, builtin_field, is_required, sort_order)
SELECT tpl.id, 'complet', q.field, q.required::boolean, q.pos
FROM tpl,
(VALUES
  ('belly_measurement', 'false', 1),
  ('hip_measurement',   'false', 2),
  ('thigh_measurement', 'false', 3),
  ('photo_front',       'false', 4),
  ('photo_side',        'false', 5),
  ('photo_back',        'false', 6)
) AS q(field, required, pos);
