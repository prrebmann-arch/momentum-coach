import { createClient } from '@/lib/supabase/client'

export type NotificationType = 'bilan' | 'questionnaire' | 'execution_video' | 'posing_video' | 'fodmap'

export interface CoachNotification {
  id: string
  coachId: string
  athleteId: string
  type: NotificationType
  title: string
  body: string | null
  resourceLink: string
  sourceTable: string
  sourceId: string
  readAt: string | null
  createdAt: string
}

interface CoachNotificationRow {
  id: string
  coach_id: string
  athlete_id: string
  type: NotificationType
  title: string
  body: string | null
  resource_link: string
  source_table: string
  source_id: string
  read_at: string | null
  created_at: string
}

function mapRow(row: CoachNotificationRow): CoachNotification {
  return {
    id: row.id,
    coachId: row.coach_id,
    athleteId: row.athlete_id,
    type: row.type,
    title: row.title,
    body: row.body,
    resourceLink: row.resource_link,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

const UNREAD_LIMIT = 30

export async function fetchUnreadNotifications(coachId: string): Promise<CoachNotification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('coach_notifications')
    .select('*')
    .eq('coach_id', coachId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(UNREAD_LIMIT)

  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('coach_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function markAllNotificationsRead(coachId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('coach_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('coach_id', coachId)
    .is('read_at', null)

  if (error) throw error
}

export async function markResourceNotificationsRead(
  athleteId: string,
  type: NotificationType
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('coach_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('athlete_id', athleteId)
    .eq('type', type)
    .is('read_at', null)

  if (error) throw error
}
