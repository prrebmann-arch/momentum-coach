'use client'

import { useMemo } from 'react'
import {
  STEP_TYPE_META,
  formatDayLabel,
  computeUrgency,
  todayIso,
  type OnboardingStepType,
} from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'
import type { VerticalTimelinePoint } from './OnboardingTimelineVerticalSpine'

interface Props {
  points: VerticalTimelinePoint[]
  startDate?: string | null
  selectedId?: string | null
  onPointClick: (id: string) => void
  onAddAt: (dayOffset: number) => void
  onToggleDone: (id: string, done: boolean) => void
  readOnly?: boolean
}

function formatDateForOffset(startDate: string, offset: number): { label: string; iso: string } {
  const parts = startDate.split('-').map((n) => parseInt(n, 10))
  const [y, m, d] = parts
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + offset)
  const label = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const iso = dt.toISOString().slice(0, 10)
  return { label, iso }
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

interface DayGroup {
  day_offset: number
  points: VerticalTimelinePoint[]
}

export default function OnboardingTimelineVerticalCompact({
  points,
  startDate,
  selectedId,
  onPointClick,
  onAddAt,
  onToggleDone,
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
  const today = useMemo(() => todayIso(), [])

  return (
    <div className={styles.vCompact}>
      {groups.map((group) => {
        const isToday = todayOffset != null && group.day_offset === todayOffset
        const isPast = todayOffset != null && group.day_offset < todayOffset
        const dateInfo = startDate ? formatDateForOffset(startDate, group.day_offset) : null
        const urgency = dateInfo ? computeUrgency(dateInfo.iso, today) : null

        return (
          <div
            key={`cg-${group.day_offset}`}
            className={`${styles.vCompactGroup} ${isToday ? styles.isToday : ''} ${isPast ? styles.isPast : ''}`}
          >
            <div className={styles.vCompactGroupHeader}>
              <span>{formatDayLabel(group.day_offset)}</span>
              {dateInfo && <span className="date">{dateInfo.label}</span>}
              {isToday ? (
                <span className="delta" style={{ background: '#ef4444', color: 'white' }}>
                  AUJOURD&apos;HUI
                </span>
              ) : (
                urgency && (
                  <span className="delta" style={{ background: urgency.bg, color: urgency.color }}>
                    {urgency.label}
                  </span>
                )
              )}
            </div>

            {group.points.map((p) => {
              const meta = STEP_TYPE_META[p.type]
              const isDiamond = meta.shape === 'diamond'
              const isSelected = selectedId === p.id
              return (
                <div
                  key={`cr-${p.id}`}
                  className={`${styles.vCompactRow} ${p.done ? styles.done : ''} ${isSelected ? styles.selected : ''}`}
                  onClick={() => onPointClick(p.id)}
                >
                  <span
                    className={`${styles.vCompactRowIcon} ${isDiamond ? styles.diamond : ''}`}
                    style={{ background: meta.color }}
                    title={meta.label}
                  >
                    <i className={`fa-solid ${meta.icon}`} />
                  </span>
                  <div className={styles.vCompactRowMain}>
                    <div className={styles.vCompactRowTitle}>{p.title}</div>
                    {p.description && <div className={styles.vCompactRowDesc}>{p.description}</div>}
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      className={`${styles.vCompactRowCheck} ${p.done ? styles.checked : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleDone(p.id, !p.done)
                      }}
                      title={p.done ? 'Marquer non fait' : 'Marquer fait'}
                      aria-label={p.done ? 'Marquer non fait' : 'Marquer fait'}
                    >
                      <i className={`fa-solid ${p.done ? 'fa-check' : 'fa-circle'}`} />
                    </button>
                  )}
                </div>
              )
            })}
            {!readOnly && (
              <button
                type="button"
                className={styles.vCompactAdd}
                onClick={() => onAddAt(group.day_offset)}
              >
                <i className="fa-solid fa-plus" />
                Ajouter à {formatDayLabel(group.day_offset)}
              </button>
            )}
          </div>
        )
      })}

      {!readOnly && (
        <button
          type="button"
          className={styles.vCompactAdd}
          style={{ width: '100%', margin: 0 }}
          onClick={() => {
            const lastOffset = groups.length > 0 ? groups[groups.length - 1].day_offset : 0
            onAddAt(lastOffset + 1)
          }}
        >
          <i className="fa-solid fa-plus" />
          Ajouter un nouveau jour
        </button>
      )}
    </div>
  )
}
