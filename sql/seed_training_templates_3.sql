-- ============================================================
-- MOMENTUM — Seed Training Templates BATCH 3
-- Variantes POINTS FAIBLES (appliquées sur Split 5j Homme)
-- ============================================================

DO $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT id INTO v_coach_id FROM auth.users WHERE email = 'pr.rebmann@gmail.com' LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach not found.';
  END IF;

  DELETE FROM training_templates
  WHERE coach_id = v_coach_id
    AND category = '5j Focus Points faibles';

  -- ============================================================
  -- 1. FOCUS PECS FAIBLES (Split 5j Homme)
  -- Principes : isolation pecs début de séance, 50-60% volume iso,
  -- rep ranges hautes (~20) sur iso, épaules en MV, fréquence x2
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j — Pecs faibles (inter+/avancé)',
    v_coach_id,
    '5j Focus Points faibles',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Pecs (séance principale) + Triceps",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Poulie vis-à-vis (isolation pecs — tempo lent)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné machine (ou Smith)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Pec Deck (2e isolation pecs fin de séance)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Pushdown corde longue",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          }
        ]
      },
      {
        "nom": "Dos + Biceps",
        "jour": "Mardi",
        "exercices": [
          {
            "nom": "Pullover poulie (corde)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Rowing T-bar",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage vertical prise neutre",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Cuisses",
        "jour": "Mercredi",
        "exercices": [
          {
            "nom": "Leg extension",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Squat Smith (ou presse)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
            ]
          },
          {
            "nom": "Leg curl assis",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain haltères",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Crunch poulie haute",
            "muscle_principal": "Abdominaux",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Épaules (MV) + Rappel Pecs",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Poulie vis-à-vis (rappel pecs — isolation début)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé couché machine (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Élévation latérale machine (MV épaules)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Reverse pec deck (MV delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Bras + Rappel Dos",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Pushdown corde",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl marteau haltères",
            "muscle_principal": "Biceps",
            "superset_id": "B1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension overhead poulie",
            "muscle_principal": "Triceps",
            "superset_id": "B2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Rowing unilatéral poulie (rappel dos)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Tirage vertical prise neutre (rappel dos)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          }
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 2. FOCUS DOS FAIBLE (Split 5j Homme)
  -- Dos en début de séance x2, pullover isolation, pecs en MV
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j — Dos faible (inter+/avancé)',
    v_coach_id,
    '5j Focus Points faibles',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Dos (séance principale) + Biceps",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Pullover poulie corde (isolation dos — tempo lent)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Rowing T-bar (ou rowing unilatéral)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage vertical prise neutre",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage horizontal poulie (prise neutre)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Pecs (MV) + Triceps",
        "jour": "Mardi",
        "exercices": [
          {
            "nom": "Pec Deck",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Pushdown corde longue",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          }
        ]
      },
      {
        "nom": "Cuisses",
        "jour": "Mercredi",
        "exercices": [
          {
            "nom": "Leg extension",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Squat Smith (ou presse)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
            ]
          },
          {
            "nom": "Leg curl assis",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain haltères",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Crunch poulie haute",
            "muscle_principal": "Abdominaux",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Épaules + Rappel Dos",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Pullover poulie corde (rappel dos — isolation début)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Rowing unilatéral poulie (rappel dos)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Élévation latérale machine",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé épaules haltères (semi-neutre)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Reverse pec deck (delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Bras + Rappel Dos",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Tirage vertical prise neutre (rappel dos)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Pushdown corde",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl marteau haltères",
            "muscle_principal": "Biceps",
            "superset_id": "B1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension overhead poulie",
            "muscle_principal": "Triceps",
            "superset_id": "B2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 3. FOCUS QUADS FAIBLES (Split 5j)
  -- Leg extension début de séance x2, épaules ou bras en MV
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j — Quads faibles (inter+/avancé)',
    v_coach_id,
    '5j Focus Points faibles',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Quads (séance principale)",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Leg extension (isolation quads — tempo lent)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Squat Smith (ou presse)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m30"}
            ]
          },
          {
            "nom": "Hack squat (ou fentes Smith)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Leg curl assis",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain haltères",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          }
        ]
      },
      {
        "nom": "Pecs + Triceps",
        "jour": "Mardi",
        "exercices": [
          {
            "nom": "Pec Deck",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Dips (ou développé décliné machine)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Pushdown corde longue",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          }
        ]
      },
      {
        "nom": "Dos + Biceps",
        "jour": "Mercredi",
        "exercices": [
          {
            "nom": "Pullover poulie corde",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Rowing T-bar",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage vertical prise neutre",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Rappel Quads + Épaules (MV)",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Leg extension (rappel quads — isolation début)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Presse à cuisses (rappel quads)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Élévation latérale machine (MV épaules)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Reverse pec deck (MV delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Crunch poulie haute",
            "muscle_principal": "Abdominaux",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Bras (MV)",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Pushdown corde",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl marteau haltères",
            "muscle_principal": "Biceps",
            "superset_id": "B1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension overhead poulie",
            "muscle_principal": "Triceps",
            "superset_id": "B2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 4. FOCUS FESSIERS FAIBLES — FEMME (Split 5j)
  -- Fessiers x3/sem (séance principale + 2 rappels), quads en MV
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j Femme — Fessiers faibles (inter+)',
    v_coach_id,
    '5j Focus Points faibles',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Fessiers (séance principale)",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Hip thrust machine (tempo lent)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Fentes bulgares Smith",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Abduction machine (fessier moyen)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Leg curl assis",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain haltères",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          }
        ]
      },
      {
        "nom": "Haut du corps",
        "jour": "Mardi",
        "exercices": [
          {
            "nom": "Rowing unilatéral poulie",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Tirage vertical prise neutre",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Pec Deck",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné machine",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Élévation latérale machine",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Reverse pec deck",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Quads (MV) + Rappel Fessiers",
        "jour": "Mercredi",
        "exercices": [
          {
            "nom": "Hip thrust machine (rappel fessiers)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Abduction machine (rappel fessier moyen)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Leg extension (MV quads)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Presse à cuisses (MV quads)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Crunch poulie haute",
            "muscle_principal": "Abdominaux",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Rappel Fessiers + Ischios",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Hip thrust machine (rappel fessiers)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Fentes bulgares Smith (rappel fessiers)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Leg curl assis",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain barre",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Mollets assis",
            "muscle_principal": "Mollets",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Haut du corps + Bras",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Rowing T-bar (ou machine)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage horizontal poulie",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé épaules haltères",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Curl poulie basse",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Pushdown corde",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      }
    ]'::jsonb
  );

  RAISE NOTICE '✅ 4 focus templates (batch 3) created for coach %', v_coach_id;

END $$;
