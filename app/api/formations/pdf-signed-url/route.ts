import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const video_id = req.nextUrl.searchParams.get('id')
  if (!video_id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  const { data: item } = await admin
    .from('formation_videos')
    .select('formation_id, content_type, file_path')
    .eq('id', video_id)
    .single()
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (item.content_type !== 'pdf' || !item.file_path) {
    return NextResponse.json({ error: 'not a pdf item' }, { status: 400 })
  }

  const { data: formation } = await admin
    .from('formations')
    .select('coach_id')
    .eq('id', item.formation_id)
    .single()
  if (!formation) return NextResponse.json({ error: 'formation not found' }, { status: 404 })

  // Access: the owning coach, or an athlete belonging to that coach —
  // mirrors the existing formations_athlete_read RLS policy (coach-wide,
  // not filtered by formation_members/visibility today).
  let allowed = formation.coach_id === user.id
  if (!allowed) {
    const { data: athlete } = await admin
      .from('athletes')
      .select('id')
      .eq('user_id', user.id)
      .eq('coach_id', formation.coach_id)
      .maybeSingle()
    allowed = !!athlete
  }
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: signed, error } = await admin.storage
    .from('formation-pdfs')
    .createSignedUrl(item.file_path, 3600)
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'sign failed' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
