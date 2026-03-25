-- ============================================================
-- AUDIT COMPLET SUPABASE — Coach App
-- Exécuter dans le SQL Editor de Supabase (Dashboard)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. INVENTAIRE DE TOUTES LES TABLES (avec taille et nb lignes)
-- ─────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS taille_totale,
  (SELECT reltuples::bigint FROM pg_class WHERE oid = (schemaname || '.' || tablename)::regclass) AS nb_lignes_estimees
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'extensions', 'graphql', 'graphql_public', 'pgbouncer', 'pgsodium', 'pgsodium_masks', 'realtime', 'vault', '_realtime', 'supabase_functions', 'supabase_migrations', '_analytics')
ORDER BY schemaname, tablename;


-- ─────────────────────────────────────────────────────────────
-- 2. TABLES SANS RLS (FAILLE CRITIQUE)
-- ─────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_active,
  CASE WHEN rowsecurity THEN '✓ OK' ELSE '✗ DANGER — pas de RLS' END AS statut
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;


-- ─────────────────────────────────────────────────────────────
-- 3. TABLES AVEC RLS ACTIVÉ MAIS SANS AUCUNE POLICY
--    (RLS ON mais aucune policy = personne ne peut accéder)
-- ─────────────────────────────────────────────────────────────
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
GROUP BY t.tablename
HAVING COUNT(p.policyname) = 0
ORDER BY t.tablename;


-- ─────────────────────────────────────────────────────────────
-- 4. DÉTAIL DE TOUTES LES POLICIES RLS
-- ─────────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ─────────────────────────────────────────────────────────────
-- 5. TABLES VIDES (potentiellement inutiles)
-- ─────────────────────────────────────────────────────────────
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND (SELECT reltuples FROM pg_class WHERE oid = ('public.' || tablename)::regclass) = 0
ORDER BY tablename;


-- ─────────────────────────────────────────────────────────────
-- 6. COLONNES NULLABLE SANS DEFAULT (risque d'incohérence)
-- ─────────────────────────────────────────────────────────────
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND is_nullable = 'YES'
  AND column_default IS NULL
  AND column_name NOT IN ('id', 'created_at', 'updated_at')
ORDER BY table_name, ordinal_position;


-- ─────────────────────────────────────────────────────────────
-- 7. FOREIGN KEYS MANQUANTES (colonnes *_id sans FK)
-- ─────────────────────────────────────────────────────────────
SELECT
  c.table_name,
  c.column_name
FROM information_schema.columns c
LEFT JOIN information_schema.key_column_usage k
  ON k.table_name = c.table_name
  AND k.column_name = c.column_name
  AND k.table_schema = c.table_schema
  AND k.constraint_name IN (
    SELECT constraint_name FROM information_schema.referential_constraints
  )
WHERE c.table_schema = 'public'
  AND c.column_name LIKE '%_id'
  AND c.column_name != 'id'
  AND k.column_name IS NULL
ORDER BY c.table_name, c.column_name;


-- ─────────────────────────────────────────────────────────────
-- 8. INDEX MANQUANTS SUR LES FOREIGN KEYS
-- ─────────────────────────────────────────────────────────────
SELECT
  tc.table_name,
  kcu.column_name AS fk_column,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes pi
      WHERE pi.tablename = tc.table_name
        AND pi.indexdef LIKE '%' || kcu.column_name || '%'
    ) THEN '✓ Indexé'
    ELSE '✗ PAS D''INDEX — performance'
  END AS index_status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;


-- ─────────────────────────────────────────────────────────────
-- 9. INDEX EXISTANTS (vérification de doublons)
-- ─────────────────────────────────────────────────────────────
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- ─────────────────────────────────────────────────────────────
-- 10. INDEX DUPLIQUÉS (même définition)
-- ─────────────────────────────────────────────────────────────
SELECT
  array_agg(indexname) AS index_dupliques,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY indexdef
HAVING COUNT(*) > 1;


-- ─────────────────────────────────────────────────────────────
-- 11. TRIGGERS ACTIFS
-- ─────────────────────────────────────────────────────────────
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;


-- ─────────────────────────────────────────────────────────────
-- 12. FONCTIONS PERSONNALISÉES (schema public)
-- ─────────────────────────────────────────────────────────────
SELECT
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  CASE p.provolatile
    WHEN 'v' THEN 'volatile'
    WHEN 's' THEN 'stable'
    WHEN 'i' THEN 'immutable'
  END AS volatility,
  p.prosecdef AS security_definer,
  CASE WHEN p.prosecdef THEN '⚠ SECURITY DEFINER — bypass RLS!' ELSE '✓ INVOKER' END AS securite
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;


-- ─────────────────────────────────────────────────────────────
-- 13. FONCTIONS SECURITY DEFINER (bypass RLS — DANGER)
-- ─────────────────────────────────────────────────────────────
SELECT
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;


-- ─────────────────────────────────────────────────────────────
-- 14. BUCKETS STORAGE & POLICIES
-- ─────────────────────────────────────────────────────────────
SELECT
  id,
  name,
  public AS est_public,
  file_size_limit,
  allowed_mime_types,
  CASE WHEN public THEN '⚠ BUCKET PUBLIC' ELSE '✓ Privé' END AS securite
FROM storage.buckets
ORDER BY name;

-- Policies sur le storage
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;


-- ─────────────────────────────────────────────────────────────
-- 15. UTILISATEURS AUTH & DERNIÈRE CONNEXION
-- ─────────────────────────────────────────────────────────────
SELECT
  id,
  email,
  role,
  created_at,
  last_sign_in_at,
  CASE
    WHEN last_sign_in_at < NOW() - INTERVAL '90 days' THEN '⚠ Inactif >90j'
    WHEN last_sign_in_at < NOW() - INTERVAL '30 days' THEN '⚡ Inactif >30j'
    ELSE '✓ Actif'
  END AS activite
FROM auth.users
ORDER BY last_sign_in_at DESC NULLS LAST;


-- ─────────────────────────────────────────────────────────────
-- 16. REALTIME — TABLES EN ÉCOUTE
-- ─────────────────────────────────────────────────────────────
SELECT *
FROM realtime.subscription
LIMIT 50;


-- ─────────────────────────────────────────────────────────────
-- 17. VUES EXISTANTES
-- ─────────────────────────────────────────────────────────────
SELECT
  table_name AS view_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;


-- ─────────────────────────────────────────────────────────────
-- 18. CONTRAINTES CHECK MANQUANTES (colonnes status/type sans enum)
-- ─────────────────────────────────────────────────────────────
SELECT
  c.table_name,
  c.column_name,
  c.data_type
FROM information_schema.columns c
LEFT JOIN information_schema.constraint_column_usage ccu
  ON c.table_name = ccu.table_name
  AND c.column_name = ccu.column_name
  AND c.table_schema = ccu.table_schema
WHERE c.table_schema = 'public'
  AND (c.column_name LIKE '%status%' OR c.column_name LIKE '%type%' OR c.column_name LIKE '%role%')
  AND c.data_type = 'text'
  AND ccu.column_name IS NULL
ORDER BY c.table_name;


-- ─────────────────────────────────────────────────────────────
-- 19. TABLES SANS COLONNE created_at (pas de traçabilité)
-- ─────────────────────────────────────────────────────────────
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = t.tablename
      AND c.column_name = 'created_at'
  )
ORDER BY t.tablename;


-- ─────────────────────────────────────────────────────────────
-- 20. TABLES SANS PRIMARY KEY
-- ─────────────────────────────────────────────────────────────
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = t.tablename
      AND tc.constraint_type = 'PRIMARY KEY'
  )
ORDER BY t.tablename;


-- ─────────────────────────────────────────────────────────────
-- 21. COLONNES TEXT SANS LIMITE (risque d'abus)
-- ─────────────────────────────────────────────────────────────
SELECT
  table_name,
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'text'
  AND character_maximum_length IS NULL
ORDER BY table_name, column_name;


-- ─────────────────────────────────────────────────────────────
-- 22. ORPHELINS — Athletes sans coach
-- ─────────────────────────────────────────────────────────────
SELECT id, email, first_name, last_name
FROM public.athletes
WHERE coach_id IS NULL
   OR coach_id NOT IN (SELECT id FROM auth.users);


-- ─────────────────────────────────────────────────────────────
-- 23. DONNÉES ORPHELINES — workout_programs sans athlète valide
-- ─────────────────────────────────────────────────────────────
SELECT wp.id, wp.athlete_id
FROM public.workout_programs wp
LEFT JOIN public.athletes a ON wp.athlete_id = a.user_id OR wp.athlete_id = a.id
WHERE a.id IS NULL;


-- ─────────────────────────────────────────────────────────────
-- 24. DONNÉES ORPHELINES — nutrition_plans sans athlète valide
-- ─────────────────────────────────────────────────────────────
SELECT np.id, np.athlete_id
FROM public.nutrition_plans np
LEFT JOIN public.athletes a ON np.athlete_id = a.user_id OR np.athlete_id = a.id
WHERE a.id IS NULL;


-- ─────────────────────────────────────────────────────────────
-- 25. EDGE FUNCTIONS DÉPLOYÉES
-- ─────────────────────────────────────────────────────────────
-- Note: pas accessible via SQL, vérifier dans le Dashboard > Edge Functions


-- ─────────────────────────────────────────────────────────────
-- 26. RÉSUMÉ GLOBAL
-- ─────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') AS nb_tables,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS nb_policies_rls,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') AS nb_index,
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public') AS nb_functions,
  (SELECT COUNT(*) FROM storage.buckets) AS nb_buckets,
  (SELECT COUNT(*) FROM auth.users) AS nb_users,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity) AS nb_tables_sans_rls;
