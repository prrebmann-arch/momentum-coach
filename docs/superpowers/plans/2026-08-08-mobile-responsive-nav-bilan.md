# Mobile Responsive — Nav + Bilan Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the COACH app usable on phone-width viewports for the critical path: opening the mobile nav, browsing to an athlete's bilans tab, reviewing the cross-athlete `/bilans` overview, and reading a bilan's detail without content clipping or horizontal page overflow — with zero visual/behavioral change on desktop (≥1024px).

**Architecture:** Activate the sidebar's already-existing off-canvas CSS (`.sidebarOpen` class defined but never applied) via a new lightweight `MobileNavContext` connecting a hamburger button in `Topbar.tsx` to `Sidebar.tsx`'s mobile-open state — kept fully separate from the existing desktop `collapsed` state (persisted in localStorage), which is untouched. Fix the athlete-tabs horizontal clipping (`overflow: hidden` → `overflow-x: auto`) under the existing mobile breakpoint. Add a mobile card view to `BilansOverview.tsx` alongside the existing table, toggled purely via CSS `display` under a breakpoint (both DOM trees render; no JS viewport detection — avoids SSR/hydration divergence). Fix two overflow bugs in the bilan accordion CSS. Cap the notification dropdown's width.

**Tech Stack:** Next.js 16 App Router, React 19, CSS Modules, no new dependencies.

## Global Constraints

- **Desktop (≥1024px) must be pixel-identical after this work — no exceptions.** Every change is either scoped inside an existing or new `@media (max-width: ...)` block, or is a `min(Xpx, Yvw)` substitution that has zero effect above the viewport width where `Yvw > Xpx`. Never edit a CSS rule's default (non-media-query) declaration in a way that changes desktop rendering.
- No JavaScript viewport/window-width detection anywhere in this plan (`window.innerWidth`, `matchMedia` in state, etc.) — all responsive behavior is CSS-driven (`@media` + `display: none/block` toggles), which is SSR-safe and avoids hydration mismatches. The one exception is the existing `collapsed` desktop-sidebar state, already guarded by the repo's established `useEffect`-post-hydration pattern — do not replicate that pattern for anything in this plan; CSS handles all of it.
- Follow the existing CSS Modules convention: styles live in `styles/*.module.css`, imported per-component. Don't introduce inline `<style>` tags or CSS-in-JS.
- Tap targets on any newly-added interactive mobile element (hamburger button, card action buttons) should be at least 40x40px — matches the existing `.footerBtn`/`.bellButton` sizing already used in this codebase (both ~38-40px), not a new convention.

---

## File Structure

- Create: `contexts/MobileNavContext.tsx` — lightweight context for the mobile sidebar open/close state.
- Modify: `app/(app)/layout.tsx` — wrap the tree in `MobileNavProvider`.
- Modify: `components/layout/Sidebar.tsx` — consume the context, apply `.sidebarOpen`, close on navigation.
- Modify: `components/layout/Topbar.tsx` — add hamburger button, mobile-only.
- Modify: `styles/sidebar.module.css` — hamburger button styles (mobile-only) + overlay styles.
- Modify: `styles/topbar.module.css` — hamburger button visibility rules.
- Modify: `styles/athletes.module.css` — athlete tabs horizontal scroll fix.
- Modify: `components/bilans/BilansOverview.tsx` — add mobile card view alongside the existing table.
- Modify: `styles/bilans.module.css` — mobile card styles, `.stats` overflow fix, `.boCardsWrap`/`.boTableWrap` display toggle, daily-detail text size bump.
- Modify: `styles/notificationBell.module.css` — dropdown width cap.

---

### Task 1: `MobileNavContext` + wire into layout

**Files:**
- Create: `contexts/MobileNavContext.tsx`
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Produces:
  - `export function MobileNavProvider({ children }: { children: React.ReactNode }): JSX.Element`
  - `export function useMobileNav(): { mobileOpen: boolean; setMobileOpen: (open: boolean) => void; toggleMobileOpen: () => void }`

- [ ] **Step 1: Write the context**

```tsx
'use client'

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'

interface MobileNavContextValue {
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  toggleMobileOpen: () => void
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleMobileOpen = useCallback(() => {
    setMobileOpen((prev) => !prev)
  }, [])

  const value = useMemo<MobileNavContextValue>(
    () => ({ mobileOpen, setMobileOpen, toggleMobileOpen }),
    [mobileOpen, toggleMobileOpen]
  )

  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
}

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext)
  if (!ctx) throw new Error('useMobileNav must be used within MobileNavProvider')
  return ctx
}
```

- [ ] **Step 2: Wrap the app shell**

In `app/(app)/layout.tsx`, add the import:

```tsx
import { MobileNavProvider } from '@/contexts/MobileNavContext'
```

Change the final `return` block from:

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

to:

```tsx
  return (
    <AthleteProvider>
      <NotificationsProvider>
        <MobileNavProvider>
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
        </MobileNavProvider>
      </NotificationsProvider>
    </AthleteProvider>
  )
```

(Only `MobileNavProvider` is added, wrapping `RecorderProvider` — no other structural change.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors referencing `contexts/MobileNavContext.tsx` or `app/(app)/layout.tsx`.

- [ ] **Step 4: Commit**

```bash
git add contexts/MobileNavContext.tsx "app/(app)/layout.tsx"
git commit -m "feat: add MobileNavContext for mobile sidebar toggle"
```

---

### Task 2: Hamburger button in Topbar + Sidebar mobile-open wiring

**Files:**
- Modify: `components/layout/Topbar.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `styles/topbar.module.css`
- Modify: `styles/sidebar.module.css`

**Interfaces:**
- Consumes: `useMobileNav()` from `contexts/MobileNavContext.tsx` (Task 1) → `{ mobileOpen, setMobileOpen, toggleMobileOpen }`.

- [ ] **Step 1: Add the hamburger button to Topbar**

Read the current `components/layout/Topbar.tsx` in full first (it's small — just confirm nothing has drifted since this plan was written). Then rewrite it:

```tsx
'use client'

import NotificationBell from '@/components/layout/NotificationBell'
import { useMobileNav } from '@/contexts/MobileNavContext'
import styles from '@/styles/topbar.module.css'

export default function Topbar() {
  const { toggleMobileOpen } = useMobileNav()

  return (
    <div className={styles.topbar}>
      <button
        type="button"
        className={styles.hamburgerBtn}
        aria-label="Ouvrir le menu"
        onClick={toggleMobileOpen}
      >
        <i className="fa-solid fa-bars" />
      </button>
      <div className={styles.topbarSpacer} />
      <NotificationBell />
    </div>
  )
}
```

- [ ] **Step 2: Add hamburger + spacer styles to topbar.module.css**

Read the current `styles/topbar.module.css` in full first. The current file is:

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

Add these new rules (do not modify `.topbar` itself — desktop layout must stay unchanged):

```css
.hamburgerBtn {
  display: none;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--glass-bg);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text);
  font-size: 16px;
}

.hamburgerBtn:hover {
  background: var(--surface-hover, rgba(255, 255, 255, 0.06));
}

.topbarSpacer {
  flex: 1;
}

@media (max-width: 1024px) {
  .hamburgerBtn {
    display: inline-flex;
  }
}
```

`.hamburgerBtn` is `display: none` by default (desktop) and only becomes visible under the same 1024px breakpoint already used by `sidebar.module.css` for the off-canvas sidebar — keeps the two thresholds in sync. `.topbarSpacer` pushes the bell to the right exactly as `.topbar`'s existing `justify-content: flex-end` did before, but now the hamburger sits at the far left when visible; on desktop the hamburger is `display: none` so `.topbar`'s own `justify-content: flex-end` still positions the bell exactly as before (verify this visually in Task 2's manual check, Step 5).

- [ ] **Step 3: Wire `mobileOpen` into Sidebar**

Read the current `components/layout/Sidebar.tsx` in full first (reproduced in this plan's investigation, but re-verify nothing has drifted). Modify `SidebarImpl`:

Add the import:
```tsx
import { useMobileNav } from '@/contexts/MobileNavContext'
```

Add near the top of `SidebarImpl`, alongside the existing `useAuth`/`useTheme` calls:
```tsx
const { mobileOpen, setMobileOpen } = useMobileNav()
```

Change the root `<div>`'s className from:
```tsx
<div className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
```
to:
```tsx
<div className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.sidebarOpen : ''}`}>
```

In the `nav` items' `.map()`, each `<Link>` needs an `onClick` that closes the mobile menu on navigation (desktop is unaffected — `setMobileOpen(false)` when it's already `false` is a no-op re-render-wise since React bails out on identical state). Change:
```tsx
<Link
  key={item.route}
  href={item.route}
  className={isActive(item.route) ? styles.navItemActive : styles.navItem}
  title={collapsed ? item.label : undefined}
>
```
to:
```tsx
<Link
  key={item.route}
  href={item.route}
  className={isActive(item.route) ? styles.navItemActive : styles.navItem}
  title={collapsed ? item.label : undefined}
  onClick={() => setMobileOpen(false)}
>
```

Add a mobile-only overlay, rendered as a sibling right before the sidebar's root `<div>` closes (i.e., after the `<div className={styles.sidebarFooter}>...</div>` block, still inside the outermost returned fragment — restructure the return to a fragment if it isn't one already). The overlay only needs to render when `mobileOpen` is true and only has visible effect under the mobile breakpoint (desktop never sets `mobileOpen` to true since there's no way to trigger it there — the hamburger that sets it is `display: none` above 1024px):

```tsx
return (
  <>
    {mobileOpen && (
      <div
        className={styles.mobileOverlay}
        onClick={() => setMobileOpen(false)}
      />
    )}
    <div className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.sidebarOpen : ''}`}>
      {/* ... existing content unchanged ... */}
    </div>
  </>
)
```

- [ ] **Step 4: Add overlay styles to sidebar.module.css**

Read the current `styles/sidebar.module.css` in full first, specifically the existing `@media (max-width: 1024px)` block (contains `.sidebar { transform: translateX(-100%); ... }` and `.sidebarOpen { transform: translateX(0); }`). Add the overlay rule INSIDE that same media query block, so it never applies on desktop:

```css
@media (max-width: 1024px) {
  /* ... existing .sidebar / .sidebarOpen / .mainContent rules stay exactly as-is ... */

  .mobileOverlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }
}
```

`z-index: 99` — confirm this sits below the sidebar's own z-index (check the existing `.sidebar` rule for its `z-index` value outside the media query and use one less, so the overlay never covers the sidebar itself, only the content behind it).

- [ ] **Step 5: Manual verification**

Run `npm run dev`. Using browser DevTools device toolbar (or resizing the window) at both a desktop width (≥1024px) and a phone width (375-430px):
- **Desktop**: confirm the hamburger is invisible, the topbar/bell look identical to before this change, the sidebar behaves exactly as before (collapse toggle still works, no overlay ever appears).
- **Mobile**: confirm the sidebar starts off-screen, tapping the hamburger slides it in, tapping a nav link navigates AND closes the sidebar, tapping the overlay (not a link) closes without navigating.

- [ ] **Step 6: Commit**

```bash
git add components/layout/Topbar.tsx components/layout/Sidebar.tsx styles/topbar.module.css styles/sidebar.module.css
git commit -m "feat: wire hamburger button to mobile sidebar off-canvas toggle"
```

---

### Task 3: Athlete tabs horizontal scroll on mobile

**Files:**
- Modify: `styles/athletes.module.css`

**Interfaces:** none (CSS-only).

- [ ] **Step 1: Locate and confirm the current rule**

Read `styles/athletes.module.css` around the `.athleteTabs` rule (currently, per this plan's investigation, lines 169-178):

```css
/* ===== ATHLETE TABS ===== */
.athleteTabs {
  display: flex;
  align-items: center;
  gap: 0px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
  overflow: hidden;
}
```

Re-verify these exact line numbers and content before editing — confirm nothing has drifted.

- [ ] **Step 2: Add mobile scroll override**

Find the existing `@media (max-width: 768px)` block in this file (per this plan's investigation, near the end of the file, currently containing `.apRow`, `.infoGrid`, `.athleteGrid`, `.statGrid` overrides). Add `.athleteTabs` to that same block:

```css
@media (max-width: 768px) {
  .apRow { grid-template-columns: 1fr; }
  .infoGrid { grid-template-columns: 1fr; }
  .athleteGrid { grid-template-columns: 1fr; }
  .statGrid { grid-template-columns: 1fr 1fr; }
  .athleteTabs {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .athleteTabs::-webkit-scrollbar {
    display: none;
  }
}
```

Do NOT change the base (non-media-query) `.athleteTabs` rule — `overflow: hidden` stays there for desktop; the media query overrides it to `overflow-x: auto` only under 768px.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open an athlete's detail page at a 375-430px viewport width. Confirm all tabs (including "Bilans", further down the list) are reachable by a horizontal swipe/scroll gesture, with no visible scrollbar. At ≥1024px, confirm tabs render exactly as before (clipped/hidden overflow, no scrolling — this is the pre-existing desktop behavior, unchanged).

- [ ] **Step 4: Commit**

```bash
git add styles/athletes.module.css
git commit -m "fix: make athlete tabs horizontally scrollable on mobile"
```

---

### Task 4: `/bilans` mobile card view

**Files:**
- Modify: `components/bilans/BilansOverview.tsx`
- Modify: `styles/bilans.module.css`

**Interfaces:**
- Consumes: existing component state already in scope in `BilansOverview.tsx` — `filtered: AthleteData[]` (each with `.athlete`, `.status`, `.bilanReport`, `.lastBilanReport`, `.expectedStr`), `router`, `marking`, `sendingRappel`, `rappelSentRef`, `markAsTreated`, `sendRappel`. No new state needed — this task only adds a second JSX render of the same data.

- [ ] **Step 1: Read the current table JSX in full**

Read `components/bilans/BilansOverview.tsx` around the table block (per this plan's investigation, roughly lines 235-328) to confirm current structure, especially the exact variable names used inside the `.map()` (`a`, `initials`, `lastBilanDate`, `lastDateStr`, `echeanceStr`, `bilanInfo`) — reuse identically in the new card view, don't rename.

- [ ] **Step 2: Add the card view JSX, wrapped for CSS-only toggling**

Wrap the EXISTING table block in a div with class `boTableWrap` — it already has this class per the current code (`<div className={styles.boTableWrap}>`), so no change needed there except confirming it stays as-is.

Immediately after the closing `</div>` of `boTableWrap` (and before the outer component's closing `</div>`), add a new card-view block:

```tsx
      <div className={styles.boCardsWrap}>
        {filtered.length ? filtered.map(d => {
          const a = d.athlete
          const initials = (a.prenom?.charAt(0) || '') + (a.nom?.charAt(0) || '')
          const lastBilanDate = d.lastBilanReport?.date
          const lastDateStr = lastBilanDate
            ? new Date(lastBilanDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'
          const echeanceStr = new Date(d.expectedStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
          const bilanInfo = d.bilanReport
            ? (d.bilanReport.weight ? d.bilanReport.weight + ' kg' : 'Soumis')
            : '—'

          return (
            <div
              key={a.id}
              className={styles.boCard}
              onClick={() => router.push(`/athletes/${a.id}/bilans`)}
            >
              <div className={styles.boCardHeader}>
                <div className={styles.boAvatar}>{initials}</div>
                <div className={styles.boCardName}>{a.prenom} {a.nom}</div>
                <StatusBadge status={d.status} />
              </div>
              <div className={styles.boCardRow}>
                <span className={styles.boCardLabel}>Poids</span>
                <span>{bilanInfo}</span>
              </div>
              <div className={styles.boCardRow}>
                <span className={styles.boCardLabel}>Echeance</span>
                <span>{echeanceStr}</span>
              </div>
              <div className={styles.boCardRow}>
                <span className={styles.boCardLabel}>Dernier bilan</span>
                <span>{lastBilanDate ? lastDateStr : '—'}</span>
              </div>
              <div className={styles.boCardActions} onClick={(e) => e.stopPropagation()}>
                {d.status === 'done' && d.bilanReport && (
                  <button
                    className={styles.boCardActionBtn}
                    style={{ color: 'var(--success)' }}
                    onClick={() => markAsTreated(d.bilanReport!.id)}
                    disabled={marking === d.bilanReport.id}
                  >
                    <i className={marking === d.bilanReport.id ? 'fas fa-spinner fa-spin' : 'fas fa-check'} />
                    {' '}Marquer traite
                  </button>
                )}
                {d.status === 'late' && a.user_id && (
                  <button
                    className={styles.boCardActionBtn}
                    style={{ color: rappelSentRef.current.has(a.id) ? 'var(--text3)' : 'var(--primary)' }}
                    onClick={() => sendRappel(a)}
                    disabled={sendingRappel === a.id || rappelSentRef.current.has(a.id)}
                  >
                    <i className={sendingRappel === a.id ? 'fas fa-spinner fa-spin' : rappelSentRef.current.has(a.id) ? 'fas fa-bell-slash' : 'fas fa-bell'} />
                    {' '}{rappelSentRef.current.has(a.id) ? 'Rappel envoye' : 'Envoyer rappel'}
                  </button>
                )}
                <Link
                  href={`/athletes/${a.id}/bilans`}
                  className={styles.boCardActionBtn}
                  onClick={(e) => e.stopPropagation()}
                >
                  <i className="fas fa-eye" /> Voir
                </Link>
              </div>
            </div>
          )
        }) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>
            Aucun bilan dans cette categorie
          </div>
        )}
      </div>
```

This duplicates the table's per-row logic into per-card logic using the same `filtered` array and the same helper computations — intentional duplication (not extracted into a shared render function) to keep this task's diff simple and reviewable; the two views render different DOM shapes (`<tr>` vs `<div>`) so a shared render function would need significant abstraction for little benefit at this scope.

- [ ] **Step 3: Add card + display-toggle styles to bilans.module.css**

Read the current `styles/bilans.module.css` around `.boTableWrap`/`.boTable` (per this plan's investigation, lines 443+) to confirm current rules, then add:

```css
.boCardsWrap {
  display: none;
}

.boCard {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
}

.boCardHeader {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.boCardName {
  flex: 1;
  font-weight: 600;
  color: var(--text);
  font-size: 14px;
}

.boCardRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
  color: var(--text2);
}

.boCardLabel {
  color: var(--text3);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.boCardActions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle, var(--border));
  flex-wrap: wrap;
}

.boCardActionBtn {
  flex: 1;
  min-width: 100px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg3);
  color: var(--text);
  font-size: 12px;
  text-decoration: none;
  cursor: pointer;
}

@media (max-width: 768px) {
  .boTableWrap {
    display: none;
  }
  .boCardsWrap {
    display: block;
  }
}
```

`.boCardsWrap` defaults to `display: none` (desktop hides it) and `.boTableWrap` is only hidden inside the `max-width: 768px` block — so above 768px nothing changes (table shows, cards don't exist visually even though both are in the DOM), and below 768px the table hides and cards show.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero new errors from `components/bilans/BilansOverview.tsx`.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open `/bilans` at both ≥1024px (confirm table renders exactly as before, no cards visible) and ≤768px (confirm cards render instead of the table, all data matches what the table would have shown, tapping a card navigates to the athlete's bilans page, tapping an action button doesn't also trigger navigation).

- [ ] **Step 6: Commit**

```bash
git add components/bilans/BilansOverview.tsx styles/bilans.module.css
git commit -m "feat: add mobile card view to /bilans overview"
```

---

### Task 5: Bilan accordion overflow fixes + notification dropdown width cap

**Files:**
- Modify: `styles/bilans.module.css`
- Modify: `styles/notificationBell.module.css`

**Interfaces:** none (CSS-only).

- [ ] **Step 1: Fix `.stats` horizontal overflow**

Read `styles/bilans.module.css` around the `.stats` rule (per this plan's investigation, lines 64-67) and the existing mobile breakpoint that sets `min-width: 720px` on it (per this plan's investigation, around line 238, inside a `@media` block). Confirm the exact current content of that media query block before editing (it also touches `.daysTable`, `.dayHdr`, `.dayRow`, `.dayAvg` — per investigation, around lines 235-243).

Add `overflow-x: auto` to `.stats` itself, scoped inside that same existing media query (do not add it to the base `.stats` rule — desktop must keep its current non-scrolling grid layout, which fits without overflow at desktop widths):

```css
/* inside the existing media query block that already sets .stats { ...; min-width: 720px; } */
.stats {
  grid-template-columns: 80px repeat(12, 1fr) 60px 32px;
  min-width: 720px;
  overflow-x: auto;
}
```

(Merge this into the existing `.stats` declaration inside that media query rather than duplicating the rule — read the exact current block first and edit it in place.)

- [ ] **Step 2: Bump daily-detail text size on mobile**

Read `components/bilans/BilanAccordion.tsx` around the daily detail table (per this plan's investigation, roughly lines 743-800) to find which CSS classes render the small 9-11px text (per this plan's investigation, `.dayHdr span` at 9px in `bilans.module.css` around line 133, and check for a corresponding `.dayRow`/`.dr` text-size rule nearby — read the file directly rather than trusting this plan's line numbers, which may have shifted).

In the SAME existing media query block from Step 1 (the one that already overrides `.daysTable`/`.dayHdr`/`.dayRow`/`.dayAvg` for mobile), add a font-size override for whichever classes render the daily-detail cell text — target ~12-13px (up from 9-11px). Example (adjust exact class names to what you find in the file):

```css
.dayHdr span,
.dr {
  font-size: 12px;
}
```

Only add this inside the existing mobile media query block — do not touch the base (desktop) font-size declarations for these classes.

- [ ] **Step 3: Cap notification dropdown width**

Read `styles/notificationBell.module.css`'s `.dropdown` rule (per this plan's investigation, currently `width: 340px;`). Change:

```css
.dropdown {
  position: absolute;
  top: 46px;
  right: 0;
  width: 340px;
  /* ... rest unchanged ... */
}
```

to:

```css
.dropdown {
  position: absolute;
  top: 46px;
  right: 0;
  width: min(340px, 90vw);
  /* ... rest unchanged ... */
}
```

This is a direct substitution, not inside a media query — `min(340px, 90vw)` evaluates to exactly `340px` for any viewport ≥ ~378px wide (since `90vw` only drops below `340px` when viewport width < 340/0.9 ≈ 378px), so no desktop or tablet width is visually affected. Only phones narrower than ~378px see the cap take effect.

- [ ] **Step 4: Manual verification**

Run `npm run dev`. At ≥1024px: open a bilan's daily detail table and confirm it looks pixel-identical to before (no font-size change, no overflow behavior change since desktop never hits this media query). At ≤768px (matching the existing breakpoint used by `.stats`'s current mobile override): open a bilan with weekly stats and daily detail, confirm no page-level horizontal scroll occurs (the wide grids scroll locally within their own containers instead), and confirm the daily-detail text is comfortably readable. Open the notification bell at a ~360px viewport width and confirm the dropdown no longer overflows the screen edge; at ≥1024px confirm the dropdown is still exactly 340px wide.

- [ ] **Step 5: Commit**

```bash
git add styles/bilans.module.css styles/notificationBell.module.css
git commit -m "fix: contain bilan accordion overflow and cap notification dropdown width on mobile"
```

---

## Self-Review Notes

- **Spec coverage**: sidebar off-canvas activation (Task 1-2) ✓, athlete tabs scroll (Task 3) ✓, `/bilans` mobile cards (Task 4) ✓, `.stats` overflow fix + daily-detail text size (Task 5) ✓, notification dropdown width cap (Task 5) ✓. All 5 items from the design doc's Architecture section are covered.
- **No placeholders**: every code block is complete. The few "read the file first, exact line numbers may have shifted" notes are verification gates for the implementer (this plan was written from a point-in-time read of the files), not vague TODOs — each still specifies exactly what content to find and what to add/change.
- **Type consistency**: `useMobileNav()`'s return shape (`{ mobileOpen, setMobileOpen, toggleMobileOpen }`) defined in Task 1 is consumed identically in Task 2 by both `Topbar.tsx` (`toggleMobileOpen`) and `Sidebar.tsx` (`mobileOpen`, `setMobileOpen`) — no drift.
- **Desktop-safety audit**: every CSS change in this plan is either (a) inside an existing or new `@media (max-width: ...)` block, or (b) a `min(Xpx, Yvw)` substitution with no effect above a documented threshold. No task modifies a base/default CSS declaration in a way that changes rendering above 1024px. This was double-checked against the Global Constraints section during self-review.
