'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import MensurationCharts from './MensurationCharts'
import styles from '@/styles/bilans.module.css'
import type { DailyReport } from './BilanAccordion'
import type { PhotoType, PhotoEntry } from './PhotoCompare'

// ── Helpers ──

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

interface WeekGroup {
  weekStart: string
  entries: DailyReport[]
}

function groupByWeek(bilans: DailyReport[]): WeekGroup[] {
  const weeks: Record<string, DailyReport[]> = {}
  for (const b of bilans) {
    const d = new Date(b.date + 'T12:00:00')
    const monday = getMonday(d)
    const key = toDateStr(monday)
    if (!weeks[key]) weeks[key] = []
    weeks[key].push(b)
  }
  return Object.entries(weeks)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStart, entries]) => ({
      weekStart,
      entries: entries.sort((a, b) => a.date.localeCompare(b.date)),
    }))
}

function extractSeries(bilans: DailyReport[], field: string): { date: string; value: number }[] {
  return bilans
    .filter(b => b[field] != null && b[field] !== '')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(b => ({ date: b.date, value: parseFloat(String(b[field])) }))
    .filter(p => !isNaN(p.value))
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function pillClass(val: number | null, inverted?: boolean): string {
  if (val == null) return ''
  if (inverted) {
    if (val <= 3) return styles.bpPillGood
    if (val <= 5) return styles.bpPillOk
    return styles.bpPillBad
  }
  if (val >= 7) return styles.bpPillGood
  if (val >= 5) return styles.bpPillOk
  return styles.bpPillBad
}

// ── Weight Chart with interactive tooltip ──

function WeightChart({ data }: { data: { date: string; value: number }[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)

  if (data.length < 2) {
    return (
      <div className={styles.bpSection}>
        <div className={styles.bpSectionHeader}>
          <div className={styles.bpSectionTitle}>
            <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(179,8,8,0.12)', color: 'var(--primary)' }}>
              <i className="fas fa-weight-scale" />
            </div>
            Poids
          </div>
        </div>
        <div className={styles.bpEmpty}>Pas assez de donnees poids</div>
      </div>
    )
  }

  const W = 600
  const H = 180
  const PAD = { top: 24, bottom: 32, left: 48, right: 16 }

  const values = data.map(d => d.value)
  const min = Math.min(...values) - 0.5
  const max = Math.max(...values) + 0.5
  const range = max - min || 1
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * plotW,
    y: PAD.top + plotH - ((d.value - min) / range) * plotH,
    ...d,
  }))

  const lineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const fillStr = lineStr + ` ${points[points.length - 1].x.toFixed(1)},${PAD.top + plotH} ${points[0].x.toFixed(1)},${PAD.top + plotH}`

  // Y-axis labels
  const step = range > 6 ? Math.ceil(range / 4) : range > 2 ? 1 : 0.5
  const yLabels: { y: number; val: string }[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    yLabels.push({ y: PAD.top + plotH - ((v - min) / range) * plotH, val: v.toFixed(1) })
  }

  // X-axis labels
  const xIndices = [0, Math.floor(data.length / 2), data.length - 1]
  const xLabels = [...new Set(xIndices)].map(i => ({
    x: points[i].x, label: formatShort(points[i].date),
  }))

  const first = points[0]
  const last = points[points.length - 1]
  const delta = last.value - first.value
  const deltaStr = (delta > 0 ? '+' : '') + delta.toFixed(1)

  // Interactive crosshair
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const crosshair = wrap.querySelector<HTMLDivElement>('[data-crosshair]')
    const tooltip = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (!crosshair || !tooltip) return

    const mouseX = (e.clientX - rect.left) / rect.width
    let nearest = points[0]
    let minDist = Infinity
    for (const pt of points) {
      const ptX = (pt.x / W)
      const dist = Math.abs(ptX - mouseX)
      if (dist < minDist) { minDist = dist; nearest = pt }
    }
    const leftPx = (nearest.x / W) * rect.width
    crosshair.style.left = leftPx + 'px'
    crosshair.style.display = 'block'
    const d = new Date(nearest.date + 'T00:00:00')
    const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    tooltip.textContent = `${nearest.value.toFixed(1)} kg — ${label}`
    tooltip.style.display = 'block'
    tooltip.style.left = Math.min(Math.max(leftPx, 60), rect.width - 60) + 'px'
  }, [points])

  const handleMouseLeave = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const crosshair = wrap.querySelector<HTMLDivElement>('[data-crosshair]')
    const tooltip = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (crosshair) crosshair.style.display = 'none'
    if (tooltip) tooltip.style.display = 'none'
  }, [])

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(179,8,8,0.12)', color: 'var(--primary)' }}>
            <i className="fas fa-weight-scale" />
          </div>
          Poids
        </div>
        <div className={styles.bpChartValues}>
          <span className={styles.bpChartCurrent}>{last.value.toFixed(1)} kg</span>
          <span className={styles.bpChartDelta} style={{ color: delta <= 0 ? 'var(--success)' : 'var(--warning)' }}>
            {deltaStr} kg
          </span>
        </div>
      </div>
      <div
        ref={wrapRef}
        className={styles.bpChartWrap}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.bpSvg}>
          <defs>
            <linearGradient id="bp_wg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Grid */}
          {yLabels.map((yl, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={yl.y} x2={W - PAD.right} y2={yl.y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text x={PAD.left - 8} y={yl.y} fill="var(--text3)" fontSize={10} textAnchor="end" dominantBaseline="middle">{yl.val}</text>
            </g>
          ))}
          {/* Fill */}
          <polygon points={fillStr} fill="url(#bp_wg)" />
          {/* Line */}
          <polyline points={lineStr} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 5 : 2.5} fill={i === points.length - 1 ? 'var(--primary)' : 'rgba(179,8,8,0.5)'} stroke={i === points.length - 1 ? 'var(--bg)' : 'none'} strokeWidth={i === points.length - 1 ? 2.5 : 0} />
          ))}
          {/* X labels */}
          {xLabels.map((xl, i) => (
            <text key={i} x={xl.x} y={H - 6} fill="var(--text3)" fontSize={10} textAnchor="middle">{xl.label}</text>
          ))}
        </svg>
        <div data-crosshair className={styles.bpCrosshair} />
        <div data-tooltip className={styles.bpTooltip} />
      </div>
    </div>
  )
}

// ── Photo Timeline ──

function PhotoTimeline({
  bilans,
  photoHistory,
  onOpenPhoto,
  onLoadPhotos,
}: {
  bilans: DailyReport[]
  photoHistory: Record<PhotoType, PhotoEntry[]>
  onOpenPhoto: (type: PhotoType, date: string) => void
  onLoadPhotos: () => void
}) {
  const photoBilans = useMemo(
    () => bilans.filter(b => b.photo_front || b.photo_side || b.photo_back).sort((a, b) => b.date.localeCompare(a.date)),
    [bilans],
  )

  const urlsByDate = useMemo(() => {
    const map: Record<string, Record<PhotoType, string>> = {}
    for (const type of ['front', 'side', 'back'] as PhotoType[]) {
      for (const entry of photoHistory[type] || []) {
        if (!map[entry.date]) map[entry.date] = {} as Record<PhotoType, string>
        map[entry.date][type] = entry.url
      }
    }
    return map
  }, [photoHistory])

  const hasLoadedPhotos = Object.values(photoHistory).some(arr => arr.length > 0)

  useEffect(() => {
    if (photoBilans.length > 0 && !hasLoadedPhotos) {
      onLoadPhotos()
    }
  }, [photoBilans.length, hasLoadedPhotos, onLoadPhotos])

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--info)' }}>
            <i className="fas fa-camera" />
          </div>
          Evolution photos
        </div>
        {photoBilans.length > 0 && (
          <span className={styles.bpSectionBadge}>{photoBilans.length} bilan{photoBilans.length > 1 ? 's' : ''}</span>
        )}
      </div>
      {photoBilans.length === 0 ? (
        <div className={styles.bpEmpty}>Aucune photo de bilan</div>
      ) : (
        <div className={styles.bpPhotoScroll}>
          {photoBilans.map(b => {
            const urls = urlsByDate[b.date]
            return (
              <div key={b.date} className={styles.bpPhotoGroup}>
                <div className={styles.bpPhotoDate}>{formatShort(b.date)}</div>
                <div className={styles.bpPhotoRow}>
                  {(['front', 'side', 'back'] as PhotoType[]).map(pos => {
                    const url = urls?.[pos]
                    const hasRaw = !!b[`photo_${pos}`]
                    if (!hasRaw) return null
                    return (
                      <div
                        key={pos}
                        className={styles.bpPhotoThumb}
                        onClick={() => onOpenPhoto(pos, b.date)}
                      >
                        {url ? (
                          <img src={url} alt={`${pos} ${b.date}`} />
                        ) : (
                          <div className={styles.bpPhotoPlaceholder}>
                            <i className="fas fa-spinner fa-spin" style={{ fontSize: 11, color: 'var(--text3)' }} />
                          </div>
                        )}
                        <span className={styles.bpPhotoLabel}>
                          {pos === 'front' ? 'Face' : pos === 'side' ? 'Profil' : 'Dos'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Weekly Averages ──

const RATING_FIELDS: readonly { key: string; label: string; icon: string; inverted?: boolean }[] = [
  { key: 'energy', label: 'Energie', icon: 'fa-bolt' },
  { key: 'sleep_quality', label: 'Sommeil', icon: 'fa-moon' },
  { key: 'stress', label: 'Stress', icon: 'fa-face-grimace', inverted: true },
  { key: 'soreness', label: 'Courb.', icon: 'fa-dumbbell', inverted: true },
  { key: 'adherence', label: 'Adher.', icon: 'fa-circle-check' },
  { key: 'session_enjoyment', label: 'Plaisir', icon: 'fa-heart' },
]

function WeeklyAverages({ weeks }: { weeks: WeekGroup[] }) {
  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)' }}>
            <i className="fas fa-chart-bar" />
          </div>
          Moyennes hebdomadaires
        </div>
      </div>
      <div className={styles.bpWeeksGrid}>
        {/* Header row */}
        <div className={`${styles.bpWeekRow} ${styles.bpWeekRowHeader}`}>
          <div className={styles.bpWeekCellHeader}>Semaine</div>
          {RATING_FIELDS.map(f => (
            <div key={f.key} className={styles.bpWeekCellHeader}>{f.label}</div>
          ))}
          <div className={styles.bpWeekCellHeader}>Cardio</div>
        </div>
        {weeks.slice(0, 8).map(week => {
          const monday = new Date(week.weekStart + 'T00:00:00')
          const sunday = new Date(monday)
          sunday.setDate(sunday.getDate() + 6)
          const label = `${formatShort(week.weekStart)} — ${formatShort(toDateStr(sunday))}`
          const totalCardio = week.entries.reduce((s, b) => s + ((b.cardio_minutes as number) || 0), 0)

          return (
            <div key={week.weekStart} className={styles.bpWeekRow}>
              <div className={styles.bpWeekDate}>{label}</div>
              {RATING_FIELDS.map(f => {
                const vals = week.entries.map(b => parseFloat(String(b[f.key] ?? ''))).filter(v => !isNaN(v))
                const a = avg(vals)
                return (
                  <div key={f.key} className={styles.bpWeekCell}>
                    {a != null ? (
                      <span className={`${styles.bpWeekPill} ${pillClass(a, f.inverted)}`}>
                        {a.toFixed(1)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>{'\u2014'}</span>
                    )}
                  </div>
                )
              })}
              <div className={styles.bpWeekCell}>
                {totalCardio ? (
                  <span className={styles.bpWeekPill} style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--info)' }}>
                    {totalCardio}&apos;
                  </span>
                ) : (
                  <span style={{ color: 'var(--text3)' }}>{'\u2014'}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ──

interface BilanProgressViewProps {
  bilans: DailyReport[]
  photoHistory: Record<PhotoType, PhotoEntry[]>
  onOpenPhoto: (type: PhotoType, date: string) => void
  onLoadPhotos: () => void
}

export default function BilanProgressView({ bilans, photoHistory, onOpenPhoto, onLoadPhotos }: BilanProgressViewProps) {
  const sorted = useMemo(() => [...bilans].sort((a, b) => a.date.localeCompare(b.date)), [bilans])
  const weightSeries = useMemo(() => extractSeries(sorted, 'weight'), [sorted])
  const weeks = useMemo(() => groupByWeek(sorted), [sorted])
  const latestDate = sorted.length > 0 ? sorted[sorted.length - 1].date : ''
  const hasMens = sorted.some(b => b.belly_measurement || b.hip_measurement || b.thigh_measurement)

  return (
    <div className={styles.bpContainer}>
      {/* 1. Photos */}
      <PhotoTimeline
        bilans={sorted}
        photoHistory={photoHistory}
        onOpenPhoto={onOpenPhoto}
        onLoadPhotos={onLoadPhotos}
      />

      {/* 2. Weight */}
      <WeightChart data={weightSeries} />

      {/* 3. Mensurations */}
      {hasMens && (
        <div className={styles.bpSection}>
          <div className={styles.bpSectionHeader}>
            <div className={styles.bpSectionTitle}>
              <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(232,93,4,0.12)', color: '#E85D04' }}>
                <i className="fas fa-ruler" />
              </div>
              Mensurations
            </div>
          </div>
          <div className={styles.bpMensWrap}>
            <MensurationCharts bilans={sorted} upToDate={latestDate} suffix="progress" />
          </div>
        </div>
      )}

      {/* 4. Weekly Averages */}
      <WeeklyAverages weeks={weeks} />
    </div>
  )
}
