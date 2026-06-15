'use client'

import { memo } from 'react'
import { computeUrgency, STEP_TYPE_META, todayIso, type OnboardingStepType } from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'

interface OnboardingStepBadgeProps {
  scheduledDate: string
  type: OnboardingStepType
  title: string
  /** Optional second count to show as a small pill (e.g. "+2") */
  extraCount?: number
  onClick?: (e: React.MouseEvent) => void
}

// Per-urgency visual config: word + size class + colors (override the soft computed bg/color for high-urgency levels).
function getBadgeLook(level: 'overdue' | 'today' | 'imminent' | 'soon' | 'later' | 'far') {
  switch (level) {
    case 'overdue':
      return {
        word: 'EN RETARD',
        sizeClass: styles.badgeXL,
        bg: '#dc2626', // strong red
        color: 'white',
        ring: '0 0 0 2px rgba(220, 38, 38, 0.35), 0 4px 14px rgba(220, 38, 38, 0.45)',
        icon: 'fa-triangle-exclamation',
      }
    case 'today':
      return {
        word: "AUJOURD'HUI",
        sizeClass: styles.badgeXL,
        bg: '#ef4444',
        color: 'white',
        ring: '0 0 0 2px rgba(239, 68, 68, 0.3), 0 4px 14px rgba(239, 68, 68, 0.4)',
        icon: 'fa-bolt',
      }
    case 'imminent':
      return {
        word: 'À FAIRE',
        sizeClass: styles.badgeL,
        bg: '#f97316', // orange
        color: 'white',
        ring: '0 0 0 1px rgba(249, 115, 22, 0.25), 0 2px 8px rgba(249, 115, 22, 0.35)',
        icon: 'fa-circle-exclamation',
      }
    case 'soon':
      return {
        word: 'PROCHAINE ACTION',
        sizeClass: styles.badgeM,
        bg: 'rgba(234, 179, 8, 0.18)',
        color: '#eab308',
        ring: 'none',
        icon: 'fa-clock',
      }
    case 'later':
      return {
        word: 'PROCHAINE ACTION',
        sizeClass: styles.badgeM,
        bg: 'rgba(132, 204, 22, 0.18)',
        color: '#84cc16',
        ring: 'none',
        icon: 'fa-clock',
      }
    case 'far':
      return {
        word: 'PROCHAINE ACTION',
        sizeClass: styles.badgeM,
        bg: 'rgba(148, 163, 184, 0.15)',
        color: 'var(--text2)',
        ring: 'none',
        icon: 'fa-calendar',
      }
    default:
      return null
  }
}

function OnboardingStepBadgeImpl({
  scheduledDate,
  type,
  title,
  extraCount,
  onClick,
}: OnboardingStepBadgeProps) {
  const today = todayIso()
  const urgency = computeUrgency(scheduledDate, today)

  const look = getBadgeLook(urgency.level)
  if (!look) return null

  const meta = STEP_TYPE_META[type]
  const handleClick = onClick
    ? (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        onClick(e)
      }
    : undefined

  const isHighUrgency =
    urgency.level === 'overdue' || urgency.level === 'today' || urgency.level === 'imminent'

  return (
    <span
      className={`${styles.badge} ${look.sizeClass} ${urgency.level === 'overdue' ? styles.badgeOverdue : ''}`}
      style={{
        color: look.color,
        background: look.bg,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: look.ring,
      }}
      onClick={handleClick}
      title={`${meta.label} · ${title} (${scheduledDate})`}
    >
      <i className={`fa-solid ${look.icon}`} />
      {look.word && <span className={styles.badgeWord}>{look.word}</span>}
      <span className={styles.badgeSep}>·</span>
      <span className={styles.badgeDay}>{urgency.label}</span>
      <span className={styles.badgeTitle}>{title}</span>
      {extraCount && extraCount > 0 ? (
        <span className={styles.badgeExtra}>+{extraCount}</span>
      ) : null}
      {isHighUrgency && <span className={styles.badgePulseDot} />}
    </span>
  )
}

export default memo(OnboardingStepBadgeImpl)
