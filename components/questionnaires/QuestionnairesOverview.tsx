'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import { Q_TYPES, QuestionRow } from '@/components/questionnaires/QuestionnaireAnswer'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'

/* eslint-disable @typescript-eslint/no-explicit-any */

type FilterKey = 'all' | 'completed' | 'pending'

const MAX_ASSIGNMENTS_LOAD = 200

export default function QuestionnairesOverview() {
  const supabase = createClient()
  const { user } = useAuth()
  const { athletes, loading: athletesLoading } = useAthleteContext()

  const [assignments, setAssignments] = useState<any[]>([])
  const [responsesMap, setResponsesMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const athleteMap = useMemo(() => {
    const m: Record<string, { prenom: string; nom: string }> = {}
    athletes.forEach((a) => { m[a.id] = { prenom: a.prenom || '', nom: a.nom || '' } })
    return m
  }, [athletes])

  const loadData = useCallback(async () => {
    if (!user) return
    const athleteIds = athletes.map((a) => a.id)
    if (!assignments.length) setLoading(true)
    try {
      if (!athleteIds.length) {
        setAssignments([])
        setResponsesMap({})
        return
      }
      const { data: assigns } = await supabase
        .from('questionnaire_assignments')
        .select('*, questionnaire_templates(titre)')
        .in('athlete_id', athleteIds)
        .order('sent_at', { ascending: false })
        .limit(MAX_ASSIGNMENTS_LOAD)

      const assignsData = assigns || []
      const completedIds = assignsData.filter((a: any) => a.status === 'completed').map((a: any) => a.id)
      const rmap: Record<string, any> = {}
      if (completedIds.length > 0) {
        const { data: responses } = await supabase
          .from('questionnaire_responses')
          .select('id, assignment_id, responses, submitted_at')
          .in('assignment_id', completedIds)
        ;(responses || []).forEach((r: any) => { rmap[r.assignment_id] = r })
      }

      setAssignments(assignsData)
      setResponsesMap(rmap)
    } finally {
      setLoading(false)
    }
  }, [user?.id, athletes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!athletesLoading && athletes.length) loadData()
  }, [athletesLoading, athletes, loadData])

  useRefetchOnResume(loadData, loading)

  function toggleDetail(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    let list = assignments
    if (filter === 'completed') list = list.filter((a: any) => a.status === 'completed')
    if (filter === 'pending') list = list.filter((a: any) => a.status === 'pending')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a: any) => {
        const name = `${athleteMap[a.athlete_id]?.prenom || ''} ${athleteMap[a.athlete_id]?.nom || ''}`.toLowerCase()
        return name.includes(q)
      })
    }
    return list
  }, [assignments, filter, search, athleteMap])

  const counts = useMemo(() => {
    const c = { all: assignments.length, completed: 0, pending: 0 }
    assignments.forEach((a: any) => {
      if (a.status === 'completed') c.completed++
      else if (a.status === 'pending') c.pending++
    })
    return c
  }, [assignments])

  if (athletesLoading || loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <Skeleton width={200} height={28} />
          <Skeleton width={300} height={16} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} width={100} height={36} />)}
        </div>
        <Skeleton height={300} />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Questionnaires</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['all', 'completed', 'pending'] as FilterKey[]).map((f) => {
          const label = f === 'all' ? 'Tous' : f === 'completed' ? 'Complétés' : 'En attente'
          return (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-red' : 'btn-outline'}`}
              onClick={() => setFilter(f)}
            >
              {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{counts[f]}</span>
            </button>
          )
        })}
        <input
          type="text"
          className="form-control"
          style={{ marginLeft: 'auto', maxWidth: 240 }}
          placeholder="Rechercher un athlete..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!filtered.length ? (
        <EmptyState icon="fas fa-clipboard-list" message="Aucun questionnaire" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((a: any) => {
            const title = a.questionnaire_templates?.titre || '(Sans titre)'
            const athleteName = `${athleteMap[a.athlete_id]?.prenom || ''} ${athleteMap[a.athlete_id]?.nom || ''}`.trim() || 'Athlete inconnu'
            const isPending = a.status === 'pending'
            const isExpanded = expandedIds.has(a.id)
            const resp = responsesMap[a.id]
            const questions = a.questions_snapshot || []
            const answers = resp ? (resp.responses || []) : []
            const accent = isPending ? '#f97316' : '#22c55e'
            const dateStr = new Date(isPending ? a.sent_at : (a.completed_at || a.sent_at)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

            return (
              <div
                key={a.id}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${accent}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => toggleDetail(a.id)}
                >
                  <i
                    className="fa-solid fa-chevron-right"
                    style={{ fontSize: 11, color: 'var(--text2)', transition: 'transform .2s', transform: isExpanded ? 'rotate(90deg)' : '', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <a
                        href={`/athletes/${a.athlete_id}/questionnaires`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)', textDecoration: 'none' }}
                      >
                        {athleteName}
                      </a>
                      <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text2)' }}>{title}</span>
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                          background: isPending ? 'rgba(249, 115, 22, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: accent, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5,
                          textTransform: 'uppercase', borderRadius: 999,
                        }}
                      >
                        <i className={`fa-solid ${isPending ? 'fa-clock' : 'fa-check'}`} style={{ fontSize: 9 }} />
                        {isPending ? 'En attente' : 'Complète'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                      <i className="fa-regular fa-calendar" style={{ marginRight: 6, opacity: 0.6 }} />
                      {isPending ? 'Envoyé le' : 'Répondu le'} {dateStr}
                      <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
                      {questions.length} question{questions.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '16px 18px 18px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {questions.map((q: any, qi: number) => {
                        const typeInfo = Q_TYPES.find((t) => t.value === q.type)
                        const ans = answers.find((r: any) => r.question_id === q.id)
                        return (
                          <QuestionRow
                            key={qi}
                            index={qi + 1}
                            question={q}
                            typeIcon={typeInfo?.icon || 'fa-question'}
                            answer={ans}
                            hasResponse={!!resp}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
