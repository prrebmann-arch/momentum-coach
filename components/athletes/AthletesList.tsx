'use client'

import { useState, useMemo, useEffect, memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import NotificationBell from '@/components/layout/NotificationBell'
import { useAthleteContext } from '@/contexts/AthleteContext'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import AddAthleteForm from './AddAthleteForm'
import Modal from '@/components/ui/Modal'
import { computeUrgency, todayIso } from '@/lib/onboarding'
import styles from '@/styles/athletes.module.css'
import type { Athlete } from '@/lib/types'

import { PROG_PHASES } from '@/lib/constants'

type SortMode = 'created' | 'urgency' | 'alpha'

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: '#22c55e' },
  pending: { label: 'En attente', color: '#f59e0b' },
  past_due: { label: 'Impaye', color: '#ef4444' },
  canceled: { label: 'Annule', color: '#ef4444' },
  completed: { label: 'Termine', color: '#6366f1' },
  free: { label: 'Gratuit', color: '#22c55e' },
}

function getPaymentBadge(athlete: Athlete) {
  const plan = athlete._payment
  if (!plan) return { label: 'Gratuit', color: '#22c55e' }
  if (plan.is_free) return { label: 'Gratuit', color: '#22c55e' }
  return PAYMENT_STATUS_MAP[plan.payment_status] || { label: 'En attente', color: '#f59e0b' }
}

// Ligne d'action compacte (remplace le gros badge) : même code couleur.
const ACTION_LOOK = {
  overdue: { word: 'En retard', icon: 'fa-triangle-exclamation', cls: 'actionOverdue' },
  today: { word: "Aujourd'hui", icon: 'fa-bolt', cls: 'actionOverdue' },
  imminent: { word: 'À faire', icon: 'fa-circle-exclamation', cls: 'actionSoon' },
  soon: { word: 'Prochaine action', icon: 'fa-circle-arrow-right', cls: 'actionLater' },
  later: { word: 'Prochaine action', icon: 'fa-circle-arrow-right', cls: 'actionLater' },
  far: { word: 'Prochaine action', icon: 'fa-circle-arrow-right', cls: 'actionLater' },
} as const

const AthleteCard = memo(function AthleteCard({ athlete, href }: { athlete: Athlete; href: string }) {
  const nextStep = athlete._nextStep
  const urgentCount = athlete._urgentCount || 0
  const extraCount = urgentCount > 1 ? urgentCount - 1 : 0
  const initials = (athlete.prenom?.charAt(0) || '') + (athlete.nom?.charAt(0) || '')
  const activePhase = athlete._phase
  const phaseInfo = activePhase?.phase ? (PROG_PHASES as Record<string, { label: string; short: string; color: string }>)[activePhase.phase] : null
  const phaseLabel = phaseInfo ? phaseInfo.label : (activePhase?.name || '')
  const phaseColor = phaseInfo ? phaseInfo.color : 'var(--primary)'
  const payBadge = getPaymentBadge(athlete)
  // « Gratuit » sur chaque carte = bruit : on n'affiche le paiement que s'il
  // y a quelque chose à savoir (payé, en attente, impayé, annulé…).
  const showPay = payBadge.label !== 'Gratuit'
  const urgency = nextStep ? computeUrgency(nextStep.scheduled_date, todayIso()) : null
  const action = urgency ? ACTION_LOOK[urgency.level] : null

  const topBarStyle = useMemo(() => ({
    background: phaseInfo ? phaseColor : 'var(--border)',
    opacity: phaseInfo ? 0.8 : 0.3,
  }), [phaseInfo, phaseColor])

  const phaseBadgeStyle = useMemo(() => phaseLabel ? { color: phaseColor, background: `${phaseColor}18` } : undefined, [phaseLabel, phaseColor])
  const payBadgeStyle = useMemo(() => ({ color: payBadge.color, background: `${payBadge.color}18` }), [payBadge.color])

  return (
    <Link href={href} className={styles.athleteCard} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className={styles.cardTopBar} style={topBarStyle} />
      <div className={styles.cardHead}>
        {athlete.avatar_url ? (
          <Image src={athlete.avatar_url} alt="" width={44} height={44} unoptimized style={{ objectFit: 'cover' }} className={styles.cardAvatar} />
        ) : (
          <div className={styles.cardAvatarFallback}>{initials}</div>
        )}
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>
            {athlete.prenom} {athlete.nom}
          </div>
          <div className={styles.cardEmail}>{athlete.email || ''}</div>
        </div>
        {phaseLabel && (
          <span className={styles.phaseBadge} style={phaseBadgeStyle}>
            {phaseLabel}
          </span>
        )}
      </div>

      {nextStep && action && urgency && (
        <div className={`${styles.cardAction} ${styles[action.cls]}`} title={`${nextStep.title} (${nextStep.scheduled_date})`}>
          <i className={`fa-solid ${action.icon}`} />
          <span className={styles.cardActionWord}>{action.word}</span>
          <span className={styles.cardActionSep}>·</span>
          <span className={styles.cardActionDay}>{urgency.label}</span>
          <span className={styles.cardActionTitle}>{nextStep.title}</span>
          {extraCount > 0 && <span className={styles.cardActionExtra}>+{extraCount}</span>}
        </div>
      )}

      <div className={styles.cardFooter}>
        <span className={styles.cardWeight}>
          <i className="fa-solid fa-weight-scale" />
          {athlete.poids_actuel ? `${athlete.poids_actuel} kg` : '\u2014'}
        </span>
        {showPay && (
          <span className={styles.phaseBadge} style={payBadgeStyle}>
            {payBadge.label}
          </span>
        )}
      </div>
    </Link>
  )
})

function urgencyRank(a: Athlete): number {
  // Lower = more urgent (sort ascending). No step → very high number.
  const s = a._nextStep
  if (!s) return 1_000_000
  const u = computeUrgency(s.scheduled_date, todayIso())
  const order: Record<typeof u.level, number> = {
    overdue: 0,
    today: 1,
    imminent: 2,
    soon: 3,
    later: 4,
    far: 5,
  }
  return order[u.level] * 1000 + new Date(s.scheduled_date).getTime() / 1_000_000
}

export default function AthletesList() {
  const { athletes, loading } = useAthleteContext()
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [credentialsMessage, setCredentialsMessage] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('created')
  const [showPaused, setShowPaused] = useState(false)

  // Persist sort mode in localStorage (read in effect, lessons #418 hydration)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('athletes:sort') as SortMode | null
      if (stored === 'urgency' || stored === 'alpha' || stored === 'created') {
        setSortMode(stored)
      }
    } catch {
      /* noop */
    }
  }, [])
  const handleSortChange = (next: SortMode) => {
    setSortMode(next)
    try { window.localStorage.setItem('athletes:sort', next) } catch { /* noop */ }
  }

  const { activeAthletes, pausedAthletes } = useMemo(() => {
    let list = athletes
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (a) =>
          a.prenom?.toLowerCase().includes(q) ||
          a.nom?.toLowerCase().includes(q) ||
          a.email?.toLowerCase().includes(q)
      )
    }
    const active = list.filter((a) => a.access_mode !== 'paused')
    const paused = list.filter((a) => a.access_mode === 'paused')
    if (sortMode === 'urgency') {
      active.sort((a, b) => urgencyRank(a) - urgencyRank(b))
    } else if (sortMode === 'alpha') {
      active.sort((a, b) => (a.prenom || '').localeCompare(b.prenom || ''))
      paused.sort((a, b) => (a.prenom || '').localeCompare(b.prenom || ''))
    }
    return { activeAthletes: active, pausedAthletes: paused }
  }, [athletes, search, sortMode])

  if (loading) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Athletes</h1>
        </div>
        <div className={styles.athleteGrid}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={180} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          Athletes
          <span className={styles.countLabel}>
            {activeAthletes.length} athlete{activeAthletes.length > 1 ? 's' : ''} actif{activeAthletes.length > 1 ? 's' : ''}
          </span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-red" onClick={() => setShowAddModal(true)}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
            Ajouter un athlete
          </button>
          <NotificationBell />
        </div>
      </div>

      <div className={styles.searchBar} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className={styles.searchWrap} style={{ flex: 1, minWidth: 200 }}>
          <i className={`fa-solid fa-search ${styles.searchIcon}`} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Rechercher un athlete..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={sortMode}
          onChange={(e) => handleSortChange(e.target.value as SortMode)}
          aria-label="Tri"
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '8px 10px',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <option value="created">Tri: récents</option>
          <option value="urgency">Tri: urgence onboarding</option>
          <option value="alpha">Tri: alphabétique</option>
        </select>
      </div>

      {activeAthletes.length === 0 && pausedAthletes.length === 0 ? (
        <EmptyState
          icon="fa-solid fa-users"
          message={search ? 'Aucun athlete trouve' : 'Aucun athlete'}
          action={
            !search ? (
              <button className="btn btn-red" onClick={() => setShowAddModal(true)}>
                <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
                Ajouter un athlete
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {activeAthletes.length > 0 && (
            <div className={styles.athleteGrid}>
              {activeAthletes.map((athlete) => (
                <AthleteCard
                  key={athlete.id}
                  athlete={athlete}
                  href={`/athletes/${athlete.id}/apercu`}
                />
              ))}
            </div>
          )}
          {activeAthletes.length === 0 && !search && (
            <EmptyState icon="fa-solid fa-users" message="Aucun athlete actif" />
          )}

          {pausedAthletes.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <button
                onClick={() => setShowPaused((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '4px 0', marginBottom: 12 }}
              >
                <i className={`fa-solid fa-chevron-${showPaused ? 'down' : 'right'}`} style={{ fontSize: 11 }} />
                Anciens athlètes ({pausedAthletes.length})
              </button>
              {showPaused && (
                <div className={styles.athleteGrid} style={{ opacity: 0.6 }}>
                  {pausedAthletes.map((athlete) => (
                    <AthleteCard
                      key={athlete.id}
                      athlete={athlete}
                      href={`/athletes/${athlete.id}/apercu`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <AddAthleteForm
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={(msg) => setCredentialsMessage(msg)}
      />

      <Modal
        isOpen={!!credentialsMessage}
        onClose={() => setCredentialsMessage(null)}
        title="Message WhatsApp"
      >
        <div style={{ padding: 20, background: 'var(--bg3)', borderRadius: 10, margin: 16, fontFamily: 'monospace', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid var(--border)' }}>
          {credentialsMessage}
        </div>
        <div style={{ padding: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-red" onClick={async () => {
            if (credentialsMessage) {
              try { await navigator.clipboard.writeText(credentialsMessage); } catch {}
            }
          }}>
            Copier le message
          </button>
          <button className="btn btn-outline" onClick={() => setCredentialsMessage(null)}>
            Fermer
          </button>
        </div>
      </Modal>
    </div>
  )
}
