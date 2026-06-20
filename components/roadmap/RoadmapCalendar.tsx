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
  actif: boolean
  supplements: { id: string; nom: string; marque: string | null; type: string | null } | null
}

interface WeekNote {
  athlete_id: string
  week_start: string
  note: string
}

interface RoadmapCalendarProps {
  phases: RoadmapPhase[]
  programs: ProgramRef[]
  nutritions: NutritionRef[]
  reports: DailyReport[]
  supplements?: SupplementRow[]
  weekNotes?: WeekNote[]
  onSaveWeekNote?: (weekStart: string, note: string) => Promise<void>
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

export default function RoadmapCalendar({ phases, programs, nutritions, reports, supplements = [], weekNotes = [], onSaveWeekNote }: RoadmapCalendarProps) {
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
    const adherenceByDate: Record<string, number> = {}
    reports.forEach((r) => {
      if (r.weight) weightByDate[r.date] = parseFloat(String(r.weight))
      if (r.cardio_minutes) cardioByDate[r.date] = (cardioByDate[r.date] || 0) + r.cardio_minutes
      if (r.adherence != null) adherenceByDate[r.date] = parseFloat(String(r.adherence))
    })

    // Only true 'supplementation' (hormonal / cycle products) — not 'complement'
    // (whey, BCAA, vitamins…) which would clutter the roadmap view.
    const activeSupps = supplements.filter(s => s.actif && s.supplements && s.supplements.type === 'supplementation')

    const weeks: {
      num: number
      start: string
      end: string
      phase: RoadmapPhase | undefined
      avgWeight: string | null
      totalCardio: number
      supps: SupplementRow[]
      adherencePct: number | null
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
      const adhVals: number[] = []
      let cardioSum = 0
      for (let d = 0; d < 7; d++) {
        const dt = new Date(weekStart)
        dt.setDate(dt.getDate() + d)
        const dKey = toDateStr(dt)
        const v = weightByDate[dKey]
        if (v) weightVals.push(v)
        cardioSum += cardioByDate[dKey] || 0
        const a = adherenceByDate[dKey]
        if (a != null) adhVals.push(a)
      }
      const avgWeight = weightVals.length
        ? (weightVals.reduce((a, b) => a + b, 0) / weightVals.length).toFixed(1)
        : null
      // daily_reports.adherence is logged on a /10 scale → × 10 to get %
      const adherencePct = adhVals.length
        ? Math.round((adhVals.reduce((a, b) => a + b, 0) / adhVals.length) * 10)
        : null

      // Supplement is active on this week if start_date is null or <= weekEnd
      const supps = activeSupps.filter(s => !s.start_date || s.start_date <= weekEndKey)

      weeks.push({ num: weekNum++, start: weekKey, end: weekEndKey, phase, avgWeight, totalCardio: cardioSum, supps, adherencePct })
      weekStart.setDate(weekStart.getDate() + 7)
    }
    return weeks
  }, [phases, reports, supplements])

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
              const adhClass = w.adherencePct == null ? 'neutral'
                : w.adherencePct >= 80 ? 'good'
                : w.adherencePct >= 60 ? 'mid' : 'bad'

              return (
                <article
                  key={w.num}
                  className={`${styles.rmFeedCard} ${isCurrent ? styles.rmFeedCardCurrent : ''} ${isPast ? styles.rmFeedCardPast : ''}`}
                  style={{ borderLeftColor: color }}
                >
                  <header className={styles.rmFeedCardHead}>
                    <span className={styles.rmFeedNum}>S{w.num}</span>
                    <span className={styles.rmFeedRange}>
                      {formatDateShort(w.start)} — {formatDateShort(w.end)}
                    </span>
                    {isCurrent && <span className={styles.rmFeedNowBadge}>EN COURS</span>}
                    {pi && p && (
                      <span className={styles.rmFeedPhase} style={{ background: color, color: '#fff' }}>
                        {p.name}
                      </span>
                    )}
                  </header>

                  <div className={styles.rmFeedStats}>
                    <div className={styles.rmFeedStat}>
                      <span className={styles.rmFeedStatLabel}><i className="fa-solid fa-weight-scale" /> Poids moy.</span>
                      <span className={styles.rmFeedStatValue}>{w.avgWeight ? `${w.avgWeight} kg` : '—'}</span>
                    </div>
                    <div className={styles.rmFeedStat}>
                      <span className={styles.rmFeedStatLabel}><i className="fa-solid fa-heart-pulse" style={{ color: '#ef4444' }} /> Cardio</span>
                      <span className={styles.rmFeedStatValue}>{w.totalCardio > 0 ? `${w.totalCardio} min` : '—'}</span>
                    </div>
                    <div className={`${styles.rmFeedStat} ${styles[`rmFeedStatAdh_${adhClass}`]}`}>
                      <span className={styles.rmFeedStatLabel}><i className="fa-solid fa-circle-check" /> Adhérence</span>
                      <span className={styles.rmFeedStatValue}>{w.adherencePct != null ? `${w.adherencePct}%` : '—'}</span>
                    </div>
                  </div>

                  <div className={styles.rmFeedBody}>
                    <div className={styles.rmFeedBlock}>
                      <div className={styles.rmFeedBlockHdr}>
                        <i className="fa-solid fa-dumbbell" />
                        <span>Programme</span>
                      </div>
                      <div className={styles.rmFeedBlockBody}>
                        {prog ? prog.nom : <span className={styles.rmFeedMuted}>Aucun</span>}
                      </div>
                    </div>

                    <div className={styles.rmFeedBlock}>
                      <div className={styles.rmFeedBlockHdr}>
                        <i className="fa-solid fa-utensils" style={{ color: '#f59e0b' }} />
                        <span>Nutrition</span>
                      </div>
                      <div className={styles.rmFeedBlockBody}>
                        {nutri ? (
                          <>
                            <div className={styles.rmFeedNutriTop}>
                              <strong>{nutri.calories_objectif ?? nutri.nom}</strong>
                              {nutri.calories_objectif != null && <span className={styles.rmFeedUnit}>kcal</span>}
                            </div>
                            {(nutri.proteines != null || nutri.glucides != null || nutri.lipides != null) && (
                              <div className={styles.rmFeedNutriMacros}>
                                P {nutri.proteines ?? 0}g · G {nutri.glucides ?? 0}g · L {nutri.lipides ?? 0}g
                              </div>
                            )}
                          </>
                        ) : <span className={styles.rmFeedMuted}>Aucun</span>}
                      </div>
                    </div>

                    <div className={styles.rmFeedBlock}>
                      <div className={styles.rmFeedBlockHdr}>
                        <i className="fa-solid fa-pills" style={{ color: '#a855f7' }} />
                        <span>Suppléments</span>
                        {w.supps.length > 0 && (
                          <button
                            type="button"
                            className={styles.rmFeedToggle}
                            onClick={() => setExpandedSuppsKey(isExpandedSupps ? null : w.start)}
                          >
                            {w.supps.length} actif{w.supps.length > 1 ? 's' : ''} <i className={`fa-solid fa-chevron-${isExpandedSupps ? 'up' : 'down'}`} />
                          </button>
                        )}
                      </div>
                      <div className={styles.rmFeedBlockBody}>
                        {w.supps.length === 0 && <span className={styles.rmFeedMuted}>Aucun</span>}
                        {w.supps.length > 0 && !isExpandedSupps && (
                          <div className={styles.rmFeedSuppPreview}>
                            {w.supps.slice(0, 2).map(s => s.supplements?.nom).filter(Boolean).join(', ')}
                            {w.supps.length > 2 && ` +${w.supps.length - 2}`}
                          </div>
                        )}
                        {isExpandedSupps && (
                          <ul className={styles.rmFeedSuppList}>
                            {w.supps.map(s => (
                              <li key={s.id}>
                                <span className={styles.rmFeedSuppName}>
                                  {s.supplements?.nom}
                                  {s.supplements?.marque && <em>· {s.supplements.marque}</em>}
                                </span>
                                <span className={styles.rmFeedSuppDose}>
                                  {s.dosage ? `${s.dosage}${s.unite || ''}` : ''}
                                  {s.frequence ? ` · ${s.frequence}` : ''}
                                  {s.moment_prise ? ` · ${s.moment_prise}` : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  <footer className={styles.rmFeedNote}>
                    <i className="fa-solid fa-note-sticky" style={{ color: '#f59e0b' }} />
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
                        placeholder="Note de la semaine…"
                        className={styles.rmFeedNoteInput}
                      />
                    ) : note ? (
                      <button type="button" className={styles.rmFeedNoteText} onClick={() => startNoteEdit(w.start)}>
                        {note}
                      </button>
                    ) : (
                      <button type="button" className={styles.rmFeedNoteEmpty} onClick={() => startNoteEdit(w.start)}>
                        <i className="fa-solid fa-plus" /> Ajouter une note
                      </button>
                    )}
                  </footer>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
