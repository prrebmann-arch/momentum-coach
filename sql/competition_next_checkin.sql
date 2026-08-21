-- ============================================================
-- ÉCHÉANCE PROCHAIN CHECK-IN — mode compétition
-- Date: 2026-08-21
-- Le coach fixe "prochain check-in dans X heures" pour un athlète en
-- compétition. L'app athlète programme une notification locale à cette
-- heure (useCheckinReminder.js, expo-notifications) et affiche un compte à
-- rebours. Une seule échéance active à la fois par athlète (écrasée à
-- chaque nouvelle définition ou dès qu'un check-in est soumis).
-- Execute in Supabase SQL Editor
-- ============================================================

ALTER TABLE athletes ADD COLUMN IF NOT EXISTS next_checkin_at TIMESTAMPTZ;
