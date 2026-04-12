-- ============================================================
-- MOMENTUM — CLEAN ALL TEMPLATES + REBUILD
-- Batch 1 : Split 4 jours (7 variantes — Antonin Ditte)
-- ============================================================
-- Source : Formation Results Talk — organisation exacte Antonin
-- Volume : 8-12 séries séance initiale, 4-6 séries rappel
-- 12-18 séries/semaine par muscle
-- ============================================================

DO $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT id INTO v_coach_id FROM auth.users WHERE email = 'pr.rebmann@gmail.com' LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach not found.';
  END IF;

  -- ========== DELETE ALL EXISTING TEMPLATES ==========
  DELETE FROM training_templates WHERE coach_id = v_coach_id;

  -- ============================================================
  -- 1. BASE DU SPLIT 4 JOURS
  -- Lundi: Pectoraux | Mardi: Dos | Mercredi: OFF
  -- Jeudi: Épaules ou Bras | Ven: OFF ou Legs | Sam: OFF ou Legs
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 4j — Base',
    v_coach_id,
    'Split 4 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Pec Deck (ou poulie vis-à-vis)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith (ou machine)",
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
          }
        ]
      },
      {
        "nom": "Dos",
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
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          }
        ]
      },
      {
        "nom": "Épaules + Bras",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Élévation latérale machine (ou haltères)",
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
          },
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
            "nom": "Pushdown corde longue",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Jambes",
        "jour": "Samedi",
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
            "nom": "Squat Smith (ou presse à cuisses)",
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
            "nom": "Hip thrust machine (ou barre)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
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
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 2. SPLIT 4J FOCUS ÉPAULES
  -- Lundi: Pectoraux + Delto lat | Mardi: Dos + Delto post
  -- Mercredi: OFF | Jeudi: Bras + 1 lat + 1 post
  -- Ven: OFF ou Legs | Sam: OFF ou Legs
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 4j — Focus épaules',
    v_coach_id,
    'Split 4 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux + Delto lat",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Pec Deck (ou poulie vis-à-vis)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith (ou machine)",
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
            "nom": "Élévation latérale machine (rappel delto lat)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Dos + Delto post",
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
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Reverse pec deck (rappel delto post)",
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
        "nom": "Bras + 1 lat + 1 post",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Élévation latérale haltères (rappel delto lat)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Face pull poulie (rappel delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
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
            "nom": "Pushdown corde longue",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "superset_id": "B1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
            "muscle_principal": "Triceps",
            "superset_id": "B2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Jambes",
        "jour": "Samedi",
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
            "nom": "Squat Smith (ou presse à cuisses)",
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
            "nom": "Hip thrust machine (ou barre)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
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
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 3. SPLIT 4J FOCUS BRAS
  -- Lundi: Pectoraux + Triceps | Mardi: Dos + Biceps
  -- Mercredi: OFF | Jeudi: Épaules + 1-2 biceps + 1-2 triceps
  -- Ven: OFF ou Legs | Sam: OFF ou Legs
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 4j — Focus bras',
    v_coach_id,
    'Split 4 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux + Triceps",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Pec Deck (ou poulie vis-à-vis)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith (ou machine)",
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
            "nom": "Pushdown corde longue (rappel triceps)",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé (rappel triceps)",
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
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl incliné haltères (rappel biceps)",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl pupitre poulie (rappel biceps)",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Épaules + 1-2 biceps + 1-2 triceps",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Élévation latérale machine (ou haltères)",
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
          },
          {
            "nom": "Curl marteau haltères",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension overhead poulie (corde)",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Jambes",
        "jour": "Samedi",
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
            "nom": "Squat Smith (ou presse à cuisses)",
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
            "nom": "Hip thrust machine (ou barre)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
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
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 4. SPLIT 4J FOCUS PECS, BRAS FORT
  -- Lundi: Pectoraux + Triceps | Mardi: Dos + Biceps
  -- Mercredi: OFF | Jeudi: Épaules + 2 pecs
  -- Ven: OFF ou Legs | Sam: OFF ou Legs
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 4j — Focus pecs, bras fort',
    v_coach_id,
    'Split 4 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux + Triceps",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Pec Deck (ou poulie vis-à-vis)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith (ou machine)",
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
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
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
        "nom": "Épaules + 2 pecs (rappel)",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Élévation latérale machine (ou haltères)",
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
          },
          {
            "nom": "Poulie vis-à-vis (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé couché machine (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          }
        ]
      },
      {
        "nom": "Jambes",
        "jour": "Samedi",
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
            "nom": "Squat Smith (ou presse à cuisses)",
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
            "nom": "Hip thrust machine (ou barre)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
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
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 5. SPLIT 4J FOCUS PECS, ÉPAULES FORTES
  -- Lundi: Pectoraux + Delto lat | Mardi: Dos + Delto post
  -- Mercredi: OFF | Jeudi: Bras + 2 pecs
  -- Ven: OFF ou Legs | Sam: OFF ou Legs
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 4j — Focus pecs, épaules fortes',
    v_coach_id,
    'Split 4 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux + Delto lat",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Pec Deck (ou poulie vis-à-vis)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith (ou machine)",
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
            "nom": "Élévation latérale machine (rappel delto lat)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Dos + Delto post",
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
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Reverse pec deck (rappel delto post)",
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
        "nom": "Bras + 2 pecs (rappel)",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Poulie vis-à-vis (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé couché machine (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
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
            "nom": "Pushdown corde longue",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "superset_id": "B1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
            "muscle_principal": "Triceps",
            "superset_id": "B2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Jambes",
        "jour": "Samedi",
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
            "nom": "Squat Smith (ou presse à cuisses)",
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
            "nom": "Hip thrust machine (ou barre)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
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
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 6. SPLIT 4J FOCUS DOS, BRAS FORT
  -- Lundi: Pectoraux | Mardi: Dos + Biceps
  -- Mercredi: OFF | Jeudi: OFF
  -- Vendredi: Épaules + 2 dos | Samedi: Legs
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 4j — Focus dos, bras fort',
    v_coach_id,
    'Split 4 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Vendredi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Pec Deck (ou poulie vis-à-vis)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith (ou machine)",
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
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
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
        "nom": "Épaules + 2 dos (rappel)",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Rowing unilatéral poulie (rappel dos)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Tirage horizontal poulie (rappel dos)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Élévation latérale machine (ou haltères)",
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
        "nom": "Jambes",
        "jour": "Samedi",
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
            "nom": "Squat Smith (ou presse à cuisses)",
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
            "nom": "Hip thrust machine (ou barre)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
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
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 7. SPLIT 4J FOCUS DOS, ÉPAULES FORTES
  -- Lundi: Pectoraux + Delto lat | Mardi: Dos + Delto post
  -- Mercredi: OFF | Jeudi: OFF
  -- Vendredi: Bras + 2 dos | Samedi: Legs
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 4j — Focus dos, épaules fortes',
    v_coach_id,
    'Split 4 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Vendredi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux + Delto lat",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Pec Deck (ou poulie vis-à-vis)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith (ou machine)",
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
            "nom": "Élévation latérale machine (rappel delto lat)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Dos + Delto post",
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
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Reverse pec deck (rappel delto post)",
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
        "nom": "Bras + 2 dos (rappel)",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Rowing unilatéral poulie (rappel dos)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Tirage horizontal poulie (rappel dos)",
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
            "nom": "Pushdown corde longue",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "superset_id": "B1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
            "muscle_principal": "Triceps",
            "superset_id": "B2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Jambes",
        "jour": "Samedi",
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
            "nom": "Squat Smith (ou presse à cuisses)",
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
            "nom": "Hip thrust machine (ou barre)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
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
      }
    ]'::jsonb
  );

  RAISE NOTICE '✅ All previous templates deleted. 7 Split 4j templates created (batch 1).';

END $$;
