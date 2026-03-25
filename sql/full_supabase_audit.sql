-- ============================================================
-- AUDIT COMPLET SUPABASE — Coach App
-- Exécuter dans le SQL Editor de Supabase
-- Date: 2026-03-24
-- ============================================================

-- ============================================================
-- 1. INVENTAIRE DE TOUTES LES TABLES
-- ============================================================
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS taille_totale,
  (SELECT count(*) FROM information_schema.columns c
   WHERE c.table_schema = t.schemaname AND c.table_name = t.tablename) AS nb_colonnes
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- ============================================================
-- 2. NOMBRE DE LIGNES PAR TABLE
-- ============================================================
SELECT
  relname AS table_name,
  n_live_tup AS nb_lignes_estimees,
  n_dead_tup AS lignes_mortes,
  last_vacuum,
  last_autovacuum,
  last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ============================================================
-- 3. TOUTES LES COLONNES DE TOUTES LES TABLES
-- ============================================================
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================================
-- 4. AUDIT RLS — Tables SANS RLS activé (CRITIQUE)
-- ============================================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_active,
  CASE WHEN rowsecurity THEN '✅ RLS activé' ELSE '🔴 RLS DÉSACTIVÉ — FAILLE' END AS statut
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;

-- ============================================================
-- 5. TOUTES LES POLICIES RLS EN DÉTAIL
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS operation,
  qual AS condition_select,
  with_check AS condition_insert_update
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================
-- 6. TABLES AVEC RLS ACTIVÉ MAIS SANS POLICY (BLOQUÉ)
-- ============================================================
SELECT
  t.tablename,
  '🟡 RLS activé MAIS aucune policy → table inaccessible' AS probleme
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = t.tablename
  );

-- ============================================================
-- 7. FOREIGN KEYS — Intégrité référentielle
-- ============================================================
SELECT
  tc.table_name AS table_source,
  kcu.column_name AS colonne_fk,
  ccu.table_name AS table_cible,
  ccu.column_name AS colonne_cible,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================================
-- 8. COLONNES SANS FOREIGN KEY QUI DEVRAIENT EN AVOIR
--    (colonnes nommées *_id sans contrainte FK)
-- ============================================================
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  '⚠️ Colonne _id sans FK — vérifier intégrité' AS alerte
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name LIKE '%_id'
  AND c.column_name != 'id'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc
      ON kcu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.table_schema = 'public'
      AND kcu.table_name = c.table_name
      AND kcu.column_name = c.column_name
  )
ORDER BY c.table_name, c.column_name;

-- ============================================================
-- 9. INDEX — Performance des requêtes
-- ============================================================
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================
-- 10. COLONNES FRÉQUEMMENT FILTRÉES SANS INDEX
--     (coach_id, athlete_id, user_id, actif, date)
-- ============================================================
SELECT
  c.table_name,
  c.column_name,
  '⚠️ Colonne souvent filtrée sans index dédié' AS suggestion
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name IN ('coach_id', 'athlete_id', 'user_id', 'actif', 'date', 'created_at', 'status')
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.tablename = c.table_name
      AND i.indexdef LIKE '%' || c.column_name || '%'
  )
ORDER BY c.table_name, c.column_name;

-- ============================================================
-- 11. TABLES VIDES (potentiellement inutiles)
-- ============================================================
SELECT
  relname AS table_name,
  n_live_tup AS nb_lignes,
  CASE WHEN n_live_tup = 0 THEN '🟡 Table vide — potentiellement inutile'
       ELSE '✅ Données présentes' END AS statut
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup ASC;

-- ============================================================
-- 12. COLONNES NULLABLE QUI NE DEVRAIENT PAS L'ÊTRE
--     (nom, email, prenom sur athletes)
-- ============================================================
SELECT
  table_name,
  column_name,
  is_nullable,
  data_type,
  CASE
    WHEN column_name IN ('nom', 'prenom', 'email', 'coach_id', 'athlete_id', 'user_id')
      AND is_nullable = 'YES'
    THEN '⚠️ Devrait être NOT NULL'
    ELSE '✅ OK'
  END AS recommandation
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('nom', 'prenom', 'email', 'coach_id', 'athlete_id', 'user_id')
ORDER BY table_name, column_name;

-- ============================================================
-- 13. CONTRAINTES UNIQUE ET CHECK
-- ============================================================
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('UNIQUE', 'CHECK', 'PRIMARY KEY')
ORDER BY tc.table_name, tc.constraint_type;

-- ============================================================
-- 14. TRIGGERS ACTIFS
-- ============================================================
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event,
  action_timing AS timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================
-- 15. FONCTIONS/PROCEDURES CUSTOM
-- ============================================================
SELECT
  routine_name,
  routine_type,
  data_type AS return_type,
  external_language AS language
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ============================================================
-- 16. STORAGE BUCKETS
-- ============================================================
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
ORDER BY name;

-- ============================================================
-- 17. STORAGE POLICIES (RLS sur les fichiers)
-- ============================================================
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS operation,
  qual AS condition
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;

-- ============================================================
-- 18. TAILLE DU STORAGE PAR BUCKET
-- ============================================================
SELECT
  bucket_id,
  count(*) AS nb_fichiers,
  pg_size_pretty(sum(metadata->>'size')::bigint) AS taille_totale
FROM storage.objects
GROUP BY bucket_id
ORDER BY sum(metadata->>'size')::bigint DESC;

-- ============================================================
-- 19. UTILISATEURS AUTH — Stats
-- ============================================================
SELECT
  count(*) AS total_users,
  count(*) FILTER (WHERE last_sign_in_at > now() - interval '30 days') AS actifs_30j,
  count(*) FILTER (WHERE last_sign_in_at > now() - interval '7 days') AS actifs_7j,
  count(*) FILTER (WHERE last_sign_in_at IS NULL) AS jamais_connectes,
  count(*) FILTER (WHERE email_confirmed_at IS NULL) AS email_non_confirme
FROM auth.users;

-- ============================================================
-- 20. REALTIME — Subscriptions actives
-- ============================================================
SELECT *
FROM realtime.subscription
LIMIT 50;

-- ============================================================
-- 21. ORPHELINS — Athletes sans user_id valide
-- ============================================================
SELECT a.*
FROM public.athletes a
LEFT JOIN auth.users u ON a.user_id = u.id
WHERE u.id IS NULL AND a.user_id IS NOT NULL;

-- ============================================================
-- 22. ORPHELINS — Données sans athlete valide
-- ============================================================
-- Workout programs sans athlete
SELECT 'workout_programs' AS table_name, wp.id, wp.athlete_id
FROM public.workout_programs wp
LEFT JOIN public.athletes a ON wp.athlete_id = a.id
WHERE a.id IS NULL;

-- Nutrition plans sans athlete
SELECT 'nutrition_plans' AS table_name, np.id, np.athlete_id
FROM public.nutrition_plans np
LEFT JOIN public.athletes a ON np.athlete_id = a.id
WHERE a.id IS NULL;

-- Execution videos sans athlete
SELECT 'execution_videos' AS table_name, ev.id, ev.athlete_id
FROM public.execution_videos ev
LEFT JOIN public.athletes a ON ev.athlete_id = a.id
WHERE a.id IS NULL;

-- Bilan retours sans athlete
SELECT 'bilan_retours' AS table_name, br.id, br.athlete_id
FROM public.bilan_retours br
LEFT JOIN public.athletes a ON br.athlete_id = a.id
WHERE a.id IS NULL;

-- ============================================================
-- 23. DOUBLONS POTENTIELS
-- ============================================================
-- Athletes avec même email
SELECT email, count(*) AS doublons
FROM public.athletes
WHERE email IS NOT NULL
GROUP BY email
HAVING count(*) > 1;

-- Push tokens dupliqués
SELECT user_id, count(*) AS nb_tokens
FROM public.push_tokens
GROUP BY user_id
HAVING count(*) > 1;

-- ============================================================
-- 24. COLONNES JSON — Vérifier la structure
-- ============================================================
SELECT
  table_name,
  column_name,
  data_type,
  udt_name,
  '⚠️ Colonne JSON — pas de validation de schéma' AS note
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (data_type = 'jsonb' OR data_type = 'json' OR udt_name = 'jsonb' OR udt_name = 'json')
ORDER BY table_name;

-- ============================================================
-- 25. EXTENSIONS POSTGRES INSTALLÉES
-- ============================================================
SELECT
  extname,
  extversion,
  extnamespace::regnamespace AS schema
FROM pg_extension
ORDER BY extname;

-- ============================================================
-- 26. VUES EXISTANTES
-- ============================================================
SELECT
  table_name AS view_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public';

-- ============================================================
-- 27. SEQUENCES (auto-increment)
-- ============================================================
SELECT
  sequencename,
  start_value,
  min_value,
  max_value,
  increment_by,
  last_value
FROM pg_sequences
WHERE schemaname = 'public';

-- ============================================================
-- 28. CONNEXIONS ACTIVES
-- ============================================================
SELECT
  datname,
  usename,
  application_name,
  client_addr,
  state,
  count(*) AS nb_connexions
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY datname, usename, application_name, client_addr, state
ORDER BY nb_connexions DESC;

-- ============================================================
-- 29. REQUÊTES LENTES (si pg_stat_statements activé)
-- ============================================================
-- Note: peut échouer si l'extension n'est pas activée
SELECT
  query,
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY mean_exec_time DESC
LIMIT 20;

-- ============================================================
-- 30. TAILLE TOTALE DE LA BASE
-- ============================================================
SELECT
  pg_size_pretty(pg_database_size(current_database())) AS taille_base,
  current_database() AS nom_base;

-- ============================================================
-- FIN DE L'AUDIT
-- ============================================================
