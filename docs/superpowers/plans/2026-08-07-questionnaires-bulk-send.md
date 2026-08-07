# Bulk Questionnaire Send Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a coach send a questionnaire (from a template or built ad-hoc) to multiple selected athletes at once, from the `/questionnaires` cross-athlete page, without touching the existing single-athlete send flow's behavior.

**Architecture:** Extract the existing "quick questionnaire" question editor (currently inline JSX inside `app/(app)/athletes/[id]/questionnaires/page.tsx`'s `showQuick` branch) into a shared, controlled `QuickQuestionnaireEditor` component so both the per-athlete page and the new bulk-send panel use identical editing UI. Add a `sendQuestionnaireToAthletes` data function that does one batched `questionnaire_assignments` insert (array of rows) instead of N separate inserts, then fires `notifyAthlete()` per athlete in parallel. Add a bulk-send panel to `QuestionnairesOverview.tsx`: athlete checklist (from already-loaded `useAthleteContext()`), template-vs-quick toggle, send button.

**Tech Stack:** Next.js 16 App Router, Supabase (`@supabase/ssr` browser client), TypeScript, inline styles (matches this page's existing convention).

## Global Constraints

- The existing single-athlete send flow (`app/(app)/athletes/[id]/questionnaires/page.tsx`) must work identically after the refactor — same UI, same behavior, same function names for anything not explicitly changed by this plan.
- One batched Supabase `.insert()` call with an array of rows for the assignments — not a loop of N separate `.insert()` calls. Postgres rejects the whole batch atomically if any row is invalid (no silent partial insert).
- Notification failures for individual athletes must not block the assignment creation or crash the flow — best-effort, matching the existing solo-send behavior where `notifyAthlete()` failures aren't surfaced as insert failures.
- An athlete with no `user_id` (mobile account not yet activated) still gets an assignment row; notification is simply skipped for that athlete, not treated as an error.
- Reuse `useAthleteContext()` for the coach's athlete list — do not add a new Supabase query for athletes that are already loaded.

---

## File Structure

- Create: `components/questionnaires/QuickQuestionnaireEditor.tsx` — controlled question-list editor extracted from the per-athlete page's `showQuick` view.
- Create: `lib/questionnaires.ts` — `sendQuestionnaireToAthletes()` data function.
- Modify: `app/(app)/athletes/[id]/questionnaires/page.tsx` — use the extracted editor component instead of inline JSX; no behavior change.
- Modify: `components/questionnaires/QuestionnairesOverview.tsx` — add the bulk-send panel (athlete checklist, template/quick toggle, send button).

---

### Task 1: Extract `QuickQuestionnaireEditor`

**Files:**
- Create: `components/questionnaires/QuickQuestionnaireEditor.tsx`
- Modify: `app/(app)/athletes/[id]/questionnaires/page.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface QuickQuestion {
    id: string
    label: string
    type: string
    options?: string[]
    position?: string
    required: boolean
  }

  export function QuickQuestionnaireEditor(props: {
    questions: QuickQuestion[]
    onChange: (questions: QuickQuestion[]) => void
  }): JSX.Element
  ```
  Renders the question-list editing UI only (the "Questions" heading, each question card, "Ajouter une question" button) — NOT the title field, NOT the obligatoire checkbox, NOT the send/cancel buttons. Those stay in each caller (per-athlete page keeps its own title/obligatoire/buttons; the bulk-send panel in Task 3 will have its own).

- [ ] **Step 1: Read the exact current source to copy verbatim**

Read `app/(app)/athletes/[id]/questionnaires/page.tsx`'s `showQuick` branch (search for `if (showQuick) {`). The question-editing block to extract is everything from the `<h3 style={{ fontSize: 15, margin: '20px 0 12px' }}>Questions</h3>` line through the closing of the `<button className="btn btn-outline" style={{ marginTop: 12 }}>` "Ajouter une question" button — i.e. the questions list `.map()` and the add-question button, but NOT the title input above it, NOT the obligatoire checkbox below it, NOT the send/cancel button row.

- [ ] **Step 2: Create the shared component**

```tsx
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
```

- [ ] **Step 3: Update the per-athlete page to use the extracted component**

In `app/(app)/athletes/[id]/questionnaires/page.tsx`:

1. Add the import:
```tsx
import { QuickQuestionnaireEditor } from '@/components/questionnaires/QuickQuestionnaireEditor'
```
2. In the `showQuick` branch, replace the `<h3>Questions</h3>` block through the "Ajouter une question" button (identified in Step 1) with:
```tsx
<QuickQuestionnaireEditor questions={quickQuestions} onChange={setQuickQuestions} />
```
3. Leave everything else in that branch untouched: the title input, the obligatoire checkbox, the send/cancel buttons, `quickQuestions`/`setQuickQuestions` state declaration, `sendQuickQuestionnaire()`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors referencing `components/questionnaires/QuickQuestionnaireEditor.tsx` or `app/(app)/athletes/[id]/questionnaires/page.tsx`.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Manual no-regression check**

Run `npm run dev`, navigate to `/athletes/[id]/questionnaires` for a real athlete, click "Questionnaire rapide", add 2 questions (one `text`, one `photo` — confirm the position selector appears), remove one, click back/cancel. Confirm identical behavior to before the extraction (no visual or functional change).

- [ ] **Step 7: Commit**

```bash
git add components/questionnaires/QuickQuestionnaireEditor.tsx "app/(app)/athletes/[id]/questionnaires/page.tsx"
git commit -m "refactor: extract QuickQuestionnaireEditor for reuse in bulk send"
```

---

### Task 2: `sendQuestionnaireToAthletes` data function

**Files:**
- Create: `lib/questionnaires.ts`

**Interfaces:**
- Consumes:
  - `createClient()` from `lib/supabase/client.ts`.
  - `notifyAthlete()` from `lib/push.ts` — signature `(userId: string, type: string, title: string, body: string, metadata?: Record<string, unknown>, accessToken?: string | null) => Promise<void>`.
  - `QuickQuestion` type from `components/questionnaires/QuickQuestionnaireEditor.tsx` (Task 1).
- Produces:
  ```ts
  export interface BulkSendTarget {
    athleteId: string
    userId: string | null
  }

  export interface BulkSendContent {
    templateId?: string  // set for template mode
    templateTitre?: string
    quickTitre?: string   // set for quick mode
    questions: QuickQuestion[] | any[]  // resolved questions_snapshot content
    obligatoire: boolean
  }

  export async function sendQuestionnaireToAthletes(
    coachId: string,
    targets: BulkSendTarget[],
    content: BulkSendContent,
  ): Promise<{ sent: number; notified: number }>
  ```
  Throws if the Supabase insert itself errors (caller shows a toast). Notification failures are caught internally and don't throw — `notified` count reflects how many succeeded.

- [ ] **Step 1: Write the file**

```ts
import { createClient } from '@/lib/supabase/client'
import { notifyAthlete } from '@/lib/push'
import type { QuickQuestion } from '@/components/questionnaires/QuickQuestionnaireEditor'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BulkSendTarget {
  athleteId: string
  userId: string | null
}

export interface BulkSendContent {
  templateId?: string
  templateTitre?: string
  quickTitre?: string
  questions: QuickQuestion[] | any[]
  obligatoire: boolean
}

export async function sendQuestionnaireToAthletes(
  coachId: string,
  targets: BulkSendTarget[],
  content: BulkSendContent,
): Promise<{ sent: number; notified: number }> {
  const supabase = createClient()

  const rows = targets.map((t) => ({
    template_id: content.templateId || null,
    athlete_id: t.athleteId,
    coach_id: coachId,
    obligatoire: content.obligatoire,
    questions_snapshot: content.questions,
  }))

  const { error } = await supabase.from('questionnaire_assignments').insert(rows)
  if (error) throw error

  const title = content.templateTitre || content.quickTitre || 'Questionnaire'
  const notifyResults = await Promise.all(
    targets.map(async (t) => {
      if (!t.userId) return false
      try {
        await notifyAthlete(
          t.userId, 'questionnaire', 'Nouveau questionnaire',
          `Votre coach vous a envoye un questionnaire : ${title}`,
          content.templateId ? { template_id: content.templateId } : undefined,
        )
        return true
      } catch (err) {
        console.error('[sendQuestionnaireToAthletes] notify failed for', t.athleteId, err)
        return false
      }
    }),
  )

  return {
    sent: targets.length,
    notified: notifyResults.filter(Boolean).length,
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors referencing `lib/questionnaires.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/questionnaires.ts
git commit -m "feat: add sendQuestionnaireToAthletes batched send function"
```

---

### Task 3: Bulk-send panel in `QuestionnairesOverview`

**Files:**
- Modify: `components/questionnaires/QuestionnairesOverview.tsx`

**Interfaces:**
- Consumes:
  - `sendQuestionnaireToAthletes`, `BulkSendTarget` from `lib/questionnaires.ts` (Task 2).
  - `QuickQuestionnaireEditor`, `QuickQuestion` from `components/questionnaires/QuickQuestionnaireEditor.tsx` (Task 1).
  - `useToast()` from `contexts/ToastContext.tsx` — `{ toast: (msg: string, type: 'success' | 'error') => void }`.
  - `athletes` from `useAthleteContext()` (already imported in this file) — each `Athlete` has `id: string`, `user_id: string | null`, `prenom: string`, `nom: string`.
  - `createClient()` from `lib/supabase/client.ts` (already imported) — used to fetch templates for the send panel (this page doesn't currently load `questionnaire_templates`, unlike the per-athlete page).

- [ ] **Step 1: Add state and template loading**

At the top of the `QuestionnairesOverview` component, alongside existing state, add:

```tsx
import { useToast } from '@/contexts/ToastContext'
import { sendQuestionnaireToAthletes, type BulkSendTarget } from '@/lib/questionnaires'
import { QuickQuestionnaireEditor, type QuickQuestion } from '@/components/questionnaires/QuickQuestionnaireEditor'
```

```tsx
const { toast } = useToast()

const [showSendPanel, setShowSendPanel] = useState(false)
const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set())
const [sendMode, setSendMode] = useState<'template' | 'quick'>('template')
const [templates, setTemplates] = useState<any[]>([])
const [selectedTemplateId, setSelectedTemplateId] = useState('')
const [bulkObligatoire, setBulkObligatoire] = useState(false)
const [quickTitre, setQuickTitre] = useState('')
const [quickQuestions, setQuickQuestions] = useState<QuickQuestion[]>([])
const [sending, setSending] = useState(false)
```

Add a template-loading effect (templates aren't currently fetched by this page):

```tsx
useEffect(() => {
  if (!user || !showSendPanel) return
  supabase
    .from('questionnaire_templates')
    .select('id, titre, questions')
    .eq('coach_id', user.id)
    .order('titre')
    .limit(100)
    .then(({ data }) => setTemplates(data || []))
}, [user, showSendPanel]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Add selection helpers**

```tsx
function toggleAthleteSelected(id: string) {
  setSelectedAthleteIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
}

function selectAllAthletes() {
  setSelectedAthleteIds(new Set(athletes.map((a) => a.id)))
}

function deselectAllAthletes() {
  setSelectedAthleteIds(new Set())
}

function resetSendPanel() {
  setShowSendPanel(false)
  setSelectedAthleteIds(new Set())
  setSendMode('template')
  setSelectedTemplateId('')
  setBulkObligatoire(false)
  setQuickTitre('')
  setQuickQuestions([])
}

async function handleBulkSend() {
  if (!user || selectedAthleteIds.size === 0) return
  if (sendMode === 'template' && !selectedTemplateId) {
    toast('Selectionnez un template', 'error')
    return
  }
  if (sendMode === 'quick' && (!quickTitre.trim() || !quickQuestions.some((q) => q.label.trim()))) {
    toast('Titre et au moins une question requis', 'error')
    return
  }

  setSending(true)
  try {
    const targets: BulkSendTarget[] = Array.from(selectedAthleteIds).map((athleteId) => ({
      athleteId,
      userId: athleteMap[athleteId] ? (athletes.find((a) => a.id === athleteId)?.user_id ?? null) : null,
    }))

    let questions: any[]
    let templateTitre: string | undefined
    if (sendMode === 'template') {
      const tpl = templates.find((t: any) => t.id === selectedTemplateId)
      questions = tpl?.questions || []
      templateTitre = tpl?.titre
    } else {
      questions = quickQuestions.map((q) => ({ ...q, id: q.id || crypto.randomUUID() }))
    }

    const result = await sendQuestionnaireToAthletes(user.id, targets, {
      templateId: sendMode === 'template' ? selectedTemplateId : undefined,
      templateTitre,
      quickTitre: sendMode === 'quick' ? quickTitre.trim() : undefined,
      questions,
      obligatoire: bulkObligatoire,
    })

    toast(`Questionnaire envoye a ${result.sent} athlete${result.sent > 1 ? 's' : ''}`, 'success')
    resetSendPanel()
    loadData()
  } catch (err) {
    console.error('[QuestionnairesOverview] bulk send failed:', err)
    toast('Erreur lors de l\'envoi', 'error')
  } finally {
    setSending(false)
  }
}
```

Note: `athleteMap[athleteId]` is already defined earlier in this file (from the existing code) as `{ prenom, nom }` per athlete — it does NOT carry `user_id`. Look up `user_id` via `athletes.find(...)` as shown above (`athletes` array elements have `user_id`), not via `athleteMap`.

- [ ] **Step 3: Add the "Envoyer" button and send panel to the JSX**

In the return statement, right after the `<div className="page-header">...</div>` block and before the filter-buttons row, add:

```tsx
<div style={{ marginBottom: 16 }}>
  <button className="btn btn-red btn-sm" onClick={() => setShowSendPanel((v) => !v)}>
    <i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />
    Envoyer
  </button>
</div>

{showSendPanel && (
  <div
    style={{
      background: 'linear-gradient(180deg, var(--bg3, var(--bg2)), var(--bg2))',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '18px 20px',
      marginBottom: 20,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 15 }}>Envoyer un questionnaire</h3>
      <button className="btn btn-outline btn-sm" onClick={resetSendPanel}>
        <i className="fas fa-times" /> Fermer
      </button>
    </div>

    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Destinataires ({selectedAthleteIds.size})
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={selectAllAthletes}>Tout selectionner</button>
          <button className="btn btn-outline btn-sm" onClick={deselectAllAthletes}>Tout deselectionner</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 160, overflowY: 'auto', padding: 4 }}>
        {athletes.map((a) => (
          <label
            key={a.id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              background: selectedAthleteIds.has(a.id) ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg3)',
              border: `1px solid ${selectedAthleteIds.has(a.id) ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 999, fontSize: 12, cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={selectedAthleteIds.has(a.id)}
              onChange={() => toggleAthleteSelected(a.id)}
            />
            {a.prenom} {a.nom}
          </label>
        ))}
      </div>
    </div>

    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <button
        className={`btn btn-sm ${sendMode === 'template' ? 'btn-red' : 'btn-outline'}`}
        onClick={() => setSendMode('template')}
      >
        Depuis un template
      </button>
      <button
        className={`btn btn-sm ${sendMode === 'quick' ? 'btn-red' : 'btn-outline'}`}
        onClick={() => setSendMode('quick')}
      >
        Questionnaire rapide
      </button>
    </div>

    {sendMode === 'template' ? (
      templates.length ? (
        <select
          className="form-control"
          style={{ marginBottom: 14 }}
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
        >
          <option value="">— Choisir un template —</option>
          {templates.map((t: any) => (
            <option key={t.id} value={t.id}>{t.titre} ({(t.questions || []).length}q)</option>
          ))}
        </select>
      ) : (
        <div style={{ marginBottom: 14, color: 'var(--text3)', fontSize: 13 }}>Aucun template. Creez-en un dans Templates.</div>
      )
    ) : (
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Titre *</label>
        <input
          type="text"
          className="form-control"
          value={quickTitre}
          onChange={(e) => setQuickTitre(e.target.value)}
          placeholder="Ex: Retour de vacances"
        />
        <QuickQuestionnaireEditor questions={quickQuestions} onChange={setQuickQuestions} />
      </div>
    )}

    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={bulkObligatoire} onChange={(e) => setBulkObligatoire(e.target.checked)} />
      Rendre obligatoire
    </label>

    <button
      className="btn btn-red"
      onClick={handleBulkSend}
      disabled={sending || selectedAthleteIds.size === 0}
    >
      {sending ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" style={{ marginRight: 6 }} />Envoyer a {selectedAthleteIds.size} athlete{selectedAthleteIds.size > 1 ? 's' : ''}</>}
    </button>
  </div>
)}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors referencing `components/questionnaires/QuestionnairesOverview.tsx`.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, navigate to `/questionnaires`, click "Envoyer". Confirm:
- Athlete checklist renders with all the coach's athletes; "Tout selectionner"/"Tout deselectionner" work; the count in the label updates.
- Template mode: select a template, send button shows the athlete count, sending creates one `questionnaire_assignments` row per selected athlete (verify via Supabase or by checking the row appears in the list after `loadData()` refresh) and a toast confirms.
- Quick mode: enter a title, add 2 questions, send — same verification.
- Send button is disabled with 0 athletes selected.
- Closing the panel resets all its state (re-opening shows a fresh form, not leftover selections).

- [ ] **Step 7: Commit**

```bash
git add components/questionnaires/QuestionnairesOverview.tsx
git commit -m "feat: add bulk questionnaire send panel to overview page"
```

---

### Task 4: Update ARCHITECTURE.md

**Files:**
- Modify: `ARCHITECTURE.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Update the questionnaires/ component section**

In §4 (Components by domain), under the `### questionnaires/` subsection added in the prior notification-center session, add entries for the two new files:

```
### `questionnaires/`
- `QuestionnaireAnswer.tsx` — shared answer-rendering pieces (`Q_TYPES`, `PHOTO_POSITIONS`, `isPhotoAnswer`, `PhotoAnswer`, `QuestionRow`, `AnswerCell`). Used by both the per-athlete tab and the cross-athlete overview — extend here, not in either page.
- `QuickQuestionnaireEditor.tsx` — controlled question-list editor (add/remove/edit questions, per-type options). Used by both the per-athlete "questionnaire rapide" flow and the bulk-send panel on the overview page.
- `QuestionnairesOverview.tsx` — `/questionnaires` page body. Cross-athlete list, filter Tous/Complétés/En attente, accordion detail, bulk-send panel (multi-athlete select + template or quick questionnaire).
```

(This replaces the 2-line version from the earlier session — read the current file first to confirm exact wording before editing, since it may have drifted.)

- [ ] **Step 2: Add a lookup-table row**

In §11 ("Where to look for X"), add:
```
| Modify the bulk questionnaire send logic | `lib/questionnaires.ts` (`sendQuestionnaireToAthletes`) |
```

- [ ] **Step 3: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: document bulk questionnaire send in ARCHITECTURE.md"
```

---

## Self-Review Notes

- **Spec coverage**: bulk send panel on `/questionnaires` ✓, multi-select with select-all/deselect-all ✓, template OR quick questionnaire modes ✓, batched single insert (not N inserts) ✓, best-effort per-athlete notifications ✓, no regression to solo per-athlete send flow (Task 1 is a pure extraction) ✓.
- **No placeholders**: all code blocks are complete and copy-pasteable; the one explicit "re-verify before editing" note (Task 4 Step 1, since ARCHITECTURE.md content may have drifted since this plan was written) is a verification gate, not a vague TODO.
- **Type consistency**: `QuickQuestion` (Task 1) is the single shape threaded through `lib/questionnaires.ts` (Task 2, as `BulkSendContent.questions`) and `QuestionnairesOverview.tsx` (Task 3, as local `quickQuestions` state) — field names match throughout. `BulkSendTarget` (Task 2) matches exactly how Task 3 constructs its `targets` array (`athleteId`, `userId`).
