'use client'

import { Q_TYPES, PHOTO_POSITIONS } from '@/components/questionnaires/QuestionnaireAnswer'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface QuickQuestion {
  id: string
  label: string
  type: string
  options?: string[]
  position?: string
  required: boolean
}

export function QuickQuestionnaireEditor({
  questions,
  onChange,
}: {
  questions: QuickQuestion[]
  onChange: (questions: QuickQuestion[]) => void
}) {
  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '20px 0 12px' }}>Questions</h3>
      {questions.map((q: any, i: number) => (
        <div key={i} style={{ background: 'var(--bg3, var(--bg2))', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--text3)', fontSize: 13, minWidth: 24 }}>#{i + 1}</span>
            <input type="text" className="form-control" style={{ flex: 1 }} value={q.label} onChange={(e) => {
              const nq = [...questions]; nq[i] = { ...nq[i], label: e.target.value }; onChange(nq)
            }} placeholder="Texte de la question" />
            <select className="form-control" style={{ width: 160 }} value={q.type} onChange={(e) => {
              const nq = [...questions]; nq[i] = { ...nq[i], type: e.target.value }; onChange(nq)
            }}>
              {Q_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => {
              onChange(questions.filter((_, j) => j !== i))
            }}><i className="fas fa-trash" /></button>
          </div>
          {q.type === 'choice' && (
            <textarea className="form-control" rows={3} placeholder="Option 1&#10;Option 2&#10;Option 3" value={(q.options || []).join('\n')} onChange={(e) => {
              const nq = [...questions]; nq[i] = { ...nq[i], options: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean) }; onChange(nq)
            }} />
          )}
          {q.type === 'photo' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Position</label>
              <select className="form-control" style={{ width: 140 }} value={q.position || 'front'} onChange={(e) => {
                const nq = [...questions]; nq[i] = { ...nq[i], position: e.target.value }; onChange(nq)
              }}>
                {PHOTO_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Face/Profil/Dos s&apos;ajouteront automatiquement à la page Bilans.</span>
            </div>
          )}
        </div>
      ))}
      <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => {
        onChange([...questions, { id: crypto.randomUUID(), label: '', type: 'text', options: [], required: false }])
      }}><i className="fas fa-plus" /> Ajouter une question</button>
    </div>
  )
}
