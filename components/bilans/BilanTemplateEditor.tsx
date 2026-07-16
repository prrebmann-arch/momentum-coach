'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import BilanQuestionLibraryModal, { type LibraryQuestion } from './BilanQuestionLibraryModal'
import styles from '@/styles/bilan-templates.module.css'

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
  column: 'quotidien' | 'complet'
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
    default:               return t
  }
}

interface Props {
  templateId: string | null
  onSaved: () => void
  onCancel: () => void
}

export default function BilanTemplateEditor({ templateId, onSaved, onCancel }: Props) {
  const supabase = createClient()
  const { user } = useAuth()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!templateId)

  const [showLibrary, setShowLibrary] = useState<'quotidien' | 'complet' | null>(null)
  const [showCustomForm, setShowCustomForm] = useState<CustomFormState | null>(null)

  useEffect(() => {
    if (!templateId || !user) return
    const load = async () => {
      const [{ data: tpl }, { data: qs }] = await Promise.all([
        supabase.from('bilan_templates').select('name, description').eq('id', templateId).single(),
        supabase
          .from('bilan_template_questions')
          .select('id, bilan_type, builtin_field, question_id, is_required, sort_order, bilan_questions(key, label, type, unit, options)')
          .eq('template_id', templateId)
          .order('sort_order'),
      ])
      if (tpl) {
        setName(tpl.name)
        setDescription(tpl.description || '')
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

  const colQuestions = (col: 'quotidien' | 'complet') =>
    questions.filter((q) => q.bilan_type === col).sort((a, b) => a.sort_order - b.sort_order)

  const alreadySelected = (col: 'quotidien' | 'complet') =>
    questions.filter((q) => q.bilan_type === col).map((q) => q.field ?? q.key ?? '')

  function move(q: TemplateQuestion, dir: -1 | 1) {
    const col = colQuestions(q.bilan_type)
    const idx = col.findIndex((x) => (x.field ?? x.key) === (q.field ?? q.key))
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= col.length) return
    const next = [...col]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    const reindexed = next.map((item, i) => ({ ...item, sort_order: i }))
    setQuestions((prev) => [
      ...prev.filter((x) => x.bilan_type !== q.bilan_type),
      ...reindexed,
    ])
  }

  function remove(q: TemplateQuestion) {
    setQuestions((prev) =>
      prev.filter((x) => !(x.bilan_type === q.bilan_type && (x.field ?? x.key) === (q.field ?? q.key)))
    )
  }

  function toggleRequired(q: TemplateQuestion) {
    setQuestions((prev) =>
      prev.map((x) =>
        x.bilan_type === q.bilan_type && (x.field ?? x.key) === (q.field ?? q.key)
          ? { ...x, required: !x.required }
          : x
      )
    )
  }

  function addFromLibrary(col: 'quotidien' | 'complet', qs: LibraryQuestion[]) {
    const offset = colQuestions(col).length
    const toAdd: TemplateQuestion[] = qs.map((q, i) => ({
      bilan_type: col,
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
    setShowLibrary(null)
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

    const col = form.column
    const offset = colQuestions(col).length
    setQuestions((prev) => [
      ...prev,
      {
        bilan_type: col,
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
        await supabase
          .from('bilan_templates')
          .update({ name: name.trim(), description: description.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', tid)
      } else {
        const { data } = await supabase
          .from('bilan_templates')
          .insert({ coach_id: user.id, name: name.trim(), description: description.trim() || null })
          .select('id')
          .single()
        tid = data?.id ?? null
      }
      if (!tid) { toast('Erreur lors de la sauvegarde', 'error'); setSaving(false); return }

      await supabase.from('bilan_template_questions').delete().eq('template_id', tid)

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
      </div>

      <div className={styles.editorCols}>
        {(['quotidien', 'complet'] as const).map((col) => (
          <div key={col} className={styles.editorCol}>
            <div className={styles.colTitle}>
              <i className={col === 'quotidien' ? 'fas fa-sun' : 'fas fa-calendar-check'} />
              {col === 'quotidien' ? 'Bilan Quotidien' : 'Bilan Complet'}
              <span className={styles.colSubtitle}>
                {col === 'complet' ? '· questions supplémentaires' : '· questions de base'}
              </span>
            </div>

            {colQuestions(col).length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: 12 }}>
                Aucune question — ajoute depuis la bibliothèque
              </div>
            )}

            {colQuestions(col).map((q, idx, arr) => (
              <div key={q.field ?? q.key} className={styles.questionRow}>
                <div className={styles.reorderBtns}>
                  <button className={styles.reorderBtn} onClick={() => move(q, -1)} disabled={idx === 0}>▲</button>
                  <button className={styles.reorderBtn} onClick={() => move(q, 1)} disabled={idx === arr.length - 1}>▼</button>
                </div>
                <span className={styles.questionRowLabel}>{q.label}</span>
                {q.unit && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{q.unit}</span>}
                <span className={`${styles.typeBadge} ${TYPE_BADGE_CLASS[q.input_type] ?? ''}`}>
                  {formatType(q.input_type)}
                </span>
                <label className={styles.requiredToggle}>
                  <input type="checkbox" checked={q.required} onChange={() => toggleRequired(q)} />
                  Req.
                </label>
                <button className={styles.deleteBtn} onClick={() => remove(q)}>×</button>
              </div>
            ))}

            <div className={styles.addBtns}>
              <button className={styles.addBtn} onClick={() => setShowLibrary(col)}>
                <i className="fas fa-plus" /> Depuis la bibliothèque
              </button>
              <button
                className={styles.addBtn}
                onClick={() => setShowCustomForm({ column: col, label: '', input_type: 'slider_1_10', unit: '', options: '' })}
              >
                <i className="fas fa-pencil-alt" /> Question custom
              </button>
            </div>

            {showCustomForm?.column === col && (
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
                      className="form-control"
                      style={{ fontSize: 12 }}
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
        ))}
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
          bilanType={showLibrary}
          alreadySelected={alreadySelected(showLibrary)}
          onAdd={(qs) => addFromLibrary(showLibrary, qs)}
          onClose={() => setShowLibrary(null)}
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
