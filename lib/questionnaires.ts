import { createClient } from '@/lib/supabase/client'
import { notifyAthlete } from '@/lib/push'
import type { QuickQuestion } from '@/components/questionnaires/QuickQuestionnaireEditor'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BulkSendTarget {
  athleteId: string
  userId: string | null
}

export interface BulkSendContent {
  templateId?: string
  templateTitre?: string
  quickTitre?: string
  questions: QuickQuestion[] | any[]
  obligatoire: boolean
}

export async function sendQuestionnaireToAthletes(
  coachId: string,
  targets: BulkSendTarget[],
  content: BulkSendContent,
): Promise<{ sent: number; notified: number }> {
  const supabase = createClient()

  const rows = targets.map((t) => ({
    template_id: content.templateId || null,
    athlete_id: t.athleteId,
    coach_id: coachId,
    obligatoire: content.obligatoire,
    questions_snapshot: content.questions,
  }))

  const { error } = await supabase.from('questionnaire_assignments').insert(rows)
  if (error) throw error

  const title = content.templateTitre || content.quickTitre || 'Questionnaire'
  const notifyResults = await Promise.all(
    targets.map(async (t) => {
      if (!t.userId) return false
      try {
        await notifyAthlete(
          t.userId, 'questionnaire', 'Nouveau questionnaire',
          `Votre coach vous a envoye un questionnaire : ${title}`,
          content.templateId ? { template_id: content.templateId } : undefined,
        )
        return true
      } catch (err) {
        console.error('[sendQuestionnaireToAthletes] notify failed for', t.athleteId, err)
        return false
      }
    }),
  )

  return {
    sent: targets.length,
    notified: notifyResults.filter(Boolean).length,
  }
}
