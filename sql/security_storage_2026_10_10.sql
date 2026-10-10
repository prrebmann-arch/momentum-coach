-- Audit Advisors Supabase 2026-10-10 — lot 2 (Storage + coach_payment_stats).
-- Idempotent. Les URLs signées déjà émises et les URLs publiques continuent
-- de fonctionner (elles ne passent pas par ces policies).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. athlete-avatars : n'importe qui (même non connecté) pouvait déposer,
--    remplacer ou supprimer n'importe quel fichier. Bucket non utilisé par
--    le code des 3 apps → plus aucune écriture. Lecture des avatars existants
--    inchangée (bucket public, URL publique).
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists coach_upload_avatars on storage.objects;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. coach-audio : tout utilisateur connecté (athlètes compris) pouvait lire
--    TOUS les audios et en déposer n'importe où. Chemins utilisés par le code :
--      <coach uid>/bilan_… · <coach uid>/retour_… · <coach uid>/annonce_…
--      posing-retours/<athletes.id>/…   (page posing du site)
--    Les athlètes lisent via des URLs signées déjà émises → pas besoin de SELECT.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Authenticated users read coach-audio" on storage.objects;
drop policy if exists coach_read_audio on storage.objects;
drop policy if exists coach_read_coach_audio on storage.objects;
drop policy if exists coach_upload_coach_audio on storage.objects;
drop policy if exists coach_upload_audio on storage.objects;

drop policy if exists coach_audio_own_select on storage.objects;
create policy coach_audio_own_select on storage.objects for select to authenticated
using (
  bucket_id = 'coach-audio' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or ((storage.foldername(name))[1] = 'posing-retours'
        and (storage.foldername(name))[2] in (select a.id::text from public.athletes a where a.coach_id = (select auth.uid())))
  )
);

drop policy if exists coach_audio_own_insert on storage.objects;
create policy coach_audio_own_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'coach-audio' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or ((storage.foldername(name))[1] = 'posing-retours'
        and (storage.foldername(name))[2] in (select a.id::text from public.athletes a where a.coach_id = (select auth.uid())))
  )
);
-- UPDATE / DELETE : policies existantes (owner = auth.uid() ou dossier du coach) conservées.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Buckets publics listables (content-drafts, formations) : la lecture via
--    URL publique ne dépend pas de ces policies ; on remplace la lecture
--    « tout le monde » par une lecture limitée au propriétaire (nécessaire
--    aux uploads en upsert).
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists public_read_content_drafts on storage.objects;
drop policy if exists content_drafts_owner_select on storage.objects;
create policy content_drafts_owner_select on storage.objects for select to authenticated
using (bucket_id = 'content-drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Remplacement d'un fichier existant (upsert du calque Instagram du profil) :
-- aucune policy UPDATE n'existait → le remplacement échouait.
drop policy if exists content_drafts_owner_update on storage.objects;
create policy content_drafts_owner_update on storage.objects for update to authenticated
using (bucket_id = 'content-drafts' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'content-drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists formations_public_read on storage.objects;
drop policy if exists formations_coach_select on storage.objects;
create policy formations_coach_select on storage.objects for select to authenticated
using (
  bucket_id = 'formations' and (storage.foldername(name))[1] = 'thumbnails'
  and exists (select 1 from public.formations f
              where f.coach_id = (select auth.uid()) and storage.filename(name) like f.id::text || '.%')
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. coach_payment_stats : `auth.uid() != p_coach_id` laissait passer un
--    appel sans session (NULL != x → NULL → pas d'exception).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.coach_payment_stats(p_coach_id uuid)
returns json language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare result json;
begin
  if auth.uid() is null or auth.uid() is distinct from p_coach_id then
    raise exception 'Unauthorized: can only view own stats';
  end if;
  select json_build_object(
    'total_athletes', (select count(*) from athletes where coach_id = p_coach_id),
    'active_subscriptions', (select count(*) from stripe_customers where coach_id = p_coach_id and subscription_status = 'active'),
    'monthly_revenue', (select coalesce(sum(monthly_amount), 0) from stripe_customers where coach_id = p_coach_id and subscription_status = 'active'),
    'total_received', (select coalesce(sum(amount), 0) from payment_history where coach_id = p_coach_id and status = 'succeeded' and is_platform_payment = false)
  ) into result;
  return result;
end; $$;
revoke execute on function public.coach_payment_stats(uuid) from public, anon;
grant execute on function public.coach_payment_stats(uuid) to authenticated;
