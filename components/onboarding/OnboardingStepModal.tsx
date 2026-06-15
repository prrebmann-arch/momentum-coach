'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import FormGroup from '@/components/ui/FormGroup'
import { STEP_TYPE_META, type OnboardingStepType, formatDayLabel } from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'

interface OnboardingStepModalProps {
  isOpen: boolean
  onClose: () => void
  /** When provided = edit mode; when null = create mode. */
  initial: {
    id?: string
    day_offset: number
    type: OnboardingStepType
    title: string
    description?: string | null
    done?: boolean
  } | null
  onSave: (data: {
    id?: string
    day_offset: number
    type: OnboardingStepType
    title: string
    description: string | null
  }) => void
  onDelete?: (id: string) => void
  onToggleDone?: (id: string, done: boolean) => void
}

export default function OnboardingStepModal({
  isOpen,
  onClose,
  initial,
  onSave,
  onDelete,
  onToggleDone,
}: OnboardingStepModalProps) {
  const [type, setType] = useState<OnboardingStepType>('message')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dayOffset, setDayOffset] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    setType(initial?.type ?? 'message')
    setTitle(initial?.title ?? '')
    setDescription(initial?.description ?? '')
    setDayOffset(initial?.day_offset ?? 0)
  }, [isOpen, initial])

  const isEdit = !!initial?.id
  const isDone = !!initial?.done

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({
      id: initial?.id,
      day_offset: Math.round(dayOffset),
      type,
      title: trimmed,
      description: description.trim() || null,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Modifier le point' : 'Ajouter un point'} size="md">
      <form onSubmit={handleSubmit} className={styles.modalForm}>
        <FormGroup label="Type" htmlFor="step-type">
          <div className={styles.typeRow}>
            {(Object.keys(STEP_TYPE_META) as OnboardingStepType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.typeBtn} ${type === t ? styles.active : ''}`}
                onClick={() => setType(t)}
              >
                <i className={`fa-solid ${STEP_TYPE_META[t].icon}`} />
                {STEP_TYPE_META[t].label}
              </button>
            ))}
          </div>
        </FormGroup>

        <FormGroup label="Titre" htmlFor="step-title">
          <input
            id="step-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: R1, Rappel R2, Production plan…"
            autoFocus
            required
          />
        </FormGroup>

        <FormGroup label="Jour (offset depuis J0)" htmlFor="step-day">
          <input
            id="step-day"
            type="number"
            value={dayOffset}
            onChange={(e) => setDayOffset(parseInt(e.target.value) || 0)}
            step={1}
          />
          <span style={{ fontSize: 11, color: 'var(--text2)' }}>{formatDayLabel(dayOffset)}</span>
        </FormGroup>

        <FormGroup label="Description (optionnel)" htmlFor="step-desc">
          <textarea
            id="step-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Notes pour toi (script, points à aborder…)"
          />
        </FormGroup>
      </form>

      <div className={styles.modalActions}>
        {isEdit && onDelete && (
          <button type="button" className={styles.dangerLink} onClick={() => onDelete(initial!.id!)}>
            <i className="fa-solid fa-trash" style={{ marginRight: 4 }} />
            Supprimer
          </button>
        )}
        {isEdit && onToggleDone && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onToggleDone(initial!.id!, !isDone)}
          >
            <i className={`fa-solid ${isDone ? 'fa-rotate-left' : 'fa-check'}`} style={{ marginRight: 4 }} />
            {isDone ? 'Rouvrir' : 'Marquer fait'}
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn btn-red" onClick={handleSubmit}>
          {isEdit ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </Modal>
  )
}
