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

function formatMedium(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface WeekGroup { weekStart: string; entries: DailyReport[] }

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
    .map(([weekStart, entries]) => ({ weekStart, entries: entries.sort((a, b) => a.date.localeCompare(b.date)) }))
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

// ── Transformation Hero ──

function TransformationHero({
  bilans, photoHistory, onOpenPhoto, onLoadPhotos,
}: {
  bilans: DailyReport[]
  photoHistory: Record<PhotoType, PhotoEntry[]>
  onOpenPhoto: (type: PhotoType, date: string) => void
  onLoadPhotos: () => void
}) {
  const [activeTab, setActiveTab] = useState<PhotoType>('front')
  const [leftDateIdx, setLeftDateIdx] = useState(0) // index into photoBilans (0 = oldest)

  const photoBilans = useMemo(
    () => bilans.filter(b => b.photo_front || b.photo_side || b.photo_back).sort((a, b) => a.date.localeCompare(b.date)),
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
  useEffect(() => { if (photoBilans.length > 0 && !hasLoadedPhotos) onLoadPhotos() }, [photoBilans.length, hasLoadedPhotos, onLoadPhotos])

  // Reset leftDateIdx if it's out of bounds
  const safeLeftIdx = Math.min(leftDateIdx, Math.max(photoBilans.length - 2, 0))

  if (photoBilans.length === 0) return null

  const leftBilan = photoBilans[safeLeftIdx]
  const lastBilan = photoBilans[photoBilans.length - 1]
  const leftUrl = urlsByDate[leftBilan.date]?.[activeTab]
  const lastUrl = urlsByDate[lastBilan.date]?.[activeTab]

  // Compute deltas between selected left and right
  const leftWeight = bilans.find(b => b.date === leftBilan.date)?.weight
  const rightWeight = bilans.find(b => b.date === lastBilan.date)?.weight
  const weightDelta = (leftWeight != null && rightWeight != null) ? (rightWeight as number) - (leftWeight as number) : null

  const leftBelly = bilans.find(b => b.date === leftBilan.date)?.belly_measurement
  const rightBelly = bilans.find(b => b.date === lastBilan.date)?.belly_measurement
  const bellyDelta = (leftBelly != null && rightBelly != null) ? (rightBelly as number) - (leftBelly as number) : null

  const adherences = bilans.map(b => parseFloat(String(b.adherence ?? ''))).filter(v => !isNaN(v))
  const avgAdh = adherences.length ? avg(adherences) : null

  // Duration between selected dates
  const daysDiff = Math.round((new Date(lastBilan.date).getTime() - new Date(leftBilan.date).getTime()) / 86400000)
  const durationLabel = daysDiff >= 30 ? `${Math.round(daysDiff / 30)} mois de suivi` : `${daysDiff} jours de suivi`

  const formatUpper = (dateStr: string) => new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()

  const TABS: { key: PhotoType; label: string }[] = [
    { key: 'front', label: 'Face' },
    { key: 'side', label: 'Profil' },
    { key: 'back', label: 'Dos' },
  ]

  return (
    <div className={styles.bpSection} style={{ position: 'relative' }}>
      <div className={styles.bpTransformBg} />
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(179,8,8,0.12)', color: '#B30808' }}>
            <i className="fas fa-arrow-right-arrow-left" />
          </div>
          Transformation
        </div>
        <span className={styles.bpSectionBadge}>{durationLabel}</span>
      </div>

      {/* Tabs */}
      <div className={styles.bpTransformTabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.bpTransformTab} ${activeTab === t.key ? styles.bpTransformTabActive : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Before / After */}
      <div className={styles.bpTransformBody}>
        <div className={styles.bpTransformSide}>
          {photoBilans.length > 2 ? (
            <select
              className={styles.bpTransformSelect}
              value={safeLeftIdx}
              onChange={(e) => setLeftDateIdx(Number(e.target.value))}
            >
              {photoBilans.slice(0, -1).map((b, i) => (
                <option key={b.date} value={i}>{formatMedium(b.date)}</option>
              ))}
            </select>
          ) : (
            <div className={styles.bpTransformLabel}>Debut</div>
          )}
          <div className={styles.bpTransformPhoto} onClick={() => onOpenPhoto(activeTab, leftBilan.date)}>
            {leftUrl ? <img src={leftUrl} alt="comparaison" /> : (
              <div className={styles.bpPhotoPlaceholder}><i className="fas fa-spinner fa-spin" style={{ fontSize: 16, color: 'var(--text3)' }} /></div>
            )}
          </div>
          <div className={styles.bpTransformDate}>{formatUpper(leftBilan.date)}</div>
        </div>

        <div className={styles.bpTransformCenter}>
          {weightDelta !== null && (
            <div className={styles.bpTransformDelta}>
              <div className={styles.bpTransformDeltaValue} style={{ color: weightDelta <= 0 ? 'var(--success)' : 'var(--warning)' }}>
                {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg
              </div>
              <div className={styles.bpTransformDeltaLabel}>Poids</div>
            </div>
          )}
          <div className={styles.bpTransformArrow}><i className="fas fa-right-long" /></div>
          {bellyDelta !== null && (
            <div className={styles.bpTransformDelta}>
              <div className={styles.bpTransformDeltaValue} style={{ color: bellyDelta <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {bellyDelta > 0 ? '+' : ''}{bellyDelta.toFixed(1)} cm
              </div>
              <div className={styles.bpTransformDeltaLabel}>Ventre</div>
            </div>
          )}
          {avgAdh !== null && (
            <div className={styles.bpTransformDelta}>
              <div className={styles.bpTransformDeltaValue} style={{ color: 'var(--text2)' }}>
                {avgAdh.toFixed(1)}<span style={{ fontSize: 12, color: 'var(--text3)' }}>/10</span>
              </div>
              <div className={styles.bpTransformDeltaLabel}>Adherence moy.</div>
            </div>
          )}
        </div>

        <div className={styles.bpTransformSide}>
          <div className={styles.bpTransformLabel} style={{ color: 'var(--success)' }}>Dernier</div>
          <div className={styles.bpTransformPhoto} onClick={() => onOpenPhoto(activeTab, lastBilan.date)}>
            {lastUrl ? <img src={lastUrl} alt="dernier" /> : (
              <div className={styles.bpPhotoPlaceholder}><i className="fas fa-spinner fa-spin" style={{ fontSize: 16, color: 'var(--text3)' }} /></div>
            )}
          </div>
          <div className={styles.bpTransformDate}>{formatUpper(lastBilan.date)}</div>
        </div>
      </div>

      {/* Date dots */}
      {photoBilans.length > 2 && (
        <div className={styles.bpTransformDots}>
          {photoBilans.map((b, i) => (
            <div
              key={b.date}
              className={`${styles.bpTransformDot} ${i === photoBilans.length - 1 ? styles.bpTransformDotActive : ''}`}
              title={formatShort(b.date)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Hero Strip ──

interface HeroCard {
  icon: string; iconColor: string; iconBg: string; gradient: string
  label: string; value: string; unit?: string; delta?: string; deltaColor?: string
}

function HeroStrip({ bilans }: { bilans: DailyReport[] }) {
  const cards = useMemo(() => {
    const result: HeroCard[] = []

    // Sommeil moy
    const sleeps = bilans.map(b => parseFloat(String(b.sleep_quality ?? ''))).filter(v => !isNaN(v))
    if (sleeps.length) {
      result.push({ icon: 'fa-moon', iconColor: '#818cf8', iconBg: 'rgba(129,140,248,0.12)',
        gradient: 'linear-gradient(90deg,#818cf8,#a5b4fc)', label: 'Sommeil moy.',
        value: avg(sleeps)!.toFixed(1), unit: '/10' })
    }

    // Energie moy
    const energies = bilans.map(b => parseFloat(String(b.energy ?? ''))).filter(v => !isNaN(v))
    if (energies.length) {
      result.push({ icon: 'fa-bolt', iconColor: '#f59e0b', iconBg: 'rgba(245,158,11,0.12)',
        gradient: 'linear-gradient(90deg,#f59e0b,#fbbf24)', label: 'Energie moy.',
        value: avg(energies)!.toFixed(1), unit: '/10' })
    }

    // Adherence moy
    const adherences = bilans.map(b => parseFloat(String(b.adherence ?? ''))).filter(v => !isNaN(v))
    if (adherences.length) {
      result.push({ icon: 'fa-circle-check', iconColor: '#22c55e', iconBg: 'rgba(34,197,94,0.12)',
        gradient: 'linear-gradient(90deg,#22c55e,#4ade80)', label: 'Adherence moy.',
        value: avg(adherences)!.toFixed(1), unit: '/10' })
    }

    // Seances (count days with workout logs approximated by sessions_executed or session_performance)
    const seances = bilans.filter(b => b.sessions_executed || b.session_performance != null).length
    result.push({ icon: 'fa-dumbbell', iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.12)',
      gradient: 'linear-gradient(90deg,#3b82f6,#60a5fa)', label: 'Seances',
      value: String(seances) })

    // Cardio total
    const totalCardio = bilans.reduce((s, b) => s + ((b.cardio_minutes as number) || 0), 0)
    if (totalCardio > 0) {
      result.push({ icon: 'fa-heart-pulse', iconColor: '#7209B7', iconBg: 'rgba(114,9,183,0.12)',
        gradient: 'linear-gradient(90deg,#7209B7,#a855f7)', label: 'Cardio total',
        value: String(totalCardio), unit: 'min' })
    }

    return result
  }, [bilans])

  if (!cards.length) return null
  return (
    <div className={styles.bpHeroStrip}>
      {cards.map((c, i) => (
        <div key={i} className={styles.bpHeroCard}>
          <div className={styles.bpHeroBar} style={{ background: c.gradient }} />
          <div className={styles.bpHeroIcon} style={{ background: c.iconBg, color: c.iconColor }}>
            <i className={`fas ${c.icon}`} />
          </div>
          <div className={styles.bpHeroValue}>{c.value}{c.unit && <span className={styles.bpHeroUnit}>{c.unit}</span>}</div>
          {c.delta && <div className={styles.bpHeroDelta} style={{ color: c.deltaColor }}>{c.delta}</div>}
          <div className={styles.bpHeroLabel}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Photo Grid ──

function PhotoGrid({
  bilans, photoHistory, onOpenPhoto, onLoadPhotos,
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
  useEffect(() => { if (photoBilans.length > 0 && !hasLoadedPhotos) onLoadPhotos() }, [photoBilans.length, hasLoadedPhotos, onLoadPhotos])

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
            <i className="fas fa-camera" />
          </div>
          Evolution photos
        </div>
        {photoBilans.length > 0 && <span className={styles.bpSectionBadge}>{photoBilans.length} date{photoBilans.length > 1 ? 's' : ''}</span>}
      </div>
      {photoBilans.length === 0 ? (
        <div className={styles.bpEmpty}>Aucune photo de bilan</div>
      ) : (
        <div className={styles.bpPhotoGrid}>
          {photoBilans.map((b, idx) => {
            const urls = urlsByDate[b.date]
            const isFirst = idx === photoBilans.length - 1
            const isLast = idx === 0
            return (
              <div key={b.date} className={styles.bpPhotoRow}>
                <div className={styles.bpPhotoRowLeft}>
                  <div className={styles.bpPhotoRowDate}>{formatMedium(b.date)}</div>
                  {isFirst && photoBilans.length > 1 && <span className={`${styles.bpPhotoRowBadge} ${styles.bpPhotoRowBadgeFirst}`}>Debut</span>}
                  {isLast && photoBilans.length > 1 && <span className={`${styles.bpPhotoRowBadge} ${styles.bpPhotoRowBadgeLast}`}>Dernier</span>}
                </div>
                <div className={styles.bpPhotoRowImages}>
                  {(['front', 'side', 'back'] as PhotoType[]).map(pos => {
                    const url = urls?.[pos]
                    const hasRaw = !!b[`photo_${pos}`]
                    if (!hasRaw) return null
                    return (
                      <div key={pos} className={styles.bpPhotoImgWrap} onClick={() => onOpenPhoto(pos, b.date)}>
                        {url ? <img src={url} alt={`${pos} ${b.date}`} /> : (
                          <div className={styles.bpPhotoPlaceholder}>
                            <i className="fas fa-spinner fa-spin" style={{ fontSize: 14, color: 'var(--text3)' }} />
                          </div>
                        )}
                        <div className={styles.bpPhotoOverlay}>{pos === 'front' ? 'Face' : pos === 'side' ? 'Profil' : 'Dos'}</div>
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

// ── Weight Chart ──

function WeightChart({ data }: { data: { date: string; value: number }[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  if (data.length < 2) {
    return (
      <div className={styles.bpSection}>
        <div className={styles.bpSectionHeader}>
          <div className={styles.bpSectionTitle}>
            <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(179,8,8,0.12)', color: '#B30808' }}><i className="fas fa-weight-scale" /></div>
            Poids
          </div>
        </div>
        <div className={styles.bpEmpty}>Pas assez de donnees poids</div>
      </div>
    )
  }
  const W = 600, H = 220, PAD = { top: 24, bottom: 32, left: 48, right: 16 }
  const values = data.map(d => d.value)
  const min = Math.min(...values) - 0.5, max = Math.max(...values) + 0.5, range = max - min || 1
  const plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom
  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * plotW,
    y: PAD.top + plotH - ((d.value - min) / range) * plotH, ...d,
  }))
  const lineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const fillStr = lineStr + ` ${points[points.length - 1].x.toFixed(1)},${PAD.top + plotH} ${points[0].x.toFixed(1)},${PAD.top + plotH}`
  const step = range > 6 ? Math.ceil(range / 4) : range > 2 ? 1 : 0.5
  const yLabels: { y: number; val: string }[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) yLabels.push({ y: PAD.top + plotH - ((v - min) / range) * plotH, val: v.toFixed(1) })
  const xIndices = [...new Set([0, Math.floor(data.length / 2), data.length - 1])]
  const xLabels = xIndices.map(i => ({ x: points[i].x, label: formatShort(points[i].date) }))
  const last = points[points.length - 1], first = points[0]
  const delta = last.value - first.value, deltaStr = (delta > 0 ? '+' : '') + delta.toFixed(1)
  const minW = Math.min(...values), maxW = Math.max(...values), avgW = values.reduce((a, b) => a + b, 0) / values.length

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const wrap = wrapRef.current; if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const ch = wrap.querySelector<HTMLDivElement>('[data-crosshair]')
    const tt = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (!ch || !tt) return
    const mouseX = (e.clientX - rect.left) / rect.width
    let nearest = points[0], minDist = Infinity
    for (const pt of points) { const dist = Math.abs(pt.x / W - mouseX); if (dist < minDist) { minDist = dist; nearest = pt } }
    const leftPx = (nearest.x / W) * rect.width
    ch.style.left = leftPx + 'px'; ch.style.display = 'block'
    const d = new Date(nearest.date + 'T00:00:00')
    tt.textContent = `${nearest.value.toFixed(1)} kg \u2014 ${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`
    tt.style.display = 'block'; tt.style.left = Math.min(Math.max(leftPx, 60), rect.width - 60) + 'px'
  }, [points])
  const handleMouseLeave = useCallback(() => {
    const wrap = wrapRef.current; if (!wrap) return
    const ch = wrap.querySelector<HTMLDivElement>('[data-crosshair]'); const tt = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (ch) ch.style.display = 'none'; if (tt) tt.style.display = 'none'
  }, [])

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(179,8,8,0.12)', color: '#B30808' }}><i className="fas fa-weight-scale" /></div>
          Poids
        </div>
        <div className={styles.bpChartValues}>
          <span className={styles.bpChartCurrent}>{last.value.toFixed(1)}<span className={styles.bpChartUnit}> kg</span></span>
          <span className={styles.bpChartDelta} style={{ color: delta <= 0 ? 'var(--success)' : 'var(--warning)' }}>{deltaStr} kg</span>
        </div>
      </div>
      <div ref={wrapRef} className={styles.bpChartWrap} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.bpSvg}>
          <defs>
            <linearGradient id="bp_wg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B30808" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#B30808" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {yLabels.map((yl, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={yl.y} x2={W - PAD.right} y2={yl.y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              <text x={PAD.left - 8} y={yl.y} fill="var(--text3)" fontSize={10} textAnchor="end" dominantBaseline="middle">{yl.val}</text>
            </g>
          ))}
          <polygon points={fillStr} fill="url(#bp_wg)" />
          <polyline points={lineStr} fill="none" stroke="#B30808" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y}
              r={i === points.length - 1 ? 5.5 : 2.5}
              fill={i === points.length - 1 ? '#B30808' : 'rgba(179,8,8,0.5)'}
              stroke={i === points.length - 1 ? 'var(--bg)' : 'none'}
              strokeWidth={i === points.length - 1 ? 2.5 : 0}
              style={i === points.length - 1 ? { filter: 'drop-shadow(0 0 8px rgba(179,8,8,0.6))' } : undefined}
            />
          ))}
          {xLabels.map((xl, i) => <text key={i} x={xl.x} y={H - 6} fill="var(--text3)" fontSize={10} textAnchor="middle">{xl.label}</text>)}
        </svg>
        <div data-crosshair className={styles.bpCrosshair} />
        <div data-tooltip className={styles.bpTooltip} />
      </div>
      <div className={styles.bpWeightStats}>
        <span className={styles.bpWeightStatPill}><i className="fas fa-arrow-down" style={{ color: 'var(--success)' }} /> Min <strong>{minW.toFixed(1)} kg</strong></span>
        <span className={styles.bpWeightStatPill}><i className="fas fa-minus" style={{ color: 'var(--text3)' }} /> Moy <strong>{avgW.toFixed(1)} kg</strong></span>
        <span className={styles.bpWeightStatPill}><i className="fas fa-arrow-up" style={{ color: 'var(--warning)' }} /> Max <strong>{maxW.toFixed(1)} kg</strong></span>
      </div>
    </div>
  )
}

// ── Metric Sparkline Rows ──

const METRICS: { key: string; label: string; icon: string; color: string; inverted?: boolean }[] = [
  { key: 'energy', label: 'Energie', icon: 'fa-bolt', color: '#f59e0b' },
  { key: 'sleep_quality', label: 'Sommeil', icon: 'fa-moon', color: '#818cf8' },
  { key: 'stress', label: 'Stress', icon: 'fa-face-grimace', color: '#ef4444', inverted: true },
  { key: 'soreness', label: 'Courb.', icon: 'fa-dumbbell', color: '#f97316', inverted: true },
  { key: 'adherence', label: 'Adherence', icon: 'fa-circle-check', color: '#22c55e' },
  { key: 'session_enjoyment', label: 'Plaisir', icon: 'fa-heart', color: '#ec4899' },
]

function weeklyAvgSeries(bilans: DailyReport[], field: string): { date: string; value: number; label: string }[] {
  const weeks = groupByWeek(bilans)
  return weeks
    .map(w => {
      const vals = w.entries.map(b => parseFloat(String(b[field] ?? ''))).filter(v => !isNaN(v))
      if (!vals.length) return null
      const a = vals.reduce((s, v) => s + v, 0) / vals.length
      return { date: w.weekStart, value: parseFloat(a.toFixed(1)), label: formatShort(w.weekStart) }
    })
    .filter(Boolean)
    .reverse() as { date: string; value: number; label: string }[]
}

function MetricSparkline({ points, color, uid }: { points: { value: number }[]; color: string; uid: string }) {
  const vals = points.map(p => p.value)
  const vMin = Math.min(...vals) - 0.5, vMax = Math.max(...vals) + 0.5
  const range = vMax - vMin || 1
  const W = 400, H = 36, px = 4, py = 4
  const plotW = W - px * 2, plotH = H - py * 2

  const pts = vals.map((v, i) => {
    const x = px + (i / Math.max(vals.length - 1, 1)) * plotW
    const y = py + plotH - ((v - vMin) / range) * plotH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const lineStr = pts.join(' ')
  const fillStr = lineStr + ` ${(px + plotW).toFixed(1)},${(py + plotH).toFixed(1)} ${px.toFixed(1)},${(py + plotH).toFixed(1)}`
  const lastPt = pts[pts.length - 1].split(',')

  return (
    <div className={styles.bpMetricRowChart}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 36 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`mg_${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={fillStr} fill={`url(#mg_${uid})`} />
        <polyline points={lineStr} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={lastPt[0]} cy={lastPt[1]} r={3.5} fill={color} stroke="#111114" strokeWidth={1.5} />
      </svg>
    </div>
  )
}

function MetricRows({ bilans }: { bilans: DailyReport[] }) {
  const rows = useMemo(() => {
    return METRICS.map(m => {
      const series = weeklyAvgSeries(bilans, m.key)
      if (series.length < 2) return null
      const lastVal = series[series.length - 1].value
      const firstVal = series[0].value
      const diff = parseFloat((lastVal - firstVal).toFixed(1))
      const diffColor = m.inverted
        ? (diff <= 0 ? 'var(--success)' : 'var(--danger)')
        : (diff >= 0 ? 'var(--success)' : 'var(--danger)')
      return { ...m, series, lastVal, diff, diffColor }
    }).filter(Boolean) as (typeof METRICS[0] & { series: { value: number }[]; lastVal: number; diff: number; diffColor: string })[]
  }, [bilans])

  if (!rows.length) return null

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8' }}>
            <i className="fas fa-chart-line" />
          </div>
          Bien-etre
        </div>
        <span className={styles.bpSectionBadge}>moyennes hebdo</span>
      </div>
      <div className={styles.bpMetricRows}>
        {rows.map(r => (
          <div key={r.key} className={styles.bpMetricRow}>
            <div className={styles.bpMetricRowIcon} style={{ background: r.color + '1a', color: r.color }}>
              <i className={`fas ${r.icon}`} />
            </div>
            <div className={styles.bpMetricRowLabel}>{r.label}</div>
            <MetricSparkline points={r.series} color={r.color} uid={r.key} />
            <div className={styles.bpMetricRowValues}>
              <span className={styles.bpMetricRowCurrent} style={{ color: r.color }}>{r.lastVal.toFixed(1)}</span>
              <span className={styles.bpMetricRowDelta} style={{ color: r.diffColor }}>
                {r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──

interface BilanProgressViewProps {
  bilans: DailyReport[]
  photoHistory: Record<PhotoType, PhotoEntry[]>
  onOpenPhoto: (type: PhotoType, date: string) => void
  onLoadPhotos: () => void
}

export default function BilanProgressView({ bilans, photoHistory, onOpenPhoto, onLoadPhotos }: BilanProgressViewProps) {
  const sorted = useMemo(() => [...bilans].sort((a, b) => a.date.localeCompare(b.date)), [bilans])
  const weightSeries = useMemo(() => extractSeries(sorted, 'weight'), [sorted])
  const latestDate = sorted.length > 0 ? sorted[sorted.length - 1].date : ''
  const hasMens = sorted.some(b => b.belly_measurement || b.hip_measurement || b.thigh_measurement)

  return (
    <div className={styles.bpContainer}>
      <TransformationHero bilans={sorted} photoHistory={photoHistory} onOpenPhoto={onOpenPhoto} onLoadPhotos={onLoadPhotos} />
      <HeroStrip bilans={sorted} />

      <div className={styles.bpTwoCol}>
        <WeightChart data={weightSeries} />
        {hasMens ? (
          <div className={styles.bpSection}>
            <div className={styles.bpSectionHeader}>
              <div className={styles.bpSectionTitle}>
                <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(232,93,4,0.12)', color: '#E85D04' }}><i className="fas fa-ruler" /></div>
                Mensurations
              </div>
            </div>
            <div className={styles.bpMensWrap}><MensurationCharts bilans={sorted} upToDate={latestDate} suffix="progress" /></div>
          </div>
        ) : <div />}
      </div>

      <MetricRows bilans={sorted} />
    </div>
  )
}
