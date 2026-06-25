# Coach AI Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "IA" tab to each athlete page where the coach types natural-language instructions and Claude generates structured workout/nutrition plan previews before writing to the DB.

**Architecture:** Three new files — a POST API route that gathers athlete context and calls Claude (`/api/coach-ai`), a POST API route that writes validated previews to the DB (`/api/coach-ai/apply`), and a client-side page that manages the instruction → clarification → preview → apply flow (`/athletes/[id]/ia/page.tsx`). The athlete layout's `TABS` array gains one new entry.

**Tech Stack:** Next.js 16 App Router, `@anthropic-ai/sdk` (already installed), `claude-sonnet-4-6`, Supabase service role for context reads, service role for DB writes in apply route.

## Global Constraints

- French language — all UI text and Claude responses in French
- No new exercises or foods created — Claude references IDs from `exercices` and `aliments_db` only
- `ANTHROPIC_API_KEY` already set in Vercel — do not add new env vars
- All API routes call `verifyAuth()` from `lib/api/auth.ts`
- Use `user.id` (from `verifyAuth`) for `coach_id` on all inserts — never `coach.id` (that's the coach_profiles PK — see lessons.md)
- `exercices` column in `workout_sessions` is stored as `JSON.stringify()` — match existing pattern
- `meals_data` column in `nutrition_plans` is stored as `JSON.stringify()` — match existing pattern
- All React hooks declared before any early-return (lessons.md)
- Model: `claude-sonnet-4-6`, max_tokens: 4096

---

### Task 1: Add "IA" tab to athlete navigation

**Files:**
- Modify: `app/(app)/athletes/[id]/layout.tsx:10-27`

**Interfaces:**
- Consumes: existing `TABS` array
- Produces: `{ label: 'IA', route: 'ia', icon: 'fa-wand-magic-sparkles' }` entry; route `/athletes/[id]/ia` is active-highlighted when pathname ends with `/ia`

- [ ] **Step 1: Add the IA tab entry**

In `app/(app)/athletes/[id]/layout.tsx`, append to the `TABS` array after the `'Sang'` entry:

```ts
const TABS = [
  { label: 'Apercu',     route: 'apercu',          icon: 'fa-eye' },
  { label: 'Onboard.',   route: 'onboarding',       icon: 'fa-flag-checkered' },
  { label: 'Infos',      route: 'infos',            icon: 'fa-id-card' },
  { label: 'Entr.',      route: 'training',         icon: 'fa-dumbbell' },
  { label: 'Nutrition',  route: 'nutrition',        icon: 'fa-utensils' },
  { label: 'Roadmap',    route: 'roadmap',          icon: 'fa-route' },
  { label: 'Bilans',     route: 'bilans',           icon: 'fa-clipboard-check' },
  { label: 'Videos',     route: 'videos',           icon: 'fa-video' },
  { label: 'Retours',    route: 'retours',          icon: 'fa-comments' },
  { label: 'Posing',     route: 'posing',           icon: 'fa-person' },
  { label: 'FODMAP',     route: 'fodmap',           icon: 'fa-vial' },
  { label: 'Quest.',     route: 'questionnaires',   icon: 'fa-clipboard-list' },
  { label: 'Suppl.',     route: 'supplements',      icon: 'fa-capsules' },
  { label: 'Routine',    route: 'routine',          icon: 'fa-sun' },
  { label: 'Menstr.',    route: 'menstrual',        icon: 'fa-calendar-days' },
  { label: 'Sang',       route: 'bloodtest',        icon: 'fa-droplet' },
  { label: 'IA',         route: 'ia',               icon: 'fa-wand-magic-sparkles' },
]
```

- [ ] **Step 2: Build check**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from this file (page.tsx doesn't exist yet, but href targets aren't validated at build time).

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/athletes/\[id\]/layout.tsx
git commit -m "feat(ia): add IA tab to athlete navigation"
```

---

### Task 2: Create `/api/coach-ai` route

**Files:**
- Create: `app/api/coach-ai/route.ts`

**Interfaces:**
- Consumes: `POST { athleteId: string, instruction: string, clarifications?: string }` with `Authorization: Bearer <token>`
- Produces:
  - `{ type: 'clarification', questions: string[] }` when info is missing
  - `{ type: 'preview', action: 'create_program'|'update_program'|'create_nutrition'|'update_nutrition', summary: string, data: object }` when ready

- [ ] **Step 1: Create the route file**

Create `app/api/coach-ai/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

const SYSTEM_PROMPT_TEMPLATE = `Tu es l'assistant IA du coach sur l'app Momentum.
Tu travailles TOUJOURS sur un athlète spécifique : {athleteName}.

RÈGLES STRICTES :
1. Tu n'utilises QUE les exercices de la liste fournie (champ "exercices_disponibles").
   Ne crée jamais un exercice qui n'y est pas. Si l'exercice demandé n'existe pas, signale-le dans la clarification.
2. Tu n'utilises QUE les aliments de la liste fournie (champ "aliments_disponibles").
   Ne crée jamais un aliment qui n'y est pas. Si l'aliment demandé n'existe pas, signale-le dans la clarification.
3. Si des informations critiques manquent (jour d'une séance, nombre de séries, aliment non précisé),
   liste TOUTES les questions manquantes en une seule réponse JSON de type "clarification".
   Ne génère pas un programme incomplet.
4. Quand tu génères, retourne UNIQUEMENT du JSON valide correspondant au schéma demandé.
   Pas de texte libre, pas de markdown autour du JSON.

CONTEXTE ATHLÈTE :
{athleteContext}

EXERCICES DISPONIBLES :
{exercicesJson}

ALIMENTS DISPONIBLES :
{alimentsJson}

SCHÉMA CLARIFICATION (quand il manque des infos) :
{"type":"clarification","questions":["question 1","question 2"]}

SCHÉMA PROGRAMME (create) :
{"type":"preview","action":"create_program","summary":"1-2 phrases","data":{"nom":"string","pattern_type":"fixed","sessions":[{"nom":"string","jour":1,"ordre":0,"exercices":[{"exercice_id":"uuid","nom":"string","muscle_principal":"string","sets":[{"type":"normal","reps":"8-10","tempo":"3-1-2-0","repos":90,"kg":null}]}]}]}}

SCHÉMA PROGRAMME (update — inclure programme_id) :
{"type":"preview","action":"update_program","summary":"1-2 phrases","data":{"programme_id":"uuid","nom":"string","pattern_type":"fixed","sessions":[...]}}

SCHÉMA NUTRITION (create) :
{"type":"preview","action":"create_nutrition","summary":"1-2 phrases","data":{"nom":"string","meal_type":"training","calories_objectif":2500,"proteines":180,"glucides":300,"lipides":70,"meals_data":[{"meal_index":0,"nom":"Petit-déjeuner","foods":[{"aliment_id":"uuid","nom":"string","qte":100,"kcal":350,"p":12,"g":45,"l":8}]}]}}

SCHÉMA NUTRITION (update — inclure plan_id) :
{"type":"preview","action":"update_nutrition","summary":"1-2 phrases","data":{"plan_id":"uuid","nom":"string","meal_type":"training","calories_objectif":2500,"proteines":180,"glucides":300,"lipides":70,"meals_data":[...]}}`

export async function POST(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const { athleteId, instruction, clarifications } = await req.json()
  if (!athleteId || !instruction) {
    return NextResponse.json({ error: 'missing athleteId or instruction' }, { status: 400 })
  }

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  const { data: athlete } = await admin
    .from('athletes')
    .select('id, prenom, nom')
    .eq('id', athleteId)
    .eq('coach_id', user.id)
    .single()
  if (!athlete) return NextResponse.json({ error: 'athlete not found or forbidden' }, { status: 404 })

  const [progsRes, nutrRes, exsRes, alimRes] = await Promise.all([
    admin
      .from('workout_programs')
      .select('id, nom, workout_sessions(nom, jour, ordre)')
      .eq('athlete_id', athleteId)
      .limit(20),
    admin
      .from('nutrition_plans')
      .select('id, nom, calories_objectif, proteines, glucides, lipides')
      .eq('athlete_id', athleteId)
      .limit(20),
    admin
      .from('exercices')
      .select('id, nom, muscle_principal, muscle_secondaire, categorie')
      .or(`coach_id.eq.${user.id},coach_id.is.null`)
      .limit(500),
    admin
      .from('aliments_db')
      .select('id, nom, calories, proteines, glucides, lipides')
      .or(`coach_id.eq.${user.id},coach_id.is.null`)
      .limit(1000),
  ])

  const athleteContext = JSON.stringify({
    programmes_existants: progsRes.data || [],
    plans_nutritionnels_existants: nutrRes.data || [],
  })

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{athleteName}', `${athlete.prenom} ${athlete.nom}`)
    .replace('{athleteContext}', athleteContext)
    .replace('{exercicesJson}', JSON.stringify(exsRes.data || []))
    .replace('{alimentsJson}', JSON.stringify(alimRes.data || []))

  const userMessage = clarifications
    ? `Instruction initiale : ${instruction}\n\nRéponses aux questions : ${clarifications}`
    : instruction

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  let responseText: string
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('no text block in response')
    responseText = textBlock.text.trim()
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }
  } catch (e: any) {
    console.error('[coach-ai] claude error', e)
    return NextResponse.json({ error: 'claude_error', detail: e.message }, { status: 502 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    console.error('[coach-ai] json parse error', responseText.slice(0, 300))
    return NextResponse.json({ error: 'invalid_json', detail: responseText.slice(0, 300) }, { status: 502 })
  }

  return NextResponse.json(parsed)
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add app/api/coach-ai/route.ts
git commit -m "feat(ia): add /api/coach-ai route — context gathering + Claude call"
```

---

### Task 3: Create `/api/coach-ai/apply` route

**Files:**
- Create: `app/api/coach-ai/apply/route.ts`

**Interfaces:**
- Consumes: `POST { athleteId: string, action: 'create_program'|'update_program'|'create_nutrition'|'update_nutrition', data: object }`
- Produces: `{ ok: true, programme_id?: string }` on success, error JSON on failure

- [ ] **Step 1: Create the apply route**

Create `app/api/coach-ai/apply/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const { athleteId, action, data } = await req.json()
  if (!athleteId || !action || !data) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  // Verify ownership
  const { data: athlete } = await admin
    .from('athletes')
    .select('id')
    .eq('id', athleteId)
    .eq('coach_id', user.id)
    .single()
  if (!athlete) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  if (action === 'create_program')  return applyCreateProgram(admin, user.id, athleteId, data)
  if (action === 'update_program')  return applyUpdateProgram(admin, user.id, athleteId, data)
  if (action === 'create_nutrition') return applyCreateNutrition(admin, user.id, athleteId, data)
  if (action === 'update_nutrition') return applyUpdateNutrition(admin, user.id, athleteId, data)

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

async function applyCreateProgram(admin: SupabaseClient, coachId: string, athleteId: string, data: any) {
  const { data: prog, error: progErr } = await admin
    .from('workout_programs')
    .insert({
      nom: data.nom,
      athlete_id: athleteId,
      coach_id: coachId,
      pattern_type: data.pattern_type || 'fixed',
      actif: true,
    })
    .select('id')
    .single()
  if (progErr || !prog) {
    console.error('[coach-ai/apply] create_program', progErr)
    return NextResponse.json({ error: progErr?.message || 'insert failed' }, { status: 500 })
  }

  for (let i = 0; i < (data.sessions || []).length; i++) {
    const s = data.sessions[i]
    const { error: sessErr } = await admin.from('workout_sessions').insert({
      nom: s.nom,
      jour: s.jour ?? null,
      program_id: prog.id,
      exercices: JSON.stringify(s.exercices || []),
      ordre: s.ordre ?? i,
    })
    if (sessErr) {
      console.error('[coach-ai/apply] insert session', sessErr)
      return NextResponse.json({ error: sessErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, programme_id: prog.id })
}

async function applyUpdateProgram(admin: SupabaseClient, _coachId: string, athleteId: string, data: any) {
  const programmeId = data.programme_id
  if (!programmeId) return NextResponse.json({ error: 'missing programme_id' }, { status: 400 })

  const { data: existing } = await admin
    .from('workout_programs')
    .select('id')
    .eq('id', programmeId)
    .eq('athlete_id', athleteId)
    .single()
  if (!existing) return NextResponse.json({ error: 'program not found' }, { status: 404 })

  const { error: updErr } = await admin
    .from('workout_programs')
    .update({ nom: data.nom, pattern_type: data.pattern_type || 'fixed' })
    .eq('id', programmeId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const { error: delErr } = await admin.from('workout_sessions').delete().eq('program_id', programmeId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  for (let i = 0; i < (data.sessions || []).length; i++) {
    const s = data.sessions[i]
    const { error: sessErr } = await admin.from('workout_sessions').insert({
      nom: s.nom,
      jour: s.jour ?? null,
      program_id: programmeId,
      exercices: JSON.stringify(s.exercices || []),
      ordre: s.ordre ?? i,
    })
    if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

async function applyCreateNutrition(admin: SupabaseClient, coachId: string, athleteId: string, data: any) {
  const { error } = await admin.from('nutrition_plans').insert({
    nom: data.nom,
    athlete_id: athleteId,
    coach_id: coachId,
    meal_type: data.meal_type || 'both',
    calories_objectif: data.calories_objectif,
    proteines: data.proteines,
    glucides: data.glucides,
    lipides: data.lipides,
    meals_data: JSON.stringify(data.meals_data || []),
    actif: true,
    valid_from: new Date().toISOString().split('T')[0],
  })
  if (error) {
    console.error('[coach-ai/apply] create_nutrition', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

async function applyUpdateNutrition(admin: SupabaseClient, _coachId: string, athleteId: string, data: any) {
  const planId = data.plan_id
  if (!planId) return NextResponse.json({ error: 'missing plan_id' }, { status: 400 })

  const { data: existing } = await admin
    .from('nutrition_plans')
    .select('id')
    .eq('id', planId)
    .eq('athlete_id', athleteId)
    .single()
  if (!existing) return NextResponse.json({ error: 'plan not found' }, { status: 404 })

  const { error } = await admin.from('nutrition_plans').update({
    nom: data.nom,
    meal_type: data.meal_type || 'both',
    calories_objectif: data.calories_objectif,
    proteines: data.proteines,
    glucides: data.glucides,
    lipides: data.lipides,
    meals_data: JSON.stringify(data.meals_data || []),
  }).eq('id', planId)
  if (error) {
    console.error('[coach-ai/apply] update_nutrition', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/coach-ai/apply/route.ts
git commit -m "feat(ia): add /api/coach-ai/apply route — DB writes for programs and nutrition"
```

---

### Task 4: Create the IA page UI

**Files:**
- Create: `app/(app)/athletes/[id]/ia/page.tsx`

**Interfaces:**
- Consumes: `useParams<{ id }>`, `useAuth` (for `accessToken`)
- Produces: page with 5 states: `idle` → `loading` → `clarification` → `preview` → `success`

- [ ] **Step 1: Create the page**

Create `app/(app)/athletes/[id]/ia/page.tsx`:

```tsx
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

  // All state declared before any early-return (lessons.md rule)
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
    if (!res.ok) throw new Error(json.error || 'Erreur serveur')
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
    } catch (e: any) {
      setError(e.message)
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
    } catch (e: any) {
      setError(e.message)
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
    } catch (e: any) {
      setError(e.message)
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
        <div style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid rgba(220,38,38,0.2)' }}>
          {error}
        </div>
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
```

- [ ] **Step 2: Build check**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH && npm run build 2>&1 | tail -30
```

Expected: build succeeds. Fix any TS errors in the new file before committing.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/athletes/[id]/ia/page.tsx"
git commit -m "feat(ia): add IA tab page — idle/loading/clarification/preview/success states"
```

---

### Task 5: Update ARCHITECTURE.md

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Add new route in section 2**

In section 2 (Routes), after the `/athletes/[id]/bloodtest/validate/[upload_id]` row, add:
```
| `/athletes/[id]/ia` | `ia/page.tsx` | Coach AI tab — natural-language instruction → Claude preview → DB write |
```

- [ ] **Step 2: Add new API routes in section 3**

In section 3 (API Routes), after the `/api/bloodtest/signed-url` row, add:
```
| `/api/coach-ai` | POST | `coach-ai/route.ts` | Gathers athlete context (programs, nutrition, exercises, foods) + calls Claude Sonnet → `{type:'clarification'}` or `{type:'preview'}` |
| `/api/coach-ai/apply` | POST | `coach-ai/apply/route.ts` | Writes validated preview to DB: `workout_programs`+`workout_sessions` or `nutrition_plans` |
```

- [ ] **Step 3: Add entries in section 11 (Where to look for X)**

```
| Modify Coach AI system prompt or model | `app/api/coach-ai/route.ts` (`SYSTEM_PROMPT_TEMPLATE`) |
| Modify Coach AI DB write logic | `app/api/coach-ai/apply/route.ts` |
| Modify Coach AI UI states | `app/(app)/athletes/[id]/ia/page.tsx` |
```

- [ ] **Step 4: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "chore: update ARCHITECTURE.md with IA tab routes"
```

---

### Task 6: PR to develop

- [ ] **Step 1: Push feature branch**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH && git branch --show-current
# Should be on a feature/ia-tab branch. If still on develop, create one first:
# git checkout -b feature/coach-ai-tab
git push -u origin HEAD
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --base develop \
  --title "feat(ia): Coach AI tab — natural language → plan preview → DB write" \
  --body "$(cat <<'EOF'
## Summary
- Adds \"IA\" tab to athlete navigation (icon: wand-magic-sparkles)
- POST /api/coach-ai: gathers athlete context (programs, nutrition plans, exercises DB, foods DB) and calls Claude Sonnet 4.6 — returns clarification questions or structured preview JSON
- POST /api/coach-ai/apply: writes validated preview to workout_programs+workout_sessions or nutrition_plans (full replace for updates)
- Client page with 5 states: idle → loading → clarification → preview → success

## Test plan
- [ ] Navigate to any athlete → IA tab visible and clickable
- [ ] Type a complete program instruction → Claude returns program preview with valid exercise IDs from DB
- [ ] Click Créer → program appears in Training tab
- [ ] Type an incomplete instruction (missing sets/days) → Claude returns clarification questions
- [ ] Answer questions → Claude returns preview → click Créer → saved
- [ ] Type a nutrition instruction → nutrition preview shows meals+foods
- [ ] Click Créer → plan appears in Nutrition tab
- [ ] Reference an existing program by name → update_program replaces sessions
- [ ] Verify Claude never fabricates exercise/food IDs outside the DB

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
