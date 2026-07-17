'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import styles from '@/styles/bilan-templates.module.css'

export interface LibraryQuestion {
  type: 'builtin' | 'custom'
  field?: string
  key?: string
  question_id?: string
  label: string
  input_type: string
  unit?: string
  options?: string[]
  category?: string
}

const BUILTIN_QUOTIDIEN: LibraryQuestion[] = [
  { type: 'builtin', field: 'weight',            label: 'Poids',               input_type: 'number',      unit: 'kg',  category: 'physical'  },
  { type: 'builtin', field: 'energy',            label: 'Énergie',             input_type: 'slider_1_10',              category: 'mental'    },
  { type: 'builtin', field: 'stress',            label: 'Stress',              input_type: 'slider_1_10',              category: 'mental'    },
  { type: 'builtin', field: 'sleep_quality',     label: 'Qualité du sommeil',  input_type: 'slider_1_10',              category: 'sleep'     },
  { type: 'builtin', field: 'soreness',          label: 'Courbatures',         input_type: 'slider_1_10',              category: 'physical'  },
  { type: 'builtin', field: 'session_enjoyment', label: 'Plaisir séance',      input_type: 'slider_1_10',              category: 'training'  },
  { type: 'builtin', field: 'cardio_minutes',    label: 'Cardio (min)',        input_type: 'number',      unit: 'min', category: 'training'  },
  { type: 'builtin', field: 'bedtime',           label: 'Heure coucher',       input_type: 'time',                     category: 'sleep'     },
  { type: 'builtin', field: 'wakeup',            label: 'Heure réveil',        input_type: 'time',                     category: 'sleep'     },
  { type: 'builtin', field: 'sleep_efficiency',  label: 'Efficacité sommeil',  input_type: 'number',      unit: '%',   category: 'sleep'     },
  { type: 'builtin', field: 'sick_signs',        label: 'Signes de maladie',   input_type: 'boolean',                  category: 'health'    },
  { type: 'builtin', field: 'adherence',         label: 'Adhérence',           input_type: 'slider_1_10',              category: 'training'  },
  { type: 'builtin', field: 'positive_week',     label: 'Point positif',       input_type: 'text_long',                category: 'mental'    },
  { type: 'builtin', field: 'negative_week',     label: 'Point à améliorer',   input_type: 'text_long',                category: 'mental'    },
  { type: 'builtin', field: 'general_notes',     label: 'Notes générales',     input_type: 'text_long',                category: 'other'     },
]

const BUILTIN_COMPLET: LibraryQuestion[] = [
  { type: 'builtin', field: 'belly_measurement', label: 'Tour de ventre',      input_type: 'number', unit: 'cm', category: 'physical' },
  { type: 'builtin', field: 'hip_measurement',   label: 'Tour de hanches',     input_type: 'number', unit: 'cm', category: 'physical' },
  { type: 'builtin', field: 'thigh_measurement', label: 'Tour de cuisses',     input_type: 'number', unit: 'cm', category: 'physical' },
  { type: 'builtin', field: 'photo_front',       label: 'Photo face',          input_type: 'photo',               category: 'physical' },
  { type: 'builtin', field: 'photo_side',        label: 'Photo profil',        input_type: 'photo',               category: 'physical' },
  { type: 'builtin', field: 'photo_back',        label: 'Photo dos',           input_type: 'photo',               category: 'physical' },
]

const CATEGORIES = [
  { key: 'all',        label: 'Tous'          },
  { key: 'physical',   label: 'Physique'      },
  { key: 'mental',     label: 'Mental'        },
  { key: 'sleep',      label: 'Sommeil'       },
  { key: 'training',   label: 'Entraînement'  },
  { key: 'nutrition',  label: 'Nutrition'     },
  { key: 'health',     label: 'Santé'         },
]

interface Props {
  bilanType: 'quotidien' | 'complet'
  alreadySelected: string[]
  onAdd: (questions: LibraryQuestion[]) => void
  onClose: () => void
}

export default function BilanQuestionLibraryModal({ bilanType, alreadySelected, onAdd, onClose }: Props) {
  const { user } = useAuth()
  const [category, setCategory] = useState('all')
  const [customQuestions, setCustomQuestions] = useState<LibraryQuestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadingCustom, setLoadingCustom] = useState(true)

  // Show all builtin questions regardless of bilanType — the distinction is now per-template
  const builtins = [...BUILTIN_QUOTIDIEN, ...BUILTIN_COMPLET]

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('bilan_questions')
      .select('id, key, label, type, options, unit, category')
      .or(`coach_id.eq.${user.id},is_system.eq.true`)
      .order('label')
      .then(({ data, error }: { data: any[] | null; error: any }) => {
        if (error) { console.error('[BilanQuestionLibraryModal]', error); return }
        const mapped: LibraryQuestion[] = (data ?? []).map((q: any) => ({
          type: 'custom' as const,
          key: q.key,
          question_id: q.id,
          label: q.label,
          input_type: q.type,
          unit: q.unit ?? undefined,
          options: Array.isArray(q.options) ? q.options : undefined,
          category: q.category ?? undefined,
        }))
        setCustomQuestions(mapped)
        setLoadingCustom(false)
      })
  }, [user])

  const allQuestions: LibraryQuestion[] = [...builtins, ...customQuestions]

  const getKey = (q: LibraryQuestion) => q.type === 'builtin' ? `builtin:${q.field}` : `custom:${q.key}`

  const available = allQuestions.filter((q) => !alreadySelected.includes(q.field ?? q.key ?? ''))

  const filtered = category === 'all' ? available : available.filter((q) => q.category === category)

  const toggle = (q: LibraryQuestion) => {
    const k = getKey(q)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const handleAdd = () => {
    const toAdd = allQuestions.filter((q) => selected.has(getKey(q)))
    onAdd(toAdd)
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Bibliothèque de questions</div>
            <div className={styles.modalSub}>Sélectionnez les questions à ajouter au bilan {bilanType === 'quotidien' ? 'quotidien' : 'complet'}</div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className={styles.modalCategoryBar}>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`${styles.categoryTab} ${category === c.key ? styles.categoryTabActive : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className={styles.modalBody}>
          {loadingCustom ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Aucune question disponible dans cette catégorie
            </div>
          ) : (
            filtered.map((q) => {
              const k = getKey(q)
              const isSelected = selected.has(k)
              return (
                <label key={k} className={`${styles.questionRow} ${isSelected ? styles.questionRowSelected : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(q)}
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.questionLabel}>{q.label}</div>
                    {q.unit && <span className={styles.questionUnit}>{q.unit}</span>}
                  </div>
                  <span className={`${styles.inputTypeBadge} ${styles[`inputType_${q.input_type.replace(/_/g, '')}`] ?? ''}`}>
                    {formatInputType(q.input_type)}
                  </span>
                  {q.type === 'builtin' && (
                    <span className={styles.builtinPill}>Intégré</span>
                  )}
                </label>
              )
            })
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button
            className="btn btn-red"
            disabled={selected.size === 0}
            onClick={handleAdd}
          >
            <i className="fa-solid fa-plus" />
            Ajouter {selected.size > 0 ? `${selected.size} question${selected.size > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatInputType(type: string): string {
  switch (type) {
    case 'slider_1_10': return '1–10'
    case 'number':      return 'Nombre'
    case 'text_long':   return 'Texte'
    case 'boolean':     return 'Oui/Non'
    case 'time':        return 'Heure'
    case 'photo':       return 'Photo'
    default:            return type
  }
}
