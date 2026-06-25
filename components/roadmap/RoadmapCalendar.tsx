'use client'

import { useState, useMemo, useCallback } from 'react'
import { PROG_PHASES, type ProgPhaseKey } from '@/lib/constants'
import { toDateStr } from '@/lib/utils'
import type { RoadmapPhase } from './RoadmapTimeline'
import styles from '@/styles/roadmap.module.css'

interface ProgramRef {
  id: string
  nom: string
}

interface NutritionRef {
  id: string
  nom: string
  calories_objectif: number | null
  proteines: number | null
  glucides: number | null
  lipides: number | null
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
  supplements: { id: string; nom: string; marque: string | null; type: string | null } | null
}

interface WeekNote {
  athlete_id: string
  week_start: string
  note: string
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
  onSaveWeekNote?: (weekStart: string, note: string) => Promise<void>
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

export default function RoadmapCalendar({ phases, programs, nutritions, reports, supplements = [], weekNotes = [], nutritionLogs = [], onSaveWeekNote }: RoadmapCalendarProps) {
  const [calOffset, setCalOffset] = useState<number | null>(null)
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [expandedSuppsKey, setExpandedSuppsKey] = useState<string | null>(null)

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
          style={style}
        >
          {d}
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

    // Only 'supplementation' rows are roadmap-relevant. Whether the row is
    // currently actif=true doesn't matter — what matters is the time window
    // (start_date..end_date) of the cycle. A stopped cycle (actif=false,
    // end_date set) should still show on the weeks where it WAS active.
    const cycleSupps = supplements.filter(s => s.supplements && s.supplements.type === 'supplementation')

    const weeks: {
      num: number
      start: string
      end: string
      phase: RoadmapPhase | undefined
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

      // Supp cycle overlaps this week iff (start <= weekEnd) AND (end IS NULL OR end >= weekStart).
      // Null start_date is interpreted as "always started", so it overlaps unless end ended before weekStart.
      const supps = cycleSupps.filter(s => {
        const startOk = !s.start_date || s.start_date <= weekEndKey
        const endOk = !s.end_date || s.end_date >= weekKey
        return startOk && endOk
      })

      weeks.push({ num: weekNum++, start: weekKey, end: weekEndKey, phase, avgWeight, totalCardio: cardioSum, supps, weekNutri })
      weekStart.setDate(weekStart.getDate() + 7)
    }
    return weeks
  }, [phases, reports, supplements, nutritionLogs])

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
              const prog = p ? programs.find((pr) => pr.id === p.programme_id) : null
              const nutri = p ? nutritions.find((n) => n.id === p.nutrition_id) : null
              const note = noteByWeek[w.start] ?? ''
              const isEditingNote = editingNoteKey === w.start
              const isExpandedSupps = expandedSuppsKey === w.start
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

                    {/* 3. Programme */}
                    <div className={styles.rmFeedKv} title={prog?.nom}>
                      <i className="fa-solid fa-dumbbell" />
                      {prog ? <strong>{prog.nom}</strong> : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </div>

                    {/* 4. Nutrition */}
                    <div className={styles.rmFeedKv}>
                      <i className="fa-solid fa-utensils" style={{ color: '#f59e0b' }} />
                      {w.weekNutri ? (
                        <>
                          <strong>{w.weekNutri.avgK}</strong>
                          <span className="sub">kcal · P{w.weekNutri.avgP} G{w.weekNutri.avgG} L{w.weekNutri.avgL}</span>
                          <span className={`${styles.rmFeedAdh} ${styles[`rmFeedAdh_${adhClass}`]}`} style={{ marginLeft: 6 }}>
                            {w.weekNutri.adherence}%
                          </span>
                        </>
                      ) : nutri ? (
                        <>
                          <strong style={{ color: 'var(--text3)' }}>{nutri.calories_objectif ?? nutri.nom}</strong>
                          {nutri.calories_objectif != null && <span className="sub" style={{ color: 'var(--text3)' }}>obj · P{nutri.proteines ?? 0} G{nutri.glucides ?? 0} L{nutri.lipides ?? 0}</span>}
                        </>
                      ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </div>

                    {/* 5. Poids */}
                    <div className={styles.rmFeedKv}>
                      <i className="fa-solid fa-weight-scale" />
                      {w.avgWeight ? <strong>{w.avgWeight} kg</strong> : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </div>

                    {/* 6. Cardio + Suppléments chips */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <div className={styles.rmFeedKv}>
                        <i className="fa-solid fa-heart-pulse" style={{ color: '#ef4444' }} />
                        {w.totalCardio > 0 ? <strong>{w.totalCardio} min</strong> : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </div>
                      <div className={styles.rmFeedSuppChips}>
                        {w.supps.length === 0 ? (
                          <span style={{ color: 'var(--text3)', fontSize: 10 }}>aucune supp.</span>
                        ) : (
                          <>
                            {w.supps.slice(0, 2).map(s => (
                              <span key={s.id} className={styles.rmFeedSuppChip} title={`${s.supplements?.nom}${s.dosage ? ` ${s.dosage}${s.unite || ''}` : ''}`}>
                                {s.supplements?.nom}
                              </span>
                            ))}
                            {w.supps.length > 2 && (
                              <button type="button" className={styles.rmFeedSuppMore} onClick={() => setExpandedSuppsKey(isExpandedSupps ? null : w.start)}>
                                {isExpandedSupps ? 'masquer' : `+${w.supps.length - 2}`}
                              </button>
                            )}
                            {w.supps.length > 0 && w.supps.length <= 2 && (
                              <button type="button" className={styles.rmFeedSuppMore} onClick={() => setExpandedSuppsKey(isExpandedSupps ? null : w.start)} title="Détails dosages">
                                <i className={`fa-solid fa-chevron-${isExpandedSupps ? 'up' : 'down'}`} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* 7. Note */}
                    <div className={styles.rmFeedNoteCol}>
                      <i className="fa-solid fa-note-sticky" style={{ color: '#f59e0b', fontSize: 11 }} />
                      {isEditingNote ? (
                        <input
                          autoFocus
                          value={editingNoteValue}
                          onChange={e => setEditingNoteValue(e.target.value)}
                          onBlur={commitNote}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitNote() }
                            if (e.key === 'Escape') { e.preventDefault(); setEditingNoteKey(null) }
                          }}
                          placeholder="…"
                          className={styles.rmFeedNoteInput}
                        />
                      ) : note ? (
                        <button type="button" className={styles.rmFeedNoteText} onClick={() => startNoteEdit(w.start)} title={note}>{note}</button>
                      ) : (
                        <button type="button" className={styles.rmFeedNoteEmpty} onClick={() => startNoteEdit(w.start)}>+ note</button>
                      )}
                    </div>
                  </div>

                  {isExpandedSupps && w.supps.length > 0 && (
                    <ul className={styles.rmFeedSuppDetails}>
                      {w.supps.map(s => (
                        <li key={s.id}>
                          <span className="nm">
                            {s.supplements?.nom}
                            {s.supplements?.marque && <em>· {s.supplements.marque}</em>}
                          </span>
                          <span className="ds">
                            {s.dosage ? `${s.dosage}${s.unite || ''}` : ''}
                            {s.frequence ? ` · ${s.frequence}` : ''}
                            {s.moment_prise ? ` · ${s.moment_prise}` : ''}
                            {s.end_date && <span style={{ color: '#ef4444', marginLeft: 4 }}>· stop {formatDateShort(s.end_date)}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
