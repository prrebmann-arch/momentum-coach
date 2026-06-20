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
}

interface DailyReport {
  date: string
  weight: number | null
  cardio_minutes: number | null
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
    reports.forEach((r) => {
      if (r.weight) weightByDate[r.date] = parseFloat(String(r.weight))
      if (r.cardio_minutes) cardioByDate[r.date] = (cardioByDate[r.date] || 0) + r.cardio_minutes
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
      let cardioSum = 0
      for (let d = 0; d < 7; d++) {
        const dt = new Date(weekStart)
        dt.setDate(dt.getDate() + d)
        const dKey = toDateStr(dt)
        const v = weightByDate[dKey]
        if (v) weightVals.push(v)
        cardioSum += cardioByDate[dKey] || 0
      }
      const avgWeight = weightVals.length
        ? (weightVals.reduce((a, b) => a + b, 0) / weightVals.length).toFixed(1)
        : null

      // Supplement is active on this week if start_date is null or <= weekEnd
      const supps = activeSupps.filter(s => !s.start_date || s.start_date <= weekEndKey)

      weeks.push({ num: weekNum++, start: weekKey, end: weekEndKey, phase, avgWeight, totalCardio: cardioSum, supps })
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

      {/* Week table */}
      {weekTableRows.length > 0 && (
        <div className={styles.rmWeektableSection}>
          <h3 className={styles.rmSectionTitle}>Vue semaine par semaine</h3>
          <div className={styles.rmWt} data-cols="8">
            <div className={styles.rmWtHdr}>
              <span className={styles.rmWtH} style={{ textAlign: 'left' }}>Semaine</span>
              <span className={styles.rmWtH}>Phase</span>
              <span className={styles.rmWtH}>Poids moyen</span>
              <span className={styles.rmWtH}>Programme</span>
              <span className={styles.rmWtH}>Nutrition</span>
              <span className={styles.rmWtH}>Cardio</span>
              <span className={styles.rmWtH}>Suppléments</span>
              <span className={styles.rmWtH} style={{ textAlign: 'left' }}>Note</span>
            </div>
            {weekTableRows.map((w) => {
              const isCurrent = w.start <= todayStr && w.end >= todayStr
              const p = w.phase
              const pi = p ? PROG_PHASES[p.phase as ProgPhaseKey] : null
              const color = pi ? pi.color : null
              const prog = p ? programs.find((pr) => pr.id === p.programme_id) : null
              const nutri = p ? nutritions.find((n) => n.id === p.nutrition_id) : null
              const note = noteByWeek[w.start] ?? ''
              const isEditingNote = editingNoteKey === w.start
              const isExpandedSupps = expandedSuppsKey === w.start

              return (
                <div key={w.num} className={`${styles.rmWtRow} ${isCurrent ? styles.rmWtCurrent : ''}`}>
                  <span className={`${styles.rmWtCell} ${styles.rmWtWeek}`}>
                    <strong>S{w.num}</strong>
                    <span className={styles.rmWtDates}>
                      {formatDateShort(w.start)} — {formatDateShort(w.end)}
                    </span>
                  </span>
                  <span className={styles.rmWtCell}>
                    {pi && p ? (
                      <span className={styles.rmWtPhase} style={{ background: color! }}>
                        {p.name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>&mdash;</span>
                    )}
                  </span>
                  <span className={styles.rmWtCell}>{w.avgWeight ? `${w.avgWeight} kg` : '\u2014'}</span>
                  <span className={styles.rmWtCell}>
                    {prog ? (
                      <span className={styles.rmWtProg}>
                        <i className="fa-solid fa-dumbbell" /> {prog.nom}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>&mdash;</span>
                    )}
                  </span>
                  <span className={styles.rmWtCell}>
                    {nutri ? (
                      <span className={styles.rmWtNutri}>
                        <i className="fa-solid fa-utensils" /> {nutri.nom}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>&mdash;</span>
                    )}
                  </span>
                  <span className={styles.rmWtCell}>
                    {w.totalCardio > 0 ? (
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                        <i className="fa-solid fa-heart-pulse" style={{ marginRight: 4, color: '#ef4444' }} /> {w.totalCardio} min
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>&mdash;</span>
                    )}
                  </span>
                  <span className={styles.rmWtCell}>
                    {w.supps.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setExpandedSuppsKey(isExpandedSupps ? null : w.start)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                        title={w.supps.map(s => `${s.supplements?.nom}${s.dosage ? ` ${s.dosage}${s.unite || ''}` : ''}`).join(' · ')}
                      >
                        <i className="fa-solid fa-pills" style={{ marginRight: 4, color: '#a855f7' }} />
                        {w.supps.length} actif{w.supps.length > 1 ? 's' : ''}
                        <i className={`fa-solid fa-chevron-${isExpandedSupps ? 'up' : 'down'}`} style={{ marginLeft: 4, fontSize: 9 }} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>&mdash;</span>
                    )}
                  </span>
                  <span className={styles.rmWtCell} style={{ textAlign: 'left', overflow: 'visible' }}>
                    {isEditingNote ? (
                      <span style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%' }}>
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
                          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--primary)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px', fontSize: 12 }}
                        />
                      </span>
                    ) : note ? (
                      <button
                        type="button"
                        onClick={() => startNoteEdit(w.start)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 12, textAlign: 'left', padding: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={note}
                      >
                        <i className="fa-solid fa-note-sticky" style={{ marginRight: 4, color: '#f59e0b' }} /> {note}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startNoteEdit(w.start)}
                        style={{ background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}
                      >
                        <i className="fa-solid fa-plus" /> Note
                      </button>
                    )}
                  </span>
                  {isExpandedSupps && (
                    <div style={{ gridColumn: '1 / -1', background: 'var(--bg3)', padding: '8px 12px', borderRadius: 6, marginTop: 4, fontSize: 12 }}>
                      {w.supps.map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text)' }}>
                            <strong>{s.supplements?.nom}</strong>
                            {s.supplements?.marque ? <span style={{ color: 'var(--text3)' }}> · {s.supplements.marque}</span> : null}
                          </span>
                          <span style={{ color: 'var(--text2)' }}>
                            {s.dosage ? `${s.dosage}${s.unite || ''}` : ''} {s.frequence ? `· ${s.frequence}` : ''} {s.moment_prise ? `· ${s.moment_prise}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
