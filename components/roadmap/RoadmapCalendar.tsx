'use client'

import { useState, useMemo, useCallback } from 'react'
import { PROG_PHASES, type ProgPhaseKey } from '@/lib/constants'
import { toDateStr } from '@/lib/utils'
import type { RoadmapPhase } from './RoadmapTimeline'
import styles from '@/styles/roadmap.module.css'

interface ProgramRef {
  id: string
  nom: string
  created_at: string | null
}

interface NutritionRef {
  id: string
  nom: string
  meal_type: string | null
  calories_objectif: number | null
  proteines: number | null
  glucides: number | null
  lipides: number | null
  valid_from: string | null
  actif: boolean | null
}

interface DailyReport {
  date: string
  weight: number | null
  cardio_minutes: number | null
  adherence: number | null
}

interface SupplementRow {
  id: string
  dosage: number | null
  unite: string | null
  frequence: string | null
  moment_prise: string | null
  start_date: string | null
  end_date: string | null
  actif: boolean
  created_at: string | null
  supplements: { id: string; nom: string; marque: string | null; type: string | null } | null
}

interface WeekNote {
  athlete_id: string
  week_start: string
  note: string
}

interface AthleteEvent {
  id: string
  type: 'vacances' | 'competition' | 'medical' | 'autre'
  title: string
  start_date: string
  end_date: string
  notes: string | null
}

const EVENT_COLORS: Record<string, string> = {
  vacances:    '#f59e0b',
  competition: '#8b5cf6',
  medical:     '#ef4444',
  autre:       '#6b7280',
}

const EVENT_EMOJI: Record<string, string> = {
  vacances: '🏖️', competition: '🏆', medical: '🤕', autre: '📌',
}

interface NutritionLog {
  date: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meals_log: string | any[]
}

interface RoadmapCalendarProps {
  phases: RoadmapPhase[]
  programs: ProgramRef[]
  nutritions: NutritionRef[]
  reports: DailyReport[]
  supplements?: SupplementRow[]
  weekNotes?: WeekNote[]
  nutritionLogs?: NutritionLog[]
  events?: AthleteEvent[]
  onSaveWeekNote?: (weekStart: string, note: string) => Promise<void>
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

// Parse dosing frequency → times per day (e.g. "2x/jour" → 2, "3x/semaine" → 3/7)
function freqPerDay(frequence: string | null): number {
  if (!frequence) return 1
  const dayM = frequence.match(/(\d+)\s*(?:x|fois)?\s*(?:\/|par)\s*j(?:our)?/i)
  if (dayM) return parseInt(dayM[1])
  const semM = frequence.match(/(\d+)\s*(?:x|fois)?\s*(?:\/|par)\s*s(?:em(?:aine)?)?/i)
  if (semM) return parseInt(semM[1]) / 7
  return 1
}

export default function RoadmapCalendar({ phases, programs, nutritions, reports, supplements = [], weekNotes = [], nutritionLogs = [], events = [], onSaveWeekNote }: RoadmapCalendarProps) {
  const [calOffset, setCalOffset] = useState<number | null>(null)
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')

  const noteByWeek = useMemo(() => {
    const m: Record<string, string> = {}
    weekNotes.forEach(n => { m[n.week_start] = n.note })
    return m
  }, [weekNotes])

  const startNoteEdit = useCallback((weekKey: string) => {
    setEditingNoteKey(weekKey)
    setEditingNoteValue(noteByWeek[weekKey] ?? '')
  }, [noteByWeek])

  const commitNote = useCallback(async () => {
    if (!editingNoteKey || !onSaveWeekNote) { setEditingNoteKey(null); return }
    await onSaveWeekNote(editingNoteKey, editingNoteValue.trim())
    setEditingNoteKey(null)
  }, [editingNoteKey, editingNoteValue, onSaveWeekNote])

  const todayStr = toDateStr(new Date())

  // Date range
  const { minDate, maxDate, totalMonths } = useMemo(() => {
    if (!phases.length) return { minDate: new Date(), maxDate: new Date(), totalMonths: 0 }
    const allDates = phases.flatMap((p) => [
      new Date(p.start_date + 'T00:00:00'),
      new Date(p.end_date + 'T00:00:00'),
    ])
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())))
    const minD = new Date(min.getFullYear(), min.getMonth(), 1)
    const maxD = new Date(max.getFullYear(), max.getMonth() + 1, 0)
    const total = (maxD.getFullYear() - minD.getFullYear()) * 12 + (maxD.getMonth() - minD.getMonth()) + 1
    return { minDate: minD, maxDate: maxD, totalMonths: total }
  }, [phases])

  // Default offset: current month if in range
  const effectiveOffset = useMemo(() => {
    if (calOffset !== null) return calOffset
    const now = new Date()
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    if (currentMonth >= minDate && currentMonth <= maxDate) {
      return (currentMonth.getFullYear() - minDate.getFullYear()) * 12 + (currentMonth.getMonth() - minDate.getMonth())
    }
    return 0
  }, [calOffset, minDate, maxDate])

  if (!phases.length) return null

  const visibleCount = Math.min(4, totalMonths)
  const offset = Math.max(0, Math.min(effectiveOffset, totalMonths - visibleCount))
  const canPrev = offset > 0
  const canNext = offset + visibleCount < totalMonths

  const months: React.ReactNode[] = []
  for (let m = 0; m < visibleCount; m++) {
    const monthDate = new Date(minDate.getFullYear(), minDate.getMonth() + offset + m, 1)
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    const firstDay = new Date(year, month, 1)
    let startDay = firstDay.getDay() - 1
    if (startDay < 0) startDay = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: React.ReactNode[] = []
    for (let i = 0; i < startDay; i++) {
      days.push(<span key={`e-${i}`} className={styles.rmCalDay + ' ' + styles.rmCalEmpty} />)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const phase = phases.find((p) => p.start_date <= dateStr && p.end_date >= dateStr)
      const pi = phase ? PROG_PHASES[phase.phase as ProgPhaseKey] : null
      const color = pi ? pi.color : null
      const isToday = dateStr === todayStr
      const dayEvents = events.filter(ev => ev.start_date <= dateStr && ev.end_date >= dateStr)

      let style: React.CSSProperties = {}
      if (isToday) {
        style = { background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }
      } else if (color) {
        style = { background: `${color}22`, borderColor: color }
      }

      days.push(
        <span
          key={d}
          className={`${styles.rmCalDay} ${isToday ? styles.rmCalToday : ''} ${phase ? styles.rmCalInPhase : ''}`}
          style={{ ...style, position: 'relative' }}
        >
          {d}
          {dayEvents.length > 0 && (
            <span style={{
              position: 'absolute',
              bottom: 2,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 2,
            }}>
              {dayEvents.slice(0, 3).map(ev => (
                <span
                  key={ev.id}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: EVENT_COLORS[ev.type] ?? '#6b7280',
                    display: 'inline-block',
                  }}
                />
              ))}
            </span>
          )}
        </span>,
      )
    }

    months.push(
      <div key={m} className={styles.rmCalMonth}>
        <div className={styles.rmCalMonthName}>
          {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
        </div>
        <div className={styles.rmCalDaysHdr}>
          <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
        </div>
        <div className={styles.rmCalDays}>{days}</div>
      </div>,
    )
  }

  // Week table
  const weekTableRows = useMemo(() => {
    if (!phases.length) return []
    const allDates = phases.flatMap((p) => [
      new Date(p.start_date + 'T00:00:00'),
      new Date(p.end_date + 'T00:00:00'),
    ])
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())))
    // Align to Monday
    const dow = min.getDay()
    const diff = dow === 0 ? -6 : 1 - dow
    min.setDate(min.getDate() + diff)

    const weightByDate: Record<string, number> = {}
    const cardioByDate: Record<string, number> = {}
    reports.forEach((r) => {
      if (r.weight) weightByDate[r.date] = parseFloat(String(r.weight))
      if (r.cardio_minutes) cardioByDate[r.date] = (cardioByDate[r.date] || 0) + r.cardio_minutes
    })

    // Compute actual kcal/macros/adherence from nutrition_logs per day
    type DayNutri = { actualK: number; actualP: number; actualG: number; actualL: number; adherence: number }
    const nutriByDate: Record<string, DayNutri> = {}
    nutritionLogs.forEach((log) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let mealsLog: any[] = []
      try { mealsLog = (typeof log.meals_log === 'string' ? JSON.parse(log.meals_log) : log.meals_log) || [] } catch { /* empty */ }
      if (!mealsLog.length) return

      let actualK = 0, actualP = 0, actualG = 0, actualL = 0
      let followedCount = 0, totalFoods = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mealsLog.forEach((meal: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(meal?.foods || []).forEach((f: any) => {
          totalFoods++
          const orig = f.original || {}
          if (f.status === 'followed') {
            followedCount++
            actualK += parseFloat(orig.kcal) || 0
            actualP += parseFloat(orig.p) || 0
            actualG += parseFloat(orig.g) || 0
            actualL += parseFloat(orig.l) || 0
          } else if (f.status === 'replaced' && f.replacement) {
            actualK += parseFloat(f.replacement.kcal) || 0
            actualP += parseFloat(f.replacement.p) || 0
            actualG += parseFloat(f.replacement.g) || 0
            actualL += parseFloat(f.replacement.l) || 0
          }
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(meal?.extras || []).forEach((ex: any) => {
          actualK += parseFloat(ex.kcal) || 0
          actualP += parseFloat(ex.p) || 0
          actualG += parseFloat(ex.g) || 0
          actualL += parseFloat(ex.l) || 0
        })
      })
      nutriByDate[log.date] = {
        actualK, actualP, actualG, actualL,
        adherence: totalFoods > 0 ? Math.round((followedCount / totalFoods) * 100) : 0,
      }
    })

    const cycleSupps = supplements.filter(s =>
      s.supplements &&
      s.supplements.type === 'supplementation' &&
      s.dosage !== 0
    )

    // Pre-sort by date for efficient fallback lookups
    const sortedNutritions = [...nutritions].sort((a, b) => {
      const va = a.valid_from ?? '1970-01-01'
      const vb = b.valid_from ?? '1970-01-01'
      return va < vb ? -1 : va > vb ? 1 : 0
    })
    const sortedPrograms = [...programs].sort((a, b) => {
      const ca = a.created_at ?? '1970-01-01'
      const cb = b.created_at ?? '1970-01-01'
      return ca < cb ? -1 : ca > cb ? 1 : 0
    })

    const isTrainingPlan = (n: NutritionRef) =>
      !n.meal_type || n.meal_type === 'training' || n.meal_type === 'entrainement' || n.meal_type === 'on'
    const isRestPlan = (n: NutritionRef) =>
      n.meal_type === 'rest' || n.meal_type === 'repos' || n.meal_type === 'off'

    const sortedTraining = sortedNutritions.filter(isTrainingPlan)
    const sortedRest = sortedNutritions.filter(isRestPlan)

    function resolveNutritionPair(phaseNutritionId: string | null | undefined, weekEndKey: string): { training: NutritionRef | null; rest: NutritionRef | null } {
      let bestTraining: NutritionRef | null = null
      for (const n of sortedTraining) {
        const vf = n.valid_from ?? '1970-01-01'
        if (vf <= weekEndKey) bestTraining = n
      }
      if (!bestTraining) bestTraining = sortedTraining.find(n => n.actif) ?? sortedTraining[0] ?? null

      let bestRest: NutritionRef | null = null
      for (const n of sortedRest) {
        const vf = n.valid_from ?? '1970-01-01'
        if (vf <= weekEndKey) bestRest = n
      }
      if (!bestRest) bestRest = sortedRest.find(n => n.actif) ?? sortedRest[0] ?? null

      // If phase has a specific nutrition_id, use it and override the appropriate type
      if (phaseNutritionId) {
        const specified = nutritions.find(n => n.id === phaseNutritionId) ?? null
        if (specified) {
          if (isRestPlan(specified)) bestRest = specified
          else bestTraining = specified
        }
      }

      return { training: bestTraining, rest: bestRest }
    }

    // Find active program for a given week end date (fallback when phase.programme_id is null)
    function resolveProgram(phaseProgramId: string | null | undefined, weekEndKey: string): ProgramRef | null {
      if (phaseProgramId) return programs.find(p => p.id === phaseProgramId) ?? null
      let best: ProgramRef | null = null
      for (const p of sortedPrograms) {
        const ca = p.created_at ?? '1970-01-01'
        if (ca <= weekEndKey) best = p
      }
      return best
    }

    const weeks: {
      num: number
      start: string
      end: string
      phase: RoadmapPhase | undefined
      prog: ProgramRef | null
      nutri: { training: NutritionRef | null; rest: NutritionRef | null }
      avgWeight: string | null
      totalCardio: number
      supps: SupplementRow[]
      weekNutri: { avgK: number; avgP: number; avgG: number; avgL: number; adherence: number; daysLogged: number } | null
    }[] = []
    let weekStart = new Date(min)
    let weekNum = 1
    while (weekStart <= max) {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const weekKey = toDateStr(weekStart)
      const weekEndKey = toDateStr(weekEnd)

      const phase = phases.find((p) => p.start_date <= weekEndKey && p.end_date >= weekKey)

      const weightVals: number[] = []
      const nutriVals: DayNutri[] = []
      let cardioSum = 0
      for (let d = 0; d < 7; d++) {
        const dt = new Date(weekStart)
        dt.setDate(dt.getDate() + d)
        const dKey = toDateStr(dt)
        const v = weightByDate[dKey]
        if (v) weightVals.push(v)
        cardioSum += cardioByDate[dKey] || 0
        if (nutriByDate[dKey]) nutriVals.push(nutriByDate[dKey])
      }
      const avgWeight = weightVals.length
        ? (weightVals.reduce((a, b) => a + b, 0) / weightVals.length).toFixed(1)
        : null
      const weekNutri = nutriVals.length ? {
        avgK: Math.round(nutriVals.reduce((a, b) => a + b.actualK, 0) / nutriVals.length),
        avgP: Math.round(nutriVals.reduce((a, b) => a + b.actualP, 0) / nutriVals.length),
        avgG: Math.round(nutriVals.reduce((a, b) => a + b.actualG, 0) / nutriVals.length),
        avgL: Math.round(nutriVals.reduce((a, b) => a + b.actualL, 0) / nutriVals.length),
        adherence: Math.round(nutriVals.reduce((a, b) => a + b.adherence, 0) / nutriVals.length),
        daysLogged: nutriVals.length,
      } : null

      // Group all entries by supplement name, then pick the most relevant one per week:
      // - Historical (actif=false + end_date): if end_date >= weekKey, it was still active
      //   this week. Among multiple historical entries, pick earliest end_date (= the protocol
      //   in effect at the start of the week). No start constraint needed — they stop
      //   appearing naturally once end_date < weekKey.
      // - Active (actif=true): no end constraint, but use created_at as effective start
      //   to prevent supplements added later from bleeding into older weeks.
      const byName = new Map<string, SupplementRow[]>()
      for (const s of cycleSupps) {
        const key = (s.supplements?.nom ?? s.id).toLowerCase()
        const arr = byName.get(key) ?? []
        arr.push(s)
        byName.set(key, arr)
      }
      const supps: SupplementRow[] = []
      for (const entries of byName.values()) {
        const historical = entries
          .filter(e => !e.actif && !!e.end_date && e.end_date >= weekKey)
          .sort((a, b) => a.end_date! < b.end_date! ? -1 : 1)
        if (historical.length > 0) {
          supps.push(historical[0])
        } else {
          const active = entries.filter(e => {
            if (!e.actif) return false
            const eff = e.start_date ?? (e.created_at ? e.created_at.slice(0, 10) : null)
            return !eff || eff <= weekEndKey
          })
          if (active.length > 0) {
            active.sort((a, b) => (b.created_at ?? '') > (a.created_at ?? '') ? 1 : -1)
            supps.push(active[0])
          }
        }
      }

      const prog = resolveProgram(phase?.programme_id, weekEndKey)
      const nutri = resolveNutritionPair(phase?.nutrition_id, weekEndKey)

      weeks.push({ num: weekNum++, start: weekKey, end: weekEndKey, phase, prog, nutri, avgWeight, totalCardio: cardioSum, supps, weekNutri })
      weekStart.setDate(weekStart.getDate() + 7)
    }
    return weeks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases, reports, supplements, nutritionLogs, nutritions, programs])

  return (
    <>
      {/* Calendar view */}
      <div className={styles.rmCalendarSection}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 className={styles.rmSectionTitle} style={{ margin: 0 }}>Vue calendrier</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setCalOffset(offset - 1)}
              disabled={!canPrev}
              style={canPrev ? undefined : { opacity: 0.3, cursor: 'default' }}
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setCalOffset(offset + 1)}
              disabled={!canNext}
              style={canNext ? undefined : { opacity: 0.3, cursor: 'default' }}
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
        <div className={styles.rmCalGrid} style={{ gridTemplateColumns: `repeat(${visibleCount}, 1fr)` }}>
          {months}
        </div>
        <div className={styles.rmCalLegend}>
          {phases.map((p) => {
            const pi = PROG_PHASES[p.phase as ProgPhaseKey]
            const color = pi ? pi.color : '#555'
            return (
              <span key={p.id} className={styles.rmLegendItem}>
                <span className={styles.rmLegendDot} style={{ background: color }} />
                {p.name}{' '}
                <span className={styles.rmLegendDates}>
                  {formatDateShort(p.start_date)} — {formatDateShort(p.end_date)}
                </span>
              </span>
            )
          })}
        </div>
      </div>

      {/* Weekly feed cards */}
      {weekTableRows.length > 0 && (
        <div className={styles.rmFeedSection}>
          <div className={styles.rmFeedHead}>
            <h3 className={styles.rmSectionTitle} style={{ margin: 0 }}>Vue semaine par semaine</h3>
            <span className={styles.rmFeedHeadHint}>
              {weekTableRows.length} semaine{weekTableRows.length > 1 ? 's' : ''} planifiée{weekTableRows.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className={styles.rmFeedList}>
            {weekTableRows.map((w) => {
              const isCurrent = w.start <= todayStr && w.end >= todayStr
              const isPast = w.end < todayStr
              const p = w.phase
              const pi = p ? PROG_PHASES[p.phase as ProgPhaseKey] : null
              const color = pi ? pi.color : 'var(--border)'
              const prog = w.prog
              const { training: nutriOn, rest: nutriOff } = w.nutri
              const note = noteByWeek[w.start] ?? ''
              const isEditingNote = editingNoteKey === w.start
              const adhClass = w.weekNutri == null ? 'neutral'
                : w.weekNutri.adherence >= 80 ? 'good'
                : w.weekNutri.adherence >= 60 ? 'mid' : 'bad'

              return (
                <article
                  key={w.num}
                  className={`${styles.rmFeedCard} ${isCurrent ? styles.rmFeedCardCurrent : ''} ${isPast ? styles.rmFeedCardPast : ''}`}
                  style={{ borderLeftColor: color }}
                >
                  <div className={styles.rmFeedRow}>
                    {/* 1. Semaine */}
                    <div className={styles.rmFeedWeek}>
                      <span className={styles.rmFeedNum}>S{w.num}</span>
                      <span className={styles.rmFeedRange}>{formatDateShort(w.start)} — {formatDateShort(w.end)}</span>
                      {isCurrent && <span className={styles.rmFeedNowBadge}>NOW</span>}
                    </div>

                    {/* 2. Phase */}
                    <div>
                      {pi && p ? (
                        <span className={styles.rmFeedPhase} style={{ background: color }}>{p.name}</span>
                      ) : (
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                      )}
                    </div>

                    {/* 3. Programme — nom du plan actif, tous horizons (planification) */}
                    <div className={styles.rmFeedKv} title={prog?.nom}>
                      <i className="fa-solid fa-dumbbell" />
                      {prog ? <strong>{prog.nom}</strong> : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </div>

                    {/* 4. Nutrition — plans ON/OFF planifiés + données réelles */}
                    <div className={styles.rmFeedNutriCol}>
                      <i className="fa-solid fa-utensils" style={{ color: '#f59e0b', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                        {nutriOn && (
                          <div className={styles.rmFeedNutriRow}>
                            <span className={styles.rmFeedNutriLabel}>ON</span>
                            <strong>{nutriOn.calories_objectif ?? '?'}</strong>
                            <span className={styles.rmFeedNutriMacros}>kcal · P{nutriOn.proteines ?? '?'} G{nutriOn.glucides ?? '?'} L{nutriOn.lipides ?? '?'}</span>
                          </div>
                        )}
                        {nutriOff && (
                          <div className={styles.rmFeedNutriRow}>
                            <span className={`${styles.rmFeedNutriLabel} ${styles.rmFeedNutriLabelOff}`}>OFF</span>
                            <strong>{nutriOff.calories_objectif ?? '?'}</strong>
                            <span className={styles.rmFeedNutriMacros}>kcal · P{nutriOff.proteines ?? '?'} G{nutriOff.glucides ?? '?'} L{nutriOff.lipides ?? '?'}</span>
                          </div>
                        )}
                        {!nutriOn && !nutriOff && <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>}
                        {w.weekNutri && (
                          <div className={styles.rmFeedNutriReal}>
                            Réel: <strong>{w.weekNutri.avgK}</strong> kcal
                            <span className={`${styles.rmFeedAdh} ${styles[`rmFeedAdh_${adhClass}`]}`}>{w.weekNutri.adherence}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 5. Poids */}
                    <div className={styles.rmFeedKv}>
                      <i className="fa-solid fa-weight-scale" />
                      {w.avgWeight ? <strong>{w.avgWeight} kg</strong> : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </div>

                    {/* 6. Cardio + Suppléments — cardio réel uniquement */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <div className={styles.rmFeedKv}>
                        <i className="fa-solid fa-heart-pulse" style={{ color: '#ef4444' }} />
                        {w.totalCardio > 0 ? <strong>{w.totalCardio} min</strong> : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </div>
                      {w.supps.length === 0 ? (
                        <span style={{ color: 'var(--text3)', fontSize: 10 }}>aucune supp.</span>
                      ) : (
                        <ul className={styles.rmFeedSuppList}>
                          {w.supps.map(s => {
                            const weeklyQty = s.dosage ? Math.round(s.dosage * freqPerDay(s.frequence) * 7) : null
                            const isMg = s.unite === 'mg' || s.unite === 'g'
                            return (
                              <li key={s.id} className={styles.rmFeedSuppItem}>
                                <span className={styles.rmFeedSuppName}>{s.supplements?.nom}</span>
                                {s.dosage != null && (
                                  <span className={styles.rmFeedSuppDose}>
                                    {s.dosage}{s.unite || ''}
                                    {s.frequence ? ` · ${s.frequence}` : ''}
                                    {isMg && weeklyQty != null && (
                                      <span className={styles.rmFeedSuppWeekly}> = {weeklyQty}{s.unite}/sem</span>
                                    )}
                                  </span>
                                )}
                                {s.end_date && <span style={{ color: '#ef4444', fontSize: 9 }}>stop {formatDateShort(s.end_date)}</span>}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>

                  </div>

                  {/* Note coaching — pleine largeur sous la grille */}
                  <div className={styles.rmFeedNoteSection}>
                    {isEditingNote ? (
                      <textarea
                        autoFocus
                        value={editingNoteValue}
                        onChange={e => setEditingNoteValue(e.target.value)}
                        onBlur={commitNote}
                        onKeyDown={e => {
                          if (e.key === 'Escape') { e.preventDefault(); setEditingNoteKey(null) }
                          if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); commitNote() }
                        }}
                        placeholder="Note de coaching pour cette semaine… (Shift+Entrée pour sauvegarder)"
                        className={styles.rmFeedNoteTextarea}
                        rows={3}
                      />
                    ) : note ? (
                      <button type="button" className={styles.rmFeedNoteBlock} onClick={() => startNoteEdit(w.start)}>
                        <i className="fa-solid fa-note-sticky" style={{ color: '#f59e0b', flexShrink: 0 }} />
                        <span>{note}</span>
                      </button>
                    ) : (
                      <button type="button" className={styles.rmFeedNoteAdd} onClick={() => startNoteEdit(w.start)}>
                        <i className="fa-solid fa-pen" />
                        <span>Ajouter une note de coaching</span>
                      </button>
                    )}
                  </div>

                  {/* Événements de l'athlète sur cette semaine */}
                  {(() => {
                    const weekEvents = events.filter(ev =>
                      ev.start_date <= w.end && ev.end_date >= w.start
                    )
                    if (!weekEvents.length) return null
                    return (
                      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {weekEvents.map(ev => {
                          const evColor = EVENT_COLORS[ev.type] ?? '#6b7280'
                          const evEmoji = EVENT_EMOJI[ev.type] ?? '📌'
                          return (
                            <div
                              key={ev.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: evColor + '18',
                                border: `1px solid ${evColor}44`,
                                borderRadius: 6, padding: '4px 10px',
                                fontSize: 12,
                              }}
                            >
                              <span>{evEmoji}</span>
                              <strong style={{ color: evColor }}>{ev.title}</strong>
                              <span style={{ color: 'var(--text3)', fontSize: 11 }}>
                                {new Date(ev.start_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                {ev.start_date !== ev.end_date && (
                                  <> — {new Date(ev.end_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</>
                                )}
                              </span>
                              {ev.notes && <span style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 11 }}>· {ev.notes}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </article>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
