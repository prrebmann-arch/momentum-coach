# Centre de notifications coach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a coach-facing notification bell (top-right) that surfaces athlete activity — bilans submitted, questionnaire responses, execution videos, posing videos, FODMAP logs — with a Realtime unread badge, click-to-navigate-and-mark-read, and auto-mark-read on visiting the related page.

**Architecture:** A new `coach_notifications` table is populated exclusively by 5 Postgres `AFTER INSERT` triggers on the athlete-write source tables (`security definer`, resolves `coach_id` via `athletes.coach_id`). No ATHLETE repo changes. On the COACH side: a `NotificationsContext` subscribes to Supabase Realtime on `coach_notifications` filtered by `coach_id`, exposing unread notifications + a `markRead`/`markAllRead` API; a `NotificationBell` component renders the badge + dropdown in a new global topbar; consuming pages call a shared helper to bulk-mark-read on mount.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + `@supabase/ssr` + Realtime), TypeScript, CSS Modules.

## Global Constraints

- No changes to the ATHLETE repo — all event capture happens via DB triggers only.
- In-app only for v1 — no push/email to the coach.
- SQL is hand-written and applied manually in the Supabase SQL Editor (repo pattern — no migration tool). Files live in `sql/*.sql`, follow the header-comment style seen in `sql/rls_critical_tables.sql`.
- RLS: a coach must only ever see/update rows where `coach_id = auth.uid()`. Verify with a second-coach negative test before considering the DB task done.
- Follow existing patterns: `lib/supabase/client.ts` singleton browser client, CSS Modules per component, contexts under `contexts/*` mirroring `RecorderContext.tsx`'s shape (value memoized, wraps a lower-level concern).
- Realtime channel must be cleaned up on unmount / auth change (no leaked subscriptions across coach logout/login).

---

## File Structure

- Create: `sql/coach_notifications.sql` — table, indexes, RLS policies, 5 trigger functions + triggers.
- Create: `lib/notifications.ts` — typed helpers: `fetchUnreadNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `markResourceNotificationsRead`.
- Create: `contexts/NotificationsContext.tsx` — provider + `useNotifications()` hook, Realtime subscription.
- Create: `components/layout/NotificationBell.tsx` — bell icon + badge + dropdown.
- Create: `components/layout/Topbar.tsx` — thin global topbar wrapper, right-aligned bell.
- Create: `styles/topbar.module.css` — topbar layout.
- Create: `styles/notificationBell.module.css` — badge + dropdown styles.
- Modify: `app/(app)/layout.tsx` — mount `NotificationsProvider` in the provider tree, render `Topbar` above `Sidebar`/`main`.
- Modify: `app/(app)/athletes/[id]/bilans/page.tsx` (or its client component) — call `markResourceNotificationsRead` on mount.
- Modify: `app/(app)/athletes/[id]/questionnaires/page.tsx` — same.
- Modify: `app/(app)/videos/page.tsx` — same.
- Modify: `app/(app)/athletes/[id]/posing/page.tsx` — same.
- Modify: `app/(app)/athletes/[id]/fodmap/page.tsx` — same.

---

### Task 1: `coach_notifications` table + RLS + triggers (SQL)

**Files:**
- Create: `sql/coach_notifications.sql`

**Interfaces:**
- Produces: table `coach_notifications(id uuid, coach_id uuid, athlete_id uuid, type text, title text, body text, resource_link text, source_table text, source_id uuid, read_at timestamptz null, created_at timestamptz)`. `type` values: `'bilan' | 'questionnaire' | 'execution_video' | 'posing_video' | 'fodmap'`.

- [ ] **Step 1: Write the SQL file**

```sql
-- ============================================================
-- coach_notifications — centre de notifications coach
-- Alimentée exclusivement par triggers sur les tables source
-- (aucune écriture applicative, aucune modif du repo ATHLETE)
-- Date: 2026-08-06
-- ============================================================

CREATE TABLE IF NOT EXISTS coach_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bilan', 'questionnaire', 'execution_video', 'posing_video', 'fodmap')),
  title text NOT NULL,
  body text,
  resource_link text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_notifications_unread
  ON coach_notifications(coach_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coach_notifications_athlete_type
  ON coach_notifications(athlete_id, type)
  WHERE read_at IS NULL;

ALTER TABLE coach_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_read_own_notifications" ON coach_notifications;
CREATE POLICY "coach_read_own_notifications" ON coach_notifications FOR SELECT
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "coach_update_own_notifications" ON coach_notifications;
CREATE POLICY "coach_update_own_notifications" ON coach_notifications FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- No INSERT/DELETE policy for authenticated role — rows are created only by
-- the SECURITY DEFINER trigger functions below, which bypass RLS.

-- ============================================================
-- Trigger function factory pattern: one function per source table
-- (kept separate, not parameterized, so each stays simple SQL)
-- ============================================================

CREATE OR REPLACE FUNCTION notify_coach_on_bilan()
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
    'bilan',
    'Nouveau bilan',
    'Un bilan a été soumis.',
    '/athletes/' || NEW.athlete_id || '/bilans',
    'daily_reports',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_bilan ON daily_reports;
CREATE TRIGGER trg_notify_coach_on_bilan
  AFTER INSERT ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION notify_coach_on_bilan();

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
    '/athletes/' || NEW.athlete_id || '/questionnaires',
    'questionnaire_responses',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_questionnaire ON questionnaire_responses;
CREATE TRIGGER trg_notify_coach_on_questionnaire
  AFTER INSERT ON questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION notify_coach_on_questionnaire();

CREATE OR REPLACE FUNCTION notify_coach_on_execution_video()
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
    'execution_video',
    'Nouvelle vidéo technique',
    'Un athlète a ajouté une vidéo d''exécution.',
    '/videos',
    'execution_videos',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_execution_video ON execution_videos;
CREATE TRIGGER trg_notify_coach_on_execution_video
  AFTER INSERT ON execution_videos
  FOR EACH ROW EXECUTE FUNCTION notify_coach_on_execution_video();

CREATE OR REPLACE FUNCTION notify_coach_on_posing_video()
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
    'posing_video',
    'Nouvelle vidéo posing',
    'Un athlète a ajouté une vidéo de posing.',
    '/athletes/' || NEW.athlete_id || '/posing',
    'posing_videos',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_posing_video ON posing_videos;
CREATE TRIGGER trg_notify_coach_on_posing_video
  AFTER INSERT ON posing_videos
  FOR EACH ROW EXECUTE FUNCTION notify_coach_on_posing_video();

CREATE OR REPLACE FUNCTION notify_coach_on_fodmap()
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
    'fodmap',
    'Log FODMAP',
    'Un athlète a ajouté un log FODMAP.',
    '/athletes/' || NEW.athlete_id || '/fodmap',
    'athlete_fodmap_logs',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_on_fodmap ON athlete_fodmap_logs;
CREATE TRIGGER trg_notify_coach_on_fodmap
  AFTER INSERT ON athlete_fodmap_logs
  FOR EACH ROW EXECUTE FUNCTION notify_coach_on_fodmap();

-- ============================================================
-- Realtime: add table to the supabase_realtime publication so
-- postgres_changes subscriptions fire for INSERT/UPDATE.
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE coach_notifications;
```

- [ ] **Step 2: Apply in Supabase SQL Editor**

Run the full file content in the Supabase project's SQL Editor (repo convention — no CLI migration tool in this repo). Confirm no errors.

- [ ] **Step 3: Manual verification query**

In the SQL Editor, pick a real `athlete_id` you own as coach and run:

```sql
INSERT INTO daily_reports (athlete_id, date) VALUES ('<athlete_id>', current_date)
RETURNING id;
```

Then:

```sql
SELECT * FROM coach_notifications WHERE source_table = 'daily_reports' ORDER BY created_at DESC LIMIT 1;
```

Expected: one row with `type = 'bilan'`, correct `coach_id`, `resource_link = '/athletes/<athlete_id>/bilans'`.

Clean up the test row afterward:
```sql
DELETE FROM coach_notifications WHERE source_table = 'daily_reports' AND source_id = '<the returned id>';
DELETE FROM daily_reports WHERE id = '<the returned id>';
```

- [ ] **Step 4: RLS negative-test verification**

In the SQL Editor, run as a second coach (or via `SET request.jwt.claims` simulation, or simply inspect the policy logic) to confirm `coach_id = auth.uid()` is enforced — i.e., no `SELECT`/`UPDATE` policy exists that would leak rows across coaches. Visually re-read the two policies created in Step 1 and confirm both use `auth.uid()`.

- [ ] **Step 5: Commit**

```bash
git add sql/coach_notifications.sql
git commit -m "feat: add coach_notifications table with source-table triggers"
```

---

### Task 2: `lib/notifications.ts` — typed data helpers

**Files:**
- Create: `lib/notifications.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts` (returns Supabase browser client singleton).
- Produces:
  - `interface CoachNotification { id: string; coachId: string; athleteId: string; type: 'bilan' | 'questionnaire' | 'execution_video' | 'posing_video' | 'fodmap'; title: string; body: string | null; resourceLink: string; sourceTable: string; sourceId: string; readAt: string | null; createdAt: string }`
  - `async function fetchUnreadNotifications(coachId: string): Promise<CoachNotification[]>`
  - `async function markNotificationRead(id: string): Promise<void>`
  - `async function markAllNotificationsRead(coachId: string): Promise<void>`
  - `async function markResourceNotificationsRead(athleteId: string, type: CoachNotification['type']): Promise<void>`

- [ ] **Step 1: Write the file**

```typescript
import { createClient } from '@/lib/supabase/client'

export type NotificationType = 'bilan' | 'questionnaire' | 'execution_video' | 'posing_video' | 'fodmap'

export interface CoachNotification {
  id: string
  coachId: string
  athleteId: string
  type: NotificationType
  title: string
  body: string | null
  resourceLink: string
  sourceTable: string
  sourceId: string
  readAt: string | null
  createdAt: string
}

interface CoachNotificationRow {
  id: string
  coach_id: string
  athlete_id: string
  type: NotificationType
  title: string
  body: string | null
  resource_link: string
  source_table: string
  source_id: string
  read_at: string | null
  created_at: string
}

function mapRow(row: CoachNotificationRow): CoachNotification {
  return {
    id: row.id,
    coachId: row.coach_id,
    athleteId: row.athlete_id,
    type: row.type,
    title: row.title,
    body: row.body,
    resourceLink: row.resource_link,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

const UNREAD_LIMIT = 30

export async function fetchUnreadNotifications(coachId: string): Promise<CoachNotification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('coach_notifications')
    .select('*')
    .eq('coach_id', coachId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(UNREAD_LIMIT)

  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('coach_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function markAllNotificationsRead(coachId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('coach_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('coach_id', coachId)
    .is('read_at', null)

  if (error) throw error
}

export async function markResourceNotificationsRead(
  athleteId: string,
  type: NotificationType
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('coach_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('athlete_id', athleteId)
    .eq('type', type)
    .is('read_at', null)

  if (error) throw error
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no new errors introduced by `lib/notifications.ts` (repo has `ignoreBuildErrors: true` in next.config, but tsc should still be clean for this new file).

- [ ] **Step 3: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: add coach_notifications data helpers"
```

---

### Task 3: `NotificationsContext` with Realtime subscription

**Files:**
- Create: `contexts/NotificationsContext.tsx`

**Interfaces:**
- Consumes:
  - `useAuth()` from `contexts/AuthContext.tsx` → `{ user }` (has `.id`).
  - `fetchUnreadNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `CoachNotification` from `lib/notifications.ts` (Task 2).
  - `createClient()` from `lib/supabase/client.ts`.
- Produces:
  - `NotificationsProvider({ children }: { children: React.ReactNode })`
  - `useNotifications(): { notifications: CoachNotification[]; unreadCount: number; markRead: (id: string) => Promise<void>; markAllRead: () => Promise<void> }`

- [ ] **Step 1: Write the context**

```tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchUnreadNotifications,
  markNotificationRead as markNotificationReadApi,
  markAllNotificationsRead as markAllNotificationsReadApi,
  type CoachNotification,
} from '@/lib/notifications'

interface NotificationsContextValue {
  notifications: CoachNotification[]
  unreadCount: number
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<CoachNotification[]>([])
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const reload = useCallback(async () => {
    if (!user) return
    try {
      const rows = await fetchUnreadNotifications(user.id)
      setNotifications(rows)
    } catch (err) {
      console.error('[Notifications] fetch failed:', err)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }
    reload()

    const supabase = createClient()
    const channel = supabase
      .channel(`coach_notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coach_notifications', filter: `coach_id=eq.${user.id}` },
        () => {
          // Any insert/update for this coach — just reload the unread set.
          // Simpler and safer than hand-merging partial payloads.
          reload()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [user, reload])

  // Filet de sécurité: resynchronise au retour d'onglet si le canal
  // Realtime a été coupé pendant la veille (cf. hooks/useRefetchOnResume.ts).
  useEffect(() => {
    const handleWake = () => reload()
    window.addEventListener('coach:wake', handleWake)
    return () => window.removeEventListener('coach:wake', handleWake)
  }, [reload])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    try {
      await markNotificationReadApi(id)
    } catch (err) {
      console.error('[Notifications] markRead failed:', err)
      reload()
    }
  }, [reload])

  const markAllRead = useCallback(async () => {
    if (!user) return
    setNotifications([])
    try {
      await markAllNotificationsReadApi(user.id)
    } catch (err) {
      console.error('[Notifications] markAllRead failed:', err)
      reload()
    }
  }, [user, reload])

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount: notifications.length, markRead, markAllRead }),
    [notifications, markRead, markAllRead]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add contexts/NotificationsContext.tsx
git commit -m "feat: add NotificationsContext with Realtime subscription"
```

---

### Task 4: `NotificationBell` component + `Topbar` + styles

**Files:**
- Create: `components/layout/NotificationBell.tsx`
- Create: `components/layout/Topbar.tsx`
- Create: `styles/notificationBell.module.css`
- Create: `styles/topbar.module.css`

**Interfaces:**
- Consumes: `useNotifications()` from `contexts/NotificationsContext.tsx` (Task 3) → `{ notifications, unreadCount, markRead, markAllRead }`. `CoachNotification` type from `lib/notifications.ts`.
- Produces: `<NotificationBell />` (no props), `<Topbar />` (no props) — both default exports.

- [ ] **Step 1: Write `styles/notificationBell.module.css`**

```css
.bellButton {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--glass-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text);
}

.bellButton:hover {
  background: var(--surface-hover, rgba(255, 255, 255, 0.06));
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--danger, #e5484d);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.dropdown {
  position: absolute;
  top: 46px;
  right: 0;
  width: 340px;
  max-height: 420px;
  overflow-y: auto;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  z-index: 200;
}

.dropdownHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.markAllButton {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 13px;
  cursor: pointer;
}

.notifItem {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  cursor: pointer;
  color: var(--text);
}

.notifItem:last-child {
  border-bottom: none;
}

.notifItem:hover {
  background: var(--surface-hover, rgba(255, 255, 255, 0.06));
}

.notifTitle {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 2px;
}

.notifBody {
  font-size: 12px;
  color: var(--text-muted);
}

.emptyState {
  padding: 24px 14px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
```

- [ ] **Step 2: Write `components/layout/NotificationBell.tsx`**

```tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/contexts/NotificationsContext'
import type { CoachNotification } from '@/lib/notifications'
import styles from '@/styles/notificationBell.module.css'

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleItemClick = useCallback(
    async (notif: CoachNotification) => {
      setOpen(false)
      router.push(notif.resourceLink)
      await markRead(notif.id)
    },
    [markRead, router]
  )

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={styles.bellButton}
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <i className="fa-solid fa-bell" />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 190 }}
            onClick={() => setOpen(false)}
          />
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <span>Notifications</span>
              {notifications.length > 0 && (
                <button type="button" className={styles.markAllButton} onClick={() => markAllRead()}>
                  Tout marquer lu
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>Aucune nouvelle activité</div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  className={styles.notifItem}
                  onClick={() => handleItemClick(notif)}
                >
                  <div className={styles.notifTitle}>{notif.title}</div>
                  {notif.body && <div className={styles.notifBody}>{notif.body}</div>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `styles/topbar.module.css`**

```css
.topbar {
  position: sticky;
  top: 0;
  z-index: 150;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 12px 24px;
  background: transparent;
}
```

- [ ] **Step 4: Write `components/layout/Topbar.tsx`**

```tsx
'use client'

import NotificationBell from '@/components/layout/NotificationBell'
import styles from '@/styles/topbar.module.css'

export default function Topbar() {
  return (
    <div className={styles.topbar}>
      <NotificationBell />
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no new type errors.

- [ ] **Step 6: Commit**

```bash
git add components/layout/NotificationBell.tsx components/layout/Topbar.tsx styles/notificationBell.module.css styles/topbar.module.css
git commit -m "feat: add NotificationBell and Topbar components"
```

---

### Task 5: Wire `NotificationsProvider` + `Topbar` into the app shell

**Files:**
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `NotificationsProvider` from `contexts/NotificationsContext.tsx` (Task 3), `Topbar` from `components/layout/Topbar.tsx` (Task 4).

- [ ] **Step 1: Import and wrap the provider tree**

In `app/(app)/layout.tsx`, add the import:

```tsx
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import Topbar from '@/components/layout/Topbar'
```

Then change the returned tree (the final `return` block) from:

```tsx
  return (
    <AthleteProvider>
      <RecorderProvider>
        <div className={styles.appLayout}>
          <Sidebar />
          <main className={styles.mainContent}>
            {children}
          </main>
        </div>
        <RecordingPill />
        <LiveCamBubble />
        <RetourFinalizeModal />
      </RecorderProvider>
    </AthleteProvider>
  )
```

to:

```tsx
  return (
    <AthleteProvider>
      <NotificationsProvider>
        <RecorderProvider>
          <div className={styles.appLayout}>
            <Sidebar />
            <div className={styles.mainContent} style={{ display: 'flex', flexDirection: 'column' }}>
              <Topbar />
              <main style={{ flex: 1 }}>{children}</main>
            </div>
          </div>
          <RecordingPill />
          <LiveCamBubble />
          <RetourFinalizeModal />
        </RecorderProvider>
      </NotificationsProvider>
    </AthleteProvider>
  )
```

Note: `main` no longer carries `styles.mainContent` directly (moved to the wrapping div so `Topbar` sits above it inside the same scroll container) — check `styles/sidebar.module.css`'s `.mainContent` rule for any properties (e.g. `margin-left` offsetting the fixed sidebar) that must stay on the outer wrapping div, not get lost. Read that CSS rule before editing to confirm.

- [ ] **Step 2: Manual verification**

Run: `npm run dev`
Open the app, log in as a coach. Confirm:
- The bell renders top-right on every `(app)` page.
- Sidebar layout/offset is unchanged (no visual regression from moving `mainContent` styling).
- Clicking the bell opens an (empty) dropdown with no console errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/layout.tsx"
git commit -m "feat: mount NotificationsProvider and Topbar in app shell"
```

---

### Task 6: Auto-mark-read on visiting each source page

**Files:**
- Modify: `app/(app)/athletes/[id]/bilans/page.tsx` (or the client component it renders — check which file holds `'use client'` and the `athleteId` param first)
- Modify: `app/(app)/athletes/[id]/questionnaires/page.tsx`
- Modify: `app/(app)/videos/page.tsx`
- Modify: `app/(app)/athletes/[id]/posing/page.tsx`
- Modify: `app/(app)/athletes/[id]/fodmap/page.tsx`

**Interfaces:**
- Consumes: `markResourceNotificationsRead(athleteId: string, type: NotificationType)` from `lib/notifications.ts` (Task 2).

- [ ] **Step 1: Confirm each target file and its athleteId source**

Before editing, run:

```bash
grep -n "athleteId\|params" "app/(app)/athletes/[id]/bilans/page.tsx" "app/(app)/athletes/[id]/questionnaires/page.tsx" "app/(app)/athletes/[id]/posing/page.tsx" "app/(app)/athletes/[id]/fodmap/page.tsx"
```

For each per-athlete page, confirm how the athlete id is obtained (route param vs `useParams()`) before writing the effect — do not assume the prop name.

- [ ] **Step 2: Add the mark-read effect to each per-athlete page**

For `bilans`, `questionnaires`, `posing`, `fodmap` (each is athlete-scoped — has an athlete id in scope), add near the top of the client component:

```tsx
import { useEffect } from 'react'
import { markResourceNotificationsRead } from '@/lib/notifications'
```

```tsx
useEffect(() => {
  if (!athleteId) return
  markResourceNotificationsRead(athleteId, '<TYPE>').catch((err) =>
    console.error('[Notifications] markResourceNotificationsRead failed:', err)
  )
}, [athleteId])
```

Substitute `<TYPE>` per page: `bilans` → `'bilan'`, `questionnaires` → `'questionnaire'`, `posing` → `'posing_video'`, `fodmap` → `'fodmap'`.

- [ ] **Step 3: Add the mark-read effect to `app/(app)/videos/page.tsx`**

This page is cross-athlete (`type: 'execution_video'` notifications don't carry a single relevant `athleteId` for the whole page — the notification's `resourceLink` is `/videos` for all athletes). Mark all unread `execution_video` notifications for the coach as read on mount instead of per-athlete:

```tsx
import { useNotifications } from '@/contexts/NotificationsContext'
```

Inside the component:

```tsx
const { notifications, markRead } = useNotifications()

useEffect(() => {
  const unreadExecutionVideoIds = notifications
    .filter((n) => n.type === 'execution_video')
    .map((n) => n.id)
  unreadExecutionVideoIds.forEach((id) => {
    markRead(id).catch((err) => console.error('[Notifications] markRead failed:', err))
  })
  // Only run once on mount — do not re-run when `notifications` updates from
  // the Realtime subscription, or a video added while the page is open
  // would be immediately marked read before the coach sees it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. With a test notification present (insert one manually via SQL as in Task 1 Step 3, using a real athlete you coach), navigate to the corresponding page and confirm the bell's unread count decrements and the item disappears from the dropdown.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/athletes/[id]/bilans" "app/(app)/athletes/[id]/questionnaires" "app/(app)/videos/page.tsx" "app/(app)/athletes/[id]/posing" "app/(app)/athletes/[id]/fodmap"
git commit -m "feat: auto-mark-read notifications on visiting related pages"
```

---

### Task 7: End-to-end verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full flow test**

With `npm run dev` running and logged in as a coach with at least one athlete:

1. In the Supabase SQL Editor, insert a test row into `daily_reports` for that athlete (as in Task 1 Step 3).
2. Within a few seconds (Realtime), confirm the bell badge increments without a page refresh.
3. Click the bell, confirm the "Nouveau bilan" item appears.
4. Click the item — confirm navigation to `/athletes/<id>/bilans` and the badge decrements.
5. Repeat steps 1–4 for `questionnaire_responses`, `execution_videos`, `posing_videos`, `athlete_fodmap_logs` (adjust resource paths accordingly).
6. For one event type, instead of clicking the notification, navigate directly to the related page — confirm the notification disappears from the bell (auto-mark-read) without clicking it in the dropdown first.
7. Log in as a second coach (or inspect via SQL) and confirm they never see the first coach's test notifications.

- [ ] **Step 2: Clean up all test rows**

```sql
DELETE FROM coach_notifications WHERE title LIKE '%test%' OR created_at > now() - interval '1 hour';
-- Only if you're certain these are your own test rows — otherwise delete
-- by explicit id captured during Step 1 of this task and Task 1.
```

Also delete any test rows you inserted into `daily_reports` / `questionnaire_responses` / `execution_videos` / `posing_videos` / `athlete_fodmap_logs`.

- [ ] **Step 3: Update `ARCHITECTURE.md`**

Add `coach_notifications` to the DB schema section (§7, "Notif & push"), and `NotificationsContext` to §5, and `NotificationBell`/`Topbar` to §4 under `layout/`. Follow the existing table/format conventions in that file.

- [ ] **Step 4: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: document coach notification center in ARCHITECTURE.md"
```

---

## Self-Review Notes

- **Spec coverage**: 5 event types (Task 1) ✓, manual + auto mark-read (Tasks 2, 6) ✓, Realtime badge (Task 3) ✓, bell top-right (Task 4/5) ✓, no ATHLETE changes (all tasks are SQL/COACH-only) ✓, in-app only — no push/email code added ✓.
- **No placeholders**: all SQL and TSX are complete, no TBD.
- **Type consistency**: `CoachNotification` (Task 2) is the single shape used by `NotificationsContext` (Task 3) and `NotificationBell` (Task 4) — field names (`resourceLink`, `readAt`, etc.) match throughout. `NotificationType` union is identical between `lib/notifications.ts`, the SQL `CHECK` constraint, and Task 6's per-page literals.
