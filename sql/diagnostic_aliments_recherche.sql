-- ============================================================================
-- DIAGNOSTIC : "la recherche d'aliments ne remonte plus que ma base perso"
-- Exécuter bloc par bloc dans le SQL Editor Supabase et lire les résultats.
-- Contexte : la recherche athlète a 3 sources —
--   1) "Mes aliments"   = table athlete_food_items (favoris/récents perso)
--   2) "Momentum"       = table aliments_db (base coach + aliments globaux)
--   3) "Ciqual (ANSES)" = JSON LOCAL dans l'app (aucune DB — ne peut pas casser côté SQL)
--   +  "Open Food Facts" = API externe (aucune DB — voir note en bas)
-- Donc si seule "Mes aliments" remonte, le suspect DB est aliments_db (RLS ou vide).
-- ============================================================================

-- 1) La table aliments_db contient-elle des lignes ? Combien globales / par coach ?
SELECT
  count(*)                                             AS total,
  count(*) FILTER (WHERE coach_id IS NULL)             AS globaux,
  count(*) FILTER (WHERE coach_id IS NOT NULL)         AS par_coach
FROM aliments_db;

-- 2) Les policies RLS réellement présentes sur aliments_db (source de vérité prod)
SELECT policyname, cmd, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'aliments_db'
ORDER BY policyname;

-- 3) RLS est-elle activée sur la table ?
SELECT relrowsecurity AS rls_active
FROM pg_class
WHERE oid = 'public.aliments_db'::regclass;

-- 4) Simuler ce que VOIT un athlète : remplace <EMAIL_ATHLETE> par l'email d'un
--    athlète de test. Doit renvoyer les aliments de SON coach + les globaux.
--    (Requête admin — ignore la RLS ; sert à confirmer que la DONNÉE existe.)
WITH a AS (
  SELECT coach_id FROM athletes WHERE email = '<EMAIL_ATHLETE>' LIMIT 1
)
SELECT count(*) AS visibles_attendus
FROM aliments_db, a
WHERE aliments_db.coach_id = a.coach_id
   OR aliments_db.coach_id IS NULL;
