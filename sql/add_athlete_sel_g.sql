-- Sel quotidien (g/jour) — consigne globale de l'athlète, affichée en haut de la
-- diète (coach + athlète), à côté de l'objectif eau (water_goal_ml).
-- À exécuter dans le SQL Editor Supabase.
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS sel_g NUMERIC;
