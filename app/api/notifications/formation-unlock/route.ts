import { createClient } from '@supabase/supabase-js'
import { verifyCronSecret, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 60
export const runtime = 'nodejs'

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  return _supabaseAdmin
}

type Formation = { id: string; title: string; coach_id: string; visibility: 'all' | 'selected' }
type Video = { id: string; formation_id: string; title: string; available_from_day: number }
type Athlete = { id: string; user_id: string | null; coach_id: string; created_at: string }

function daysSince(dateStr: string): number {
  const start = new Date(dateStr).getTime()
  if (isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / 86400000))
}

export async function GET(request: Request) {
  try { verifyCronSecret(request) } catch (err) { return authErrorResponse(err) }

  const admin = getSupabaseAdmin()

  // 1. Load all scheduled videos (available_from_day > 0)
  const { data: videos, error: vErr } = await admin
    .from('formation_videos')
    .select('id, formation_id, title, available_from_day')
    .gt('available_from_day', 0)
  if (vErr) return Response.json({ error: vErr.message }, { status: 500 })
  if (!videos || videos.length === 0) return Response.json({ ok: true, pushed: 0, scanned: 0 })

  const formationIds = [...new Set((videos as Video[]).map((v) => v.formation_id))]

  // 2. Load formations
  const { data: formations } = await admin
    .from('formations')
    .select('id, title, coach_id, visibility')
    .in('id', formationIds)
  const formationMap = new Map<string, Formation>(((formations || []) as Formation[]).map((f) => [f.id, f]))

  // 3. Load formation_members (for visibility='selected')
  const { data: members } = await admin
    .from('formation_members')
    .select('formation_id, athlete_id')
    .in('formation_id', formationIds)
  const membersByFormation = new Map<string, string[]>()
  ;(members || []).forEach((m: { formation_id: string; athlete_id: string }) => {
    const arr = membersByFormation.get(m.formation_id) || []
    arr.push(m.athlete_id)
    membersByFormation.set(m.formation_id, arr)
  })

  // 4. Load athletes per coach (for visibility='all')
  const coachIds = [...new Set(((formations || []) as Formation[]).map((f) => f.coach_id))]
  const { data: athletesRaw } = await admin
    .from('athletes')
    .select('id, user_id, coach_id, created_at')
    .in('coach_id', coachIds)
  const athletesByCoach = new Map<string, Athlete[]>()
  const athletesById = new Map<string, Athlete>()
  ;((athletesRaw || []) as Athlete[]).forEach((a) => {
    const arr = athletesByCoach.get(a.coach_id) || []
    arr.push(a)
    athletesByCoach.set(a.coach_id, arr)
    athletesById.set(a.id, a)
  })

  // 5. For each video, find athletes who JUST unlocked it today
  type Target = { user_id: string; video_id: string; video_title: string; formation_id: string; formation_title: string }
  const targets: Target[] = []
  for (const v of videos as Video[]) {
    const f = formationMap.get(v.formation_id)
    if (!f) continue
    const audience: Athlete[] = f.visibility === 'selected'
      ? (membersByFormation.get(f.id) || []).map((aid) => athletesById.get(aid)).filter(Boolean) as Athlete[]
      : (athletesByCoach.get(f.coach_id) || [])
    for (const a of audience) {
      if (!a.user_id) continue
      const elapsed = daysSince(a.created_at)
      // Trigger only on the exact day the threshold is hit, to avoid daily spam
      if (elapsed === v.available_from_day) {
        targets.push({ user_id: a.user_id, video_id: v.id, video_title: v.title, formation_id: f.id, formation_title: f.title })
      }
    }
  }

  if (targets.length === 0) return Response.json({ ok: true, pushed: 0, scanned: (videos as Video[]).length })

  // 6. Idempotency: skip targets that already have a notif row for (user, video, type='formation_unlock')
  const userIds = [...new Set(targets.map((t) => t.user_id))]
  const videoIds = [...new Set(targets.map((t) => t.video_id))]
  const { data: existing } = await admin
    .from('notifications')
    .select('user_id, metadata')
    .in('user_id', userIds)
    .eq('type', 'formation_unlock')
  const sentKeys = new Set<string>()
  ;((existing || []) as Array<{ user_id: string; metadata: Record<string, unknown> | null }>).forEach((n) => {
    const vid = n.metadata && typeof n.metadata === 'object' ? (n.metadata as Record<string, unknown>).video_id : undefined
    if (vid && videoIds.includes(String(vid))) sentKeys.add(`${n.user_id}|${vid}`)
  })
  const fresh = targets.filter((t) => !sentKeys.has(`${t.user_id}|${t.video_id}`))
  if (fresh.length === 0) return Response.json({ ok: true, pushed: 0, scanned: (videos as Video[]).length, skipped_already_sent: targets.length })

  // 7. Insert notification rows
  const notifRows = fresh.map((t) => ({
    user_id: t.user_id,
    type: 'formation_unlock',
    title: `Nouvelle vidéo débloquée : ${t.formation_title}`,
    body: t.video_title,
    metadata: { formation_id: t.formation_id, video_id: t.video_id },
  }))
  await admin.from('notifications').insert(notifRows)

  // 8. Push via Expo
  const { data: tokens } = await admin
    .from('push_tokens')
    .select('token, user_id')
    .in('user_id', userIds)
  const tokensByUser = new Map<string, string[]>()
  ;((tokens || []) as Array<{ token: string; user_id: string }>).forEach((t) => {
    const arr = tokensByUser.get(t.user_id) || []
    arr.push(t.token)
    tokensByUser.set(t.user_id, arr)
  })

  const messages: Array<Record<string, unknown>> = []
  for (const t of fresh) {
    const toks = tokensByUser.get(t.user_id) || []
    for (const tok of toks) {
      messages.push({
        to: tok,
        sound: 'default',
        title: `Nouvelle vidéo débloquée : ${t.formation_title}`,
        body: t.video_title,
        data: { type: 'formation', formation_id: t.formation_id, video_id: t.video_id },
      })
    }
  }

  if (messages.length > 0) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      })
    } catch (e) {
      console.error('[formation-unlock] expo push failed', e)
    }
  }

  return Response.json({ ok: true, pushed: fresh.length, scanned: (videos as Video[]).length, push_messages: messages.length })
}
