-- Traces de boot du site coach (lib/bootTrace.ts -> /api/client-log).
-- Sert à diagnostiquer les "premier chargement bloqué / lent" en prod.
-- reason : ready | slow | stalled | abandoned | error | no-hydration
-- Écriture et lecture uniquement via service role (RLS activée, aucune policy).
-- Rétention 30 jours (purge opportuniste dans la route API).

create table if not exists public.client_boot_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  reason text not null,
  path text,
  ready_ms integer,
  payload jsonb not null
);

create index if not exists client_boot_logs_created_at_idx on public.client_boot_logs (created_at desc);

alter table public.client_boot_logs enable row level security;

-- Requêtes utiles :
--   -- blocages des 7 derniers jours
--   select created_at, reason, path, ready_ms, payload->'events' as events, payload->'errors' as errors
--   from client_boot_logs where reason <> 'ready' and created_at > now() - interval '7 days' order by created_at desc;
--   -- vitesse de boot (p50 / p95)
--   select percentile_cont(0.5) within group (order by ready_ms) p50, percentile_cont(0.95) within group (order by ready_ms) p95, count(*)
--   from client_boot_logs where reason = 'ready' and created_at > now() - interval '7 days';
