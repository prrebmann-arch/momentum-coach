import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type Body = {
  formation_id: string
  video_id: string
  video_title: string
}

export async function POST(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  let body: Body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.formation_id || !body.video_id || !body.video_title) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

  // Verify coach owns the formation
  const { data: formation, error: fErr } = await admin
    .from('formations')
    .select('id, title, visibility, coach_id')
    .eq('id', body.formation_id)
    .single()
  if (fErr || !formation) return NextResponse.json({ error: 'formation_not_found' }, { status: 404 })
  if (formation.coach_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Compute audience
  let athleteIds: string[] = []
  if (formation.visibility === 'selected') {
    const { data: members } = await admin
      .from('formation_members')
      .select('athlete_id')
      .eq('formation_id', formation.id)
    athleteIds = (members || []).map((m: { athlete_id: string }) => m.athlete_id)
  } else {
    const { data: all } = await admin
      .from('athletes')
      .select('id')
      .eq('coach_id', user.id)
    athleteIds = (all || []).map((a: { id: string }) => a.id)
  }
  if (athleteIds.length === 0) return NextResponse.json({ ok: true, pushed: 0 })

  // Fetch user_ids
  const { data: athletes } = await admin
    .from('athletes')
    .select('id, user_id, prenom')
    .in('id', athleteIds)
  const withUserId = (athletes || []).filter((a: { user_id: string | null }) => !!a.user_id) as Array<{ id: string; user_id: string; prenom: string | null }>

  const title = `Nouvelle vidéo : ${formation.title}`
  const bodyText = body.video_title

  // Insert in-app notifications
  if (withUserId.length > 0) {
    const notifRows = withUserId.map((a) => ({
      user_id: a.user_id,
      type: 'formation',
      title,
      body: bodyText,
      metadata: { formation_id: formation.id, video_id: body.video_id },
    }))
    await admin.from('notifications').insert(notifRows)

    // Push via Expo
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', withUserId.map((a) => a.user_id))
    if (tokens && tokens.length > 0) {
      const messages = tokens.map((t: { token: string; user_id: string }) => ({
        to: t.token,
        sound: 'default',
        title,
        body: bodyText,
        data: { type: 'formation', formation_id: formation.id, video_id: body.video_id },
      }))
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        })
      } catch (e) {
        console.error('[formation-new-video] expo push failed', e)
      }
    }
  }

  return NextResponse.json({ ok: true, pushed: withUserId.length })
}
