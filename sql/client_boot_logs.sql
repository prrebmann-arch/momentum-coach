-- Traces de boot du site coach (lib/bootTrace.ts -> /api/client-log).
-- Sert à diagnostiquer les "premier chargement bloqué / lent" en prod.
-- reason   : ready | slow | stalled | abandoned | error | no-hydration
-- user_id  : renseigné UNIQUEMENT si le JWT du cookie de session a été validé
--            par Supabase Auth (verified = true). Sinon NULL ; l'id déclaré par
--            le navigateur reste dans payload->>'userId' (non fiable).
-- Les rapports non vérifiés sont plafonnés (taille + quota horaire) dans la route.
-- Écriture et lecture uniquement via service role (RLS activée, aucune policy).
-- Rétention 30 jours (purge opportuniste dans la route API).

create table if not exists public.client_boot_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  verified boolean not null default false,
  reason text not null,
  path text,
  ready_ms integer,
  payload jsonb not null
);

create index if not exists client_boot_logs_created_at_idx on public.client_boot_logs (created_at desc);
create index if not exists client_boot_logs_unverified_idx on public.client_boot_logs (created_at desc) where not verified;

alter table public.client_boot_logs enable row level security;

-- Requêtes utiles :
--   -- blocages des 7 derniers jours
--   select created_at, reason, path, coalesce(user_id::text, payload->>'userId') as coach, verified,
--          payload->'events' as events, payload->'supabase' as supabase, payload->'errors' as errors
--   from client_boot_logs where reason <> 'ready' and created_at > now() - interval '7 days' order by created_at desc;
--   -- vitesse de boot (p50 / p95)
--   select percentile_cont(0.5) within group (order by ready_ms) p50, percentile_cont(0.95) within group (order by ready_ms) p95, count(*)
--   from client_boot_logs where reason = 'ready' and created_at > now() - interval '7 days';
