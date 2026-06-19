'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Athlete } from '@/lib/types'

interface AthleteContextType {
  athletes: Athlete[]
  loading: boolean
  refreshAthletes: () => Promise<void>
  selectedAthleteId: string | null
  selectedAthlete: Athlete | null
  setSelectedAthleteId: (id: string | null) => void
}

const AthleteContext = createContext<AthleteContextType | undefined>(undefined)

// sessionStorage cache removed — JSON.parse of 200+ athletes was blocking the main thread for 2-5s

async function fetchAthletesData(userId: string): Promise<Athlete[]> {
  const supabase = createClient()
  // Cutoff for "upcoming" steps query: today + 14 days. We compute today in local TZ
  // to match scheduled_date (which the coach edits in their local calendar).
  const now = new Date()
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  // Horizon J+90 — assez large pour toujours afficher la prochaine action sur la card
  // athlète, même si elle est à plusieurs semaines (R2, bilan M1, etc.).
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + 90)
  const horizonIso = `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, '0')}-${String(horizon.getDate()).padStart(2, '0')}`

  const [{ data, error }, { data: phases }, { data: plans }, { data: steps, error: stepsErr }] = await Promise.all([
    supabase
      .from('athletes')
      .select('id, user_id, coach_id, prenom, nom, email, avatar_url, date_naissance, genre, objectif, poids_actuel, poids_objectif, access_mode, pas_journalier, water_goal_ml, complete_bilan_frequency, complete_bilan_interval, complete_bilan_day, complete_bilan_anchor_date, complete_bilan_month_day, complete_bilan_notif_time, onboarding_start_date, created_at')
      .eq('coach_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('roadmap_phases')
      .select('athlete_id, phase, name')
      .eq('coach_id', userId)
      .eq('status', 'en_cours')
      .limit(200),
    supabase
      .from('athlete_payment_plans')
      .select('athlete_id, payment_status, amount, frequency, is_free')
      .eq('coach_id', userId)
      .limit(200),
    supabase
      .from('athlete_onboarding_steps')
      .select('id, athlete_id, scheduled_date, type, title')
      .eq('coach_id', userId)
      .is('done_at', null)
      .is('dismissed_at', null)
      .lte('scheduled_date', horizonIso)
      .order('scheduled_date', { ascending: true })
      .limit(1000),
  ])

  // Latest weight per athlete from daily_reports (last 90 days).
  // athletes.poids_actuel column is never updated by the ATHLETE app — the
  // source of truth is daily_reports.poids. We resolve the most recent
  // non-null value per user_id and override the column at hydration.
  const userIds = (data as Array<{ user_id: string | null }> | null || [])
    .map(a => a.user_id)
    .filter((id): id is string => !!id)
  const latestWeightByUserId = new Map<string, number>()
  if (userIds.length > 0) {
    const ninetyAgo = new Date(now)
    ninetyAgo.setDate(ninetyAgo.getDate() - 90)
    const ninetyIso = `${ninetyAgo.getFullYear()}-${String(ninetyAgo.getMonth() + 1).padStart(2, '0')}-${String(ninetyAgo.getDate()).padStart(2, '0')}`
    const { data: reports } = await supabase
      .from('daily_reports')
      .select('user_id, poids, date')
      .in('user_id', userIds)
      .not('poids', 'is', null)
      .gte('date', ninetyIso)
      .order('date', { ascending: false })
      .limit(5000)
    ;(reports as Array<{ user_id: string; poids: number | null; date: string }> | null || []).forEach(r => {
      if (r.poids == null) return
      if (!latestWeightByUserId.has(r.user_id)) latestWeightByUserId.set(r.user_id, r.poids)
    })
  }

  if (error) throw error
  if (!data) return []
  if (stepsErr) console.error('[AthleteContext] steps fetch error', stepsErr)

  const phaseMap: Record<string, { athlete_id: string; phase: string; name: string }> = {}
  ;(phases || []).forEach((p: { athlete_id: string; phase: string; name: string }) => {
    if (!phaseMap[p.athlete_id]) phaseMap[p.athlete_id] = p
  })
  const planMap: Record<string, { payment_status: string; amount: number; frequency: string; is_free: boolean }> = {}
  ;(plans || []).forEach((p: { athlete_id: string; payment_status: string; amount: number; frequency: string; is_free: boolean }) => {
    planMap[p.athlete_id] = { payment_status: p.payment_status, amount: p.amount, frequency: p.frequency, is_free: p.is_free }
  })
  // Group steps per athlete: keep the earliest one for `_nextStep`, count today/overdue for `_urgentCount`.
  const stepMap: Record<string, { id: string; scheduled_date: string; type: 'message' | 'call' | 'milestone'; title: string }> = {}
  const urgentMap: Record<string, number> = {}
  ;(steps || []).forEach((s: { id: string; athlete_id: string; scheduled_date: string; type: 'message' | 'call' | 'milestone'; title: string }) => {
    if (!stepMap[s.athlete_id]) {
      stepMap[s.athlete_id] = { id: s.id, scheduled_date: s.scheduled_date, type: s.type, title: s.title }
    }
    if (s.scheduled_date <= todayIso) {
      urgentMap[s.athlete_id] = (urgentMap[s.athlete_id] || 0) + 1
    }
  })

  const fresh = (data as Athlete[]).map(a => {
    const liveWeight = a.user_id ? latestWeightByUserId.get(a.user_id) : undefined
    return {
      ...a,
      poids_actuel: liveWeight ?? a.poids_actuel,
      _phase: phaseMap[a.id] || null,
      _payment: planMap[a.id] || null,
      _nextStep: stepMap[a.id] || null,
      _urgentCount: urgentMap[a.id] || 0,
    }
  })

  return fresh
}

export function AthleteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null)

  const userId = user?.id || null

  const { data: athletes, isLoading, mutate } = useSWR(
    userId ? `athletes:${userId}` : null,
    () => fetchAthletesData(userId!),
    {
      fallbackData: undefined,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    },
  )

  // loading = true only when SWR has no data at all (no cache, no fetch result yet)
  const loading = userId ? (isLoading && !athletes) : false

  const refreshAthletes = useCallback(async () => {
    await mutate()
  }, [mutate])

  // SWR in-memory cache handles cleanup automatically on key change

  const athleteList = athletes ?? []

  const selectedAthlete = useMemo(
    () => (selectedAthleteId ? athleteList.find(a => a.id === selectedAthleteId) ?? null : null),
    [selectedAthleteId, athleteList],
  )

  const value = useMemo(
    () => ({ athletes: athleteList, loading, refreshAthletes, selectedAthleteId, selectedAthlete, setSelectedAthleteId }),
    [athleteList, loading, refreshAthletes, selectedAthleteId, selectedAthlete],
  )

  return (
    <AthleteContext.Provider value={value}>
      {children}
    </AthleteContext.Provider>
  )
}

export function useAthleteContext() {
  const ctx = useContext(AthleteContext)
  if (!ctx) throw new Error('useAthleteContext must be used within AthleteProvider')
  return ctx
}
