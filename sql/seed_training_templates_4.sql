-- ============================================================
-- MOMENTUM — Seed Training Templates BATCH 4
-- Focus: Bras faibles, Ischios faibles, Épaules faibles
-- ============================================================

DO $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT id INTO v_coach_id FROM auth.users WHERE email = 'pr.rebmann@gmail.com' LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach not found.';
  END IF;

  -- ============================================================
  -- 1. FOCUS BRAS FAIBLES (Split 5j Homme)
  -- Bras en début de séance bras (frais), séance bras dédiée,
  -- rappel bras sur push et pull, épaules en MV
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j — Bras faibles (inter+/avancé)',
    v_coach_id,
    '5j Focus Points faibles',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Bras (séance principale — frais)",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extensions triceps double corde",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "superset_id": "B1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension overhead poulie (corde)",
            "muscle_principal": "Triceps",
            "superset_id": "B2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl marteau haltères",
            "muscle_principal": "Biceps",
            "superset_id": "C1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
            "muscle_principal": "Triceps",
            "superset_id": "C2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Pecs + Rappel Triceps",
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
            "nom": "Extensions triceps double corde (rappel triceps)",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension overhead poulie (rappel triceps)",
            "muscle_principal": "Triceps",
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
        "nom": "Dos + Rappel Biceps",
        "jour": "Jeudi",
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
        "nom": "Épaules (MV) + Rappel Pecs",
        "jour": "Vendredi",
        "exercices": [
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
            "nom": "Poulie vis-à-vis (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé couché haltères (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          }
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 2. FOCUS ISCHIOS FAIBLES (Split 5j)
  -- Leg curl début de séance x2, quads en MV
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j — Ischios faibles (inter+/avancé)',
    v_coach_id,
    '5j Focus Points faibles',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Ischios (séance principale)",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Leg curl assis (isolation ischios — tempo lent)",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain barre",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
            ]
          },
          {
            "nom": "Leg curl allongé (si dispo)",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Hip thrust machine",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Leg extension (MV quads)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
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
            "nom": "Dips (ou chest press déclinée)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Extensions triceps double corde",
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
        "nom": "Rappel Ischios + Épaules",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Leg curl assis (rappel ischios — isolation début)",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain haltères (rappel ischios)",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
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
        "nom": "Bras + Rappel Pecs/Dos",
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
            "nom": "Extensions triceps double corde",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
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
            "nom": "Rowing unilatéral poulie (rappel dos)",
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
  -- 3. FOCUS ÉPAULES FAIBLES (Split 5j Homme)
  -- Élévation latérale début de séance x2, pecs en MV,
  -- delto lat + delto post en priorité
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j — Épaules faibles (inter+/avancé)',
    v_coach_id,
    '5j Focus Points faibles',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Épaules (séance principale)",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Élévation latérale machine (isolation — tempo lent)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m30"}
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
            "nom": "Élévation latérale haltères (2e iso épaules)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
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
            "nom": "Face pull poulie (delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Dos + Biceps",
        "jour": "Mardi",
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
        "nom": "Pecs (MV) + Rappel Épaules + Triceps",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Élévation latérale machine (rappel épaules — début)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "15-20", "tempo": "20X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Reverse pec deck (rappel delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Pec Deck (MV pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith (MV pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Extensions triceps double corde",
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
        "nom": "Bras + Rappel Dos",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Curl marteau haltères",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension overhead poulie",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
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

  RAISE NOTICE '✅ 3 focus templates (batch 4) created for coach %', v_coach_id;

END $$;
