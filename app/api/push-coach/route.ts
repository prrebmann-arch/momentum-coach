// Push notification proxy — athlete → their own coach only. Separate from
// /api/push (coach → athlete) to keep each direction's authorization simple
// to audit rather than merging two different trust checks into one route.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth, authErrorResponse } from '@/lib/api/auth';

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  return _supabaseAdmin;
}

type PushMessage = { to?: unknown } & Record<string, unknown>;

// Types de notif qu'un athlète peut envoyer à son coach (routage côté app coach).
const ALLOWED_TYPES = new Set(['checkin', 'bilan', 'execution_video', 'posing_video', 'questionnaire', 'fodmap']);

export async function POST(request: Request) {
  let user: { id: string };
  try { ({ user } = await verifyAuth(request)); } catch (e) { return authErrorResponse(e); }

  try {
    const raw = await request.json();
    // Accepte { title, body, data } ou l'ancien tableau de messages Expo : on ne
    // garde que le contenu du 1er message, JAMAIS les destinataires (`to`).
    // Avant, l'app athlète devait lire elle-même les tokens du coach — ce que
    // la RLS de push_tokens interdit (à raison) → liste vide → aucune push.
    const msg = (Array.isArray(raw) ? raw[0] : raw) as PushMessage & { title?: unknown; body?: unknown; data?: unknown };
    const title = typeof msg?.title === 'string' ? msg.title.slice(0, 120) : '';
    const bodyText = typeof msg?.body === 'string' ? msg.body.slice(0, 500) : '';
    const data = (msg?.data && typeof msg.data === 'object' ? msg.data : {}) as Record<string, unknown>;
    if (!title || !ALLOWED_TYPES.has(String(data.type))) {
      return NextResponse.json({ error: 'Invalid notification' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // L'appelant doit être un athlète ; la notif part uniquement vers SON coach.
    const { data: athleteRow } = await supabase
      .from('athletes')
      .select('coach_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const coachId = (athleteRow as { coach_id?: string } | null)?.coach_id;
    if (!coachId) {
      return NextResponse.json({ error: 'Forbidden: caller is not an athlete' }, { status: 403 });
    }

    const { data: rowsRaw, error: tokErr } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', coachId);
    if (tokErr) throw tokErr;
    const tokens = [...new Set(((rowsRaw || []) as unknown as { token: string }[]).map((r) => r.token))].slice(0, 100);
    if (!tokens.length) return NextResponse.json({ sent: 0 });

    const messages = tokens.map((to) => ({ to, sound: 'default', title, body: bodyText, data }));
    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    // Ne JAMAIS renvoyer la réponse Expo brute à l'athlète : elle contient les
    // tokens push du coach (ex. erreurs DeviceNotRegistered → details.expoPushToken).
    const result = await expoRes.json().catch(() => null) as { data?: { status?: string }[] } | null;
    const tickets = Array.isArray(result?.data) ? result!.data : [];
    const sent = tickets.filter((t) => t?.status === 'ok').length;
    if (!expoRes.ok || sent < tokens.length) {
      console.warn('[push-coach] expo', expoRes.status, JSON.stringify(result).slice(0, 500));
    }
    return NextResponse.json({ sent }, { status: expoRes.ok ? 200 : 502 });
  } catch (err: unknown) {
    console.error('[push-coach]', err);
    return NextResponse.json({ error: 'Push request failed' }, { status: 500 });
  }
}
