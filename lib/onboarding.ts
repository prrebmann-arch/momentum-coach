/**
 * Shared helpers for the onboarding timeline feature.
 * Used by both the per-athlete page and the templates editor.
 */

export type OnboardingStepType = 'message' | 'call' | 'milestone'

export interface OnboardingTemplateStep {
  day_offset: number
  type: OnboardingStepType
  title: string
  description?: string
}

export interface OnboardingTemplate {
  id: string
  coach_id: string
  name: string
  description: string | null
  is_default: boolean
  steps: OnboardingTemplateStep[]
  created_at: string
  updated_at: string
}

export interface AthleteOnboardingStep {
  id: string
  athlete_id: string
  coach_id: string
  template_id: string | null
  day_offset: number
  scheduled_date: string // ISO date (yyyy-mm-dd)
  type: OnboardingStepType
  title: string
  description: string | null
  done_at: string | null
  dismissed_at: string | null
  created_at: string
  updated_at: string
}

export const STEP_TYPE_META: Record<
  OnboardingStepType,
  { label: string; icon: string; color: string; shape: 'dot' | 'fill' | 'diamond' }
> = {
  message: { label: 'Message', icon: 'fa-comment-dots', color: '#9ca3af', shape: 'dot' },
  call: { label: 'Appel', icon: 'fa-phone', color: '#ef4444', shape: 'fill' },
  milestone: { label: 'Étape clé', icon: 'fa-diamond', color: '#991b1b', shape: 'diamond' },
}

/** Default "Premium" template seeded per-coach on first visit to /templates → Onboarding. */
export const PREMIUM_TEMPLATE_STEPS: OnboardingTemplateStep[] = [
  { day_offset: 0, type: 'call', title: 'R1', description: 'Call de vente — closing + paiement + caler R2 en direct' },
  { day_offset: 0, type: 'message', title: 'Questionnaire', description: 'Envoi questionnaire + confirm R2 (dans l’heure suivant R1)' },
  { day_offset: 1, type: 'message', title: 'Vidéo outil', description: 'Présentation rapide app + onboarding' },
  { day_offset: 2, type: 'message', title: 'Relance 1' },
  { day_offset: 3, type: 'message', title: 'Relance 2' },
  { day_offset: 4, type: 'milestone', title: 'Check J-3', description: 'Questionnaire + paiement + infos OK ? Sinon décaler R2 de 3j.' },
  { day_offset: 4, type: 'milestone', title: 'Roadmap', description: 'Production plan — Roadmap 3-6 mois' },
  { day_offset: 5, type: 'milestone', title: 'Training/Nut.', description: 'Production plan — Training + Nutrition' },
  { day_offset: 6, type: 'message', title: 'Rappel R2', description: 'Rappel R2 (J-1) + lien visio' },
  { day_offset: 6, type: 'milestone', title: 'Suppl./Bilan', description: 'Production plan — Suppl. + Métriques + Bilan' },
  { day_offset: 7, type: 'call', title: 'R2', description: 'Présentation plan live' },
  { day_offset: 7, type: 'message', title: 'Récap S1', description: '3 priorités semaine 1 — envoyé dans l’heure suivant R2' },
  { day_offset: 30, type: 'milestone', title: 'Bilan M1' },
]

export const PREMIUM_TEMPLATE_NAME = 'Onboarding Premium'
export const PREMIUM_TEMPLATE_DESCRIPTION =
  '7 jours pour verrouiller l’engagement — R1 → questionnaire → production → R2 → récap. Inspiré du process Romain (Synergy).'

/**
 * Ensure the "Onboarding Premium" default template exists for this coach.
 * Returns true if a row was inserted, false if one already existed (or on error).
 * Idempotent + concurrency-safe: if called multiple times in parallel for the same
 * user (e.g. templates page + athlete onboarding page racing), only the first
 * call will execute; the rest share its in-flight promise. This prevents the
 * double-seed bug where 2 callers both saw "no template" and both INSERTed.
 */
const _inFlight = new Map<string, Promise<boolean>>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensurePremiumTemplate(supabase: any, userId: string): Promise<boolean> {
  const existing = _inFlight.get(userId)
  if (existing) return existing
  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('onboarding_templates')
        .select('id')
        .eq('coach_id', userId)
        .eq('is_default', true)
        .limit(1)
      if (error) {
        console.error('[ensurePremiumTemplate] select', error)
        return false
      }
      if (data && data.length > 0) return false
      const { error: insErr } = await supabase.from('onboarding_templates').insert({
        coach_id: userId,
        name: PREMIUM_TEMPLATE_NAME,
        description: PREMIUM_TEMPLATE_DESCRIPTION,
        is_default: true,
        steps: PREMIUM_TEMPLATE_STEPS,
      })
      if (insErr) {
        console.error('[ensurePremiumTemplate] insert', insErr)
        return false
      }
      return true
    } finally {
      _inFlight.delete(userId)
    }
  })()
  _inFlight.set(userId, promise)
  return promise
}

/** Add d days to an ISO date string (yyyy-mm-dd). Returns ISO date. */
export function addDays(isoDate: string, d: number): string {
  const dt = new Date(isoDate + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + d)
  return dt.toISOString().slice(0, 10)
}

/** Today as ISO date (yyyy-mm-dd) in local time. */
export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Difference in days between two ISO dates (b - a). */
export function diffDays(a: string, b: string): number {
  const aDt = new Date(a + 'T00:00:00Z').getTime()
  const bDt = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((bDt - aDt) / 86400000)
}

export interface UrgencyInfo {
  level: 'overdue' | 'today' | 'imminent' | 'soon' | 'later' | 'far'
  color: string
  bg: string
  label: string // e.g. "J-3" / "Auj." / "+2j"
}

export function computeUrgency(scheduledDate: string, today: string): UrgencyInfo {
  const days = diffDays(today, scheduledDate)
  if (days < 0) {
    return { level: 'overdue', color: '#7f1d1d', bg: 'rgba(127,29,29,0.18)', label: `+${Math.abs(days)}j` }
  }
  if (days === 0) return { level: 'today', color: '#ef4444', bg: 'rgba(239,68,68,0.18)', label: 'Auj.' }
  if (days <= 2) return { level: 'imminent', color: '#f97316', bg: 'rgba(249,115,22,0.18)', label: `J-${days}` }
  if (days <= 7) return { level: 'soon', color: '#eab308', bg: 'rgba(234,179,8,0.18)', label: `J-${days}` }
  if (days <= 14) return { level: 'later', color: '#84cc16', bg: 'rgba(132,204,22,0.18)', label: `J-${days}` }
  return { level: 'far', color: '#6b7280', bg: 'rgba(107,114,128,0.10)', label: `J-${days}` }
}

/** Month buckets: month 1 = day 0..30, month 2 = 31..60, etc. */
export interface MonthRange {
  index: number // 0-based
  startOffset: number
  endOffset: number // inclusive
  days: number
}

export function getMonthRange(monthIndex: number): MonthRange {
  const startOffset = monthIndex === 0 ? 0 : monthIndex * 30 + 1
  const endOffset = monthIndex === 0 ? 30 : (monthIndex + 1) * 30
  return { index: monthIndex, startOffset, endOffset, days: endOffset - startOffset + 1 }
}

/** Find the month index that contains a given day_offset. */
export function monthIndexForOffset(offset: number): number {
  if (offset <= 30) return 0
  return Math.floor((offset - 1) / 30)
}

/** Format a day_offset as a human label: J0, J7, J+45… */
export function formatDayLabel(offset: number): string {
  if (offset === 0) return 'J0'
  return offset > 0 ? `J+${offset}` : `J${offset}`
}
