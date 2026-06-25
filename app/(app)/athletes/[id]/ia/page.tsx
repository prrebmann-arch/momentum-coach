'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

type UIState = 'idle' | 'loading' | 'clarification' | 'preview' | 'success'

interface PreviewResponse {
  type: 'preview'
  action: 'create_program' | 'update_program' | 'create_nutrition' | 'update_nutrition'
  summary: string
  data: Record<string, unknown>
}

function ProgramPreview({ data }: { data: Record<string, unknown> }) {
  const sessions = (data.sessions as any[]) || []
  return (
    <div>
      <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>{data.nom as string}</h4>
      {sessions.map((s: any, i: number) => (
        <div key={i} style={{ marginBottom: 16, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{s.nom} — Jour {s.jour}</div>
          {(s.exercices || []).map((ex: any, j: number) => (
            <div key={j} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {ex.nom}{' '}
                <span style={{ color: 'var(--text-2)', fontSize: 12 }}>({ex.muscle_principal})</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', paddingLeft: 8 }}>
                {(ex.sets || []).length} séries ·{' '}
                {(ex.sets || []).map((set: any, k: number) => (
                  <span key={k} style={{ marginRight: 8 }}>{set.reps} reps · {set.repos}s repos</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function NutritionPreview({ data }: { data: Record<string, unknown> }) {
  const meals = (data.meals_data as any[]) || []
  return (
    <div>
      <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{data.nom as string}</h4>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
        {data.calories_objectif as number} kcal · P{data.proteines as number}g ·
        G{data.glucides as number}g · L{data.lipides as number}g
      </div>
      {meals.map((m: any, i: number) => (
        <div key={i} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{m.nom}</div>
          {(m.foods || []).map((f: any, j: number) => (
            <div key={j} style={{ fontSize: 13, marginBottom: 2 }}>
              {f.nom} — {f.qte}g{' '}
              <span style={{ color: 'var(--text-2)' }}>({f.kcal} kcal · P{f.p}g)</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function IAPage() {
  const params = useParams<{ id: string }>()
  const athleteId = params.id
  const { accessToken } = useAuth()
  const router = useRouter()

  const [uiState, setUIState] = useState<UIState>('idle')
  const [instruction, setInstruction] = useState('')
  const [clarificationAnswers, setClarificationAnswers] = useState('')
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([])
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function callCoachAI(body: Record<string, unknown>) {
    const res = await fetch('/api/coach-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.detail || json.error || 'Erreur serveur')
    return json
  }

  async function handleSubmit() {
    if (!instruction.trim()) return
    setError(null)
    setUIState('loading')
    try {
      const json = await callCoachAI({ athleteId, instruction })
      if (json.type === 'clarification') {
        setClarificationQuestions(json.questions || [])
        setUIState('clarification')
      } else if (json.type === 'preview') {
        setPreview(json as PreviewResponse)
        setUIState('preview')
      } else {
        throw new Error('Réponse inattendue de Claude')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
      setUIState('idle')
    }
  }

  async function handleSubmitClarification() {
    if (!clarificationAnswers.trim()) return
    setError(null)
    setUIState('loading')
    try {
      const json = await callCoachAI({ athleteId, instruction, clarifications: clarificationAnswers })
      if (json.type === 'clarification') {
        setClarificationQuestions(json.questions || [])
        setUIState('clarification')
      } else if (json.type === 'preview') {
        setPreview(json as PreviewResponse)
        setUIState('preview')
      } else {
        throw new Error('Réponse inattendue')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
      setUIState('clarification')
    }
  }

  async function handleApply() {
    if (!preview) return
    setUIState('loading')
    try {
      const res = await fetch('/api/coach-ai/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ athleteId, action: preview.action, data: preview.data }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur création')
      setUIState('success')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
      setUIState('preview')
    }
  }

  function handleReset() {
    setInstruction('')
    setClarificationAnswers('')
    setClarificationQuestions([])
    setPreview(null)
    setError(null)
    setUIState('idle')
  }

  const isProgram = preview?.action === 'create_program' || preview?.action === 'update_program'
  const targetRoute = isProgram ? 'training' : 'nutrition'

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    resize: 'vertical',
    padding: '12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-2)',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Assistant IA</h2>
      <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: 14 }}>
        Décris en français ce que tu veux créer ou modifier. Claude génère un aperçu avant d&apos;écrire quoi que ce soit.
      </p>

      {error && (
        <pre style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12, border: '1px solid rgba(220,38,38,0.2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
          {error}
        </pre>
      )}

      {uiState === 'idle' && (
        <div>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={`Ex : "Crée un programme Push/Pull/Legs 3 séances. Push : développé couché 4x8, dips 3x12, élévations latérales 3x15."`}
            rows={6}
            style={textareaStyle}
          />
          <button
            className="btn btn-red"
            onClick={handleSubmit}
            disabled={!instruction.trim()}
            style={{ marginTop: 12 }}
          >
            Envoyer
          </button>
        </div>
      )}

      {uiState === 'loading' && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" />
          <p style={{ marginTop: 12, color: 'var(--text-2)', fontSize: 14 }}>Claude analyse la demande…</p>
        </div>
      )}

      {uiState === 'clarification' && (
        <div>
          <div style={{ marginBottom: 16, padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 14 }}>Claude a besoin de précisions :</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {clarificationQuestions.map((q, i) => (
                <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>{q}</li>
              ))}
            </ul>
          </div>
          <textarea
            value={clarificationAnswers}
            onChange={(e) => setClarificationAnswers(e.target.value)}
            placeholder="Vos réponses aux questions ci-dessus…"
            rows={5}
            style={textareaStyle}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-red" onClick={handleSubmitClarification} disabled={!clarificationAnswers.trim()}>
              Envoyer les réponses
            </button>
            <button className="btn btn-outline" onClick={handleReset}>
              Recommencer
            </button>
          </div>
        </div>
      )}

      {uiState === 'preview' && preview && (
        <div>
          <div style={{ marginBottom: 16, padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-2)', fontStyle: 'italic' }}>{preview.summary}</p>
            {isProgram
              ? <ProgramPreview data={preview.data} />
              : <NutritionPreview data={preview.data} />
            }
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-red" onClick={handleApply}>
              {preview.action.startsWith('create') ? 'Créer' : 'Appliquer'}
            </button>
            <button className="btn btn-outline" onClick={handleReset}>
              Modifier ma demande
            </button>
          </div>
        </div>
      )}

      {uiState === 'success' && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <i className="fa-solid fa-circle-check fa-2x" style={{ color: '#22c55e' }} />
          <p style={{ marginTop: 12, fontSize: 16, fontWeight: 600 }}>
            {isProgram ? 'Programme créé !' : 'Plan nutritionnel créé !'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn-red" onClick={() => router.push(`/athletes/${athleteId}/${targetRoute}`)}>
              Voir {isProgram ? "l'entraînement" : 'la nutrition'}
            </button>
            <button className="btn btn-outline" onClick={handleReset}>
              Nouvelle demande
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
