import { createClient } from '@supabase/supabase-js'
import { verifyCronSecret, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 60

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  return _supabaseAdmin
}

const RETENTION_DAYS = 45
const BATCH_SIZE = 100

type ArchiveResult = { bucket: string; archived: number; storageErrors: number; dbError?: string }

export async function GET(request: Request) {
  try { verifyCronSecret(request) } catch (err) { return authErrorResponse(err) }

  const supabase = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400 * 1000).toISOString()

  const results: ArchiveResult[] = []

  // 1. bilan_retours / coach-video bucket (video + thumbnail per row)
  results.push(await archiveBilanRetours(supabase, cutoff))

  // 2. execution_videos / execution-videos bucket (single storage_path per row)
  results.push(await archiveExecutionVideos(supabase, cutoff))

  const totalArchived = results.reduce((sum, r) => sum + r.archived, 0)
  return Response.json({ retentionDays: RETENTION_DAYS, totalArchived, results })
}

async function archiveBilanRetours(
  supabase: ReturnType<typeof createClient>,
  cutoff: string,
): Promise<ArchiveResult> {
  const { data: candidates, error: qErr } = await supabase
    .from('bilan_retours')
    .select('id, video_path, thumbnail_path')
    .lt('created_at', cutoff)
    .is('archived_at', null)
    .not('video_path', 'is', null)
    .limit(BATCH_SIZE)

  if (qErr) return { bucket: 'coach-video', archived: 0, storageErrors: 0, dbError: qErr.message }
  if (!candidates || candidates.length === 0) return { bucket: 'coach-video', archived: 0, storageErrors: 0 }

  const paths: string[] = []
  for (const r of candidates) {
    if (r.video_path) paths.push(r.video_path as string)
    if (r.thumbnail_path) paths.push(r.thumbnail_path as string)
  }
  const { error: delErr } = await supabase.storage.from('coach-video').remove(paths)
  const storageErrors = delErr ? 1 : 0
  if (delErr) console.error('[archive] coach-video storage.remove (continuing):', delErr)

  const ids = candidates.map((r: any) => r.id)
  const { error: updErr } = await supabase
    .from('bilan_retours')
    .update({ archived_at: new Date().toISOString() })
    .in('id', ids)
  if (updErr) return { bucket: 'coach-video', archived: 0, storageErrors, dbError: updErr.message }

  return { bucket: 'coach-video', archived: ids.length, storageErrors }
}

async function archiveExecutionVideos(
  supabase: ReturnType<typeof createClient>,
  cutoff: string,
): Promise<ArchiveResult> {
  const { data: candidates, error: qErr } = await supabase
    .from('execution_videos')
    .select('id, storage_path')
    .lt('created_at', cutoff)
    .is('archived_at', null)
    .not('storage_path', 'is', null)
    .limit(BATCH_SIZE)

  if (qErr) return { bucket: 'execution-videos', archived: 0, storageErrors: 0, dbError: qErr.message }
  if (!candidates || candidates.length === 0) return { bucket: 'execution-videos', archived: 0, storageErrors: 0 }

  // Athlete upload convention (ATHLETE/src/api/executionVideos.js):
  //   video = `${baseKey}.mp4`, thumbnail = `${baseKey}_thumb.jpg`.
  const paths: string[] = []
  for (const r of candidates) {
    const p = r.storage_path as string | null
    if (!p) continue
    paths.push(p)
    const base = p.replace(/\.mp4$/i, '')
    paths.push(`${base}_thumb.jpg`)
  }
  const { error: delErr } = await supabase.storage.from('execution-videos').remove(paths)
  const storageErrors = delErr ? 1 : 0
  if (delErr) console.error('[archive] execution-videos storage.remove (continuing):', delErr)

  const ids = candidates.map((r: any) => r.id)
  const { error: updErr } = await supabase
    .from('execution_videos')
    .update({ archived_at: new Date().toISOString() })
    .in('id', ids)
  if (updErr) return { bucket: 'execution-videos', archived: 0, storageErrors, dbError: updErr.message }

  return { bucket: 'execution-videos', archived: ids.length, storageErrors }
}
