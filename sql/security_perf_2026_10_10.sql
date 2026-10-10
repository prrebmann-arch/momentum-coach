-- Audit Advisors Supabase 2026-10-10 — lot 1 (corrections sûres).
-- À exécuter dans le SQL Editor. Idempotent. Chaque bloc logue ce qu'il fait (NOTICE).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Fonctions SECURITY DEFINER financières : plus exécutables en anonyme.
--    (non appelées par le code des apps ; l'admin web passe en authenticated)
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_payments', 'coach_payment_stats')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
    raise notice 'revoke anon: %', f;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. athlete_onboarding : insertion ouverte à tous (WITH CHECK true).
--    Les inserts passent par /api/athlete-onboarding/init (service role).
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists anyone_insert_onboarding on public.athlete_onboarding;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Index en double (doublons exacts signalés par l'advisor) — on garde un
--    exemplaire de chaque paire.
-- ─────────────────────────────────────────────────────────────────────────
drop index if exists public.idx_payment_plans_coach;          -- = idx_athlete_payment_plans_coach
drop index if exists public.idx_daily_reports_user_id_date;   -- = idx_daily_reports_user_date
drop index if exists public.idx_notifications_user_id;        -- = idx_notifications_user_created
drop index if exists public.idx_nutrition_logs_athlete_date;  -- = idx_nutrition_logs_athlete_id_date
drop index if exists public.idx_nutrition_plans_actif;        -- = idx_nutrition_plans_athlete_id_actif

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Policies RLS en double STRICTEMENT identiques (même table, action,
--    rôles, type permissif, USING et WITH CHECK au caractère près) : on
--    garde la première par ordre alphabétique. Comportement inchangé
--    (des policies permissives identiques ne font que se répéter).
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from (
      select p.*, row_number() over (
        partition by schemaname, tablename, cmd, permissive, roles, coalesce(qual, ''), coalesce(with_check, '')
        order by policyname) as rn
      from pg_policies p
      where schemaname = 'public'
    ) x
    where rn > 1
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    raise notice 'policy doublon supprimée: %.%', r.tablename, r.policyname;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. auth_rls_initplan : auth.uid() évalué une fois par requête au lieu
--    d'une fois par ligne → (select auth.uid()). Ne touche que les policies
--    qui appellent auth.uid() sans (select …).
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare r record; new_qual text; new_check text; stmt text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (   (qual ~ 'auth\.uid\(\)' and qual !~* 'select auth\.uid\(\)')
           or (with_check ~ 'auth\.uid\(\)' and with_check !~* 'select auth\.uid\(\)'))
  loop
    new_qual := regexp_replace(r.qual, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    new_check := regexp_replace(r.with_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    stmt := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if r.qual is not null then stmt := stmt || format(' using (%s)', new_qual); end if;
    if r.with_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    execute stmt;
    raise notice 'initplan corrigé: %.%', r.tablename, r.policyname;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. function_search_path_mutable : search_path figé sur les fonctions
--    signalées (public + extensions pour uuid_generate_v4 & co).
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'set_updated_at','is_admin','coach_payment_stats','admin_payments','latest_weight_per_athlete',
      'admin_overview','update_updated_at','admin_stripe_overview','set_athlete_food_items_updated_at',
      'set_workout_log_locked_at','set_routine_items_updated_at','set_daily_actions_updated_at',
      'handle_new_user','update_updated_at_column','touch_updated_at','delete_athlete_complete',
      'admin_coaches','admin_athletes','admin_metrics')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f);
    raise notice 'search_path figé: %', f;
  end loop;
end $$;
