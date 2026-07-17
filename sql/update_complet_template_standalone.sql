-- ============================================================
-- Le template Complet devient auto-suffisant (quotidien + complet)
-- Sur les jours de bilan complet, SEUL ce template est affiché
-- ============================================================

-- 1. Remplacer les questions du Bilan Complet Standard (6 → 21)
DELETE FROM bilan_template_questions
WHERE template_id = (
  SELECT id FROM bilan_templates WHERE name = 'Bilan Complet Standard' AND coach_id IS NULL
);

WITH tpl AS (
  SELECT id FROM bilan_templates WHERE name = 'Bilan Complet Standard' AND coach_id IS NULL
)
INSERT INTO bilan_template_questions (template_id, bilan_type, builtin_field, is_required, sort_order)
SELECT tpl.id, 'complet', q.field, q.required::boolean, q.pos
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
  ('general_notes',     'false', 15),
  ('belly_measurement', 'false', 16),
  ('hip_measurement',   'false', 17),
  ('thigh_measurement', 'false', 18),
  ('photo_front',       'false', 19),
  ('photo_side',        'false', 20),
  ('photo_back',        'false', 21)
) AS q(field, required, pos);

-- 2. Régénérer le snapshot pour tous les athlètes assignés au Bilan Complet Standard
UPDATE athlete_bilan_templates abt
SET template_snapshot = jsonb_build_object(
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
assigned_at = now()
FROM bilan_templates bt
WHERE abt.template_id = bt.id
  AND bt.name = 'Bilan Complet Standard'
  AND bt.coach_id IS NULL;

-- Vérification : nombre de questions par template
SELECT bt.name, count(*) as nb_questions
FROM bilan_template_questions btq
JOIN bilan_templates bt ON bt.id = btq.template_id
GROUP BY bt.name;
