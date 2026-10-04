// Reçoit les traces de boot envoyées par lib/bootTrace.ts (navigator.sendBeacon).
// Pas d'auth : un beacon ne porte pas de header Authorization. Les données sont
// purement diagnostiques (timings, erreurs JS), le userId n'est qu'un indice de
// corrélation non fiable. Taille plafonnée, requêtes cross-site refusées.
// Persisté dans client_boot_logs (sql/client_boot_logs.sql) car les logs
// runtime Vercel ne sont gardés que peu de temps.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MAX_BYTES = 32_000;
const REASONS = new Set(['ready', 'slow', 'stalled', 'abandoned', 'error', 'no-hydration']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETENTION_DAYS = 30;

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  return _supabaseAdmin;
}

export async function POST(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return new NextResponse(null, { status: 403 });
  }

  const text = await request.text();
  if (!text || text.length > MAX_BYTES) return new NextResponse(null, { status: 413 });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const reason = typeof body.reason === 'string' && REASONS.has(body.reason) ? body.reason : null;
  if (!reason) return new NextResponse(null, { status: 400 });

  const userId = typeof body.userId === 'string' && UUID_RE.test(body.userId) ? body.userId : null;
  const path = typeof body.path === 'string' ? body.path.slice(0, 200) : null;
  const readyMs = typeof body.readyMs === 'number' && Number.isFinite(body.readyMs) ? Math.round(body.readyMs) : null;

  const line = `[client-boot] ${reason} path=${path} readyMs=${readyMs} user=${userId}`;
  if (reason === 'ready') console.log(line);
  else console.warn(line, text);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('client_boot_logs')
    .insert({ user_id: userId, reason, path, ready_ms: readyMs, payload: body } as never);
  if (error) console.error('[client-log] insert failed', error.message);

  // Rétention : purge opportuniste (~1 requête sur 50), pas besoin de cron.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
    const { error: purgeError } = await supabase.from('client_boot_logs').delete().lt('created_at', cutoff);
    if (purgeError) console.error('[client-log] purge failed', purgeError.message);
  }

  return new NextResponse(null, { status: 204 });
}
