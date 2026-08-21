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

export async function POST(request: Request) {
  let user: { id: string };
  try { ({ user } = await verifyAuth(request)); } catch (e) { return authErrorResponse(e); }

  try {
    const body = await request.json();
    const messages: PushMessage[] = Array.isArray(body) ? body : [body];
    const tokens = [...new Set(messages.map((m) => m?.to).filter((t): t is string => typeof t === 'string'))];
    if (!tokens.length || tokens.length !== messages.length || tokens.length > 100) {
      return NextResponse.json({ error: 'Invalid recipients' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // The caller must be an athlete row's user_id, and every target token
    // must belong to that athlete's coach_id — nothing else.
    const { data: athleteRow } = await supabase
      .from('athletes')
      .select('coach_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!athleteRow?.coach_id) {
      return NextResponse.json({ error: 'Forbidden: caller is not an athlete' }, { status: 403 });
    }

    const { data: rowsRaw } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .in('token', tokens);
    const rows = (rowsRaw || []) as unknown as { token: string; user_id: string }[];
    const allowedTokens = new Set(rows.filter((r) => r.user_id === athleteRow.coach_id).map((r) => r.token));
    if (tokens.some((t) => !allowedTokens.has(t))) {
      return NextResponse.json({ error: 'Forbidden: recipient is not your coach' }, { status: 403 });
    }

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const data = await expoRes.json();
    return NextResponse.json(data, { status: expoRes.status });
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Push request failed', message: (err as Error).message }, { status: 500 });
  }
}
