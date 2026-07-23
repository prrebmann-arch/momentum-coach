'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import BilanQuestionLibraryModal, { type LibraryQuestion } from './BilanQuestionLibraryModal'
import styles from '@/styles/bilan-templates.module.css'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface TemplateQuestion {
  id?: string
  bilan_type: 'quotidien' | 'complet'
  type: 'builtin' | 'custom'
  field?: string
  key?: string
  question_id?: string
  label: string
  input_type: string
  unit?: string
  options?: string[]
  required: boolean
  sort_order: number
}

interface CustomFormState {
  label: string
  input_type: string
  unit: string
  options: string
}

const INPUT_TYPES = [
  { value: 'slider_1_10',    label: 'Slider 1-10'    },
  { value: 'number',         label: 'Nombre'         },
  { value: 'text_short',     label: 'Texte court'    },
  { value: 'text_long',      label: 'Texte long'     },
  { value: 'boolean',        label: 'Oui / Non'      },
  { value: 'time',           label: 'Heure'          },
  { value: 'single_choice',  label: 'Choix unique'   },
  { value: 'multiple_choice',label: 'Choix multiple' },
  { value: 'photo',          label: 'Photo'          },
  { value: 'video',          label: 'Vidéo'          },
]

const TYPE_BADGE_CLASS: Record<string, string> = {
  slider_1_10:    styles.typeBadgeSlider,
  number:         styles.typeBadgeNumber,
  text_short:     styles.typeBadgeText,
  text_long:      styles.typeBadgeText,
  boolean:        styles.typeBadgeBoolean,
  time:           styles.typeBadgeTime,
  single_choice:  styles.typeBadgeChoice,
  multiple_choice:styles.typeBadgeChoice,
  photo:          styles.typeBadgePhoto,
  video:          styles.typeBadgePhoto,
}

function formatType(t: string): string {
  switch (t) {
    case 'slider_1_10':    return '1–10'
    case 'number':         return 'Nombre'
    case 'text_short':     return 'Court'
    case 'text_long':      return 'Texte'
    case 'boolean':        return 'Oui/Non'
    case 'time':           return 'Heure'
    case 'single_choice':  return 'Choix'
    case 'multiple_choice':return 'Multi'
    case 'photo':          return 'Photo'
    case 'video':          return 'Vidéo'
    default:               return t
  }
}

interface Props {
  templateId: string | null
  onSaved: () => void
  onCancel: () => void
}

function SortableQuestionRow({
  q,
  onRemove,
  onToggleRequired,
}: {
  q: TemplateQuestion
  onRemove: () => void
  onToggleRequired: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: q.field ?? q.key ?? q.id ?? '',
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className={styles.questionRow}>
      <button className={styles.dragHandle} {...listeners} {...attributes} title="Réordonner">
        <i className="fas fa-grip-vertical" />
      </button>
      <span className={styles.questionRowLabel}>{q.label}</span>
      {q.unit && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{q.unit}</span>}
      <span className={`${styles.typeBadge} ${TYPE_BADGE_CLASS[q.input_type] ?? ''}`}>
        {formatType(q.input_type)}
      </span>
      <label className={styles.requiredToggle}>
        <input type="checkbox" checked={q.required} onChange={onToggleRequired} />
        Req.
      </label>
      <button className={styles.deleteBtn} onClick={onRemove}>×</button>
    </div>
  )
}

export default function BilanTemplateEditor({ templateId, onSaved, onCancel }: Props) {
  const supabase = createClient()
  const { user } = useAuth()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [templateType, setTemplateType] = useState<'quotidien' | 'complet'>('quotidien')
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!templateId)

  const [showLibrary, setShowLibrary] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState<CustomFormState | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (!templateId || !user) return
    const load = async () => {
      const [{ data: tpl }, { data: qs }] = await Promise.all([
        supabase.from('bilan_templates').select('name, description, template_type').eq('id', templateId).single(),
        supabase
          .from('bilan_template_questions')
          .select('id, bilan_type, builtin_field, question_id, is_required, sort_order, bilan_questions(key, label, type, unit, options)')
          .eq('template_id', templateId)
          .order('sort_order'),
      ])
      if (tpl) {
        setName(tpl.name)
        setDescription(tpl.description || '')
        setTemplateType((tpl as any).template_type || 'quotidien')
      }
      if (qs) {
        setQuestions(qs.map((q: any, i: number) => {
          if (q.builtin_field) {
            const info = getBuiltinInfo(q.builtin_field)
            return {
              id: q.id,
              bilan_type: q.bilan_type,
              type: 'builtin' as const,
              field: q.builtin_field,
              label: info.label,
              input_type: info.input_type,
              unit: info.unit,
              required: q.is_required,
              sort_order: q.sort_order ?? i,
            }
          }
          const bq = q.bilan_questions as any
          return {
            id: q.id,
            bilan_type: q.bilan_type,
            type: 'custom' as const,
            key: bq?.key,
            question_id: q.question_id,
            label: bq?.label || '',
            input_type: bq?.type || 'text_short',
            unit: bq?.unit ?? undefined,
            options: Array.isArray(bq?.options) ? bq.options : undefined,
            required: q.is_required,
            sort_order: q.sort_order ?? i,
          }
        }))
      }
      setLoading(false)
    }
    load()
  }, [templateId, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Single column — all questions belong to templateType
  const currentQuestions = questions
    .filter((q) => q.bilan_type === templateType)
    .sort((a, b) => a.sort_order - b.sort_order)

  const alreadySelected = currentQuestions.map((q) => q.field ?? q.key ?? '')

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = currentQuestions.findIndex((q) => (q.field ?? q.key ?? q.id) === active.id)
    const newIdx = currentQuestions.findIndex((q) => (q.field ?? q.key ?? q.id) === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reindexed = arrayMove(currentQuestions, oldIdx, newIdx).map((item, i) => ({ ...item, sort_order: i }))
    setQuestions((prev) => [
      ...prev.filter((x) => x.bilan_type !== templateType),
      ...reindexed,
    ])
  }

  function remove(q: TemplateQuestion) {
    setQuestions((prev) =>
      prev.filter((x) => !(x.bilan_type === templateType && (x.field ?? x.key) === (q.field ?? q.key)))
    )
  }

  function toggleRequired(q: TemplateQuestion) {
    setQuestions((prev) =>
      prev.map((x) =>
        x.bilan_type === templateType && (x.field ?? x.key) === (q.field ?? q.key)
          ? { ...x, required: !x.required }
          : x
      )
    )
  }

  function addFromLibrary(qs: LibraryQuestion[]) {
    const offset = currentQuestions.length
    const toAdd: TemplateQuestion[] = qs.map((q, i) => ({
      bilan_type: templateType,
      type: q.type,
      field: q.field,
      key: q.key,
      question_id: q.question_id,
      label: q.label,
      input_type: q.input_type,
      unit: q.unit,
      options: q.options,
      required: false,
      sort_order: offset + i,
    }))
    setQuestions((prev) => [...prev, ...toAdd])
    setShowLibrary(false)
  }

  async function addCustomQuestion(form: CustomFormState) {
    if (!form.label.trim() || !user) return
    const options = ['single_choice', 'multiple_choice'].includes(form.input_type)
      ? form.options.split('\n').map((s) => s.trim()).filter(Boolean)
      : undefined

    const { data: inserted, error } = await supabase
      .from('bilan_questions')
      .insert({
        coach_id: user.id,
        key: `custom_${Date.now()}`,
        label: form.label.trim(),
        type: form.input_type,
        unit: form.unit.trim() || null,
        options: options ? options : null,
        category: 'other',
        is_system: false,
      })
      .select('id, key, label, type, unit, options')
      .single()

    if (error || !inserted) { toast('Erreur lors de la création', 'error'); return }

    const offset = currentQuestions.length
    setQuestions((prev) => [
      ...prev,
      {
        bilan_type: templateType,
        type: 'custom',
        key: inserted.key,
        question_id: inserted.id,
        label: inserted.label,
        input_type: inserted.type,
        unit: inserted.unit ?? undefined,
        options: Array.isArray(inserted.options) ? inserted.options : undefined,
        required: false,
        sort_order: offset,
      },
    ])
    setShowCustomForm(null)
  }

  async function handleSave() {
    if (!name.trim() || !user) return
    setSaving(true)
    try {
      let tid = templateId
      if (tid) {
        const { error: updError } = await supabase
          .from('bilan_templates')
          .update({ name: name.trim(), description: description.trim() || null, template_type: templateType, updated_at: new Date().toISOString() })
          .eq('id', tid)
        if (updError) { console.error('[bilan-template] update error:', updError); toast(`Erreur: ${updError.message}`, 'error'); setSaving(false); return }
      } else {
        const { data } = await supabase
          .from('bilan_templates')
          .insert({ coach_id: user.id, name: name.trim(), description: description.trim() || null, template_type: templateType })
          .select('id')
          .single()
        tid = data?.id ?? null
      }
      if (!tid) { toast('Erreur lors de la sauvegarde', 'error'); setSaving(false); return }

      // Verifier le delete AVANT l'insert : delete OK + insert KO = template vide.
      const { error: delError } = await supabase.from('bilan_template_questions').delete().eq('template_id', tid)
      if (delError) { console.error('[bilan-template] delete error:', delError); toast(`Erreur: ${delError.message}`, 'error'); setSaving(false); return }

      const rows = questions.map((q, i) => ({
        template_id: tid!,
        bilan_type: q.bilan_type,
        builtin_field: q.type === 'builtin' ? q.field : null,
        question_id: q.type === 'custom' ? q.question_id : null,
        is_required: q.required,
        sort_order: q.sort_order,
      }))

      if (rows.length > 0) {
        const { error } = await supabase.from('bilan_template_questions').insert(rows)
        if (error) { toast('Erreur lors de la sauvegarde', 'error'); setSaving(false); return }
      }

      toast('Template sauvegardé', 'success')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}><i className="fas fa-spinner fa-spin" /></div>
  }

  return (
    <div className={styles.editorWrap}>
      <div className={styles.editorHeader}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>
            <i className="fas fa-arrow-left" style={{ marginRight: 6 }} />Retour
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {templateId ? 'Modifier le template' : 'Nouveau template bilan'}
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label">Nom du template *</label>
            <input
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Standard Momentum"
            />
          </div>
          <div>
            <label className="form-label">Description (optionnel)</label>
            <input
              className="form-control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex: Template pour athlètes force intermédiaire"
            />
          </div>
        </div>

        {/* Type selector — editable only for new templates, badge for existing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Type</span>
          {templateId ? (
            <span className={styles.typePillBadge} data-type={templateType}>
              <i className={templateType === 'quotidien' ? 'fas fa-sun' : 'fas fa-calendar-check'} style={{ marginRight: 5 }} />
              {templateType === 'quotidien' ? 'Quotidien' : 'Complet'}
            </span>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`btn btn-sm ${templateType === 'quotidien' ? 'btn-red' : 'btn-outline'}`}
                onClick={() => setTemplateType('quotidien')}
              >
                <i className="fas fa-sun" style={{ marginRight: 5 }} />Quotidien
              </button>
              <button
                type="button"
                className={`btn btn-sm ${templateType === 'complet' ? 'btn-red' : 'btn-outline'}`}
                onClick={() => setTemplateType('complet')}
              >
                <i className="fas fa-calendar-check" style={{ marginRight: 5 }} />Complet
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Single column of questions for the active templateType */}
      <div className={styles.editorCol}>
        <div className={styles.colTitle}>
          <i className={templateType === 'quotidien' ? 'fas fa-sun' : 'fas fa-calendar-check'} />
          {templateType === 'quotidien' ? 'Bilan Quotidien' : 'Bilan Complet'}
          <span className={styles.colSubtitle}>
            {templateType === 'complet' ? '· questions supplémentaires' : '· questions de base'}
          </span>
        </div>

        {currentQuestions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: 12 }}>
            Aucune question — ajoute depuis la bibliothèque
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={currentQuestions.map((q) => q.field ?? q.key ?? q.id ?? '')}
            strategy={verticalListSortingStrategy}
          >
            {currentQuestions.map((q) => (
              <SortableQuestionRow
                key={q.field ?? q.key ?? q.id}
                q={q}
                onRemove={() => remove(q)}
                onToggleRequired={() => toggleRequired(q)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <div className={styles.addBtns}>
          <button className={styles.addBtn} onClick={() => setShowLibrary(true)}>
            <i className="fas fa-plus" /> Depuis la bibliothèque
          </button>
          <button
            className={styles.addBtn}
            onClick={() => setShowCustomForm({ label: '', input_type: 'slider_1_10', unit: '', options: '' })}
          >
            <i className="fas fa-pencil-alt" /> Question custom
          </button>
        </div>

        {showCustomForm && (
          <div className={styles.customForm}>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text2)' }}>Nouvelle question</div>
            <div className={styles.customFormRow}>
              <div style={{ flex: 1 }}>
                <div className={styles.customFormLabel}>Libellé</div>
                <input
                  className="form-control"
                  style={{ fontSize: 12 }}
                  value={showCustomForm.label}
                  onChange={(e) => setShowCustomForm((f) => f && { ...f, label: e.target.value })}
                  placeholder="ex: Humeur générale"
                />
              </div>
              <div>
                <div className={styles.customFormLabel}>Type</div>
                <select
                  className={styles.customFormSelect}
                  value={showCustomForm.input_type}
                  onChange={(e) => setShowCustomForm((f) => f && { ...f, input_type: e.target.value })}
                >
                  {INPUT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            {showCustomForm.input_type === 'number' && (
              <div>
                <div className={styles.customFormLabel}>Unité (optionnel)</div>
                <input
                  className="form-control"
                  style={{ fontSize: 12, width: 100 }}
                  value={showCustomForm.unit}
                  onChange={(e) => setShowCustomForm((f) => f && { ...f, unit: e.target.value })}
                  placeholder="kg, min…"
                />
              </div>
            )}
            {['single_choice', 'multiple_choice'].includes(showCustomForm.input_type) && (
              <div>
                <div className={styles.customFormLabel}>Options (une par ligne)</div>
                <textarea
                  className="form-control"
                  style={{ fontSize: 12 }}
                  rows={3}
                  value={showCustomForm.options}
                  onChange={(e) => setShowCustomForm((f) => f && { ...f, options: e.target.value })}
                  placeholder={'Option 1\nOption 2\nOption 3'}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-red btn-sm"
                disabled={!showCustomForm.label.trim()}
                onClick={() => addCustomQuestion(showCustomForm)}
              >
                Ajouter
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setShowCustomForm(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-outline" onClick={onCancel}>Annuler</button>
        <button className="btn btn-red" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />}
          {saving ? ' Enregistrement…' : ' Enregistrer'}
        </button>
      </div>

      {showLibrary && (
        <BilanQuestionLibraryModal
          bilanType={templateType}
          alreadySelected={alreadySelected}
          onAdd={(qs) => addFromLibrary(qs)}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  )
}

// Maps builtin field names to display info
function getBuiltinInfo(field: string): { label: string; input_type: string; unit?: string } {
  const map: Record<string, { label: string; input_type: string; unit?: string }> = {
    weight:            { label: 'Poids',               input_type: 'number',      unit: 'kg'  },
    energy:            { label: 'Énergie',             input_type: 'slider_1_10'              },
    stress:            { label: 'Stress',              input_type: 'slider_1_10'              },
    sleep_quality:     { label: 'Qualité du sommeil',  input_type: 'slider_1_10'              },
    soreness:          { label: 'Courbatures',         input_type: 'slider_1_10'              },
    session_enjoyment: { label: 'Plaisir séance',      input_type: 'slider_1_10'              },
    cardio_minutes:    { label: 'Cardio (min)',        input_type: 'number',      unit: 'min' },
    bedtime:           { label: 'Heure coucher',       input_type: 'time'                     },
    wakeup:            { label: 'Heure réveil',        input_type: 'time'                     },
    sleep_efficiency:  { label: 'Efficacité sommeil',  input_type: 'number',      unit: '%'   },
    sick_signs:        { label: 'Signes de maladie',   input_type: 'boolean'                  },
    adherence:         { label: 'Adhérence',           input_type: 'slider_1_10'              },
    positive_week:     { label: 'Point positif',       input_type: 'text_long'                },
    negative_week:     { label: 'Point à améliorer',   input_type: 'text_long'                },
    general_notes:     { label: 'Notes générales',     input_type: 'text_long'                },
    belly_measurement: { label: 'Tour de ventre',      input_type: 'number',      unit: 'cm'  },
    hip_measurement:   { label: 'Tour de hanches',     input_type: 'number',      unit: 'cm'  },
    thigh_measurement: { label: 'Tour de cuisses',     input_type: 'number',      unit: 'cm'  },
    photo_front:       { label: 'Photo face',          input_type: 'photo'                    },
    photo_side:        { label: 'Photo profil',        input_type: 'photo'                    },
    photo_back:        { label: 'Photo dos',           input_type: 'photo'                    },
  }
  return map[field] ?? { label: field, input_type: 'text_short' }
}
