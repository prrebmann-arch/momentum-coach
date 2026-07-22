// Push notification proxy — forwards to Expo Push API (avoids CORS)
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth, authErrorResponse } from '@/lib/api/auth';

// Cached Supabase admin client (service role — persists across requests in same lambda)
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

    // Autorisation : chaque token destinataire doit appartenir au caller ou a
    // un de SES athletes. Sans ce check, tout utilisateur authentifie pouvait
    // pousser un payload arbitraire vers n'importe quel token Expo connu.
    const supabase = getSupabaseAdmin();
    const { data: rowsRaw } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .in('token', tokens);
    const rows = (rowsRaw || []) as unknown as { token: string; user_id: string }[];
    const ownerIds = [...new Set(rows.map((r) => r.user_id))];
    let myAthleteIds: string[] = [];
    if (ownerIds.length) {
      const { data: myAthletesRaw } = await supabase
        .from('athletes')
        .select('user_id')
        .eq('coach_id', user.id)
        .in('user_id', ownerIds);
      myAthleteIds = ((myAthletesRaw || []) as unknown as { user_id: string }[]).map((a) => a.user_id);
    }
    const allowedOwners = new Set([user.id, ...myAthleteIds]);
    const allowedTokens = new Set(rows.filter((r) => allowedOwners.has(r.user_id)).map((r) => r.token));
    if (tokens.some((t) => !allowedTokens.has(t))) {
      return NextResponse.json({ error: 'Forbidden: recipient not linked to caller' }, { status: 403 });
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
