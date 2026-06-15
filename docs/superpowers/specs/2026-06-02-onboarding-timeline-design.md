# Onboarding Timeline — Design

**Status**: in implementation
**Date**: 2026-06-02
**Repo**: COACH (web)

## Problem

When a coach signs a new athlete, the first 7-30 days set the trajectory of the whole coaching relationship. Today the coach tracks the steps (R1, send questionnaire, deadline checks, R2 prep, send plan, etc.) ad-hoc in WhatsApp/Notion. We need a way to:

1. Pre-template the process (e.g. a "Premium" 7-day onboarding) and apply it to every new athlete in one click.
2. See, every time the coach opens `/athletes`, what is due today / soon / late per athlete.
3. Edit each athlete's timeline visually (move a point, add a point, remove one), month-by-month.
4. Track completion (mark done) and build a historical view of who got what when.

## Non-goals (for v1)

- No automated push/email/WhatsApp send. The coach still does the action — the tool just reminds.
- No top-level `/onboarding` dashboard. The athletes list already serves as the "today's tasks" cockpit via badges.
- No cross-coach template sharing.

## Architecture

### 3.1 Data model — `sql/onboarding_timeline.sql`

```sql
-- Reusable template (e.g. "Onboarding Premium")
onboarding_templates
  id uuid PK
  coach_id uuid FK auth.users
  name text NOT NULL
  description text
  is_default boolean DEFAULT false
  steps jsonb NOT NULL DEFAULT '[]'
    -- [{ day_offset:int, type:'message'|'call'|'milestone', title:text, description?:text }]
  created_at, updated_at timestamptz

-- Per-athlete instance of a step (1 row per touchpoint)
athlete_onboarding_steps
  id uuid PK
  athlete_id uuid FK athletes
  coach_id uuid FK auth.users
  template_id uuid FK onboarding_templates NULL  -- nullable: ad-hoc steps allowed
  day_offset int NOT NULL                         -- relative to athlete.onboarding_start_date
  scheduled_date date NOT NULL                    -- computed = start_date + day_offset, persisted for query speed
  type text CHECK (type IN ('message','call','milestone'))
  title text NOT NULL
  description text
  done_at timestamptz NULL
  dismissed_at timestamptz NULL
  created_at, updated_at timestamptz

-- New column on athletes
athletes.onboarding_start_date date NULL  -- anchor (J0). When NULL = no onboarding active.
```

RLS: `coach_id = auth.uid()` on both tables for ALL ops.

Indexes:
- `idx_aos_athlete (athlete_id, scheduled_date)` — load timeline for one athlete
- `idx_aos_coach_due (coach_id, scheduled_date) WHERE done_at IS NULL` — "what's due today/soon" badges query

Seed: on first read by a coach (or via a small trigger on coach signup), create a "Onboarding Premium" template per coach. (Implementation: client-side check + insert if absent on first visit of /templates onboarding tab.)

### 3.2 Components

```
components/onboarding/
  OnboardingTimeline.tsx          ← horizontal SVG-based timeline, used by both pages
  OnboardingStepBadge.tsx         ← compact "J-3 R2" pill with color (used on /athletes)
  OnboardingStepModal.tsx         ← add/edit a step (type, title, description, day_offset)
  ApplyTemplateModal.tsx          ← pick a template + start_date when applying to an athlete
  onboarding.module.css
components/templates/
  OnboardingTemplatesList.tsx
  OnboardingTemplateEditor.tsx    ← thin wrapper around <OnboardingTimeline mode="template" />
```

### 3.3 Routes

- New: `app/(app)/athletes/[id]/onboarding/page.tsx`
- Modified: `app/(app)/athletes/[id]/layout.tsx` — add tab "Onboard." (icon `fa-flag-checkered`) between "Apercu" and "Infos"
- Modified: `app/(app)/templates/page.tsx` — add tab "Onboarding" between "Compléments" and "Workflows"
- Modified: `components/athletes/AthletesList.tsx` — fetch next-due step per athlete, render badge
- Modified: `components/athletes/AddAthleteForm.tsx` — add onboarding template dropdown (in addition to the existing workflow dropdown)

No new API routes — coach-owned data only, RLS covers everything.

### 3.4 Timeline UI

- **Layout**: full-width container, ~120 px tall, horizontal axis = 1 month (28-31 days), points placed at `(day_offset - month_start) / month_length * width`.
- **Day numbers**: ticks every 5 days (J1, J5, J10, …, J30). Today's day = a vertical accent line when in view.
- **Points**: small circles, color/shape by type. Above the line = title text (slightly offset for collision-avoid).
- **Drag**: `pointerdown` on a point → mouse-move updates day_offset in local state → `pointerup` commits via Supabase UPDATE. Snap to integer day.
- **Click empty axis area**: opens AddStepModal pre-filled with `day_offset = day_clicked`.
- **Click point**: opens EditStepModal (edit / delete / mark done).
- **Month nav**: `← Mois précédent` / `Mois suivant →` buttons. Bottom label: `Mois 1 — J0 à J30 (date début → date fin)`.
- **Done steps**: greyed out (opacity .4, no drag), kept in place. Filter toggle: "Masquer terminés".
- **Mode prop**:
  - `mode="athlete"` → drag/click mutates `athlete_onboarding_steps`
  - `mode="template"` → drag/click mutates the parent's `steps` array (controlled component)

### 3.5 Athletes list badges

Query: in AthleteContext, add a 4th parallel query:

```ts
supabase.from('athlete_onboarding_steps')
  .select('id, athlete_id, scheduled_date, type, title')
  .eq('coach_id', userId)
  .is('done_at', null)
  .is('dismissed_at', null)
  .lte('scheduled_date', today_plus_14_days)
  .order('scheduled_date', { ascending: true })
  .limit(500)
```

Group by athlete_id → keep the next 1 step + count of overdue/today steps. Attach to athlete as `_nextStep` and `_urgentCount`.

Color mapping (computed from `daysUntil = (scheduled_date - today).days`):

| daysUntil | color | label format |
|---|---|---|
| < 0 (overdue) | #b91c1c (dark red, pulse) | `+Nj · ${title}` |
| = 0 (today) | #ef4444 (red) | `Auj. · ${title}` |
| 1-2 | #f97316 (orange) | `J-N · ${title}` |
| 3-7 | #eab308 (yellow) | `J-N · ${title}` |
| 8-14 | #84cc16 (green) | `J-N · ${title}` |
| > 14 | none (hidden) | — |

Badge type-icon: ` (message) /  (call) / ◆ (milestone)` prefix.

Optional sort: `localStorage('athletes:sort') = 'urgency' | 'alpha' | 'created'`. Toggle in header.

Click badge → confirm + UPDATE done_at = now() + refetch (or optimistic).

### 3.6 Apply template flow

**At athlete creation** (AddAthleteForm):
1. New dropdown "Template onboarding" (same UX as existing workflow dropdown). Default: no template.
2. On submit, after the athlete insert succeeds: if a template is selected, INSERT rows into `athlete_onboarding_steps` (one per template step), with `scheduled_date = today + day_offset`, and set `athletes.onboarding_start_date = today`.

**After creation** (athlete onboarding tab):
- Button "Appliquer un template" → ApplyTemplateModal (template picker + start_date picker). Warns if steps already exist (offers: replace / append).

**Move start_date later**:
- The onboarding tab header shows the start_date as an editable date input. On change: UPDATE the athletes row + UPDATE all non-done steps' scheduled_date = start_date + day_offset.

## Code conventions (per lessons.md)

- All hooks placed before any conditional return.
- Always handle `error` on Supabase calls: `if (error) { console.error('[ctx]', error); toast(\`Erreur: \${error.message}\`); return }`.
- Use primitives (`user?.id`) not objects in hook deps. Memoize context values.
- Explicit column lists in `.select()`. `.limit()` on every list query.
- Cross-user inserts (e.g. inserting steps for an athlete from coach side) are OK as-is because the row's `coach_id = auth.uid()` — RLS passes.
- Empty string for date column → coerce to `null` (lessons 2026-04-20).
- `npm run build` before claiming done.

## Out of scope / future

- Notifications/reminders (Expo push to coach phone the day before).
- Multi-athlete kanban view of upcoming touchpoints across the week.
- Generic "tasks" / Todo system disconnected from onboarding.
- Athlete side visibility (read-only timeline for the client). Could be added later via RLS read for the athlete user_id.

## Open questions resolved during brainstorm

- ✅ Tri par urgence sur /athletes → optionnel, off par défaut
- ✅ onboarding_start_date modifiable manuellement (avec recompute des scheduled_date)
- ✅ Steps terminés → grisés visibles + toggle masquer

## Verification plan

1. SQL migration runs cleanly on a fresh Supabase project (test in local dashboard SQL editor before live run).
2. `npx tsc --noEmit` passes.
3. `npm run build` passes.
4. Localhost manual walkthrough:
   - Create athlete with template → timeline populated, badges visible on /athletes.
   - Drag a point → DB updated, refresh keeps the new position.
   - Add/remove a point → persisted.
   - Mark a step done → greyed out, badge disappears from /athletes.
   - Switch month → next/prev mois show correct day_offset range.
   - Edit `onboarding_start_date` → all future steps' `scheduled_date` shift.
   - Templates page: create a new template, edit existing Premium template.
