import { createClient } from '@supabase/supabase-js'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 10

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  return _supabaseAdmin
}

const TTL_SECONDS = 3600  // 1 hour

export async function GET(request: Request) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(request)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get('ids')
  const retourId = searchParams.get('id')
  if (!retourId && !idsParam) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getSupabaseAdmin()

  // Mode batch (?ids=a,b,c) : la page Retours affiche jusqu'a 100 players —
  // 1 appel batch au lieu de N appels paralleles (source des timeouts 10s).
  if (idsParam) {
    const ids = [...new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 100)
    if (!ids.length) return Response.json({ error: 'Missing ids' }, { status: 400 })

    const { data: rows, error: rowsErr } = await supabase
      .from('bilan_retours')
      .select('id, athlete_id, coach_id, video_path, thumbnail_path, archived_at, athletes(user_id)')
      .in('id', ids)
    if (rowsErr) return Response.json({ error: 'Query failed' }, { status: 500 })

    type Row = { id: string; coach_id: string; video_path: string | null; thumbnail_path: string | null; archived_at: string | null; athletes: { user_id: string | null } | { user_id: string | null }[] | null }
    const accessible = ((rows || []) as unknown as Row[]).filter((r) => {
      if (r.archived_at || !r.video_path || !r.thumbnail_path) return false
      const aRef = r.athletes
      const athleteUserId = Array.isArray(aRef) ? aRef[0]?.user_id : aRef?.user_id ?? null
      return r.coach_id === user.id || (!!athleteUserId && athleteUserId === user.id)
    })

    const results: Record<string, { videoUrl: string; thumbnailUrl: string; expiresAt: string }> = {}
    if (accessible.length) {
      const paths = accessible.flatMap((r) => [r.video_path!, r.thumbnail_path!])
      // createSignedUrls = 1 seul appel HTTP au storage pour tous les paths
      const { data: signed } = await supabase.storage.from('coach-video').createSignedUrls(paths, TTL_SECONDS)
      const urlByPath = new Map((signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]))
      const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString()
      for (const r of accessible) {
        const videoUrl = urlByPath.get(r.video_path!)
        const thumbnailUrl = urlByPath.get(r.thumbnail_path!)
        if (videoUrl && thumbnailUrl) results[r.id] = { videoUrl, thumbnailUrl, expiresAt }
      }
    }
    return Response.json({ results })
  }

  if (!retourId) return Response.json({ error: 'Missing id' }, { status: 400 })

  // Fetch the retour and verify access
  const { data: retour, error } = await supabase
    .from('bilan_retours')
    .select('id, athlete_id, coach_id, video_path, thumbnail_path, archived_at, athletes(user_id)')
    .eq('id', retourId)
    .maybeSingle()

  if (error || !retour) return Response.json({ error: 'Not found' }, { status: 404 })
  if (retour.archived_at) return Response.json({ error: 'Archived' }, { status: 410 })
  if (!retour.video_path || !retour.thumbnail_path) return Response.json({ error: 'No video' }, { status: 404 })

  // Access check: caller must be the coach OR the athlete (via athletes.user_id)
  const isCoach = retour.coach_id === user.id
  // athletes was joined as nested; depending on PG/PostgREST it may be array or object
  type AthleteRef = { user_id: string | null } | { user_id: string | null }[] | null
  const athletesRef = retour.athletes as AthleteRef
  const athleteUserId = Array.isArray(athletesRef)
    ? athletesRef[0]?.user_id
    : athletesRef?.user_id ?? null
  const isAthlete = !!athleteUserId && athleteUserId === user.id

  if (!isCoach && !isAthlete) return Response.json({ error: 'Forbidden' }, { status: 403 })

  // Generate signed URLs
  const [{ data: vidSigned, error: vidErr }, { data: thumbSigned, error: thumbErr }] = await Promise.all([
    supabase.storage.from('coach-video').createSignedUrl(retour.video_path, TTL_SECONDS),
    supabase.storage.from('coach-video').createSignedUrl(retour.thumbnail_path, TTL_SECONDS),
  ])

  if (vidErr || !vidSigned) return Response.json({ error: 'Sign video URL failed' }, { status: 500 })
  if (thumbErr || !thumbSigned) return Response.json({ error: 'Sign thumb URL failed' }, { status: 500 })

  return Response.json({
    videoUrl: vidSigned.signedUrl,
    thumbnailUrl: thumbSigned.signedUrl,
    expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
  })
}
