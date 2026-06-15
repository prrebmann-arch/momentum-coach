'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Skeleton from '@/components/ui/Skeleton'
import Toggle from '@/components/ui/Toggle'
import OnboardingTimeline, { type TimelinePoint } from '@/components/onboarding/OnboardingTimeline'
import OnboardingTimelineVerticalSpine, {
  type VerticalTimelinePoint,
} from '@/components/onboarding/OnboardingTimelineVerticalSpine'
import OnboardingTimelineVerticalFeed from '@/components/onboarding/OnboardingTimelineVerticalFeed'
import OnboardingTimelineVerticalCompact from '@/components/onboarding/OnboardingTimelineVerticalCompact'
import OnboardingStepInlineEditor from '@/components/onboarding/OnboardingStepInlineEditor'
import ApplyTemplateModal from '@/components/onboarding/ApplyTemplateModal'
import Modal from '@/components/ui/Modal'
import {
  addDays,
  ensurePremiumTemplate,
  monthIndexForOffset,
  todayIso,
  type AthleteOnboardingStep,
  type OnboardingStepType,
  type OnboardingTemplate,
} from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'

type ModalState =
  | { kind: 'closed' }
  | { kind: 'add'; defaultDay: number }

type ViewMode = 'horizontal' | 'spine' | 'feed' | 'compact'
const VIEW_STORAGE_KEY = 'onboarding-view-mode'
const VIEW_OPTIONS: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'spine', label: 'Spine', icon: 'fa-grip-lines-vertical' },
  { id: 'feed', label: 'Feed', icon: 'fa-list-ul' },
  { id: 'compact', label: 'Compact', icon: 'fa-bars' },
  { id: 'horizontal', label: 'Horizontal', icon: 'fa-grip-lines' },
]

export default function AthleteOnboardingPage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const athleteId = params.id

  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [steps, setSteps] = useState<AthleteOnboardingStep[]>([])
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([])
  const [monthIndex, setMonthIndex] = useState(0)
  const [hideDone, setHideDone] = useState(false)
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' })
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  // Default to "spine" — the brand-new big vertical view. User can switch back to horizontal anytime.
  const [viewMode, setViewModeState] = useState<ViewMode>('spine')

  // Hydrate view-mode from localStorage on mount (avoid SSR/client mismatch by reading in effect).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null
      if (stored && VIEW_OPTIONS.find((o) => o.id === stored)) setViewModeState(stored)
    } catch {
      /* noop */
    }
  }, [])
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode)
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, mode)
    } catch {
      /* noop */
    }
  }

  const loadData = useCallback(async () => {
    if (!user?.id || !athleteId) return
    try {
      const [athResult, stepsResult, tplResult] = await Promise.all([
        supabase
          .from('athletes')
          .select('onboarding_start_date')
          .eq('id', athleteId)
          .single(),
        supabase
          .from('athlete_onboarding_steps')
          .select(
            'id, athlete_id, coach_id, template_id, day_offset, scheduled_date, type, title, description, done_at, dismissed_at, created_at, updated_at',
          )
          .eq('athlete_id', athleteId)
          .is('dismissed_at', null)
          .order('day_offset', { ascending: true })
          .limit(500),
        supabase
          .from('onboarding_templates')
          .select('id, coach_id, name, description, is_default, steps, created_at, updated_at')
          .eq('coach_id', user.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (athResult.error) {
        console.error('[onboarding] athlete', athResult.error)
        toast(`Erreur: ${athResult.error.message}`, 'error')
        return
      }
      if (stepsResult.error) {
        console.error('[onboarding] steps', stepsResult.error)
        toast(`Erreur: ${stepsResult.error.message}`, 'error')
        return
      }
      if (tplResult.error) {
        console.error('[onboarding] templates', tplResult.error)
      }

      setStartDate(athResult.data?.onboarding_start_date ?? null)
      setSteps((stepsResult.data ?? []) as AthleteOnboardingStep[])
      let tpls = (tplResult.data ?? []) as OnboardingTemplate[]

      // Auto-seed the default Premium template if none exists yet, so the coach
      // never lands on an empty "Apply template" modal on first visit.
      if (tpls.length === 0) {
        const inserted = await ensurePremiumTemplate(supabase, user.id)
        if (inserted) {
          const { data: refreshed } = await supabase
            .from('onboarding_templates')
            .select('id, coach_id, name, description, is_default, steps, created_at, updated_at')
            .eq('coach_id', user.id)
            .order('is_default', { ascending: false })
            .limit(50)
          tpls = (refreshed ?? []) as OnboardingTemplate[]
        }
      }
      setTemplates(tpls)
    } finally {
      setLoading(false)
    }
  }, [user?.id, athleteId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (athleteId) loadData()
  }, [athleteId, loadData])

  useRefetchOnResume(loadData, loading)

  const visibleSteps = useMemo(
    () => (hideDone ? steps.filter((s) => !s.done_at) : steps),
    [steps, hideDone],
  )

  const points: TimelinePoint[] = useMemo(
    () =>
      visibleSteps.map((s) => ({
        id: s.id,
        day_offset: s.day_offset,
        type: s.type,
        title: s.title,
        done: !!s.done_at,
      })),
    [visibleSteps],
  )

  const verticalPoints: VerticalTimelinePoint[] = useMemo(
    () =>
      visibleSteps.map((s) => ({
        id: s.id,
        day_offset: s.day_offset,
        type: s.type,
        title: s.title,
        description: s.description,
        done: !!s.done_at,
      })),
    [visibleSteps],
  )

  // Determine the max month index we have content for (so user can navigate beyond if needed)
  const maxMonthIndex = useMemo(() => {
    if (steps.length === 0) return 5 // allow up to 6 months by default
    const max = steps.reduce((m, s) => Math.max(m, s.day_offset), 0)
    return Math.max(monthIndexForOffset(max) + 1, 5)
  }, [steps])

  // ── Mutations ──

  const updateStartDate = async (newDate: string) => {
    if (!user?.id) return
    if (!newDate) {
      toast('Date invalide', 'error')
      return
    }
    const oldDate = startDate
    setStartDate(newDate)
    const { error } = await supabase
      .from('athletes')
      .update({ onboarding_start_date: newDate })
      .eq('id', athleteId)
    if (error) {
      console.error('[onboarding] start_date update', error)
      toast(`Erreur: ${error.message}`, 'error')
      setStartDate(oldDate)
      return
    }
    // Recompute scheduled_date for all non-done steps
    const toUpdate = steps.filter((s) => !s.done_at)
    if (toUpdate.length > 0) {
      // batch update — supabase doesn't support multi-row update with different values in one query,
      // so we do them serially. Acceptable: usually < 20 steps.
      for (const s of toUpdate) {
        const newScheduled = addDays(newDate, s.day_offset)
        await supabase
          .from('athlete_onboarding_steps')
          .update({ scheduled_date: newScheduled })
          .eq('id', s.id)
      }
      await loadData()
    }
    toast('Date de démarrage mise à jour', 'success')
  }

  const movePoint = async (id: string, newDayOffset: number) => {
    if (!startDate) return
    const target = steps.find((s) => s.id === id)
    if (!target) return
    const newScheduled = addDays(startDate, newDayOffset)
    // Optimistic
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, day_offset: newDayOffset, scheduled_date: newScheduled } : s)),
    )
    const { error } = await supabase
      .from('athlete_onboarding_steps')
      .update({ day_offset: newDayOffset, scheduled_date: newScheduled })
      .eq('id', id)
    if (error) {
      console.error('[onboarding] move', error)
      toast(`Erreur: ${error.message}`, 'error')
      await loadData()
    }
  }

  const saveStep = async (data: {
    id?: string
    day_offset: number
    type: OnboardingStepType
    title: string
    description: string | null
  }) => {
    if (!user?.id || !athleteId) return
    if (!startDate) {
      toast('Définis d’abord une date de démarrage', 'error')
      return
    }
    const scheduled = addDays(startDate, data.day_offset)
    if (data.id) {
      const { error } = await supabase
        .from('athlete_onboarding_steps')
        .update({
          day_offset: data.day_offset,
          scheduled_date: scheduled,
          type: data.type,
          title: data.title,
          description: data.description,
        })
        .eq('id', data.id)
      if (error) {
        console.error('[onboarding] update step', error)
        toast(`Erreur: ${error.message}`, 'error')
        return
      }
      toast('Point mis à jour', 'success')
      // Refresh the selected step in memory so inline editor shows the latest
      setSteps((prev) =>
        prev.map((s) =>
          s.id === data.id
            ? {
                ...s,
                day_offset: data.day_offset,
                scheduled_date: scheduled,
                type: data.type,
                title: data.title,
                description: data.description,
              }
            : s,
        ),
      )
      return
    } else {
      const { error } = await supabase.from('athlete_onboarding_steps').insert({
        athlete_id: athleteId,
        coach_id: user.id,
        day_offset: data.day_offset,
        scheduled_date: scheduled,
        type: data.type,
        title: data.title,
        description: data.description,
      })
      if (error) {
        console.error('[onboarding] insert step', error)
        toast(`Erreur: ${error.message}`, 'error')
        return
      }
      toast('Point ajouté', 'success')
    }
    setModal({ kind: 'closed' })
    await loadData()
  }

  const deleteStep = async (id: string) => {
    if (!confirm('Supprimer ce point ?')) return
    const { error } = await supabase.from('athlete_onboarding_steps').delete().eq('id', id)
    if (error) {
      console.error('[onboarding] delete step', error)
      toast(`Erreur: ${error.message}`, 'error')
      return
    }
    setModal({ kind: 'closed' })
    setSelectedStepId((prev) => (prev === id ? null : prev))
    setSteps((prev) => prev.filter((s) => s.id !== id))
    toast('Point supprimé', 'success')
  }

  const toggleDone = async (id: string, done: boolean) => {
    const value = done ? new Date().toISOString() : null
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, done_at: value } : s)))
    const { error } = await supabase
      .from('athlete_onboarding_steps')
      .update({ done_at: value })
      .eq('id', id)
    if (error) {
      console.error('[onboarding] toggle done', error)
      toast(`Erreur: ${error.message}`, 'error')
      await loadData()
      return
    }
  }

  const applyTemplate = async (templateId: string, applyStart: string, mode: 'replace' | 'append') => {
    if (!user?.id || !athleteId) return
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    if (!applyStart) {
      toast('Date invalide', 'error')
      return
    }

    if (mode === 'replace') {
      const { error: delErr } = await supabase
        .from('athlete_onboarding_steps')
        .delete()
        .eq('athlete_id', athleteId)
        .is('done_at', null)
      if (delErr) {
        console.error('[onboarding] apply replace delete', delErr)
        toast(`Erreur: ${delErr.message}`, 'error')
        return
      }
    }

    // Update start_date
    const { error: athErr } = await supabase
      .from('athletes')
      .update({ onboarding_start_date: applyStart })
      .eq('id', athleteId)
    if (athErr) {
      console.error('[onboarding] apply start_date', athErr)
      toast(`Erreur: ${athErr.message}`, 'error')
      return
    }

    // Insert new steps
    const rows = (tpl.steps || []).map((s) => ({
      athlete_id: athleteId,
      coach_id: user.id,
      template_id: tpl.id,
      day_offset: s.day_offset,
      scheduled_date: addDays(applyStart, s.day_offset),
      type: s.type,
      title: s.title,
      description: s.description ?? null,
    }))
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('athlete_onboarding_steps').insert(rows)
      if (insErr) {
        console.error('[onboarding] apply insert', insErr)
        toast(`Erreur: ${insErr.message}`, 'error')
        return
      }
    }
    setApplyOpen(false)
    toast('Template appliqué', 'success')
    await loadData()
  }

  // ── UI ──

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height={48} borderRadius={10} />
        <Skeleton height={280} borderRadius={12} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div className={styles.startDateRow}>
          <i className="fa-solid fa-flag-checkered" />
          <span>Démarrage onboarding (J0)</span>
          <input
            type="date"
            value={startDate ?? ''}
            onChange={(e) => updateStartDate(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={styles.viewPicker} role="tablist" aria-label="Choisir la vue">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={viewMode === opt.id}
                className={viewMode === opt.id ? styles.active : ''}
                onClick={() => setViewMode(opt.id)}
                title={opt.label}
              >
                <i className={`fa-solid ${opt.icon}`} />
                {opt.label}
              </button>
            ))}
          </div>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--text2)',
            }}
          >
            <Toggle checked={hideDone} onChange={setHideDone} />
            Masquer terminés
          </label>
          <button className="btn btn-outline" onClick={() => setApplyOpen(true)}>
            <i className="fa-solid fa-bolt" style={{ marginRight: 6 }} />
            Appliquer un template
          </button>
        </div>
      </div>

      {!startDate && steps.length === 0 ? (
        <div className={styles.emptyHint}>
          <p>Aucune timeline pour cet athlète.</p>
          <p>Choisis une date de démarrage ci-dessus puis applique un template (ou clique sur la ligne pour ajouter des points manuellement).</p>
          <button
            className="btn btn-red"
            style={{ marginTop: 12 }}
            onClick={() => {
              updateStartDate(todayIso())
              setApplyOpen(true)
            }}
          >
            Démarrer aujourd’hui avec un template
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'horizontal' && (
            <OnboardingTimeline
              points={points}
              monthIndex={monthIndex}
              maxMonthIndex={maxMonthIndex}
              onMonthChange={setMonthIndex}
              startDate={startDate}
              onPointMove={movePoint}
              onPointClick={(id) => {
                setSelectedStepId(id)
                setModal({ kind: 'closed' })
              }}
              onAxisClick={(day) => {
                setSelectedStepId(null)
                setModal({ kind: 'add', defaultDay: day })
              }}
            />
          )}
          {viewMode === 'spine' && (
            <div className={styles.vWrap}>
              <div className={styles.vHeader}>
                <div className={styles.vHeaderTitle}>
                  <i className="fa-solid fa-grip-lines-vertical" style={{ color: 'var(--text2)' }} />
                  Timeline d&apos;onboarding
                  <span className="count">{verticalPoints.length} points</span>
                </div>
                <span className={styles.vHeaderHint}>Clique sur un point pour l&apos;éditer · survole entre deux points pour ajouter</span>
              </div>
              <OnboardingTimelineVerticalSpine
                points={verticalPoints}
                startDate={startDate}
                selectedId={selectedStepId}
                onPointClick={(id) => {
                  setSelectedStepId(id)
                  setModal({ kind: 'closed' })
                }}
                onAddAt={(day) => {
                  setSelectedStepId(null)
                  setModal({ kind: 'add', defaultDay: day })
                }}
              />
            </div>
          )}
          {viewMode === 'feed' && (
            <div className={styles.vWrap}>
              <div className={styles.vHeader}>
                <div className={styles.vHeaderTitle}>
                  <i className="fa-solid fa-list-ul" style={{ color: 'var(--text2)' }} />
                  Timeline d&apos;onboarding
                  <span className="count">{verticalPoints.length} points</span>
                </div>
                <span className={styles.vHeaderHint}>Vue chronologique par jour</span>
              </div>
              <OnboardingTimelineVerticalFeed
                points={verticalPoints}
                startDate={startDate}
                selectedId={selectedStepId}
                monthIndex={monthIndex}
                maxMonthIndex={maxMonthIndex}
                onMonthChange={setMonthIndex}
                onPointClick={(id) => {
                  setSelectedStepId(id)
                  setModal({ kind: 'closed' })
                }}
                onAddAt={(day) => {
                  setSelectedStepId(null)
                  setModal({ kind: 'add', defaultDay: day })
                }}
              />
            </div>
          )}
          {viewMode === 'compact' && (
            <div className={styles.vWrap}>
              <div className={styles.vHeader}>
                <div className={styles.vHeaderTitle}>
                  <i className="fa-solid fa-bars" style={{ color: 'var(--text2)' }} />
                  Timeline d&apos;onboarding
                  <span className="count">{verticalPoints.length} points</span>
                </div>
                <span className={styles.vHeaderHint}>Vue dense — coche pour valider</span>
              </div>
              <OnboardingTimelineVerticalCompact
                points={verticalPoints}
                startDate={startDate}
                selectedId={selectedStepId}
                onPointClick={(id) => {
                  setSelectedStepId(id)
                  setModal({ kind: 'closed' })
                }}
                onAddAt={(day) => {
                  setSelectedStepId(null)
                  setModal({ kind: 'add', defaultDay: day })
                }}
                onToggleDone={toggleDone}
              />
            </div>
          )}
          {(() => {
            // Edit mode takes precedence over add mode.
            const selected = selectedStepId ? steps.find((s) => s.id === selectedStepId) : null
            const editorNode = selected ? (
              <OnboardingStepInlineEditor
                step={{
                  id: selected.id,
                  day_offset: selected.day_offset,
                  type: selected.type,
                  title: selected.title,
                  description: selected.description,
                  done: !!selected.done_at,
                }}
                onSave={saveStep}
                onDelete={deleteStep}
                onToggleDone={toggleDone}
                onClose={() => setSelectedStepId(null)}
              />
            ) : modal.kind === 'add' ? (
              <OnboardingStepInlineEditor
                step={{ day_offset: modal.defaultDay, type: 'message', title: '', description: null, done: false }}
                onSave={async (data) => {
                  await saveStep(data)
                  setModal({ kind: 'closed' })
                }}
                onDelete={() => setModal({ kind: 'closed' })}
                onToggleDone={() => {}}
                onClose={() => setModal({ kind: 'closed' })}
              />
            ) : null

            if (!editorNode) return null

            // Vertical views (Spine / Feed / Compact) → modal central.
            // Horizontal view → inline en bas (comportement legacy).
            if (viewMode === 'horizontal') return editorNode

            return (
              <Modal
                isOpen
                onClose={() => {
                  setSelectedStepId(null)
                  setModal({ kind: 'closed' })
                }}
                size="lg"
              >
                <div style={{ padding: 4 }}>{editorNode}</div>
              </Modal>
            )
          })()}
        </>
      )}

      <ApplyTemplateModal
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        templates={templates}
        hasExistingSteps={steps.length > 0}
        onApply={applyTemplate}
      />
    </div>
  )
}
