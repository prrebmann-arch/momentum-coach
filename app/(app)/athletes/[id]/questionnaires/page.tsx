'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { notifyAthlete } from '@/lib/push'
import { getPageCache, setPageCache } from '@/lib/utils'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'

/* eslint-disable @typescript-eslint/no-explicit-any */

const Q_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'text', label: 'Texte libre', icon: 'fa-align-left' },
  { value: 'choice', label: 'Choix multiples', icon: 'fa-list-ul' },
  { value: 'rating', label: 'Note (1-10)', icon: 'fa-star' },
  { value: 'yesno', label: 'Oui / Non', icon: 'fa-toggle-on' },
  { value: 'photo', label: 'Photo', icon: 'fa-image' },
]

const PHOTO_POSITIONS = [
  { value: 'front', label: 'Face' },
  { value: 'side', label: 'Profil' },
  { value: 'back', label: 'Dos' },
  { value: 'other', label: 'Autre' },
]

function isPhotoAnswer(answer: unknown): answer is string {
  if (typeof answer !== 'string' || !answer) return false
  // URL http(s) athlete-photos OU se terminant par une extension image (avec ou sans query)
  if (/^https?:\/\//.test(answer)) {
    return /athlete-photos/.test(answer) || /\.(jpe?g|png|webp)(\?.*)?$/i.test(answer)
  }
  // Path style {uuid}/{date}_{position}.jpg — pas d'espace, pas de retour ligne, finit par .ext
  return /^[\w-]+\/[\w._-]+\.(jpe?g|png|webp)$/i.test(answer)
}

function PhotoAnswer({ pathOrUrl }: { pathOrUrl: string }) {
  const supabase = createClient()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (/^https?:\/\//.test(pathOrUrl)) {
      setUrl(pathOrUrl)
      return
    }
    ;(async () => {
      const { data } = await supabase.storage
        .from('athlete-photos')
        .createSignedUrl(pathOrUrl, 60 * 60)
      if (!cancelled) setUrl(data?.signedUrl ?? null)
    })()
    return () => { cancelled = true }
  }, [pathOrUrl, supabase])

  if (!url) {
    return <span style={{ color: 'var(--text3)', fontSize: 12 }}>Chargement…</span>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="Photo" style={{ maxWidth: 200, maxHeight: 280, borderRadius: 8, border: '1px solid var(--border)' }} />
    </a>
  )
}

function formatAnswer(question: any, answer: any): string {
  if (answer == null) return '\u2014'
  if (question.type === 'yesno') return answer ? 'Oui' : 'Non'
  if (question.type === 'rating') return `${answer}/10`
  if (question.type === 'choice' && Array.isArray(answer)) return answer.join(', ')
  if (question.type === 'photo') return isPhotoAnswer(answer) ? 'Photo envoyée' : 'Pas de photo'
  return String(answer)
}

export default function QuestionnairesPage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const cacheKey = `athlete_${params.id}_questionnaires`
  const [cached] = useState(() => getPageCache<{ assignments: any[]; responsesMap: Record<string, any>; templates: any[] }>(cacheKey))

  const [loading, setLoading] = useState(!cached)
  const [assignments, setAssignments] = useState<any[]>(cached?.assignments ?? [])
  const [responsesMap, setResponsesMap] = useState<Record<string, any>>(cached?.responsesMap ?? {})
  const [templates, setTemplates] = useState<any[]>(cached?.templates ?? [])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [obligatoire, setObligatoire] = useState(false)
  const [sending, setSending] = useState(false)

  // Quick questionnaire state
  const [showQuick, setShowQuick] = useState(false)
  const [quickTitre, setQuickTitre] = useState('')
  const [quickQuestions, setQuickQuestions] = useState<any[]>([])
  const [quickObligatoire, setQuickObligatoire] = useState(false)

  const loadData = useCallback(async () => {
    if (!assignments.length) setLoading(true)
    try {
      const [{ data: assigns }, { data: tpls }] = await Promise.all([
        supabase
          .from('questionnaire_assignments')
          .select('*, questionnaire_templates(titre)')
          .eq('athlete_id', params.id)
          .order('sent_at', { ascending: false })
          .limit(100),
        supabase
          .from('questionnaire_templates')
          .select('id, titre, questions')
          .eq('coach_id', user?.id)
          .order('titre')
          .limit(100),
      ])

      const completedIds = (assigns || []).filter((a: any) => a.status === 'completed').map((a: any) => a.id)
      const rmap: Record<string, any> = {}
      if (completedIds.length > 0) {
        const { data: responses } = await supabase
          .from('questionnaire_responses')
          .select('id, assignment_id, responses, submitted_at')
          .in('assignment_id', completedIds)
        ;(responses || []).forEach((r: any) => { rmap[r.assignment_id] = r })
      }

      const assignsData = assigns || []
      const tplsData = tpls || []
      setAssignments(assignsData)
      setResponsesMap(rmap)
      setTemplates(tplsData)

      setPageCache(cacheKey, { assignments: assignsData, responsesMap: rmap, templates: tplsData })
    } finally {
      setLoading(false)
    }
  }, [params.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.id) loadData()
  }, [params.id, loadData])

  function toggleDetail(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function sendFromTemplate() {
    if (!selectedTemplate) { toast('Selectionnez un template', 'error'); return }
    setSending(true)

    const { data: tpl } = await supabase
      .from('questionnaire_templates')
      .select('titre, questions')
      .eq('id', selectedTemplate)
      .single()

    if (!tpl) { toast('Template introuvable', 'error'); setSending(false); return }

    const { error } = await supabase.from('questionnaire_assignments').insert({
      template_id: selectedTemplate,
      athlete_id: params.id,
      coach_id: user?.id,
      obligatoire,
      questions_snapshot: tpl.questions,
    })

    setSending(false)
    if (error) { toast('Erreur lors de l\'envoi', 'error'); return }

    // Notify (DB + push)
    const { data: ath } = await supabase.from('athletes').select('user_id').eq('id', params.id).single()
    if (ath?.user_id) {
      await notifyAthlete(
        ath.user_id, 'questionnaire', 'Nouveau questionnaire',
        `Votre coach vous a envoye un questionnaire : ${tpl.titre}`,
        { template_id: selectedTemplate },
      )
    }

    toast('Questionnaire envoye', 'success')
    setSelectedTemplate('')
    setObligatoire(false)
    loadData()
  }

  async function sendQuickQuestionnaire() {
    if (!quickTitre.trim()) { toast('Le titre est obligatoire', 'error'); return }
    if (!quickQuestions.length || !quickQuestions.some((q: any) => q.label.trim())) {
      toast('Ajoutez au moins une question', 'error'); return
    }
    setSending(true)

    const questions = quickQuestions.map((q: any) => ({
      ...q,
      id: q.id || crypto.randomUUID(),
    }))

    const { error } = await supabase.from('questionnaire_assignments').insert({
      template_id: null,
      athlete_id: params.id,
      coach_id: user?.id,
      obligatoire: quickObligatoire,
      questions_snapshot: questions,
    })

    setSending(false)
    if (error) { toast('Erreur', 'error'); return }

    const { data: ath2 } = await supabase.from('athletes').select('user_id').eq('id', params.id).single()
    if (ath2?.user_id) {
      await notifyAthlete(
        ath2.user_id, 'questionnaire', 'Nouveau questionnaire',
        `Votre coach vous a envoye un questionnaire : ${quickTitre.trim()}`,
      )
    }

    toast('Questionnaire envoye', 'success')
    setShowQuick(false)
    setQuickTitre(''); setQuickQuestions([]); setQuickObligatoire(false)
    loadData()
  }

  async function relance(id: string) {
    const { data: a } = await supabase
      .from('questionnaire_assignments')
      .select('*, questionnaire_templates(titre), athletes(user_id)')
      .eq('id', id).single()
    if (!a) return
    const userId = a.athletes?.user_id
    if (!userId) { toast('Pas de user_id', 'error'); return }
    await notifyAthlete(
      userId, 'rappel', 'Rappel questionnaire',
      `N'oubliez pas de remplir : ${a.questionnaire_templates?.titre || 'Questionnaire'}`,
    )
    toast('Rappel envoye', 'success')
  }

  async function deleteAssignment(id: string) {
    if (!confirm('Supprimer ce questionnaire envoye ?')) return
    const { error } = await supabase.from('questionnaire_assignments').delete().eq('id', id)
    if (error) { toast('Erreur', 'error'); return }
    toast('Questionnaire supprime', 'success')
    loadData()
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  // Quick questionnaire editor view
  if (showQuick) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Questionnaire rapide</h2>
          <button className="btn btn-outline" onClick={() => setShowQuick(false)}><i className="fas fa-arrow-left" /> Retour</button>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Titre *</label>
            <input type="text" className="form-control" value={quickTitre} onChange={(e) => setQuickTitre(e.target.value)} placeholder="Ex: Retour de vacances" />
          </div>

          <h3 style={{ fontSize: 15, margin: '20px 0 12px' }}>Questions</h3>
          {quickQuestions.map((q: any, i: number) => (
            <div key={i} style={{ background: 'var(--bg3, var(--bg2))', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: 'var(--text3)', fontSize: 13, minWidth: 24 }}>#{i + 1}</span>
                <input type="text" className="form-control" style={{ flex: 1 }} value={q.label} onChange={(e) => {
                  const nq = [...quickQuestions]; nq[i] = { ...nq[i], label: e.target.value }; setQuickQuestions(nq)
                }} placeholder="Texte de la question" />
                <select className="form-control" style={{ width: 160 }} value={q.type} onChange={(e) => {
                  const nq = [...quickQuestions]; nq[i] = { ...nq[i], type: e.target.value }; setQuickQuestions(nq)
                }}>
                  {Q_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => {
                  setQuickQuestions((prev) => prev.filter((_, j) => j !== i))
                }}><i className="fas fa-trash" /></button>
              </div>
              {q.type === 'choice' && (
                <textarea className="form-control" rows={3} placeholder="Option 1&#10;Option 2&#10;Option 3" value={(q.options || []).join('\n')} onChange={(e) => {
                  const nq = [...quickQuestions]; nq[i] = { ...nq[i], options: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean) }; setQuickQuestions(nq)
                }} />
              )}
              {q.type === 'photo' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)' }}>Position</label>
                  <select className="form-control" style={{ width: 140 }} value={q.position || 'front'} onChange={(e) => {
                    const nq = [...quickQuestions]; nq[i] = { ...nq[i], position: e.target.value }; setQuickQuestions(nq)
                  }}>
                    {PHOTO_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Face/Profil/Dos s&apos;ajouteront automatiquement à la page Bilans.</span>
                </div>
              )}
            </div>
          ))}
          <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => {
            setQuickQuestions((prev) => [...prev, { id: crypto.randomUUID(), label: '', type: 'text', options: [], required: false }])
          }}><i className="fas fa-plus" /> Ajouter une question</button>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={quickObligatoire} onChange={(e) => setQuickObligatoire(e.target.checked)} /> Rendre obligatoire
          </label>

          <div style={{ display: 'flex', gap: 12, marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button className="btn btn-red" onClick={sendQuickQuestionnaire} disabled={sending}>
              {sending ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
            </button>
            <button className="btn btn-outline" onClick={() => setShowQuick(false)}>Annuler</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Toolbar : Envoyer ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '14px 18px',
          background: 'linear-gradient(180deg, var(--bg3, var(--bg2)), var(--bg2))',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset, 0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>
          <i className="fa-solid fa-paper-plane" />
          Envoyer
        </div>
        {templates.length ? (
          <>
            <select
              className="form-control"
              style={{ minWidth: 220, flex: '0 1 280px' }}
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
            >
              <option value="">— Choisir un template —</option>
              {templates.map((t: any) => (
                <option key={t.id} value={t.id}>{t.titre} ({(t.questions || []).length}q)</option>
              ))}
            </select>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}>
              <input type="checkbox" checked={obligatoire} onChange={(e) => setObligatoire(e.target.checked)} />
              Obligatoire
            </label>
            <button className="btn btn-red btn-sm" onClick={sendFromTemplate} disabled={sending || !selectedTemplate}>
              {sending ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" style={{ marginRight: 6 }} />Envoyer</>}
            </button>
          </>
        ) : (
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>Aucun template. Créez-en un dans Templates.</span>
        )}
        <button
          className="btn btn-outline btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => { setShowQuick(true); setQuickQuestions([{ id: crypto.randomUUID(), label: '', type: 'text', options: [], required: false }]) }}
        >
          <i className="fas fa-bolt" style={{ marginRight: 6 }} />
          Questionnaire rapide
        </button>
      </div>

      {/* ── Section Historique ── */}
      <div
        style={{
          background: 'linear-gradient(180deg, var(--bg2), var(--bg))',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '20px 24px 24px 24px',
          boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 18,
            paddingBottom: 14,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            <i className="fa-solid fa-clipboard-list" style={{ color: 'var(--text2)' }} />
            Historique
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'var(--bg3)',
                color: 'var(--text2)',
                letterSpacing: 0.3,
              }}
            >
              {assignments.length} envoyé{assignments.length > 1 ? 's' : ''}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Clique sur un questionnaire pour voir le détail</span>
        </div>

        {!assignments.length ? (
          <EmptyState icon="fas fa-clipboard-list" message="Aucun questionnaire envoyé" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {assignments.map((a: any) => {
              const title = a.questionnaire_templates?.titre || '(Sans titre)'
              const sentDate = new Date(a.sent_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
              const isPending = a.status === 'pending'
              const isExpanded = expandedIds.has(a.id)
              const resp = responsesMap[a.id]
              const questions = a.questions_snapshot || []
              const answers = resp ? (resp.responses || []) : []
              const accent = isPending ? '#f97316' : '#22c55e'

              return (
                <div
                  key={a.id}
                  style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${accent}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    transition: 'border-color .15s ease, box-shadow .15s ease',
                    boxShadow: isExpanded ? '0 4px 18px rgba(0,0,0,0.25)' : undefined,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleDetail(a.id)}
                  >
                    <i
                      className="fa-solid fa-chevron-right"
                      style={{
                        fontSize: 11,
                        color: 'var(--text2)',
                        transition: 'transform .2s',
                        transform: isExpanded ? 'rotate(90deg)' : '',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{title}</span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 9px',
                            background: isPending ? 'rgba(249, 115, 22, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: accent,
                            fontSize: 10.5,
                            fontWeight: 800,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                            borderRadius: 999,
                          }}
                        >
                          <i className={`fa-solid ${isPending ? 'fa-clock' : 'fa-check'}`} style={{ fontSize: 9 }} />
                          {isPending
                            ? 'En attente'
                            : `Complète${a.completed_at ? ' · ' + new Date(a.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}`}
                        </span>
                        {a.obligatoire && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 9px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              fontSize: 10.5,
                              fontWeight: 800,
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                              borderRadius: 999,
                            }}
                          >
                            <i className="fa-solid fa-exclamation" style={{ fontSize: 9 }} />
                            Obligatoire
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                        <i className="fa-regular fa-calendar" style={{ marginRight: 6, opacity: 0.6 }} />
                        Envoyé le {sentDate}
                        <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
                        {questions.length} question{questions.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isPending && (
                        <button className="btn btn-outline btn-sm" onClick={() => relance(a.id)}>
                          <i className="fas fa-bell" style={{ marginRight: 4 }} />
                          Relancer
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
                        onClick={() => deleteAssignment(a.id)}
                        aria-label="Supprimer"
                        title="Supprimer"
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        padding: '16px 18px 18px 18px',
                        borderTop: '1px solid var(--border)',
                        background: 'var(--bg)',
                      }}
                    >
                      {resp ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 12px',
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#22c55e',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                            marginBottom: 14,
                          }}
                        >
                          <i className="fa-solid fa-circle-check" />
                          Réponses reçues
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 12px',
                            background: 'rgba(249, 115, 22, 0.15)',
                            color: '#f97316',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                            marginBottom: 14,
                          }}
                        >
                          <i className="fa-solid fa-clock" />
                          Aperçu des questions (en attente)
                        </div>
                      )}

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
    </div>
  )
}

// ── Question + answer row (used inside expanded assignment cards) ──
function QuestionRow({
  index,
  question,
  typeIcon,
  answer,
  hasResponse,
}: {
  index: number
  question: any
  typeIcon: string
  answer: any | undefined
  hasResponse: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr',
        gap: 12,
        padding: '12px 14px',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'var(--bg3)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: 'var(--text2)',
          fontWeight: 800,
          fontSize: 13,
          position: 'relative',
        }}
        title={`Question #${index}`}
      >
        {index}
        <i
          className={`fa-solid ${typeIcon}`}
          style={{
            position: 'absolute',
            bottom: -6,
            right: -6,
            fontSize: 9,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            width: 16,
            height: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text2)',
          }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.4,
            marginBottom: hasResponse ? 8 : 0,
          }}
        >
          {question.label || '(sans label)'}
          {question.required && (
            <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 4, fontWeight: 700 }}>*</span>
          )}
        </div>
        {hasResponse && <AnswerCell question={question} answer={answer} />}
      </div>
    </div>
  )
}

function AnswerCell({ question, answer }: { question: any; answer: any | undefined }) {
  if (!answer) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'rgba(148, 163, 184, 0.1)',
          color: 'var(--text2)',
          borderRadius: 8,
          fontSize: 12,
          fontStyle: 'italic',
        }}
      >
        <i className="fa-solid fa-minus" style={{ fontSize: 10 }} />
        Pas de réponse
      </div>
    )
  }

  const val = answer.answer

  if (question.type === 'photo' && isPhotoAnswer(val)) {
    return <PhotoAnswer pathOrUrl={val} />
  }

  if (question.type === 'yesno') {
    const isYes = !!val
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          background: isYes ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: isYes ? '#22c55e' : '#ef4444',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <i className={`fa-solid ${isYes ? 'fa-check' : 'fa-xmark'}`} />
        {isYes ? 'Oui' : 'Non'}
      </div>
    )
  }

  if (question.type === 'rating') {
    const num = typeof val === 'number' ? val : parseInt(String(val), 10) || 0
    const pct = Math.max(0, Math.min(100, (num / 10) * 100))
    const color = num >= 7 ? '#22c55e' : num >= 4 ? '#eab308' : '#ef4444'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1, minWidth: 48 }}>
          {num}
          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>/10</span>
        </span>
        <div
          style={{
            flex: 1,
            maxWidth: 200,
            height: 6,
            background: 'var(--bg3)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s ease' }} />
        </div>
      </div>
    )
  }

  if (question.type === 'choice') {
    const items = Array.isArray(val) ? val : [val]
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.filter(Boolean).map((it, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <i className="fa-solid fa-circle-check" style={{ fontSize: 9 }} />
            {String(it)}
          </span>
        ))}
      </div>
    )
  }

  // Default: text answer in a soft container
  return (
    <div
      style={{
        padding: '8px 12px',
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 13.5,
        color: 'var(--text)',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}
    >
      {String(val)}
    </div>
  )
}
