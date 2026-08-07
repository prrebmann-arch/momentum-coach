# Cross-athlete Questionnaires Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/questionnaires` page listing questionnaire activity across all of the coach's athletes (completed responses + pending sends), with an accordion detail view, following the existing cross-athlete pattern used by `/bilans` and `/videos`.

**Architecture:** Extract the answer-rendering pieces already built for the per-athlete tab (`app/(app)/athletes/[id]/questionnaires/page.tsx`) into a shared file so both pages render answers identically without duplication. Add a new `QuestionnairesOverview` component (mirroring `components/bilans/BilansOverview.tsx`'s shape: `useAthleteContext()` for the athlete list, one cross-athlete Supabase query, `useRefetchOnResume`, filter buttons, accordion list). Wire it into the sidebar and into `ARCHITECTURE.md`. Separately, update the `notify_coach_on_questionnaire` trigger's `resource_link` via a standalone SQL file so the notification bell points at the new global view.

**Tech Stack:** Next.js 16 App Router, Supabase (`@supabase/ssr` browser client), TypeScript, inline styles (matches `athlete-tabs.module.css` per-athlete page's existing convention — no new CSS module needed).

## Global Constraints

- Reuse existing rendering code for answers (`Q_TYPES`, `PHOTO_POSITIONS`, `isPhotoAnswer`, `PhotoAnswer`, `QuestionRow`, `AnswerCell`) — do not reimplement it. `formatAnswer()` in the current per-athlete file is dead code (never called) — do not extract or reuse it, it is not part of the real rendering path.
- The overview page is read-only: sending new questionnaires stays exclusively on `/athletes/[id]/questionnaires`. Do not add a send/compose UI to the new page.
- Follow existing patterns: `useAthleteContext()` for the coach's athlete list (already loaded, no extra query), `useRefetchOnResume` for tab-return refresh, `AthletesList`-style cross-athlete query scoped by `athlete_id IN (...)`.
- SQL changes are hand-written, applied manually in the Supabase SQL Editor (repo convention — no migration tool). New file follows the header-comment style seen in `sql/rls_critical_tables.sql`.
- `sql/coach_notifications.sql` and its `coach_notifications` table/triggers already exist in the live Supabase database (applied manually in a prior session) even though the code implementing that feature (PR #248) is not yet merged to `develop`. Do not assume the file exists in this repo checkout — the SQL change in Task 4 is a standalone `CREATE OR REPLACE FUNCTION` that works whether or not #248 has merged yet.

---

## File Structure

- Create: `components/questionnaires/QuestionnaireAnswer.tsx` — shared answer-rendering pieces extracted from the per-athlete page.
- Create: `components/questionnaires/QuestionnairesOverview.tsx` — main cross-athlete list component.
- Create: `app/(app)/questionnaires/page.tsx` — thin page wrapper (mirrors `app/(app)/bilans/page.tsx`).
- Modify: `app/(app)/athletes/[id]/questionnaires/page.tsx` — import the extracted pieces instead of defining them locally; no behavior change.
- Modify: `components/layout/Sidebar.tsx` — add nav entry.
- Modify: `ARCHITECTURE.md` — document the new route/component.
- Create: `sql/update_questionnaire_notification_link.sql` — standalone `CREATE OR REPLACE FUNCTION` updating `notify_coach_on_questionnaire`'s `resource_link`.

---

### Task 1: Extract shared answer-rendering code

**Files:**
- Create: `components/questionnaires/QuestionnaireAnswer.tsx`
- Modify: `app/(app)/athletes/[id]/questionnaires/page.tsx`

**Interfaces:**
- Produces:
  - `export const Q_TYPES: { value: string; label: string; icon: string }[]`
  - `export const PHOTO_POSITIONS: { value: string; label: string }[]`
  - `export function isPhotoAnswer(answer: unknown): answer is string`
  - `export function PhotoAnswer({ pathOrUrl }: { pathOrUrl: string }): JSX.Element`
  - `export function QuestionRow({ index, question, typeIcon, answer, hasResponse }: { index: number; question: any; typeIcon: string; answer: any | undefined; hasResponse: boolean }): JSX.Element`
  - `export function AnswerCell({ question, answer }: { question: any; answer: any | undefined }): JSX.Element`

- [ ] **Step 1: Read the exact current source to copy verbatim**

The current file `app/(app)/athletes/[id]/questionnaires/page.tsx` has these pieces at the listed line ranges (verify line numbers haven't drifted before copying — read the file fresh):
- `Q_TYPES` (lines 16-22)
- `PHOTO_POSITIONS` (lines 24-29)
- `isPhotoAnswer` (lines 31-39)
- `PhotoAnswer` (lines 41-69)
- `QuestionRow` (lines 620-702)
- `AnswerCell` (lines 704-824)

Do NOT extract `formatAnswer` (lines 71-78) — grep the file first to confirm it has zero call sites (it is dead code, superseded by `AnswerCell`'s per-type rendering). Confirm with:
```bash
grep -n "formatAnswer(" "app/(app)/athletes/[id]/questionnaires/page.tsx"
```
Expected: only the definition line, no call sites. If a call site exists (meaning the codebase changed since this plan was written), extract `formatAnswer` too and add it to the exports list above — do not silently drop functionality.

- [ ] **Step 2: Create the shared file**

Create `components/questionnaires/QuestionnaireAnswer.tsx` with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Q_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'text', label: 'Texte libre', icon: 'fa-align-left' },
  { value: 'choice', label: 'Choix multiples', icon: 'fa-list-ul' },
  { value: 'rating', label: 'Note (1-10)', icon: 'fa-star' },
  { value: 'yesno', label: 'Oui / Non', icon: 'fa-toggle-on' },
  { value: 'photo', label: 'Photo', icon: 'fa-image' },
]

export const PHOTO_POSITIONS = [
  { value: 'front', label: 'Face' },
  { value: 'side', label: 'Profil' },
  { value: 'back', label: 'Dos' },
  { value: 'other', label: 'Autre' },
]

export function isPhotoAnswer(answer: unknown): answer is string {
  if (typeof answer !== 'string' || !answer) return false
  // URL http(s) athlete-photos OU se terminant par une extension image (avec ou sans query)
  if (/^https?:\/\//.test(answer)) {
    return /athlete-photos/.test(answer) || /\.(jpe?g|png|webp)(\?.*)?$/i.test(answer)
  }
  // Path style {uuid}/{date}_{position}.jpg — pas d'espace, pas de retour ligne, finit par .ext
  return /^[\w-]+\/[\w._-]+\.(jpe?g|png|webp)$/i.test(answer)
}

export function PhotoAnswer({ pathOrUrl }: { pathOrUrl: string }) {
  const supabase = createClient()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (/^https?:\/\//.test(pathOrUrl)) {
      setUrl(pathOrUrl)
      return
    }
    ;(async () => {
      const { data } = await supabase.storage
        .from('athlete-photos')
        .createSignedUrl(pathOrUrl, 60 * 60)
      if (!cancelled) setUrl(data?.signedUrl ?? null)
    })()
    return () => { cancelled = true }
  }, [pathOrUrl, supabase])

  if (!url) {
    return <span style={{ color: 'var(--text3)', fontSize: 12 }}>Chargement…</span>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="Photo" style={{ maxWidth: 200, maxHeight: 280, borderRadius: 8, border: '1px solid var(--border)' }} />
    </a>
  )
}

// ── Question + answer row (used inside expanded assignment cards) ──
export function QuestionRow({
  index,
  question,
  typeIcon,
  answer,
  hasResponse,
}: {
  index: number
  question: any
  typeIcon: string
  answer: any | undefined
  hasResponse: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr',
        gap: 12,
        padding: '12px 14px',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'var(--bg3)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: 'var(--text2)',
          fontWeight: 800,
          fontSize: 13,
          position: 'relative',
        }}
        title={`Question #${index}`}
      >
        {index}
        <i
          className={`fa-solid ${typeIcon}`}
          style={{
            position: 'absolute',
            bottom: -6,
            right: -6,
            fontSize: 9,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            width: 16,
            height: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text2)',
          }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.4,
            marginBottom: hasResponse ? 8 : 0,
          }}
        >
          {question.label || '(sans label)'}
          {question.required && (
            <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 4, fontWeight: 700 }}>*</span>
          )}
        </div>
        {hasResponse && <AnswerCell question={question} answer={answer} />}
      </div>
    </div>
  )
}

export function AnswerCell({ question, answer }: { question: any; answer: any | undefined }) {
  if (!answer) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'rgba(148, 163, 184, 0.1)',
          color: 'var(--text2)',
          borderRadius: 8,
          fontSize: 12,
          fontStyle: 'italic',
        }}
      >
        <i className="fa-solid fa-minus" style={{ fontSize: 10 }} />
        Pas de réponse
      </div>
    )
  }

  const val = answer.answer

  if (question.type === 'photo' && isPhotoAnswer(val)) {
    return <PhotoAnswer pathOrUrl={val} />
  }

  if (question.type === 'yesno') {
    const isYes = !!val
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          background: isYes ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: isYes ? '#22c55e' : '#ef4444',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <i className={`fa-solid ${isYes ? 'fa-check' : 'fa-xmark'}`} />
        {isYes ? 'Oui' : 'Non'}
      </div>
    )
  }

  if (question.type === 'rating') {
    const num = typeof val === 'number' ? val : parseInt(String(val), 10) || 0
    const pct = Math.max(0, Math.min(100, (num / 10) * 100))
    const color = num >= 7 ? '#22c55e' : num >= 4 ? '#eab308' : '#ef4444'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1, minWidth: 48 }}>
          {num}
          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>/10</span>
        </span>
        <div
          style={{
            flex: 1,
            maxWidth: 200,
            height: 6,
            background: 'var(--bg3)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s ease' }} />
        </div>
      </div>
    )
  }

  if (question.type === 'choice') {
    const items = Array.isArray(val) ? val : [val]
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.filter(Boolean).map((it, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <i className="fa-solid fa-circle-check" style={{ fontSize: 9 }} />
            {String(it)}
          </span>
        ))}
      </div>
    )
  }

  // Default: text answer in a soft container
  return (
    <div
      style={{
        padding: '8px 12px',
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 13.5,
        color: 'var(--text)',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}
    >
      {String(val)}
    </div>
  )
}
```

- [ ] **Step 3: Update the per-athlete page to import from the shared file**

In `app/(app)/athletes/[id]/questionnaires/page.tsx`:

1. Delete the local definitions of `Q_TYPES`, `PHOTO_POSITIONS`, `isPhotoAnswer`, `PhotoAnswer`, `QuestionRow`, `AnswerCell` (lines 16-69 and 620-824 per Step 1's ranges — re-verify exact ranges before deleting since Step 1/2 may have shifted things).
2. Also delete `formatAnswer` (confirmed dead code in Step 1) — if Step 1 found a call site instead, keep it local (do not delete) and skip this sub-step.
3. Add the import:

```tsx
import { Q_TYPES, PHOTO_POSITIONS, isPhotoAnswer, PhotoAnswer, QuestionRow, AnswerCell } from '@/components/questionnaires/QuestionnaireAnswer'
```

Keep every other line of the file (state, `loadData`, `sendFromTemplate`, `sendQuickQuestionnaire`, `relance`, `deleteAssignment`, the JSX render) completely unchanged — this is a pure extraction, not a rewrite.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors referencing `components/questionnaires/QuestionnaireAnswer.tsx` or `app/(app)/athletes/[id]/questionnaires/page.tsx`.

- [ ] **Step 5: Manual no-regression check**

Run: `npm run build`
Expected: build succeeds (repo has `ignoreBuildErrors: true` but a successful build confirms no syntax/import breakage).

- [ ] **Step 6: Commit**

```bash
git add components/questionnaires/QuestionnaireAnswer.tsx "app/(app)/athletes/[id]/questionnaires/page.tsx"
git commit -m "refactor: extract shared questionnaire answer rendering"
```

---

### Task 2: `QuestionnairesOverview` component

**Files:**
- Create: `components/questionnaires/QuestionnairesOverview.tsx`

**Interfaces:**
- Consumes:
  - `useAuth()` from `contexts/AuthContext.tsx` → `{ user }`.
  - `useAthleteContext()` from `contexts/AthleteContext.tsx` → `{ athletes: Athlete[], loading: boolean }`. `Athlete` type from `@/lib/types` has `id: string`, `prenom: string`, `nom: string`.
  - `useToast()` from `contexts/ToastContext.tsx` → `{ toast }`.
  - `useRefetchOnResume` from `hooks/useRefetchOnResume.ts` — signature `(refetch: () => void, isLoading: boolean) => void`.
  - `createClient()` from `lib/supabase/client.ts`.
  - `Q_TYPES, QuestionRow` from `components/questionnaires/QuestionnaireAnswer.tsx` (Task 1).
  - `EmptyState` from `components/ui/EmptyState.tsx`, `Skeleton` from `components/ui/Skeleton.tsx` (same import paths as the per-athlete page).
- Produces: `export default function QuestionnairesOverview(): JSX.Element` — no props, self-contained (matches `BilansOverview`'s shape).

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import { Q_TYPES, QuestionRow } from '@/components/questionnaires/QuestionnaireAnswer'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'

/* eslint-disable @typescript-eslint/no-explicit-any */

type FilterKey = 'all' | 'completed' | 'pending'

const MAX_ASSIGNMENTS_LOAD = 200

export default function QuestionnairesOverview() {
  const supabase = createClient()
  const { user } = useAuth()
  const { athletes, loading: athletesLoading } = useAthleteContext()

  const [assignments, setAssignments] = useState<any[]>([])
  const [responsesMap, setResponsesMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const athleteMap = useMemo(() => {
    const m: Record<string, { prenom: string; nom: string }> = {}
    athletes.forEach((a) => { m[a.id] = { prenom: a.prenom || '', nom: a.nom || '' } })
    return m
  }, [athletes])

  const loadData = useCallback(async () => {
    if (!user) return
    const athleteIds = athletes.map((a) => a.id)
    if (!assignments.length) setLoading(true)
    try {
      if (!athleteIds.length) {
        setAssignments([])
        setResponsesMap({})
        return
      }
      const { data: assigns } = await supabase
        .from('questionnaire_assignments')
        .select('*, questionnaire_templates(titre)')
        .in('athlete_id', athleteIds)
        .order('sent_at', { ascending: false })
        .limit(MAX_ASSIGNMENTS_LOAD)

      const assignsData = assigns || []
      const completedIds = assignsData.filter((a: any) => a.status === 'completed').map((a: any) => a.id)
      const rmap: Record<string, any> = {}
      if (completedIds.length > 0) {
        const { data: responses } = await supabase
          .from('questionnaire_responses')
          .select('id, assignment_id, responses, submitted_at')
          .in('assignment_id', completedIds)
        ;(responses || []).forEach((r: any) => { rmap[r.assignment_id] = r })
      }

      setAssignments(assignsData)
      setResponsesMap(rmap)
    } finally {
      setLoading(false)
    }
  }, [user?.id, athletes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!athletesLoading && athletes.length) loadData()
  }, [athletesLoading, athletes, loadData])

  useRefetchOnResume(loadData, loading)

  function toggleDetail(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    let list = assignments
    if (filter === 'completed') list = list.filter((a: any) => a.status === 'completed')
    if (filter === 'pending') list = list.filter((a: any) => a.status === 'pending')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a: any) => {
        const name = `${athleteMap[a.athlete_id]?.prenom || ''} ${athleteMap[a.athlete_id]?.nom || ''}`.toLowerCase()
        return name.includes(q)
      })
    }
    return list
  }, [assignments, filter, search, athleteMap])

  const counts = useMemo(() => {
    const c = { all: assignments.length, completed: 0, pending: 0 }
    assignments.forEach((a: any) => {
      if (a.status === 'completed') c.completed++
      else if (a.status === 'pending') c.pending++
    })
    return c
  }, [assignments])

  if (athletesLoading || loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <Skeleton width={200} height={28} />
          <Skeleton width={300} height={16} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} width={100} height={36} />)}
        </div>
        <Skeleton height={300} />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Questionnaires</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['all', 'completed', 'pending'] as FilterKey[]).map((f) => {
          const label = f === 'all' ? 'Tous' : f === 'completed' ? 'Complétés' : 'En attente'
          return (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-red' : 'btn-outline'}`}
              onClick={() => setFilter(f)}
            >
              {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{counts[f]}</span>
            </button>
          )
        })}
        <input
          type="text"
          className="form-control"
          style={{ marginLeft: 'auto', maxWidth: 240 }}
          placeholder="Rechercher un athlete..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!filtered.length ? (
        <EmptyState icon="fas fa-clipboard-list" message="Aucun questionnaire" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((a: any) => {
            const title = a.questionnaire_templates?.titre || '(Sans titre)'
            const athleteName = `${athleteMap[a.athlete_id]?.prenom || ''} ${athleteMap[a.athlete_id]?.nom || ''}`.trim() || 'Athlete inconnu'
            const isPending = a.status === 'pending'
            const isExpanded = expandedIds.has(a.id)
            const resp = responsesMap[a.id]
            const questions = a.questions_snapshot || []
            const answers = resp ? (resp.responses || []) : []
            const accent = isPending ? '#f97316' : '#22c55e'
            const dateStr = new Date(isPending ? a.sent_at : (a.completed_at || a.sent_at)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

            return (
              <div
                key={a.id}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${accent}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => toggleDetail(a.id)}
                >
                  <i
                    className="fa-solid fa-chevron-right"
                    style={{ fontSize: 11, color: 'var(--text2)', transition: 'transform .2s', transform: isExpanded ? 'rotate(90deg)' : '', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <a
                        href={`/athletes/${a.athlete_id}/questionnaires`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)', textDecoration: 'none' }}
                      >
                        {athleteName}
                      </a>
                      <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text2)' }}>{title}</span>
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                          background: isPending ? 'rgba(249, 115, 22, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: accent, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5,
                          textTransform: 'uppercase', borderRadius: 999,
                        }}
                      >
                        <i className={`fa-solid ${isPending ? 'fa-clock' : 'fa-check'}`} style={{ fontSize: 9 }} />
                        {isPending ? 'En attente' : 'Complète'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                      <i className="fa-regular fa-calendar" style={{ marginRight: 6, opacity: 0.6 }} />
                      {isPending ? 'Envoyé le' : 'Répondu le'} {dateStr}
                      <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
                      {questions.length} question{questions.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '16px 18px 18px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {questions.map((q: any, qi: number) => {
                        const typeInfo = Q_TYPES.find((t) => t.value === q.type)
                        const ans = answers.find((r: any) => r.question_id === q.id)
                        return (
                          <QuestionRow
                            key={qi}
                            index={qi + 1}
                            question={q}
                            typeIcon={typeInfo?.icon || 'fa-question'}
                            answer={ans}
                            hasResponse={!!resp}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors referencing `components/questionnaires/QuestionnairesOverview.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/questionnaires/QuestionnairesOverview.tsx
git commit -m "feat: add cross-athlete QuestionnairesOverview component"
```

---

### Task 3: Wire the route and sidebar nav

**Files:**
- Create: `app/(app)/questionnaires/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `QuestionnairesOverview` default export from `components/questionnaires/QuestionnairesOverview.tsx` (Task 2).

- [ ] **Step 1: Create the page**

```tsx
'use client'

import dynamic from 'next/dynamic'

const QuestionnairesOverview = dynamic(() => import('@/components/questionnaires/QuestionnairesOverview'), { ssr: false })

export default function QuestionnairesPage() {
  return <QuestionnairesOverview />
}
```

- [ ] **Step 2: Add the sidebar nav entry**

In `components/layout/Sidebar.tsx`, in the `navGroups` array, `'Suivi'` group's `items`, insert between `Vidéos` and `Annonces`:

```tsx
  {
    label: 'Suivi',
    items: [
      { label: 'Bilans', icon: 'fa-clipboard-check', route: '/bilans' },
      { label: 'Vidéos', icon: 'fa-video', route: '/videos' },
      { label: 'Questionnaires', icon: 'fa-clipboard-question', route: '/questionnaires' },
      { label: 'Annonces', icon: 'fa-bullhorn', route: '/annonces' },
    ],
  },
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit -p .` — expect zero new errors.
Run: `npm run build` — expect success, and confirm `/questionnaires` appears in the route list output.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Log in as a coach with at least one athlete that has questionnaire assignments (any status). Navigate via the sidebar "Questionnaires" link. Confirm:
- The page loads without error.
- Filter buttons (Tous/Complétés/En attente) change the visible list and counts.
- Clicking a row expands it and shows the questions/answers (or "Aucune réponse" style states for pending ones with no `resp`).
- Clicking the athlete name link navigates to `/athletes/[id]/questionnaires`.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/questionnaires/page.tsx" components/layout/Sidebar.tsx
git commit -m "feat: wire /questionnaires route and sidebar nav entry"
```

---

### Task 4: Update notification link + document in ARCHITECTURE.md

**Files:**
- Create: `sql/update_questionnaire_notification_link.sql`
- Modify: `ARCHITECTURE.md`

**Interfaces:** none (SQL + docs only).

- [ ] **Step 1: Write the standalone SQL update**

This updates the `notify_coach_on_questionnaire` trigger function (created by the notification-center feature, already applied manually to the live database per this plan's Global Constraints) so `resource_link` points at the new cross-athlete page instead of the per-athlete tab. It is a `CREATE OR REPLACE FUNCTION` — safe to run regardless of whether `sql/coach_notifications.sql` has been re-run since, as long as the function/trigger already exist (they do, per the constraints section).

```sql
-- ============================================================
-- Point the "réponse au questionnaire" coach notification at the
-- new cross-athlete /questionnaires overview instead of the
-- per-athlete /athletes/{id}/questionnaires tab.
-- Date: 2026-08-07
-- ============================================================

CREATE OR REPLACE FUNCTION notify_coach_on_questionnaire()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT coach_id INTO v_coach_id FROM athletes WHERE id = NEW.athlete_id;
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO coach_notifications (coach_id, athlete_id, type, title, body, resource_link, source_table, source_id)
  VALUES (
    v_coach_id,
    NEW.athlete_id,
    'questionnaire',
    'Réponse au questionnaire',
    'Un athlète a répondu à un questionnaire.',
    '/questionnaires',
    'questionnaire_responses',
    NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure abort the athlete's own write.
  RETURN NEW;
END;
$$;
```

Note: only the `resource_link` value changed (`'/athletes/' || NEW.athlete_id || '/questionnaires'` → `'/questionnaires'`); everything else — including the `EXCEPTION WHEN OTHERS` guard already present in the live version per this plan's constraints — is preserved verbatim. The trigger definition itself (`CREATE TRIGGER trg_notify_coach_on_questionnaire ...`) does not need to be re-run; only the function body changes, and the existing trigger already points at this function by name.

- [ ] **Step 2: Apply in Supabase SQL Editor**

Run the file's SQL in the Supabase project's SQL Editor. Confirm no errors.

- [ ] **Step 3: Manual verification**

In the SQL Editor, pick a real completed (or about-to-be-completed) `questionnaire_responses` row scenario, or simply check the function body was updated:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'notify_coach_on_questionnaire';
```
Expected: the returned source text contains `'/questionnaires'` and does NOT contain `'/athletes/' || NEW.athlete_id || '/questionnaires'`.

- [ ] **Step 4: Update ARCHITECTURE.md**

Add to §2 (Routes table), in the cross-athlete section near `/bilans` and `/videos`:
```
| `/questionnaires` | `app/(app)/questionnaires/page.tsx` -> `components/questionnaires/QuestionnairesOverview.tsx` | Cross-athlete questionnaire responses review |
```

Add to §4 (Components by domain), a new `### questionnaires/` subsection:
```
### `questionnaires/`
- `QuestionnaireAnswer.tsx` — shared answer-rendering pieces (`Q_TYPES`, `PHOTO_POSITIONS`, `isPhotoAnswer`, `PhotoAnswer`, `QuestionRow`, `AnswerCell`). Used by both the per-athlete tab and the cross-athlete overview — extend here, not in either page.
- `QuestionnairesOverview.tsx` — `/questionnaires` page body. Cross-athlete list, filter Tous/Complétés/En attente, accordion detail.
```

Add a row to §11 ("Where to look for X"):
```
| Modify the cross-athlete questionnaires overview | `components/questionnaires/QuestionnairesOverview.tsx` |
| Modify shared questionnaire answer rendering (used by both per-athlete and overview pages) | `components/questionnaires/QuestionnaireAnswer.tsx` |
```

- [ ] **Step 5: Commit**

```bash
git add sql/update_questionnaire_notification_link.sql ARCHITECTURE.md
git commit -m "feat: point questionnaire notifications at the new overview page"
```

---

## Self-Review Notes

- **Spec coverage**: `/questionnaires` route + sidebar entry (Task 3) ✓, Complétés/En attente filter (Task 2) ✓, accordion with athlete/title/date + expand-to-view-answers (Task 2) ✓, shared rendering code extraction with no per-athlete-page regression (Task 1) ✓, notification link update (Task 4) ✓, ARCHITECTURE.md updated (Task 4) ✓.
- **No placeholders**: all code blocks are complete; the one explicit "if this assumption is wrong, do X instead" branch (Task 1 Step 1/3, `formatAnswer` dead-code check) is a verification gate with a concrete fallback action, not a vague TODO.
- **Type consistency**: `Q_TYPES`, `PHOTO_POSITIONS`, `isPhotoAnswer`, `PhotoAnswer`, `QuestionRow`, `AnswerCell` signatures in Task 1's new file are the exact same signatures used by Task 2's `QuestionnairesOverview` and by the untouched remainder of the per-athlete page — copied verbatim from the current real source, not reconstructed from memory.
