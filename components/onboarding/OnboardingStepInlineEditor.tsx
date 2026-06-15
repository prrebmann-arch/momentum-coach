'use client'

import { useEffect, useState } from 'react'
import { STEP_TYPE_META, formatDayLabel, type OnboardingStepType } from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'

interface InlineEditorProps {
  /** When step has an `id` = edit mode; when no id = add mode (creates on save). */
  step:
    | {
        id: string
        day_offset: number
        type: OnboardingStepType
        title: string
        description: string | null
        done: boolean
      }
    | {
        id?: undefined
        day_offset: number
        type?: OnboardingStepType
        title?: string
        description?: string | null
        done?: boolean
      }
    | null
  onSave: (data: {
    id?: string
    day_offset: number
    type: OnboardingStepType
    title: string
    description: string | null
  }) => Promise<void> | void
  onDelete: (id: string) => Promise<void> | void
  onToggleDone: (id: string, done: boolean) => Promise<void> | void
  onClose: () => void
}

// Discriminator: an "add" draft has no id; an "edit" step has one.
function hasId(s: InlineEditorProps['step']): s is { id: string; day_offset: number; type: OnboardingStepType; title: string; description: string | null; done: boolean } {
  return !!s && typeof s.id === 'string'
}

export default function OnboardingStepInlineEditor({
  step,
  onSave,
  onDelete,
  onToggleDone,
  onClose,
}: InlineEditorProps) {
  const [type, setType] = useState<OnboardingStepType>('message')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dayOffset, setDayOffset] = useState(0)

  // Re-seed form whenever the active step changes (by id, or by day for drafts).
  const key = step ? (hasId(step) ? `e:${step.id}` : `a:${step.day_offset}`) : null
  useEffect(() => {
    if (!step) return
    setType(step.type ?? 'message')
    setTitle(step.title ?? '')
    setDescription(step.description ?? '')
    setDayOffset(step.day_offset)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!step) return null

  const isEdit = hasId(step)
  const isDone = isEdit && step.done

  const handleSave = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({
      id: isEdit ? step.id : undefined,
      day_offset: Math.round(dayOffset),
      type,
      title: trimmed,
      description: description.trim() || null,
    })
  }

  const meta = STEP_TYPE_META[type]

  // Inline styles — CSS-module-independent so layout always works.
  const containerStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, var(--bg2), var(--bg))',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '16px 18px 14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset',
  }
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  }
  const titleStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    minWidth: 0,
  }
  const badgeStyle: React.CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: 12,
    flexShrink: 0,
    background: meta.color,
  }
  const pillStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'var(--bg3)',
    color: 'var(--text2)',
    letterSpacing: 0.3,
  }
  const donePillStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(34, 197, 94, 0.15)',
    color: '#22c55e',
  }
  const closeBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text2)',
    fontSize: 16,
    cursor: 'pointer',
    width: 28,
    height: 28,
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '12px 14px',
  }
  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  }
  const fieldFullStyle: React.CSSProperties = { ...fieldStyle, gridColumn: '1 / -1' }
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: 'var(--text2)',
  }
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 13,
    width: '100%',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }
  const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: 56 }
  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>
          <span style={badgeStyle}>
            <i className={`fa-solid ${meta.icon}`} />
          </span>
          <span>{isEdit ? 'Détails du point' : 'Nouveau point'}</span>
          <span style={pillStyle}>{formatDayLabel(dayOffset)}</span>
          {isDone && <span style={donePillStyle}>Terminé</span>}
        </div>
        <button
          type="button"
          style={closeBtnStyle}
          onClick={onClose}
          aria-label="Fermer"
          title="Fermer"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      <div style={gridStyle}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Type</label>
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
        </div>

        <div style={fieldStyle}>
          <label htmlFor="ie-day" style={labelStyle}>
            Jour (offset depuis J0)
          </label>
          <input
            id="ie-day"
            type="number"
            value={dayOffset}
            onChange={(e) => setDayOffset(parseInt(e.target.value) || 0)}
            step={1}
            style={inputStyle}
          />
        </div>

        <div style={fieldFullStyle}>
          <label htmlFor="ie-title" style={labelStyle}>
            Titre
          </label>
          <input
            id="ie-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: R1, Rappel R2, Production plan…"
            style={inputStyle}
          />
        </div>

        <div style={fieldFullStyle}>
          <label htmlFor="ie-desc" style={labelStyle}>
            Description (optionnel)
          </label>
          <textarea
            id="ie-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Notes pour toi (script, points à aborder…)"
            style={textareaStyle}
          />
        </div>
      </div>

      <div style={actionsStyle}>
        <button
          type="button"
          className={styles.dangerLink}
          style={{ marginRight: 'auto', visibility: isEdit ? 'visible' : 'hidden' }}
          onClick={() => isEdit && onDelete(step.id)}
        >
          <i className="fa-solid fa-trash" style={{ marginRight: 4 }} />
          Supprimer
        </button>
        {isEdit && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onToggleDone(step.id, !isDone)}
          >
            <i className={`fa-solid ${isDone ? 'fa-rotate-left' : 'fa-check'}`} style={{ marginRight: 4 }} />
            {isDone ? 'Rouvrir' : 'Marquer fait'}
          </button>
        )}
        <button type="button" className="btn btn-red" onClick={handleSave}>
          {isEdit ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}
