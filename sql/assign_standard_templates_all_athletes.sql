-- ============================================================
-- Assigne les templates standard à tous les athlètes existants
-- qui n'ont pas encore de template assigné
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- Template quotidien → tous les athlètes sans template quotidien
INSERT INTO athlete_bilan_templates (athlete_id, template_id, bilan_type, template_snapshot, assigned_by)
SELECT
  a.id,
  bt.id,
  'quotidien',
  jsonb_build_object(
    'version', 2,
    'template_id', bt.id::text,
    'template_name', bt.name,
    'bilan_type', 'quotidien',
    'questions', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'type', 'builtin',
          'field', btq.builtin_field,
          'bilan_type', 'quotidien',
          'required', btq.is_required,
          'sort_order', btq.sort_order
        ) ORDER BY btq.sort_order
      )
      FROM bilan_template_questions btq
      WHERE btq.template_id = bt.id
    )
  ),
  NULL
FROM athletes a
JOIN bilan_templates bt ON bt.name = 'Bilan Quotidien Standard' AND bt.coach_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM athlete_bilan_templates abt
  WHERE abt.athlete_id = a.id AND abt.bilan_type = 'quotidien'
);

-- Template complet → tous les athlètes sans template complet
INSERT INTO athlete_bilan_templates (athlete_id, template_id, bilan_type, template_snapshot, assigned_by)
SELECT
  a.id,
  bt.id,
  'complet',
  jsonb_build_object(
    'version', 2,
    'template_id', bt.id::text,
    'template_name', bt.name,
    'bilan_type', 'complet',
    'questions', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'type', 'builtin',
          'field', btq.builtin_field,
          'bilan_type', 'complet',
          'required', btq.is_required,
          'sort_order', btq.sort_order
        ) ORDER BY btq.sort_order
      )
      FROM bilan_template_questions btq
      WHERE btq.template_id = bt.id
    )
  ),
  NULL
FROM athletes a
JOIN bilan_templates bt ON bt.name = 'Bilan Complet Standard' AND bt.coach_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM athlete_bilan_templates abt
  WHERE abt.athlete_id = a.id AND abt.bilan_type = 'complet'
);

-- Vérification
SELECT a.prenom, a.nom, abt.bilan_type, bt.name as template_name
FROM athlete_bilan_templates abt
JOIN athletes a ON a.id = abt.athlete_id
JOIN bilan_templates bt ON bt.id = abt.template_id
ORDER BY a.nom, abt.bilan_type;
