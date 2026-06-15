'use client'

import { useMemo } from 'react'
import { STEP_TYPE_META, formatDayLabel, type OnboardingStepType } from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'

export interface VerticalTimelinePoint {
  id: string
  day_offset: number
  type: OnboardingStepType
  title: string
  description?: string | null
  done?: boolean
}

interface Props {
  points: VerticalTimelinePoint[]
  startDate?: string | null
  selectedId?: string | null
  onPointClick: (id: string) => void
  onAddAt: (dayOffset: number) => void
  readOnly?: boolean
}

function computeTodayOffset(startDate: string | null | undefined): number | null {
  if (!startDate) return null
  const parts = startDate.split('-').map((n) => parseInt(n, 10))
  const [y, m, d] = parts
  if (!y || !m || !d) return null
  const start = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((today - start) / 86400000)
}

function formatDateForOffset(startDate: string, offset: number): string {
  const parts = startDate.split('-').map((n) => parseInt(n, 10))
  const [y, m, d] = parts
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + offset)
  return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
}

interface DayGroup {
  day_offset: number
  points: VerticalTimelinePoint[]
}

export default function OnboardingTimelineVerticalSpine({
  points,
  startDate,
  selectedId,
  onPointClick,
  onAddAt,
  readOnly = false,
}: Props) {
  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<number, VerticalTimelinePoint[]>()
    points.forEach((p) => {
      const arr = map.get(p.day_offset) ?? []
      arr.push(p)
      map.set(p.day_offset, arr)
    })
    return Array.from(map.entries())
      .map(([day_offset, pts]) => ({
        day_offset,
        points: pts.slice().sort((a, b) => a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => a.day_offset - b.day_offset)
  }, [points])

  const todayOffset = useMemo(() => computeTodayOffset(startDate ?? null), [startDate])

  // Find where to insert the today marker between groups
  const todayInsertIndex = useMemo(() => {
    if (todayOffset == null) return -1
    // Insert before the first group whose day_offset > todayOffset
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].day_offset > todayOffset) return i
    }
    return groups.length // append at end (today is after all points)
  }, [groups, todayOffset])

  // Find month boundary insert positions: between groups where day_offset crosses 31/61/91...
  const monthBoundaries = useMemo(() => {
    const bounds: { index: number; monthNum: number }[] = []
    let prevMonth = 1 // groups starting at J0..J30 = month 1
    groups.forEach((g, i) => {
      const month = g.day_offset <= 30 ? 1 : Math.floor((g.day_offset - 1) / 30) + 1
      if (month > prevMonth) {
        bounds.push({ index: i, monthNum: month })
        prevMonth = month
      }
    })
    return bounds
  }, [groups])

  let sideToggle = 0 // alternates: 0 = right, 1 = left (so first card is on the right)

  const renderRow = (group: DayGroup) => {
    const side: 'right' | 'left' = sideToggle % 2 === 0 ? 'right' : 'left'
    sideToggle++
    const isPast = todayOffset != null && group.day_offset < todayOffset
    const isToday = todayOffset != null && group.day_offset === todayOffset
    const dateLabel = startDate ? formatDateForOffset(startDate, group.day_offset) : null

    return (
      <div
        key={`g-${group.day_offset}-${group.points[0].id}`}
        className={`${styles.vSpineRow} ${side === 'right' ? styles.vSpineRowRight : styles.vSpineRowLeft}`}
      >
        <div className={styles.vSpineDayCol}>
          <div
            className={styles.vSpineDayPill}
            style={{
              borderColor: isToday ? '#ef4444' : undefined,
              color: isToday ? '#ef4444' : undefined,
            }}
            title={dateLabel ?? undefined}
          >
            {formatDayLabel(group.day_offset)}
          </div>
          <div className={styles.vSpineDots}>
            {group.points.map((p) => {
              const meta = STEP_TYPE_META[p.type]
              const isDiamond = meta.shape === 'diamond'
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.vSpineDot} ${isDiamond ? styles.vSpineDotDiamond : ''} ${p.done ? styles.done : ''}`}
                  style={{
                    background: meta.shape === 'dot' ? 'var(--bg)' : meta.color,
                    borderColor: meta.color,
                    color: meta.shape === 'dot' ? meta.color : 'white',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPointClick(p.id)
                  }}
                  aria-label={`${meta.label} — ${p.title}`}
                  title={`${meta.label} · ${p.title}`}
                >
                  <i className={`fa-solid ${meta.icon}`} />
                </button>
              )
            })}
          </div>
        </div>

        <div
          style={{
            gridColumn: side === 'right' ? 3 : 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            justifySelf: side === 'right' ? 'start' : 'end',
            alignItems: side === 'right' ? 'flex-start' : 'flex-end',
            maxWidth: 360,
            width: '100%',
          }}
        >
          {group.points.map((p) => {
            const meta = STEP_TYPE_META[p.type]
            const isSelected = selectedId === p.id
            return (
              <div
                key={`card-${p.id}`}
                className={`${styles.vSpineCard} ${p.done ? styles.done : ''} ${isSelected ? styles.selected : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onPointClick(p.id)
                }}
                style={{ width: '100%' }}
              >
                <div className={styles.vSpineCardHead}>
                  <span
                    className={styles.vTypePill}
                    style={{ background: meta.color, color: meta.shape === 'dot' ? 'var(--text)' : 'white' }}
                  >
                    <i className={`fa-solid ${meta.icon}`} style={{ fontSize: 9 }} />
                    {meta.label}
                  </span>
                  <span className={styles.vSpineCardTitle}>{p.title}</span>
                </div>
                {p.description ? <div className={styles.vSpineCardDesc}>{p.description}</div> : null}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderTodayBar = () => {
    if (todayOffset == null) return null
    const dateLabel = startDate ? formatDateForOffset(startDate, todayOffset) : ''
    return (
      <div key="today" className={styles.vToday}>
        <span className={styles.vTodayBadge}>
          <i className="fa-solid fa-location-arrow" />
          Aujourd&apos;hui {dateLabel ? `· ${dateLabel}` : ''}
        </span>
      </div>
    )
  }

  const renderMonthDivider = (monthNum: number, key: string) => (
    <div key={key} className={styles.vSpineMonth}>
      <div className={styles.vSpineMonthLabel}>Mois {monthNum}</div>
    </div>
  )

  // Compose the children list
  const items: React.ReactNode[] = []
  if (groups.length === 0) {
    if (todayOffset != null) items.push(renderTodayBar())
  } else {
    for (let i = 0; i < groups.length; i++) {
      // Month divider before this group?
      const mb = monthBoundaries.find((b) => b.index === i)
      if (mb) items.push(renderMonthDivider(mb.monthNum, `mb-${mb.monthNum}`))
      // Today bar before this group?
      if (i === todayInsertIndex) items.push(renderTodayBar())
      items.push(renderRow(groups[i]))
      // Inline add-between button (only between rows)
      if (!readOnly && i < groups.length - 1) {
        const nextDay = groups[i + 1].day_offset
        const midDay = Math.floor((groups[i].day_offset + nextDay) / 2)
        items.push(
          <div key={`add-${i}`} className={styles.vAddBetween}>
            <button
              type="button"
              className={styles.vAddBtn}
              onClick={() => onAddAt(midDay)}
              title={`Ajouter à ${formatDayLabel(midDay)}`}
              aria-label="Ajouter un point"
            >
              <i className="fa-solid fa-plus" />
            </button>
          </div>,
        )
      }
    }
    // Today bar at the end if applicable
    if (todayInsertIndex === groups.length) items.push(renderTodayBar())
  }

  return (
    <div className={styles.vSpine}>
      {items}
      {!readOnly && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            className={styles.vAddBtn}
            onClick={() => {
              const lastOffset = groups.length > 0 ? groups[groups.length - 1].day_offset : 0
              onAddAt(lastOffset + 1)
            }}
            title="Ajouter un point à la fin"
            style={{ width: 36, height: 36 }}
          >
            <i className="fa-solid fa-plus" />
          </button>
        </div>
      )}
    </div>
  )
}
