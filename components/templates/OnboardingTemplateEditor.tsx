'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import FormGroup from '@/components/ui/FormGroup'
import OnboardingTimelineVerticalFeed, {
  type VerticalTimelinePoint,
} from '@/components/onboarding/OnboardingTimelineVerticalFeed'
import OnboardingStepModal from '@/components/onboarding/OnboardingStepModal'
import {
  monthIndexForOffset,
  type OnboardingStepType,
  type OnboardingTemplate,
  type OnboardingTemplateStep,
} from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'

type EditorStep = OnboardingTemplateStep & { _localId: string }

type ModalState =
  | { kind: 'closed' }
  | { kind: 'add'; defaultDay: number }
  | { kind: 'edit'; step: EditorStep }

interface Props {
  template: OnboardingTemplate | null // null = create mode
  onSaved: () => void
  onCancel: () => void
}

let _localCounter = 0
const nextLocalId = () => `local-${++_localCounter}`

export default function OnboardingTemplateEditor({ template, onSaved, onCancel }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [name, setName] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [isDefault, setIsDefault] = useState(!!template?.is_default)
  const [steps, setSteps] = useState<EditorStep[]>(
    () => (template?.steps ?? []).map((s) => ({ ...s, _localId: nextLocalId() })),
  )
  const [monthIndex, setMonthIndex] = useState(0)
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(template?.name ?? '')
    setDescription(template?.description ?? '')
    setIsDefault(!!template?.is_default)
    setSteps((template?.steps ?? []).map((s) => ({ ...s, _localId: nextLocalId() })))
  }, [template])

  const verticalPoints: VerticalTimelinePoint[] = useMemo(
    () =>
      steps.map((s) => ({
        id: s._localId,
        day_offset: s.day_offset,
        type: s.type,
        title: s.title,
        description: s.description ?? null,
      })),
    [steps],
  )

  const maxMonthIndex = useMemo(() => {
    if (steps.length === 0) return 5
    const max = steps.reduce((m, s) => Math.max(m, s.day_offset), 0)
    return Math.max(monthIndexForOffset(max) + 1, 5)
  }, [steps])

  const handleSaveStep = (data: {
    id?: string
    day_offset: number
    type: OnboardingStepType
    title: string
    description: string | null
  }) => {
    if (data.id) {
      setSteps((prev) =>
        prev.map((s) =>
          s._localId === data.id
            ? {
                ...s,
                day_offset: data.day_offset,
                type: data.type,
                title: data.title,
                description: data.description ?? undefined,
              }
            : s,
        ),
      )
    } else {
      setSteps((prev) => [
        ...prev,
        {
          _localId: nextLocalId(),
          day_offset: data.day_offset,
          type: data.type,
          title: data.title,
          description: data.description ?? undefined,
        },
      ])
    }
    setModal({ kind: 'closed' })
  }

  const handleDeleteStep = (id: string) => {
    if (!confirm('Supprimer ce point ?')) return
    setSteps((prev) => prev.filter((s) => s._localId !== id))
    setModal({ kind: 'closed' })
  }

  const handleSave = async () => {
    if (!user?.id) return
    if (!name.trim()) {
      toast('Nom requis', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        is_default: isDefault,
        steps: steps
          .slice()
          .sort((a, b) => a.day_offset - b.day_offset)
          .map((s) => ({
            day_offset: s.day_offset,
            type: s.type,
            title: s.title,
            description: s.description ?? undefined,
          })),
      }

      // If marking this as default, unset all others first
      if (isDefault) {
        await supabase
          .from('onboarding_templates')
          .update({ is_default: false })
          .eq('coach_id', user.id)
          .neq('id', template?.id ?? '00000000-0000-0000-0000-000000000000')
      }

      if (template?.id) {
        const { error } = await supabase
          .from('onboarding_templates')
          .update(payload)
          .eq('id', template.id)
        if (error) {
          console.error('[onboarding template] update', error)
          toast(`Erreur: ${error.message}`, 'error')
          return
        }
      } else {
        const { error } = await supabase.from('onboarding_templates').insert({
          coach_id: user.id,
          ...payload,
        })
        if (error) {
          console.error('[onboarding template] insert', error)
          toast(`Erreur: ${error.message}`, 'error')
          return
        }
      }
      toast('Template enregistré', 'success')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <button className="btn btn-outline" onClick={onCancel}>
          <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />
          Retour
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-red" onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : template?.id ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormGroup label="Nom du template" htmlFor="tpl-name">
          <input
            id="tpl-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Onboarding Premium"
          />
        </FormGroup>
        <FormGroup label="Description (optionnel)" htmlFor="tpl-desc">
          <input
            id="tpl-desc"
            type="text"
            value={description ?? ''}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Court résumé du process"
          />
        </FormGroup>
      </div>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        Définir comme template par défaut (pré-sélectionné à la création d&apos;un athlète)
      </label>

      <div className={styles.vWrap}>
        <OnboardingTimelineVerticalFeed
          points={verticalPoints}
          startDate={null}
          monthIndex={monthIndex}
          maxMonthIndex={maxMonthIndex}
          onMonthChange={setMonthIndex}
          onPointClick={(id) => {
            const step = steps.find((s) => s._localId === id)
            if (step) setModal({ kind: 'edit', step })
          }}
          onAddAt={(day) => setModal({ kind: 'add', defaultDay: day })}
        />
      </div>

      <OnboardingStepModal
        isOpen={modal.kind !== 'closed'}
        onClose={() => setModal({ kind: 'closed' })}
        initial={
          modal.kind === 'edit'
            ? {
                id: modal.step._localId,
                day_offset: modal.step.day_offset,
                type: modal.step.type,
                title: modal.step.title,
                description: modal.step.description,
              }
            : modal.kind === 'add'
              ? { day_offset: modal.defaultDay, type: 'message', title: '' }
              : null
        }
        onSave={handleSaveStep}
        onDelete={handleDeleteStep}
      />
    </div>
  )
}
