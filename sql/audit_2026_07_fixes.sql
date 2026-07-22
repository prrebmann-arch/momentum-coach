-- ============================================================================
-- AUDIT 2026-07-18 — Migration SQL consolidée
-- À exécuter dans le SQL Editor Supabase (prod). Idempotente : rejouable.
-- LIRE LES "NOTICE" à l'exécution : chaque table dont la colonne attendue
-- manque est SKIPPÉE avec un message (pas de RLS activée sans policy).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Timeout des transactions orphelines (incident pool du 2026-06-14)
--    Les 'idle in transaction' PostgREST saturaient max_connections après un
--    blip Cloudflare/Supabase. Fix permanent jamais appliqué jusqu'ici.
-- ----------------------------------------------------------------------------
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '60s';

-- ----------------------------------------------------------------------------
-- 2) RPC dernier poids par athlète (perf AthleteContext — remplace un fetch
--    de ≤5000 lignes daily_reports par 1 ligne/athlète). SECURITY INVOKER :
--    la RLS de daily_reports s'applique au coach appelant.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.latest_weight_per_athlete(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, weight numeric)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT ON (dr.user_id) dr.user_id, dr.weight::numeric
  FROM public.daily_reports dr
  WHERE dr.user_id = ANY(p_user_ids)
    AND dr.weight IS NOT NULL
  ORDER BY dr.user_id, dr.date DESC
$$;

-- ----------------------------------------------------------------------------
-- 3) RLS des tables jamais couvertes par une migration versionnée
--    Pattern : on n'active la RLS QUE si la policy peut être créée
--    (colonne propriétaire présente), sinon NOTICE et skip.
-- ----------------------------------------------------------------------------

-- Helper générique : tables possédées par user_id = auth.uid()
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ig_accounts','ig_reels','ig_stories','leads','automations'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE '%: table absente — skip', t; CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=t AND column_name='user_id') THEN
      RAISE NOTICE '%: colonne user_id absente — policy NON créée, vérifier manuellement', t; CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t || '_owner', t);
    RAISE NOTICE '%: RLS activée (owner user_id)', t;
  END LOOP;
END $$;

-- biz_clients / project_config : colonne propriétaire incertaine (user_id ou coach_id)
DO $$
DECLARE t text; col text;
BEGIN
  FOREACH t IN ARRAY ARRAY['biz_clients','project_config'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE '%: table absente — skip', t; CONTINUE;
    END IF;
    SELECT column_name INTO col FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name IN ('user_id','coach_id')
      ORDER BY CASE column_name WHEN 'user_id' THEN 0 ELSE 1 END LIMIT 1;
    IF col IS NULL THEN
      RAISE NOTICE '%: ni user_id ni coach_id — policy NON créée, vérifier manuellement', t; CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (%I = auth.uid()) WITH CHECK (%I = auth.uid())', t || '_owner', t, col, col);
    RAISE NOTICE '%: RLS activée (owner %)', t, col;
  END LOOP;
END $$;

-- automation_messages : possédée via le join automations (FK automation_id)
DO $$
BEGIN
  IF to_regclass('public.automation_messages') IS NULL THEN
    RAISE NOTICE 'automation_messages: absente — skip'; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='automation_messages' AND column_name='automation_id') THEN
    RAISE NOTICE 'automation_messages: automation_id absente — vérifier manuellement'; RETURN;
  END IF;
  ALTER TABLE public.automation_messages ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS automation_messages_owner ON public.automation_messages;
  CREATE POLICY automation_messages_owner ON public.automation_messages FOR ALL
    USING (EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND a.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND a.user_id = auth.uid()));
  RAISE NOTICE 'automation_messages: RLS activée (via automations)';
END $$;

-- bilan_retours : coach = propriétaire ; athlète = lecture de ses retours
DO $$
BEGIN
  IF to_regclass('public.bilan_retours') IS NULL THEN
    RAISE NOTICE 'bilan_retours: absente — skip'; RETURN;
  END IF;
  ALTER TABLE public.bilan_retours ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS bilan_retours_coach_all ON public.bilan_retours;
  CREATE POLICY bilan_retours_coach_all ON public.bilan_retours FOR ALL
    USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
  DROP POLICY IF EXISTS bilan_retours_athlete_read ON public.bilan_retours;
  CREATE POLICY bilan_retours_athlete_read ON public.bilan_retours FOR SELECT
    USING (athlete_id IN (SELECT id FROM public.athletes WHERE user_id = auth.uid()));
  RAISE NOTICE 'bilan_retours: RLS activée (coach ALL + athlète SELECT)';
END $$;

-- athlete_onboarding : athlete_id = auth.uid de l'athlète
DO $$
BEGIN
  IF to_regclass('public.athlete_onboarding') IS NULL THEN
    RAISE NOTICE 'athlete_onboarding: absente — skip'; RETURN;
  END IF;
  ALTER TABLE public.athlete_onboarding ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS athlete_onboarding_athlete ON public.athlete_onboarding;
  CREATE POLICY athlete_onboarding_athlete ON public.athlete_onboarding FOR ALL
    USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
  DROP POLICY IF EXISTS athlete_onboarding_coach ON public.athlete_onboarding;
  CREATE POLICY athlete_onboarding_coach ON public.athlete_onboarding FOR ALL
    USING (athlete_id IN (SELECT user_id FROM public.athletes WHERE coach_id = auth.uid()))
    WITH CHECK (athlete_id IN (SELECT user_id FROM public.athletes WHERE coach_id = auth.uid()));
  RAISE NOTICE 'athlete_onboarding: RLS activée';
END $$;

-- push_tokens : owner + LECTURE par le coach de ses athlètes
-- (lib/push.ts fait un SELECT client-side des tokens des athlètes du coach)
DO $$
BEGIN
  IF to_regclass('public.push_tokens') IS NULL THEN
    RAISE NOTICE 'push_tokens: absente — skip'; RETURN;
  END IF;
  ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS push_tokens_owner ON public.push_tokens;
  CREATE POLICY push_tokens_owner ON public.push_tokens FOR ALL
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  DROP POLICY IF EXISTS push_tokens_coach_read ON public.push_tokens;
  CREATE POLICY push_tokens_coach_read ON public.push_tokens FOR SELECT
    USING (user_id IN (SELECT user_id FROM public.athletes WHERE coach_id = auth.uid()));
  RAISE NOTICE 'push_tokens: RLS activée (owner + coach read)';
END $$;

-- formations : coach ALL ; athlète SELECT (formations de SON coach)
DO $$
BEGIN
  IF to_regclass('public.formations') IS NULL THEN
    RAISE NOTICE 'formations: absente — skip'; RETURN;
  END IF;
  ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS formations_coach_all ON public.formations;
  CREATE POLICY formations_coach_all ON public.formations FOR ALL
    USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
  DROP POLICY IF EXISTS formations_athlete_read ON public.formations;
  CREATE POLICY formations_athlete_read ON public.formations FOR SELECT
    USING (coach_id IN (SELECT coach_id FROM public.athletes WHERE user_id = auth.uid()));
  RAISE NOTICE 'formations: RLS activée';
END $$;

-- formation_members : colonnes incertaines — traite user_id/athlete_id, sinon NOTICE
DO $$
DECLARE col text;
BEGIN
  IF to_regclass('public.formation_members') IS NULL THEN
    RAISE NOTICE 'formation_members: absente — skip'; RETURN;
  END IF;
  SELECT column_name INTO col FROM information_schema.columns
    WHERE table_schema='public' AND table_name='formation_members' AND column_name IN ('user_id','athlete_id')
    ORDER BY CASE column_name WHEN 'user_id' THEN 0 ELSE 1 END LIMIT 1;
  IF col IS NULL THEN
    RAISE NOTICE 'formation_members: ni user_id ni athlete_id — vérifier manuellement'; RETURN;
  END IF;
  ALTER TABLE public.formation_members ENABLE ROW LEVEL SECURITY;
  EXECUTE format('DROP POLICY IF EXISTS formation_members_self ON public.formation_members');
  EXECUTE format('CREATE POLICY formation_members_self ON public.formation_members FOR SELECT USING (%I = auth.uid())', col);
  DROP POLICY IF EXISTS formation_members_coach ON public.formation_members;
  CREATE POLICY formation_members_coach ON public.formation_members FOR ALL
    USING (formation_id IN (SELECT id FROM public.formations WHERE coach_id = auth.uid()))
    WITH CHECK (formation_id IN (SELECT id FROM public.formations WHERE coach_id = auth.uid()));
  RAISE NOTICE 'formation_members: RLS activée (self % + coach via formations)', col;
END $$;

-- stripe_audit_log : service-role uniquement → RLS activée SANS policy client
DO $$
BEGIN
  IF to_regclass('public.stripe_audit_log') IS NULL THEN
    RAISE NOTICE 'stripe_audit_log: absente — skip'; RETURN;
  END IF;
  ALTER TABLE public.stripe_audit_log ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE 'stripe_audit_log: RLS activée (service role only — aucun accès client)';
END $$;

-- ----------------------------------------------------------------------------
-- 4) STORAGE — buckets sans policy versionnée
-- ----------------------------------------------------------------------------

-- execution-videos : dossier = user_id de l'athlète. Le coach ne touche jamais
-- le bucket (il lit les URLs signées 1 an stockées dans execution_videos).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'execution-videos') THEN
    RAISE NOTICE 'bucket execution-videos absent — skip'; RETURN;
  END IF;
  DROP POLICY IF EXISTS exec_videos_owner_select ON storage.objects;
  CREATE POLICY exec_videos_owner_select ON storage.objects FOR SELECT
    USING (bucket_id = 'execution-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
  DROP POLICY IF EXISTS exec_videos_owner_insert ON storage.objects;
  CREATE POLICY exec_videos_owner_insert ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'execution-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
  DROP POLICY IF EXISTS exec_videos_owner_update ON storage.objects;
  CREATE POLICY exec_videos_owner_update ON storage.objects FOR UPDATE
    USING (bucket_id = 'execution-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
  DROP POLICY IF EXISTS exec_videos_owner_delete ON storage.objects;
  CREATE POLICY exec_videos_owner_delete ON storage.objects FOR DELETE
    USING (bucket_id = 'execution-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
  RAISE NOTICE 'execution-videos: policies owner-folder créées';
END $$;

-- coach-bloodtest : {user_id}/... (athlète) OU coach/{coach_id}/... (coach)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'coach-bloodtest') THEN
    RAISE NOTICE 'bucket coach-bloodtest absent — skip'; RETURN;
  END IF;
  DROP POLICY IF EXISTS bloodtest_owner_all ON storage.objects;
  CREATE POLICY bloodtest_owner_all ON storage.objects FOR ALL
    USING (
      bucket_id = 'coach-bloodtest' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR ((storage.foldername(name))[1] = 'coach' AND (storage.foldername(name))[2] = auth.uid()::text)
      )
    )
    WITH CHECK (
      bucket_id = 'coach-bloodtest' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR ((storage.foldername(name))[1] = 'coach' AND (storage.foldername(name))[2] = auth.uid()::text)
      )
    );
  RAISE NOTICE 'coach-bloodtest: policy owner/coach-folder créée';
END $$;

-- formations (public) : durcir upload/update — uniquement thumbnails/{id-de-SA-formation}
-- (avant : tout utilisateur authentifié pouvait uploader/écraser n'importe quoi)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'formations') THEN
    RAISE NOTICE 'bucket formations absent — skip'; RETURN;
  END IF;
  DROP POLICY IF EXISTS formations_coach_upload ON storage.objects;
  CREATE POLICY formations_coach_upload ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'formations'
      AND (storage.foldername(name))[1] = 'thumbnails'
      AND EXISTS (SELECT 1 FROM public.formations f
                  WHERE f.coach_id = auth.uid()
                    AND storage.filename(name) LIKE f.id::text || '.%')
    );
  DROP POLICY IF EXISTS formations_coach_update ON storage.objects;
  CREATE POLICY formations_coach_update ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'formations'
      AND (storage.foldername(name))[1] = 'thumbnails'
      AND EXISTS (SELECT 1 FROM public.formations f
                  WHERE f.coach_id = auth.uid()
                    AND storage.filename(name) LIKE f.id::text || '.%')
    );
  RAISE NOTICE 'formations: upload/update restreints à thumbnails/{formation du coach}';
END $$;

-- ----------------------------------------------------------------------------
-- 5) athletes — policies additives pour la fenêtre pre-link (1er login)
--    La policy versionnée athlete_read_own (user_id = auth.uid()) ne couvre pas
--    le SELECT par email au 1er login (user_id encore NULL). Une policy
--    non versionnée du dashboard doit exister — CES policies la remplacent
--    proprement : APRÈS exécution, vérifier dans le dashboard s'il existe une
--    policy SELECT plus large sur athletes et la SUPPRIMER.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS athlete_read_prelink ON public.athletes;
CREATE POLICY athlete_read_prelink ON public.athletes FOR SELECT
  USING (user_id IS NULL AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS athlete_link_self ON public.athletes;
CREATE POLICY athlete_link_self ON public.athletes FOR UPDATE
  USING (user_id IS NULL AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6) Vérifications post-exécution (à lancer et lire les résultats)
-- ----------------------------------------------------------------------------
-- a) Tables SANS RLS restantes :
--   SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false ORDER BY 1;
-- b) Policies présentes sur les tables de l'audit :
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public'
--   AND tablename IN ('ig_accounts','ig_reels','ig_stories','leads','automations','automation_messages',
--                     'biz_clients','project_config','bilan_retours','athlete_onboarding','push_tokens',
--                     'formations','formation_members','stripe_audit_log','athletes') ORDER BY 1, 2;
-- c) Policies storage :
--   SELECT policyname, cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects' ORDER BY 1;
-- d) Policy SELECT trop large sur athletes (à supprimer si présente) :
--   SELECT policyname, qual FROM pg_policies WHERE tablename='athletes' AND cmd='SELECT';
-- e) RPCs admin non versionnées — récupérer leurs définitions pour audit :
--   SELECT proname, prosecdef, pg_get_functiondef(oid) FROM pg_proc
--   WHERE proname IN ('admin_overview','admin_athletes','admin_metrics','admin_coaches');
