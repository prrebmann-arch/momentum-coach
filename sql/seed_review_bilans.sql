-- ============================================================================
-- SEED review Apple — questions custom + 60 jours de bilans remplis
-- Athlète : review@momentum-app.com (id 59e67c43-7951-42df-8dd9-565da78c8f4d,
--           user_id 1377a950-1425-4b8a-8f74-dd329b046be6)
-- Le template review n'avait QUE des questions builtin → on ajoute 3 questions
-- custom (récup, perf subjective, photo en plus) au snapshot, puis on remplit
-- custom_data avec ces clés pour que les réponses s'affichent (coach + athlète).
-- IDEMPOTENT. À exécuter dans le SQL Editor Supabase, bloc par bloc.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Créer les questions custom dans bilan_questions (pour le coach de review)
--    coach_id = le coach_id de l'athlète review.
-- ----------------------------------------------------------------------------
DO $$
DECLARE v_coach uuid;
BEGIN
  SELECT coach_id INTO v_coach FROM athletes WHERE id = '59e67c43-7951-42df-8dd9-565da78c8f4d';

  INSERT INTO bilan_questions (id, coach_id, key, label, type, category)
  VALUES
    ('c0000000-0000-4000-8000-000000000001', v_coach, 'recuperation',    'Qualité de récupération', 'slider_1_10', 'physical'),
    ('c0000000-0000-4000-8000-000000000002', v_coach, 'perf_subjective', 'Performance ressentie',    'slider_1_10', 'training'),
    ('c0000000-0000-4000-8000-000000000003', v_coach, 'note_libre',      'Ressenti de la semaine',   'text_long',   'mental'),
    ('c0000000-0000-4000-8000-000000000004', v_coach, 'photo_extra',     'Photo bonus (abdos)',      'photo',       'physical')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ----------------------------------------------------------------------------
-- 2) Ajouter ces questions au template_snapshot de l'athlète review
--    (quotidien : les 3 non-photo ; complet : les 4 avec la photo).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_quotidien jsonb := '[
    {"type":"custom","key":"recuperation","question_id":"c0000000-0000-4000-8000-000000000001","label":"Qualité de récupération","input_type":"slider_1_10","required":false,"bilan_type":"quotidien"},
    {"type":"custom","key":"perf_subjective","question_id":"c0000000-0000-4000-8000-000000000002","label":"Performance ressentie","input_type":"slider_1_10","required":false,"bilan_type":"quotidien"},
    {"type":"custom","key":"note_libre","question_id":"c0000000-0000-4000-8000-000000000003","label":"Ressenti de la semaine","input_type":"text_long","required":false,"bilan_type":"quotidien"}
  ]'::jsonb;
  v_complet jsonb := '[
    {"type":"custom","key":"recuperation","question_id":"c0000000-0000-4000-8000-000000000001","label":"Qualité de récupération","input_type":"slider_1_10","required":false,"bilan_type":"complet"},
    {"type":"custom","key":"perf_subjective","question_id":"c0000000-0000-4000-8000-000000000002","label":"Performance ressentie","input_type":"slider_1_10","required":false,"bilan_type":"complet"},
    {"type":"custom","key":"note_libre","question_id":"c0000000-0000-4000-8000-000000000003","label":"Ressenti de la semaine","input_type":"text_long","required":false,"bilan_type":"complet"},
    {"type":"custom","key":"photo_extra","question_id":"c0000000-0000-4000-8000-000000000004","label":"Photo bonus (abdos)","input_type":"photo","required":false,"bilan_type":"complet"}
  ]'::jsonb;
BEGIN
  -- Quotidien : on concatène les questions custom au tableau existant du snapshot
  UPDATE athlete_bilan_templates
  SET template_snapshot = jsonb_set(
        template_snapshot, '{questions}',
        (template_snapshot->'questions') || v_quotidien)
  WHERE athlete_id = '59e67c43-7951-42df-8dd9-565da78c8f4d' AND bilan_type = 'quotidien'
    AND NOT (template_snapshot->'questions') @> '[{"key":"recuperation"}]';

  UPDATE athlete_bilan_templates
  SET template_snapshot = jsonb_set(
        template_snapshot, '{questions}',
        (template_snapshot->'questions') || v_complet)
  WHERE athlete_id = '59e67c43-7951-42df-8dd9-565da78c8f4d' AND bilan_type = 'complet'
    AND NOT (template_snapshot->'questions') @> '[{"key":"recuperation"}]';
END $$;

-- ----------------------------------------------------------------------------
-- 3) SEED — 60 jours de bilans avec custom_data alignés sur ces clés.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_user_id uuid := '1377a950-1425-4b8a-8f74-dd329b046be6';
  v_date date; i int;
  v_weight numeric; v_energy int; v_sleep int; v_stress int; v_soreness int;
  v_adherence int; v_enjoy int; v_steps int; v_cardio int; v_recup int; v_perf int;
  pos text[] := ARRAY[
    'Super semaine, diète tenue à 100% et plein d''énergie 💪',
    'Record au développé couché aujourd''hui, +5kg vs le mois dernier !',
    'Je dors bien mieux depuis qu''on a avancé le dernier repas.',
    'Grosse motivation, j''ai même ajouté une séance de cardio.',
    'Le ventre dégonfle, les photos parlent d''elles-mêmes 🙏',
    'Perdu 1,2kg cette semaine sans avoir faim, incroyable.'];
  neg text[] := ARRAY[
    'Semaine compliquée, un repas de famille m''a sorti de la diète samedi.',
    'Un peu fatigué, mal dormi à cause du boulot.',
    'Courbatures énormes après la séance jambes.',
    'J''ai zappé une séance mardi, manque de temps.',
    'Coup de mou sur la motivation en milieu de semaine.'];
  gen text[] := ARRAY[
    'Pense à me conseiller des collations pour l''après-midi.',
    'On peut ajuster les glucides autour de l''entraînement ?',
    'Je pars en déplacement la semaine prochaine, comment gérer les repas ?',
    'Je peux remplacer le riz par des patates douces le soir ?',
    'Rien de spécial cette semaine, tout roule.'];
  libre text[] := ARRAY[
    'Je me sens de mieux en mieux dans mon corps.',
    'Beaucoup plus confiant à la salle qu''au début.',
    'Les efforts commencent à payer, je suis fier.',
    'Grosse forme cette semaine, prêt à pousser plus fort.'];
BEGIN
  FOR i IN 0..59 LOOP
    v_date := CURRENT_DATE - i;
    v_weight   := round((82.0 - i*0.06 + sin(i/4.0)*0.4)::numeric, 1);
    v_energy   := greatest(3, least(10, 7 + (floor(sin(i/3.0)*2))::int));
    v_sleep    := greatest(3, least(10, 7 + (floor(cos(i/5.0)*2))::int));
    v_stress   := greatest(1, least(8,  4 + (floor(sin(i/6.0)*3))::int));
    v_soreness := greatest(1, least(8,  3 + (floor(cos(i/4.0)*3))::int));
    v_adherence:= greatest(5, least(10, 8 + (floor(sin(i/7.0)*2))::int));
    v_enjoy    := greatest(5, least(10, 8 + (floor(cos(i/3.0)*2))::int));
    v_recup    := greatest(4, least(10, 7 + (floor(sin(i/5.0)*2))::int));
    v_perf     := greatest(4, least(10, 7 + (floor(cos(i/4.0)*2))::int));
    v_steps    := 6000 + (floor(random()*7000))::int;
    v_cardio   := CASE WHEN i % 3 = 0 THEN 20 + (floor(random()*25))::int ELSE 0 END;

    INSERT INTO daily_reports (
      user_id, date, weight, energy, sleep_quality, stress, soreness,
      adherence, session_enjoyment, steps, cardio_minutes, sick_signs,
      bedtime, wakeup, positive_week, negative_week, general_notes,
      belly_measurement, hip_measurement, thigh_measurement, custom_data
    ) VALUES (
      v_user_id, v_date, v_weight, v_energy, v_sleep, v_stress, v_soreness,
      v_adherence, v_enjoy, v_steps, v_cardio, (i % 23 = 0),
      '22:30', '06:45',
      CASE WHEN i % 7 = 0 THEN pos[1 + (i/7) % array_length(pos,1)] ELSE NULL END,
      CASE WHEN i % 9 = 3 THEN neg[1 + (i/9) % array_length(neg,1)] ELSE NULL END,
      CASE WHEN i % 11 = 5 THEN gen[1 + (i/11) % array_length(gen,1)] ELSE NULL END,
      CASE WHEN i % 7 = 0 THEN round((84 - i*0.05)::numeric,1) ELSE NULL END,
      CASE WHEN i % 7 = 0 THEN round((98 - i*0.03)::numeric,1) ELSE NULL END,
      CASE WHEN i % 7 = 0 THEN round((58 - i*0.02)::numeric,1) ELSE NULL END,
      jsonb_strip_nulls(jsonb_build_object(
        'recuperation', v_recup,
        'perf_subjective', v_perf,
        'note_libre', CASE WHEN i % 6 = 0 THEN libre[1 + (i/6) % array_length(libre,1)] ELSE NULL END
      ))
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
      weight = EXCLUDED.weight, energy = EXCLUDED.energy, sleep_quality = EXCLUDED.sleep_quality,
      stress = EXCLUDED.stress, soreness = EXCLUDED.soreness, adherence = EXCLUDED.adherence,
      session_enjoyment = EXCLUDED.session_enjoyment, steps = EXCLUDED.steps,
      cardio_minutes = EXCLUDED.cardio_minutes, sick_signs = EXCLUDED.sick_signs,
      bedtime = EXCLUDED.bedtime, wakeup = EXCLUDED.wakeup,
      positive_week = EXCLUDED.positive_week, negative_week = EXCLUDED.negative_week,
      general_notes = EXCLUDED.general_notes, belly_measurement = EXCLUDED.belly_measurement,
      hip_measurement = EXCLUDED.hip_measurement, thigh_measurement = EXCLUDED.thigh_measurement,
      custom_data = EXCLUDED.custom_data;
  END LOOP;
  RAISE NOTICE 'Seed OK : 60 bilans pour user_id %', v_user_id;
END $$;

-- ----------------------------------------------------------------------------
-- 4) NETTOYAGE (après la review Apple) — décommenter pour tout retirer.
-- ----------------------------------------------------------------------------
-- DELETE FROM daily_reports WHERE user_id = '1377a950-1425-4b8a-8f74-dd329b046be6' AND date >= CURRENT_DATE - 60;
-- UPDATE athlete_bilan_templates SET template_snapshot = jsonb_set(template_snapshot,'{questions}',
--   (SELECT jsonb_agg(q) FROM jsonb_array_elements(template_snapshot->'questions') q WHERE q->>'type' <> 'custom'))
--   WHERE athlete_id = '59e67c43-7951-42df-8dd9-565da78c8f4d';
-- Note : les questions photo custom du seed n'ont pas de fichier réel → elles
-- s'afficheront "vides" côté coach (aucune valeur dans custom_data). Normal.
