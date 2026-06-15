'use client'

import { useMemo } from 'react'
import {
  STEP_TYPE_META,
  formatDayLabel,
  computeUrgency,
  todayIso,
  getMonthRange,
  type OnboardingStepType,
} from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'
import type { VerticalTimelinePoint } from './OnboardingTimelineVerticalSpine'

interface Props {
  points: VerticalTimelinePoint[]
  startDate?: string | null
  selectedId?: string | null
  monthIndex: number
  maxMonthIndex?: number
  onMonthChange: (next: number) => void
  onPointClick: (id: string) => void
  onAddAt: (dayOffset: number) => void
  readOnly?: boolean
}

function formatDateForOffset(startDate: string, offset: number): { weekday: string; rest: string; iso: string } {
  const parts = startDate.split('-').map((n) => parseInt(n, 10))
  const [y, m, d] = parts
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + offset)
  const weekday = dt.toLocaleDateString('fr-FR', { weekday: 'long' })
  const rest = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const iso = dt.toISOString().slice(0, 10)
  return { weekday, rest, iso }
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

interface DaySection {
  day_offset: number
  points: VerticalTimelinePoint[]
}

export default function OnboardingTimelineVerticalFeed({
  points,
  startDate,
  selectedId,
  monthIndex,
  maxMonthIndex = Infinity,
  onMonthChange,
  onPointClick,
  onAddAt,
  readOnly = false,
}: Props) {
  const range = useMemo(() => getMonthRange(monthIndex), [monthIndex])

  const sections = useMemo<DaySection[]>(() => {
    const map = new Map<number, VerticalTimelinePoint[]>()
    points
      // Filter to current month range
      .filter((p) => p.day_offset >= range.startOffset && p.day_offset <= range.endOffset)
      .forEach((p) => {
        const arr = map.get(p.day_offset) ?? []
        arr.push(p)
        map.set(p.day_offset, arr)
      })
    const list = Array.from(map.entries())
      .map(([day_offset, pts]) => ({
        day_offset,
        points: pts.slice().sort((a, b) => a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => a.day_offset - b.day_offset)

    // Inject a "today" placeholder section if startDate is set, today is in this month range, and not already present
    const todayOffset = computeTodayOffset(startDate ?? null)
    if (
      todayOffset != null &&
      todayOffset >= range.startOffset &&
      todayOffset <= range.endOffset &&
      !list.find((s) => s.day_offset === todayOffset)
    ) {
      list.push({ day_offset: todayOffset, points: [] })
      list.sort((a, b) => a.day_offset - b.day_offset)
    }
    return list
  }, [points, startDate, range.startOffset, range.endOffset])

  const todayOffset = useMemo(() => computeTodayOffset(startDate ?? null), [startDate])
  const today = useMemo(() => todayIso(), [])

  // Subtitle date range for the current month
  const monthDateRange = useMemo(() => {
    if (!startDate) return null
    const parts = startDate.split('-').map((n) => parseInt(n, 10))
    const [y, m, d] = parts
    const monthStart = new Date(y, m - 1, d)
    monthStart.setDate(monthStart.getDate() + range.startOffset)
    const monthEnd = new Date(y, m - 1, d)
    monthEnd.setDate(monthEnd.getDate() + range.endOffset)
    const fmt = (dt: Date) => dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    return `${fmt(monthStart)} → ${fmt(monthEnd)}`
  }, [startDate, range.startOffset, range.endOffset])

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          width: '100%',
          padding: '14px 20px',
          marginBottom: 24,
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(127, 29, 29, 0.04))',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 16px rgba(0,0,0,0.2)',
          position: 'relative',
          zIndex: 4,
        }}
      >
        <button
          type="button"
          onClick={() => onMonthChange(Math.max(0, monthIndex - 1))}
          disabled={monthIndex === 0}
          aria-label="Mois précédent"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: monthIndex === 0 ? 'transparent' : 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '10px 18px',
            borderRadius: 999,
            cursor: monthIndex === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            opacity: monthIndex === 0 ? 0.3 : 1,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'background .12s ease, border-color .12s ease, transform .12s ease',
          }}
          onMouseEnter={(e) => {
            if (monthIndex === 0) return
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
          }}
        >
          <i className="fa-solid fa-chevron-left" style={{ fontSize: 11, opacity: 0.7 }} />
          Précédent
        </button>

        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: 0.3,
              lineHeight: 1.1,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 14px',
                background: '#ef4444',
                color: 'white',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.4)',
              }}
            >
              <i className="fa-solid fa-calendar-days" />
              Mois {range.index + 1}
            </span>
            <span style={{ color: 'var(--text2)', fontWeight: 500, fontSize: 15 }}>
              {formatDayLabel(range.startOffset)}
              <span style={{ opacity: 0.4, margin: '0 6px' }}>→</span>
              {formatDayLabel(range.endOffset)}
            </span>
          </div>
          {monthDateRange && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text2)',
                fontWeight: 500,
                marginTop: 6,
                letterSpacing: 0.3,
                opacity: 0.85,
              }}
            >
              <i
                className="fa-regular fa-calendar"
                style={{ marginRight: 6, opacity: 0.55, fontSize: 11 }}
              />
              {monthDateRange}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onMonthChange(monthIndex + 1)}
          disabled={monthIndex >= maxMonthIndex}
          aria-label="Mois suivant"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: monthIndex >= maxMonthIndex ? 'transparent' : 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '10px 18px',
            borderRadius: 999,
            cursor: monthIndex >= maxMonthIndex ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            opacity: monthIndex >= maxMonthIndex ? 0.3 : 1,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'background .12s ease, border-color .12s ease, transform .12s ease',
          }}
          onMouseEnter={(e) => {
            if (monthIndex >= maxMonthIndex) return
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
          }}
        >
          Suivant
          <i className="fa-solid fa-chevron-right" style={{ fontSize: 11, opacity: 0.7 }} />
        </button>
      </div>

      {sections.length === 0 ? (
        <div className={styles.vEmptyMonth}>
          <i className="fa-regular fa-calendar" style={{ fontSize: 24, opacity: 0.4 }} />
          <p>Aucun point ce mois-ci.</p>
          {!readOnly && (
            <button
              type="button"
              className={styles.vFeedAddDay}
              onClick={() => onAddAt(range.startOffset)}
            >
              <i className="fa-solid fa-plus" />
              Ajouter un point à {formatDayLabel(range.startOffset)}
            </button>
          )}
        </div>
      ) : (
      <div className={styles.vFeed}>
      {sections.map((section) => {
        const isToday = todayOffset != null && section.day_offset === todayOffset
        const isPast = todayOffset != null && section.day_offset < todayOffset
        const dateInfo = startDate ? formatDateForOffset(startDate, section.day_offset) : null
        const urgency = dateInfo ? computeUrgency(dateInfo.iso, today) : null

        return (
          <div
            key={`fs-${section.day_offset}`}
            className={`${styles.vFeedSection} ${isToday ? styles.isToday : ''} ${isPast ? styles.isPast : ''}`}
          >
            <div className={styles.vFeedDayLabel}>
              {dateInfo && (
                <>
                  <div className={styles.vFeedDayLabelDate}>{dateInfo.weekday}</div>
                  <div className={styles.vFeedDayLabelDate} style={{ fontSize: 12, fontWeight: 500 }}>
                    {dateInfo.rest}
                  </div>
                </>
              )}
              <div className={styles.vFeedDayLabelOffset}>{formatDayLabel(section.day_offset)}</div>
              {urgency && !isToday && (
                <span
                  className={styles.vFeedDayLabelDelta}
                  style={{ background: urgency.bg, color: urgency.color }}
                >
                  {urgency.label}
                </span>
              )}
              {isToday && (
                <span
                  className={styles.vFeedDayLabelDelta}
                  style={{ background: '#ef4444', color: 'white' }}
                >
                  AUJOURD&apos;HUI
                </span>
              )}
            </div>

            <div className={styles.vFeedSpineCol}>
              <div className={styles.vFeedDots}>
                {section.points.map((p) => {
                  const meta = STEP_TYPE_META[p.type]
                  const isDiamond = meta.shape === 'diamond'
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.vFeedDot} ${isDiamond ? styles.vFeedDotDiamond : ''}`}
                      style={{
                        background: meta.shape === 'dot' ? 'var(--bg)' : meta.color,
                        borderColor: meta.color,
                        color: meta.shape === 'dot' ? meta.color : 'white',
                        opacity: p.done ? 0.45 : 1,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onPointClick(p.id)
                      }}
                      title={`${meta.label} · ${p.title}`}
                    >
                      <i className={`fa-solid ${meta.icon}`} />
                    </button>
                  )
                })}
                {section.points.length === 0 && isToday && (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 50,
                      background: '#ef4444',
                      border: '3px solid var(--bg)',
                    }}
                    title="Aujourd'hui"
                  />
                )}
              </div>
            </div>

            <div className={styles.vFeedCards}>
              {section.points.map((p) => {
                const meta = STEP_TYPE_META[p.type]
                const isSelected = selectedId === p.id
                return (
                  <div
                    key={`card-${p.id}`}
                    className={`${styles.vFeedCard} ${p.done ? styles.done : ''} ${isSelected ? styles.selected : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPointClick(p.id)
                    }}
                  >
                    <div className={styles.vFeedCardHead}>
                      <span
                        className={styles.vTypePill}
                        style={{ background: meta.color, color: meta.shape === 'dot' ? 'var(--text)' : 'white' }}
                      >
                        <i className={`fa-solid ${meta.icon}`} style={{ fontSize: 9 }} />
                        {meta.label}
                      </span>
                      <span className={styles.vFeedCardTitle}>{p.title}</span>
                    </div>
                    {p.description ? <div className={styles.vFeedCardDesc}>{p.description}</div> : null}
                  </div>
                )
              })}
              {!readOnly && (
                <button
                  type="button"
                  className={styles.vFeedAddDay}
                  onClick={() => onAddAt(section.day_offset)}
                  title={`Ajouter un point à ${formatDayLabel(section.day_offset)}`}
                >
                  <i className="fa-solid fa-plus" />
                  Ajouter {section.points.length === 0 ? 'un point ici' : 'ce jour-là'}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {!readOnly && (
        <button
          type="button"
          className={styles.vFeedAddSection}
          onClick={() => {
            const lastOffset =
              sections.length > 0
                ? sections[sections.length - 1].day_offset
                : range.startOffset
            onAddAt(Math.min(lastOffset + 1, range.endOffset))
          }}
        >
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
          Ajouter un nouveau jour
        </button>
      )}
    </div>
      )}
    </>
  )
}
