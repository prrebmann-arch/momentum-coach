'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  STEP_TYPE_META,
  type OnboardingStepType,
  getMonthRange,
  formatDayLabel,
} from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'

export interface TimelinePoint {
  id: string
  day_offset: number
  type: OnboardingStepType
  title: string
  done?: boolean
}

interface OnboardingTimelineProps {
  points: TimelinePoint[]
  monthIndex: number
  maxMonthIndex?: number
  onMonthChange: (next: number) => void
  startDate?: string | null
  onPointMove: (id: string, newDayOffset: number) => void
  onPointClick: (id: string) => void
  onAxisClick: (dayOffset: number) => void
  readOnly?: boolean
}

// Geometry
const DAY_PX = 90
const PADDING_X = 90 // enough room for the leftmost/rightmost label not to clip
const HEIGHT = 320
const AXIS_Y = 175
const POINT_R = { dot: 8, fill: 11, diamond: 13 } as const
const LABEL_W = 140
const LABEL_H = 40

export default function OnboardingTimeline({
  points,
  monthIndex,
  maxMonthIndex = Infinity,
  onMonthChange,
  startDate,
  onPointMove,
  onPointClick,
  onAxisClick,
  readOnly = false,
}: OnboardingTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragDay, setDragDay] = useState<number | null>(null)
  const dragMovedRef = useRef(false)
  const [containerWidth, setContainerWidth] = useState(800)

  const range = useMemo(() => getMonthRange(monthIndex), [monthIndex])
  const naturalWidth = useMemo(() => PADDING_X * 2 + range.days * DAY_PX, [range.days])
  const svgWidth = Math.max(naturalWidth, containerWidth)

  // Measure container width to allow the SVG to fill it when smaller than the natural width.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setContainerWidth(el.clientWidth)
    })
    observer.observe(el)
    setContainerWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  // Filter to current month
  const monthPoints = useMemo(
    () =>
      points
        .filter((p) => p.day_offset >= range.startOffset && p.day_offset <= range.endOffset)
        .slice()
        .sort((a, b) => a.day_offset - b.day_offset || a.id.localeCompare(b.id)),
    [points, range.startOffset, range.endOffset],
  )

  // Ticks every 5 days
  const ticks = useMemo(() => {
    const out: number[] = []
    const first = range.startOffset === 0 ? 0 : Math.ceil(range.startOffset / 5) * 5
    for (let d = first; d <= range.endOffset; d += 5) out.push(d)
    return out
  }, [range.startOffset, range.endOffset])

  const dayToX = useCallback(
    (day: number) => {
      const innerWidth = svgWidth - PADDING_X * 2
      const pct = (day - range.startOffset) / (range.endOffset - range.startOffset)
      return PADDING_X + pct * innerWidth
    },
    [svgWidth, range.startOffset, range.endOffset],
  )

  const xToDay = useCallback(
    (x: number) => {
      const innerWidth = svgWidth - PADDING_X * 2
      const pct = Math.max(0, Math.min(1, (x - PADDING_X) / innerWidth))
      return Math.round(range.startOffset + pct * (range.endOffset - range.startOffset))
    },
    [svgWidth, range.startOffset, range.endOffset],
  )

  // Today line — calendar-day diff (ignores hours/timezone offset)
  const todayDay = useMemo(() => {
    if (!startDate) return null
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const [sy, sm, sd] = startDate.split('-').map((n) => parseInt(n, 10))
    if (!sy || !sm || !sd) return null
    const startMidnight = new Date(sy, sm - 1, sd)
    const diff = Math.round((todayMidnight.getTime() - startMidnight.getTime()) / 86400000)
    if (diff < range.startOffset || diff > range.endOffset) return null
    return diff
  }, [startDate, range.startOffset, range.endOffset])

  // Date range subtitle
  const dateRangeLabel = useMemo(() => {
    if (!startDate) return null
    const start = new Date(startDate + 'T00:00:00')
    const monthStart = new Date(start)
    monthStart.setDate(monthStart.getDate() + range.startOffset)
    const monthEnd = new Date(start)
    monthEnd.setDate(monthEnd.getDate() + range.endOffset)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    return `${fmt(monthStart)} → ${fmt(monthEnd)}`
  }, [startDate, range.startOffset, range.endOffset])

  // Assign labels to lanes to avoid horizontal overlap.
  // Lane 0 = above (near axis), 1 = above (far), 2 = below (near), 3 = below (far).
  // Each lane has its own minimum X gap tracker.
  type PointLayout = {
    p: TimelinePoint
    x: number // dot center x (may include same-day spread offset)
    labelX: number // label center x (no spread, anchored on the day)
    aboveLane: 0 | 1 | null
    belowLane: 0 | 1 | null
    side: 'above' | 'below'
  }
  const LABEL_HALF_WIDTH = LABEL_W / 2 + 8
  const SAME_DAY_SPREAD = 22 // px between dots that share the same day_offset
  const layouts = useMemo<PointLayout[]>(() => {
    // Group points by day_offset first to compute spread offsets per group
    const byDay = new Map<number, TimelinePoint[]>()
    monthPoints.forEach((p) => {
      const arr = byDay.get(p.day_offset) ?? []
      arr.push(p)
      byDay.set(p.day_offset, arr)
    })
    const spreadIndex = new Map<string, number>()
    byDay.forEach((arr) => {
      arr.forEach((p, i) => {
        // For a group of N, spread positions are i - (N-1)/2
        const offsetFromCenter = i - (arr.length - 1) / 2
        spreadIndex.set(p.id, offsetFromCenter)
      })
    })

    // Label anchored on each point's actual dot (with spread), so labels point cleanly to their dot
    const aboveLastX: [number, number] = [-Infinity, -Infinity]
    const belowLastX: [number, number] = [-Infinity, -Infinity]
    const out: PointLayout[] = []
    monthPoints.forEach((p, idx) => {
      const baseX = dayToX(p.day_offset)
      const spread = spreadIndex.get(p.id) ?? 0
      const x = baseX + spread * SAME_DAY_SPREAD
      const labelX = x
      const aboveFit = aboveLastX.findIndex((last) => labelX - last >= LABEL_HALF_WIDTH * 2)
      const belowFit = belowLastX.findIndex((last) => labelX - last >= LABEL_HALF_WIDTH * 2)
      const preferAbove = idx % 2 === 0
      let side: 'above' | 'below'
      if (aboveFit !== -1 && belowFit !== -1) {
        side = preferAbove ? 'above' : 'below'
      } else if (aboveFit !== -1) {
        side = 'above'
      } else if (belowFit !== -1) {
        side = 'below'
      } else {
        side = aboveLastX[1] <= belowLastX[1] ? 'above' : 'below'
      }
      let aboveLane: 0 | 1 | null = null
      let belowLane: 0 | 1 | null = null
      if (side === 'above') {
        const fit = aboveLastX.findIndex((last) => labelX - last >= LABEL_HALF_WIDTH * 2)
        aboveLane = (fit === -1 ? 1 : fit) as 0 | 1
        aboveLastX[aboveLane] = labelX
      } else {
        const fit = belowLastX.findIndex((last) => labelX - last >= LABEL_HALF_WIDTH * 2)
        belowLane = (fit === -1 ? 1 : fit) as 0 | 1
        belowLastX[belowLane] = labelX
      }
      out.push({ p, x, labelX, aboveLane, belowLane, side })
    })
    return out
  }, [monthPoints, dayToX])

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (readOnly) return
    e.stopPropagation()
    const point = points.find((p) => p.id === id)
    if (!point || point.done) {
      onPointClick(id)
      return
    }
    dragMovedRef.current = false
    setDragId(id)
    setDragDay(point.day_offset)
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragId || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const xRel = e.clientX - rect.left
    const day = xToDay(xRel)
    if (day !== dragDay) {
      dragMovedRef.current = true
      setDragDay(day)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragId) return
    const id = dragId
    const finalDay = dragDay
    setDragId(null)
    setDragDay(null)
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
    if (dragMovedRef.current && finalDay != null) {
      const orig = points.find((p) => p.id === id)
      if (orig && orig.day_offset !== finalDay) onPointMove(id, finalDay)
    } else {
      onPointClick(id)
    }
  }

  const handleBgClick = (e: React.MouseEvent) => {
    if (readOnly || dragId) return
    if (!svgRef.current) return
    const target = e.target as Element
    if (target.tagName === 'circle' || target.tagName === 'rect' && target !== svgRef.current.querySelector('[data-bg]')) {
      // ignore clicks on points
      return
    }
    const rect = svgRef.current.getBoundingClientRect()
    const xRel = e.clientX - rect.left
    const day = xToDay(xRel)
    onAxisClick(day)
  }

  // Label Y positions per lane (per side). Returns the CENTER y of the label box.
  const yForLabel = (side: 'above' | 'below', lane: 0 | 1) => {
    if (side === 'above') return lane === 0 ? AXIS_Y - 50 : AXIS_Y - 100
    return lane === 0 ? AXIS_Y + 64 : AXIS_Y + 114
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.monthLabel}>
            Mois {range.index + 1} — {formatDayLabel(range.startOffset)} à {formatDayLabel(range.endOffset)}
          </div>
          {dateRangeLabel && <div className={styles.monthSub}>{dateRangeLabel}</div>}
        </div>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onMonthChange(Math.max(0, monthIndex - 1))}
            disabled={monthIndex === 0}
          >
            <i className="fa-solid fa-chevron-left" />
            Mois précédent
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onMonthChange(monthIndex + 1)}
            disabled={monthIndex >= maxMonthIndex}
          >
            Mois suivant
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className={styles.timelineScroller}>
        <svg
          ref={svgRef}
          width={svgWidth}
          height={HEIGHT}
          onClick={handleBgClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ display: 'block', cursor: readOnly ? 'default' : 'crosshair' }}
        >
          {/* Background — captures clicks to add a point */}
          <rect data-bg x={0} y={0} width={svgWidth} height={HEIGHT} fill="transparent" />

          {/* Axis */}
          <line
            x1={PADDING_X}
            x2={svgWidth - PADDING_X}
            y1={AXIS_Y}
            y2={AXIS_Y}
            stroke="var(--border)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* Subtle axis end caps */}
          <circle cx={PADDING_X} cy={AXIS_Y} r={3} fill="var(--border)" />
          <circle cx={svgWidth - PADDING_X} cy={AXIS_Y} r={3} fill="var(--border)" />

          {/* Tick day labels (J0, J+5, J+10...) — small, faint, anchored on the axis */}
          {ticks.map((d) => {
            const x = dayToX(d)
            return (
              <g key={`tick-label-${d}`} style={{ pointerEvents: 'none' }}>
                <text
                  x={x}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fill="var(--text2)"
                  fontSize={10}
                  fontWeight={500}
                  style={{ userSelect: 'none', opacity: 0.45 }}
                >
                  {formatDayLabel(d)}
                </text>
              </g>
            )
          })}

          {/* Faint background grid every 5 days — very subtle */}
          {ticks.map((d) => {
            const x = dayToX(d)
            return (
              <line
                key={`bg-tick-${d}`}
                x1={x}
                x2={x}
                y1={AXIS_Y - 80}
                y2={AXIS_Y + 80}
                stroke="var(--border)"
                strokeWidth={1}
                opacity={0.12}
                style={{ pointerEvents: 'none' }}
              />
            )
          })}

          {/* Today vertical marker */}
          {todayDay != null && (
            <g style={{ pointerEvents: 'none' }}>
              <line
                x1={dayToX(todayDay)}
                x2={dayToX(todayDay)}
                y1={18}
                y2={HEIGHT - 16}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4,4"
                opacity={0.7}
              />
              <rect
                x={dayToX(todayDay) - 22}
                y={2}
                width={44}
                height={16}
                rx={4}
                fill="#ef4444"
              />
              <text
                x={dayToX(todayDay)}
                y={13}
                textAnchor="middle"
                fill="white"
                fontSize={9}
                fontWeight={800}
                style={{ userSelect: 'none', letterSpacing: 1 }}
              >
                AUJ
              </text>
            </g>
          )}

          {/* Points */}
          {(() => {
            // De-dup the day label "Jx" when multiple points share the same offset.
            const seenDay = new Set<number>()
            return layouts.map((l) => {
              const showDay = !seenDay.has(l.p.day_offset)
              seenDay.add(l.p.day_offset)
              return { ...l, showDay }
            })
          })().map(({ p, x: origX, labelX, aboveLane, belowLane, side, showDay }) => {
            const isDragging = dragId === p.id
            const x = isDragging && dragDay != null ? dayToX(dragDay) : origX
            const effectiveDay = isDragging && dragDay != null ? dragDay : p.day_offset
            const meta = STEP_TYPE_META[p.type]
            const r = meta.shape === 'dot' ? POINT_R.dot : meta.shape === 'fill' ? POINT_R.fill : POINT_R.diamond
            const color = meta.color
            const opacity = p.done ? 0.4 : 1
            const lane = side === 'above' ? aboveLane : belowLane
            const labelCenterY = yForLabel(side, (lane ?? 0) as 0 | 1)
            const labelTopY = labelCenterY - LABEL_H / 2
            const dayY = side === 'above' ? AXIS_Y + 22 : AXIS_Y - 14
            // Stem from point to bottom/top edge of label box
            const stemY1 = side === 'above' ? labelTopY + LABEL_H : AXIS_Y + r + 1
            const stemY2 = side === 'above' ? AXIS_Y - r - 1 : labelTopY

            return (
              <g key={p.id} opacity={opacity}>
                {/* Stem — from dot up/down to the label center x */}
                <line
                  x1={x}
                  y1={stemY1}
                  x2={labelX}
                  y2={stemY2}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.4}
                  strokeDasharray={p.done ? '3,3' : undefined}
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Label (HTML inside foreignObject for proper text rendering + ellipsis) */}
                <foreignObject
                  x={labelX - LABEL_W / 2}
                  y={labelTopY}
                  width={LABEL_W}
                  height={LABEL_H}
                  style={{ overflow: 'visible' }}
                >
                  <div
                    className={styles.labelBox}
                    style={{
                      alignItems: side === 'above' ? 'flex-end' : 'flex-start',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPointClick(p.id)
                    }}
                    title={`${meta.label} · ${p.title} (${formatDayLabel(effectiveDay)})`}
                  >
                    <span
                      className={`${styles.labelText} ${p.done ? styles.labelTextDone : ''}`}
                      style={{ borderColor: color }}
                    >
                      {p.title}
                    </span>
                  </div>
                </foreignObject>
                {/* Day label — once per unique day, centered on labelX (the day anchor) */}
                {showDay && (
                  <text
                    x={labelX}
                    y={AXIS_Y + 26}
                    textAnchor="middle"
                    fill="var(--text2)"
                    fontSize={11}
                    fontWeight={700}
                    style={{ pointerEvents: 'none', userSelect: 'none', letterSpacing: 0.3 }}
                  >
                    {formatDayLabel(effectiveDay)}
                  </text>
                )}
                {/* Point glow ring on hover (rendered as outer translucent circle on hover via CSS-on-element) */}
                {meta.shape === 'diamond' ? (
                  <rect
                    x={x - r}
                    y={AXIS_Y - r}
                    width={r * 2}
                    height={r * 2}
                    fill={color}
                    stroke="var(--bg)"
                    strokeWidth={2}
                    transform={`rotate(45 ${x} ${AXIS_Y})`}
                    onPointerDown={(e) => handlePointerDown(e, p.id)}
                    style={{
                      cursor: readOnly ? 'pointer' : 'grab',
                      filter: `drop-shadow(0 0 ${isDragging ? 6 : 0}px ${color})`,
                    }}
                  >
                    <title>{`${meta.label} · ${p.title} (${formatDayLabel(effectiveDay)})`}</title>
                  </rect>
                ) : (
                  <circle
                    cx={x}
                    cy={AXIS_Y}
                    r={r}
                    fill={meta.shape === 'dot' ? 'var(--bg)' : color}
                    stroke={color}
                    strokeWidth={meta.shape === 'dot' ? 2 : 2}
                    onPointerDown={(e) => handlePointerDown(e, p.id)}
                    style={{
                      cursor: readOnly ? 'pointer' : 'grab',
                      filter: `drop-shadow(0 0 ${isDragging ? 6 : 0}px ${color})`,
                    }}
                  >
                    <title>{`${meta.label} · ${p.title} (${formatDayLabel(effectiveDay)})`}</title>
                  </circle>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ border: '2px solid #9ca3af' }} /> Message
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#ef4444' }} /> Appel
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDiamond} /> Étape clé
        </span>
        {!readOnly && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text2)' }}>
            Glisser un point pour le décaler · cliquer sur la ligne pour en ajouter
          </span>
        )}
      </div>
    </div>
  )
}
