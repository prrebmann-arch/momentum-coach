// Reçoit les traces de boot envoyées par lib/bootTrace.ts (navigator.sendBeacon).
// Un beacon ne porte pas de header Authorization, mais il envoie les cookies
// same-origin : on vérifie l'identité via le cookie de session Supabase.
//   - token valide  → user_id vérifié, rapport persisté.
//   - sinon (anonyme, ou JWT expiré = justement le cas d'un boot bloqué)
//     → user_id NULL (l'id déclaré par le client reste dans payload, non fiable),
//       persisté seulement sous un quota horaire et une taille réduite.
// On ne rafraîchit JAMAIS la session ici : faire tourner le refresh token côté
// serveur, en parallèle du navigateur, pourrait déconnecter le coach.
// Persisté dans client_boot_logs (sql/client_boot_logs.sql) car les logs
// runtime Vercel ne sont gardés que peu de temps.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { accessTokenFromCookies } from '@/lib/api/sessionCookie';

const MAX_BYTES = 32_000;
const MAX_BYTES_UNVERIFIED = 8_000;
const UNVERIFIED_PER_HOUR = 200;
const REASONS = new Set(['ready', 'slow', 'stalled', 'abandoned', 'error', 'no-hydration']);
const RETENTION_DAYS = 30;

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  return _supabaseAdmin;
}

export async function POST(request: NextRequest) {
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
  if (!body || typeof body !== 'object' || Array.isArray(body)) return new NextResponse(null, { status: 400 });
  const reason = typeof body.reason === 'string' && REASONS.has(body.reason) ? body.reason : null;
  if (!reason) return new NextResponse(null, { status: 400 });

  const path = typeof body.path === 'string' ? body.path.slice(0, 200) : null;
  const readyMs = typeof body.readyMs === 'number' && Number.isFinite(body.readyMs) ? Math.round(body.readyMs) : null;

  const supabase = getSupabaseAdmin();
  const accessToken = accessTokenFromCookies(request.cookies.getAll());
  let userId: string | null = null;
  if (accessToken) {
    // Valide le JWT auprès de Supabase Auth (signature + expiration), sans refresh.
    const { data } = await supabase.auth.getUser(accessToken);
    userId = data.user?.id ?? null;
  }
  const verified = userId !== null;

  const line = `[client-boot] ${reason} path=${path} readyMs=${readyMs} user=${userId ?? 'unverified'}`;
  // Boot lent (> 3 s) : on journalise le détail complet (events + durées Supabase).
  if (reason === 'ready' && (readyMs ?? 0) <= 3000) console.log(line);
  else console.warn(line, text.slice(0, MAX_BYTES));

  let persist = true;
  if (!verified) {
    // Quota anti-spam pour l'écriture non authentifiée : taille réduite +
    // plafond horaire global. Au-delà : console Vercel uniquement.
    if (text.length > MAX_BYTES_UNVERIFIED) {
      persist = false;
    } else {
      const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const { count, error: countError } = await supabase
        .from('client_boot_logs')
        .select('id', { count: 'exact', head: true })
        .eq('verified', false)
        .gte('created_at', hourAgo);
      // count null (ex : HEAD sans content-range) = quota invérifiable → on n'écrit pas.
      if (countError || count === null || count >= UNVERIFIED_PER_HOUR) persist = false;
    }
  }

  if (persist) {
    const { error } = await supabase
      .from('client_boot_logs')
      .insert({ user_id: userId, verified, reason, path, ready_ms: readyMs, payload: body } as never);
    if (error) console.error('[client-log] insert failed', error.message);
  }

  // Rétention : purge opportuniste (~1 requête sur 50), pas besoin de cron.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
    const { error: purgeError } = await supabase.from('client_boot_logs').delete().lt('created_at', cutoff);
    if (purgeError) console.error('[client-log] purge failed', purgeError.message);
  }

  return new NextResponse(null, { status: 204 });
}
