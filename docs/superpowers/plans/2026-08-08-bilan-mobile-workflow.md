# Bilan Mobile Workflow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bilan review actually usable on a phone by matching the coach's real workflow (photos → weight/mensurations → daily detail only if needed → video/voice/text feedback → mark treated), instead of leading with a dense 14-column grid. Fix under-sized tap targets and a mouse-only tooltip along the way. Make the mobile video-feedback default avoid the platform wall (screen-share recording, which cannot work on mobile browsers) by defaulting to the already-built selfie mode there.

**Architecture:** `BilanAccordion.tsx`'s `.header` (always visible, not subject to the card's open/close mechanism) gains a mobile-only Photos button next to the existing "mark treated" action — reuses the existing `onOpenPhoto` prop, no new photo-fetching logic. The daily-detail table (already inside the collapsible `.body`) gains its own independent collapse toggle on mobile, defaulting closed, with a new stacked-card rendering added alongside the existing grid rendering (CSS `display` toggle under the mobile breakpoint, same pattern as the `/bilans` table-vs-cards work from the prior session — both DOM trees render, no JS viewport detection). Touch targets across `BilanAccordion.tsx` and `PhotoCompare.tsx` are enlarged inside existing mobile media queries. `MensurationCharts.tsx` gains touch event handlers mirroring its existing mouse handlers. `BilanPhotosUploadModal.tsx` gets a responsive width/padding pass. `NouveauRetourPanel.tsx`'s default recording mode is switched to `'selfie'` on mobile via a post-hydration `useEffect` (matching the `Sidebar.tsx` `collapsed`-state pattern already used in this repo for reading `localStorage` after mount), and the desktop-only "Écran + cam" button is visually disabled with an explanatory note on mobile instead of silently failing when tapped.

**Tech Stack:** Next.js 16 App Router, React 19, CSS Modules, no new dependencies.

## Global Constraints

- **Desktop (≥1024px) must be pixel-identical after this work, with one narrow, justified exception.** Every CSS change is scoped inside an existing `@media (max-width: ...)` block, or is a new rule that only takes effect via a `display: none` default that a media query overrides (same proven pattern as the prior mobile session). The one exception: `NouveauRetourPanel.tsx`'s `recordMode` default. This is a React state initial value, not a CSS/layout change — on desktop, the `useEffect` that would switch it to `'selfie'` checks `window.matchMedia('(max-width: 768px)').matches`, which is `false` on desktop, so the effect never fires there and `recordMode` stays `'screen'` exactly as today.
- No JavaScript viewport-driven conditional *rendering* anywhere in this plan (no `window.innerWidth` state driving which JSX renders) — CSS media queries handle all visual toggling. The one `matchMedia` check in this plan (Task 6) only sets a *state default value* once, post-mount, exactly mirroring the existing `Sidebar.tsx:58-63` `localStorage`-read pattern (`useState` initialized to the desktop-safe value, corrected in a `useEffect` with `[]` deps so it never causes an SSR/client hydration mismatch — the initial render, both server and client, always uses the desktop default).
- Follow the existing CSS Modules convention: styles live in `styles/*.module.css`. `BilanPhotosUploadModal.tsx`'s fixed `width: 540` is an inline style, not a CSS Module rule — Task 5 converts it to a class-based width so a mobile media query can override it (inline styles cannot be overridden by media queries).
- Tap targets added or enlarged in this plan target 44×44px minimum, consistent with the standard already used for `.footerBtn`/`.bellButton` elsewhere in this codebase.
- `.noteBtn` in `bilans.module.css` is shared by many different actions (mark-treated, column paging, expand-week, open-photos, expand-day-detail, delete-bilan) — enlarging it inside the mobile media query affects every one of these consistently, which is intentional (all were flagged as under-sized in the audit).

---

## File Structure

- Modify: `components/bilans/BilanAccordion.tsx` — Photos button in header; independent day-detail collapse state + stacked-card rendering.
- Modify: `styles/bilans.module.css` — new header-photos-button styles; day-detail-card styles; `.noteBtn` mobile sizing; `.pcNav`/`.pcResetLink` mobile sizing (shared file with `PhotoCompare.tsx`'s classes).
- Modify: `components/bilans/MensurationCharts.tsx` — touch event handlers for the tooltip.
- Modify: `components/bilans/BilanPhotosUploadModal.tsx` — replace inline `width: 540` with a CSS class; responsive padding.
- Modify: `components/recorder/NouveauRetourPanel.tsx` — mobile-default `recordMode`, disabled "Écran + cam" button with note on mobile.

---

### Task 1: Photos button in the bilan header (mobile)

**Files:**
- Modify: `components/bilans/BilanAccordion.tsx`
- Modify: `styles/bilans.module.css`

**Interfaces:**
- Consumes: `onOpenPhoto: (type: PhotoType, date: string) => void` — already a prop of `BilanAccordion` (`BilanAccordion.tsx:129`), already called elsewhere in the file as `onOpenPhoto('front', b.date)` (`BilanAccordion.tsx:883`). `hasPhotos` — already a computed boolean per-day inside the render loop (search for its definition before this task's edits; it gates the existing camera icon at line 880-887 — reuse the same underlying photo-presence check, but at the week level: the new header button should show if ANY day in the week has photos).

- [ ] **Step 1: Locate the exact current header JSX and the day-level `hasPhotos` check**

Read `components/bilans/BilanAccordion.tsx` around lines 573-635 (the `.header` block) and around lines 878-888 (the existing per-day camera button, to see how `hasPhotos` is currently derived and how `onOpenPhoto` is called). Re-verify these line numbers before editing — this plan was written from a point-in-time read.

Also find where the per-week day list (`w.bilansByDayIdx` or similar, referenced at `BilanAccordion.tsx:597`) or the raw `bilans` prop is available in scope at the point of the header render, so you can compute "does this week have at least one day with a photo" — reuse whatever data structure the per-day loop already uses to determine `hasPhotos`, applied across the week's days instead of one day.

- [ ] **Step 2: Add a week-level `hasAnyPhoto` derivation**

Near wherever the week's derived stats (`w.avgWeight`, `deltaKg`, etc.) are computed — likely in a `useMemo` building the `weeks` array, or inline per week in the render — add a boolean that's true if any day in that week has at least one of `photo_front`/`photo_side`/`photo_back` set (or whatever the exact field check the existing per-day `hasPhotos` uses — copy that exact condition, just applied with `.some()` across the week's days instead of a single day).

- [ ] **Step 3: Add the button to `.headerRight`**

In the `.headerRight` div (`BilanAccordion.tsx:586-603`, currently containing the "mark treated" `.noteBtn`, the `.dots` day-status row, and the chevron), add a new button BEFORE the existing "mark treated" button, only rendered when the week's `hasAnyPhoto` is true:

```tsx
{hasAnyPhoto && (
  <button
    className={styles.headerPhotoBtn}
    onClick={(e) => {
      e.stopPropagation()
      // Open on the most recent day in this week that actually has a photo —
      // reuse the same photo-presence check from Step 2, applied to find
      // the specific date, then call onOpenPhoto exactly as the existing
      // per-day camera icon does (BilanAccordion.tsx:883).
      const dateWithPhoto = /* most recent day in this week with a photo, per Step 2's logic */
      onOpenPhoto('front', dateWithPhoto)
    }}
    title="Photos de la semaine"
  >
    <i className="fas fa-camera" />
  </button>
)}
```

Fill in the exact `dateWithPhoto` lookup using the same week-day data structure identified in Step 1 — find the LAST (most recent) day in the week whose photo-presence check is true, mirroring how the per-day button already picks its own `b.date`.

- [ ] **Step 4: Add `.headerPhotoBtn` styles**

In `styles/bilans.module.css`, add a new rule near `.noteBtn` (around line 206-210):

```css
.headerPhotoBtn {
  display: none;
  background: none;
  border: none;
  color: var(--primary);
  cursor: pointer;
  font-size: 15px;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.15s;
}
.headerPhotoBtn:hover { background: var(--bg4); }
```

Then, inside the EXISTING `@media (max-width: 768px)` block in this same file (currently starting around line 235, containing `.header`, `.headerTop`, `.statsWrap`, `.stats`, etc. — re-verify the exact current line before editing), add:

```css
  .headerPhotoBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
  }
```

`.headerPhotoBtn` defaults to `display: none` (desktop never shows it) and only becomes visible inside the existing mobile media query — desktop is unaffected.

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit -p .` — expect zero new errors from `BilanAccordion.tsx`.
Run: `npm run build` — expect success.

- [ ] **Step 6: Manual verification**

Run `npm run dev`. At a mobile viewport width (~375-430px), open an athlete's bilans page, confirm the camera icon appears in a week's header (collapsed or expanded, doesn't matter — it's in `.header`, not `.body`) whenever that week has at least one day with a photo, and tapping it opens `PhotoCompare`. At ≥1024px, confirm the button never appears and the header looks identical to before this change.

- [ ] **Step 7: Commit**

```bash
git add components/bilans/BilanAccordion.tsx styles/bilans.module.css
git commit -m "feat: add always-visible photo access button to bilan week header on mobile"
```

---

### Task 2: Daily detail — independent collapse + stacked-card mobile view

**Files:**
- Modify: `components/bilans/BilanAccordion.tsx`
- Modify: `styles/bilans.module.css`

**Interfaces:**
- Consumes: existing per-week render scope (the `.map()` over weeks that produces the `.card` for each week) — add one new `useState` per rendered week card. Since `BilanAccordion` already manages per-week open/closed state for the whole card (search for `toggleWeek`/`w.key` used at `BilanAccordion.tsx:574`, `openNotes`/`toggleNote` used for per-day sub-rows at lines 891-897), follow the SAME state-management pattern (a `Set<string>` of open keys, or equivalent) rather than inventing a new one — read how `toggleWeek`/`openNotes` are declared before adding a third parallel mechanism.

- [ ] **Step 1: Read the current state-management pattern for open/closed toggles**

Read `BilanAccordion.tsx` for how `toggleWeek` (controls `.cardOpen` on the whole week card) and `openNotes`/`toggleNote` (controls per-day sub-row expansion, `Set<string>` keyed by `noteId`, used at lines 891-897 and 913-921) are declared and used. Re-verify current line numbers.

- [ ] **Step 2: Add day-detail-open state, keyed per week**

Using the same pattern as `openNotes` (a `Set<string>` of open keys with a toggle function), add a new state for whether the daily-detail table is expanded, keyed by week (e.g. `w.key`, the same key already used by `toggleWeek`):

```tsx
const [dayDetailOpen, setDayDetailOpen] = useState<Set<string>>(new Set())
const toggleDayDetail = useCallback((weekKey: string) => {
  setDayDetailOpen((prev) => {
    const next = new Set(prev)
    if (next.has(weekKey)) next.delete(weekKey); else next.add(weekKey)
    return next
  })
}, [])
```

Place this alongside the other `useState`/`useCallback` declarations near the top of the component function (find where `openNotes`/`toggleNote` are declared and add this next to them).

- [ ] **Step 3: Add a toggle button before the daily detail table**

Read the current JSX right before `{/* Daily detail table */}` (`BilanAccordion.tsx:744-745` per this plan's investigation — re-verify). Add a mobile-only toggle button immediately before the `.daysTable` div:

```tsx
<button
  className={styles.dayDetailToggle}
  onClick={() => toggleDayDetail(w.key)}
>
  <i className={`fas fa-chevron-${dayDetailOpen.has(w.key) ? 'up' : 'down'}`} style={{ marginRight: 6 }} />
  Voir le detail jour par jour
</button>
```

- [ ] **Step 4: Scope the existing `.daysTable` grid to be hidden on mobile unless open, and add the new stacked-card view**

Wrap the EXISTING `.daysTable` div (grid rendering, unchanged internally) in a conditional class that hides it on mobile when `!dayDetailOpen.has(w.key)`:

```tsx
<div className={`${styles.daysTable} ${!dayDetailOpen.has(w.key) ? styles.daysTableCollapsedMobile : ''}`}>
  {/* ...existing grid JSX, completely unchanged... */}
</div>
```

Then, immediately after this existing `.daysTable` div's closing tag, add a NEW parallel stacked-card view that only renders its content when mobile AND `dayDetailOpen.has(w.key)` — but since this plan avoids JS viewport detection for rendering, render it unconditionally in JSX and let CSS decide visibility, exactly like Task 4 of the prior session's `/bilans` table-vs-cards approach. This means BOTH the grid (existing) and the new card view render in the DOM at all times; CSS decides which is visible based on (a) viewport width and (b) the `dayDetailOpen` state (applied as a class, not a media query, since it's JS state not a CSS breakpoint):

```tsx
<div className={`${styles.daysCardsWrap} ${dayDetailOpen.has(w.key) ? styles.daysCardsOpen : ''}`}>
  {sorted.map(b => {
    // Reuse the exact same per-day values already computed in the grid
    // .map() above (dayStr, isBDay, and every b.<field> access) — this is
    // intentional duplication of rendering, not of data computation, same
    // tradeoff already accepted for the /bilans table-vs-cards work.
    return (
      <div key={b.date} className={styles.dayCard}>
        <div className={styles.dayCardHeader}>
          {/* dayStr + isBDay star, same content as .drDate in the grid row */}
        </div>
        <div className={styles.detailGrid}>
          <div className={styles.detailItem}><span className={styles.detailLabel}>Poids</span><span>{/* b.weight or equivalent grid cell content */}</span></div>
          <div className={styles.detailItem}><span className={styles.detailLabel}>Adherence</span><span>{/* same content as the grid's ADHER. column */}</span></div>
          {/* ...one .detailItem per column currently in the grid row (SEANCE, PERF., PLAISIR, CARDIO, COURB., STRESS, ENERGIE, MALAD., SOMM., NUIT)... */}
        </div>
        {/* Reuse the same action buttons block (photo icon, expand-detail chevron, delete) already present per-row in the grid — same onClick handlers, same conditions (hasPhotos, hasDetails, b.id) */}
      </div>
    )
  })}
</div>
```

Fill in each `.detailItem` using the EXACT same value/formatting logic already present in the corresponding grid cell in the (unchanged) `.daysTable` block above — read that block's JSX carefully (columns for POIDS, ADHER., SEANCE, PERF., PLAISIR, CARDIO, COURB., STRESS, ENERGIE, MALAD., SOMM., NUIT, per the column headers at `BilanAccordion.tsx:756-768`) and copy each cell's exact rendering expression, not just its label — do not invent new formatting.

- [ ] **Step 5: Add the CSS**

In `styles/bilans.module.css`, add near `.daysTable`/`.detailGrid`:

```css
.dayDetailToggle {
  display: none;
}

.daysCardsWrap {
  display: none;
}

.dayCard {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 8px;
}

.dayCardHeader {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}
```

Then, inside the EXISTING `@media (max-width: 768px)` block (same one edited in Task 1 Step 4):

```css
  .dayDetailToggle {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 44px;
    padding: 10px 14px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text2);
    font-size: 13px;
    cursor: pointer;
    margin-bottom: 8px;
  }
  .daysTableCollapsedMobile {
    display: none;
  }
  .daysCardsOpen {
    display: block;
  }
```

`.daysCardsWrap` defaults to `display: none` (both desktop AND mobile-but-closed), only becomes visible via the separate `.daysCardsOpen` class (applied via JS state, not a media query) — but `.daysCardsOpen`'s `display: block` rule is ITSELF scoped inside the mobile media query, so even if `dayDetailOpen` somehow had an entry on a desktop-width viewport (it can't, since the toggle button that sets it is `display: none` outside the media query and thus unclickable there), the card view still wouldn't show above 768px. Desktop's `.daysTable` is never touched by `.daysTableCollapsedMobile` since that class's `display: none` rule is also inside the mobile media query only.

- [ ] **Step 6: Type-check and build**

Run: `npx tsc --noEmit -p .` — expect zero new errors from `BilanAccordion.tsx`.
Run: `npm run build` — expect success.

- [ ] **Step 7: Manual verification**

At mobile width: confirm the daily grid is hidden by default under a "Voir le detail jour par jour" button; tapping it reveals a card per day with all the same metrics as the grid, no horizontal scroll needed to read one day; tapping again collapses it. At ≥1024px: confirm the grid renders exactly as before (always visible when `.body` is open, no toggle button visible, no card view visible).

- [ ] **Step 8: Commit**

```bash
git add components/bilans/BilanAccordion.tsx styles/bilans.module.css
git commit -m "feat: make daily bilan detail collapsible with stacked-card mobile view"
```

---

### Task 3: Enlarge tap targets — `.noteBtn`, `PhotoCompare` nav/reset

**Files:**
- Modify: `styles/bilans.module.css`

**Interfaces:** none (CSS-only).

- [ ] **Step 1: Enlarge `.noteBtn` on mobile**

Read the current `.noteBtn` rule (per this plan's investigation, `styles/bilans.module.css:206-210`) and the existing `@media (max-width: 768px)` block (same one edited in Tasks 1-2). Add, inside that media query:

```css
  .noteBtn {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
```

This affects every `.noteBtn` use across the file consistently (mark-treated, column paging, expand-week, expand-day, delete) — intentional, per this task's scope. Do not touch the base (desktop) `.noteBtn` rule — its `padding: 4px 6px; font-size: 11px` stays as-is for desktop density.

- [ ] **Step 2: Enlarge `PhotoCompare`'s nav arrows and reset-zoom link on mobile**

Read the existing `@media (max-width: 768px)` block for `PhotoCompare` styles (per this plan's investigation, a SEPARATE media query block around `styles/bilans.module.css:398-405`, containing `.pcViewer`, `.pcBody`, `.pcCell`, `.pcNav`, `.pcExportBtn` — this is a different block from the one Tasks 1-2 edited, both happen to use the same `max-width: 768px` condition but are physically separate rule sets in the file; do not merge them, just edit this one in place).

Change:
```css
  .pcNav { width: 32px; height: 32px; font-size: 12px; }
```
to:
```css
  .pcNav { width: 44px; height: 44px; font-size: 14px; }
```

(Note this actually makes the mobile nav arrows LARGER than they currently are at this breakpoint, and larger than even the desktop default of 40px — intentional, per the design spec: these are the arrows a coach relies on most heavily to step through photo history on the exact viewport where they were previously shrinking.)

Then add a `.pcResetLink` override in the same block (it currently has no media-query-specific rule):
```css
  .pcResetLink {
    padding: 8px;
    min-height: 44px;
  }
```

- [ ] **Step 3: Build**

Run: `npm run build` — expect success. CSS-only, `tsc` is not meaningfully affected.

- [ ] **Step 4: Manual verification**

At mobile width: open `PhotoCompare`, confirm nav arrows and reset-zoom are comfortably tappable. Open a bilan accordion, confirm mark-treated/expand/delete buttons have visibly larger hit areas without look broken (icons should stay centered). At ≥1024px: confirm all these elements are pixel-identical to before (`.noteBtn` desktop untouched, `.pcNav` desktop default of 40px untouched, `.pcResetLink` has no media-query override outside mobile).

- [ ] **Step 5: Commit**

```bash
git add styles/bilans.module.css
git commit -m "fix: enlarge tap targets in bilan accordion and photo comparison for mobile"
```

---

### Task 4: `MensurationCharts` touch support

**Files:**
- Modify: `components/bilans/MensurationCharts.tsx`

**Interfaces:**
- Consumes/modifies: `MiniChart`'s internal `handleMouseMove`/`handleMouseLeave` (per this plan's investigation, `MensurationCharts.tsx:60-92`) — add parallel touch handlers, do not remove or alter the existing mouse handlers.

- [ ] **Step 1: Read the current `handleMouseMove` implementation in full**

Read `components/bilans/MensurationCharts.tsx`'s `MiniChart` function (per this plan's investigation, lines 33-` through at least 100) to see the exact current logic — `handleMouseMove` reads `e.clientX` from a `React.MouseEvent`, computes the nearest data point, and updates a crosshair/tooltip via direct DOM manipulation (`wrap.querySelector`). Re-verify line numbers before editing.

- [ ] **Step 2: Extract the shared logic into a helper taking a raw `clientX`, and add touch handlers**

Refactor `handleMouseMove` to delegate to a new function taking a plain `number` (the x coordinate), then add a touch handler that extracts `clientX` from the touch event and calls the same helper:

```tsx
const updateFromClientX = useCallback((clientX: number) => {
  const wrap = wrapRef.current
  if (!wrap) return
  const rect = wrap.getBoundingClientRect()
  const crosshair = wrap.querySelector<HTMLDivElement>('[data-crosshair]')
  const tooltip = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
  if (!crosshair || !tooltip) return

  const mouseDataX = ((clientX - rect.left) / rect.width) * VB_W + VB_X
  let nearest = points[0]
  let minDist = Infinity
  for (const pt of points) {
    const ptX = (pt.idx / (points.length - 1)) * 100
    const dist = Math.abs(ptX - mouseDataX)
    if (dist < minDist) { minDist = dist; nearest = pt }
  }
  const snapDataX = (nearest.idx / (points.length - 1)) * 100
  const leftPx = ((snapDataX - VB_X) / VB_W) * rect.width
  crosshair.style.left = leftPx + 'px'
  crosshair.style.display = 'block'
  tooltip.textContent = `${nearest.value} cm — ${nearest.label}`
  tooltip.style.display = 'block'
  tooltip.style.left = Math.min(Math.max(leftPx, 50), rect.width - 50) + 'px'
}, [points])

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  updateFromClientX(e.clientX)
}, [updateFromClientX])

const handleTouchMove = useCallback((e: React.TouchEvent) => {
  if (e.touches.length > 0) updateFromClientX(e.touches[0].clientX)
}, [updateFromClientX])
```

`handleMouseLeave` (per this plan's investigation, lines 85-92) stays exactly as-is; add a `handleTouchEnd` that calls the same hide logic — either extract it to a shared function the same way, or simply call `handleMouseLeave()` directly from a new `handleTouchEnd` since it takes no arguments:

```tsx
const handleTouchEnd = useCallback(() => {
  handleMouseLeave()
}, [handleMouseLeave])
```

- [ ] **Step 3: Wire the new handlers onto the chart wrapper div**

Find the div with `onMouseMove={handleMouseMove}` and `onMouseLeave={handleMouseLeave}` (per this plan's investigation, `MensurationCharts.tsx:98-99`). Add the touch equivalents alongside (do not replace the mouse ones):

```tsx
<div
  ref={wrapRef}
  className={styles.mensChartWrap}
  onMouseMove={handleMouseMove}
  onMouseLeave={handleMouseLeave}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
>
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit -p .` — expect zero new errors from `MensurationCharts.tsx`.
Run: `npm run build` — expect success.

- [ ] **Step 5: Manual verification**

At mobile width, open a bilan's expanded per-day detail with mensuration charts, drag a finger across a chart, confirm the crosshair/tooltip follows the touch point and shows the correct value. Confirm mouse hover still works identically on desktop (unchanged handlers).

- [ ] **Step 6: Commit**

```bash
git add components/bilans/MensurationCharts.tsx
git commit -m "feat: add touch support to mensuration chart tooltip"
```

---

### Task 5: `BilanPhotosUploadModal` responsive pass

**Files:**
- Modify: `components/bilans/BilanPhotosUploadModal.tsx`
- Modify: `styles/bilans.module.css`

**Interfaces:** none new (internal styling change only).

- [ ] **Step 1: Replace the inline `width: 540` with a CSS class**

Read the current `components/bilans/BilanPhotosUploadModal.tsx` around its root popup div (per this plan's investigation, `line 127`: `<div className={s.btPopup} style={{ width: 540 }}>`). Inline styles cannot be overridden by CSS media queries, so this must move to a class. Change:

```tsx
<div className={s.btPopup} style={{ width: 540 }}>
```
to:
```tsx
<div className={`${s.btPopup} ${s.btPopupWide}`}>
```

- [ ] **Step 2: Add the CSS class and mobile padding overrides**

In `styles/bilans.module.css`, find the existing `.btPopup` rule (per this plan's investigation, around line 624-625, `width: 460px; max-width: 92vw`) and `.btPopupBody` (around line 649, `padding: 20px 24px`). Add near them:

```css
.btPopupWide {
  width: 540px;
}
```

Then, inside the existing mobile media query block used by Tasks 1-2 (`@media (max-width: 768px)` around line 235), add:

```css
  .btPopupWide {
    width: 100%;
  }
  .btPopupBody {
    padding: 16px 16px;
  }
```

`.btPopup`'s own `max-width: 92vw` (unchanged, applies regardless of `.btPopupWide`) still caps the modal on narrow viewports even before this change; this task tightens the internal padding so content isn't cramped at that capped width, and makes the 540px desktop-only width collapse to `100%` (bounded by the parent's `92vw`) on mobile instead of a fixed pixel value fighting the viewport.

- [ ] **Step 3: Build**

Run: `npm run build` — expect success. Run `npx tsc --noEmit -p .` and confirm zero new errors from `BilanPhotosUploadModal.tsx`.

- [ ] **Step 4: Manual verification**

At mobile width (~375px), open the coach photo-upload modal, confirm it's comfortably readable (not cramped edge-to-edge), the 3-photo-tile grid still fits without overflow. At ≥1024px, confirm the modal is pixel-identical to before (540px wide, same padding).

- [ ] **Step 5: Commit**

```bash
git add components/bilans/BilanPhotosUploadModal.tsx styles/bilans.module.css
git commit -m "fix: responsive width/padding for bilan photo upload modal on mobile"
```

---

### Task 6: Mobile-default video feedback mode

**Files:**
- Modify: `components/recorder/NouveauRetourPanel.tsx`

**Interfaces:**
- Modifies: the existing `recordMode` state (`useState<'screen' | 'selfie'>('screen')`, per this plan's investigation at `NouveauRetourPanel.tsx:53`) and the "Écran + cam" mode-selector button (per this plan's investigation, `NouveauRetourPanel.tsx:450-466`).

- [ ] **Step 1: Read the current `recordMode` state and the mode-selector buttons in full**

Read `components/recorder/NouveauRetourPanel.tsx` around lines 40-60 (state declarations) and lines 447-484 (the two mode-selector buttons, "Écran + cam" and "Selfie portrait"). Re-verify current line numbers before editing.

- [ ] **Step 2: Add a post-mount mobile detection that defaults `recordMode` to `'selfie'`**

Immediately after the `recordMode` state declaration, add:

```tsx
// Mobile browsers can't do getDisplayMedia (screen-share) — default to
// selfie mode there so tapping "Démarrer" doesn't hit a guaranteed
// failure. Desktop's matchMedia check is false, so this never fires
// there and recordMode stays 'screen' exactly as before — same
// post-hydration pattern as Sidebar.tsx's `collapsed` localStorage read
// (initial state is the desktop-safe value; a client-only effect may
// correct it after mount, so SSR and first client render always agree).
useEffect(() => {
  if (window.matchMedia('(max-width: 768px)').matches) {
    setRecordMode('selfie')
  }
}, [])
```

Place this near the top of the component, after `recordMode`'s `useState` declaration.

- [ ] **Step 3: Disable the "Écran + cam" button on mobile with an explanatory note**

Read the current "Écran + cam" button JSX (per this plan's investigation, lines 450-466). Add a mobile-detection boolean state (reusing the same `matchMedia` check, this time stored so the JSX can read it) rather than recomputing inline:

```tsx
const [isMobileViewport, setIsMobileViewport] = useState(false)
useEffect(() => {
  setIsMobileViewport(window.matchMedia('(max-width: 768px)').matches)
}, [])
```

(This can share the same `useEffect` as Step 2, or be separate — if combined, set both `recordMode` and `isMobileViewport` inside one effect body to avoid a redundant `matchMedia` call.)

Modify the "Écran + cam" button to be disabled and visually muted when `isMobileViewport` is true:

```tsx
<button
  type="button"
  onClick={() => { if (!isMobileViewport) setRecordMode('screen') }}
  disabled={isMobileViewport}
  title={isMobileViewport ? 'Disponible sur ordinateur uniquement' : undefined}
  style={{
    padding: '10px 12px',
    borderRadius: 10,
    border: recordMode === 'screen' ? '2px solid var(--primary, #5b8dff)' : '1px solid var(--border, #2a2a2a)',
    background: recordMode === 'screen' ? 'rgba(91,141,255,0.1)' : 'transparent',
    color: isMobileViewport ? 'var(--text3, #666)' : (recordMode === 'screen' ? 'var(--primary, #5b8dff)' : 'var(--text2)'),
    cursor: isMobileViewport ? 'not-allowed' : 'pointer',
    opacity: isMobileViewport ? 0.5 : 1,
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'center',
  }}
>
  <i className="fas fa-desktop" style={{ marginRight: 6 }} />Écran + cam
</button>
```

Below the two-button grid (after both mode buttons), add a conditional note:

```tsx
{isMobileViewport && (
  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
    <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
    Le partage d&apos;ecran n&apos;est disponible que sur ordinateur.
  </div>
)}
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit -p .` — expect zero new errors from `NouveauRetourPanel.tsx`.
Run: `npm run build` — expect success.

- [ ] **Step 5: Manual verification**

At mobile width, open "Nouveau retour", switch to the video tab, confirm "Selfie portrait" is pre-selected (highlighted) and "Écran + cam" is visibly disabled/greyed with the explanatory note shown, and cannot be selected by tapping. At ≥1024px, confirm "Écran + cam" is selected by default exactly as before, both buttons are fully clickable, and no note is shown.

- [ ] **Step 6: Commit**

```bash
git add components/recorder/NouveauRetourPanel.tsx
git commit -m "feat: default to selfie video mode on mobile, disable screen-share mode there"
```

---

## Self-Review Notes

- **Spec coverage**: header Photos button (Task 1) ✓, day-detail collapse + stacked cards (Task 2) ✓, tap-target enlargement across `.noteBtn`/`PhotoCompare` (Task 3) ✓, `MensurationCharts` touch support (Task 4) ✓, upload modal responsive pass (Task 5) ✓, video-feedback mobile default + disabled screen-share (Task 6) ✓. All 6 items from the design doc's Architecture section are covered.
- **No placeholders**: code blocks are complete except where the plan explicitly instructs the implementer to copy exact existing logic from a neighboring block (Task 1 Step 3's `dateWithPhoto` lookup, Task 2 Step 4's per-column `.detailItem` values) — these are verification/transcription gates tied to real, locatable code the implementer must read first, not vague TODOs. Each names exactly what to find and copy.
- **Type consistency**: `dayDetailOpen`/`toggleDayDetail` (Task 2) follows the exact same `Set<string>` pattern as the pre-existing `openNotes`/`toggleNote`, so no new state-shape invented. `recordMode`/`isMobileViewport` (Task 6) are consumed only within `NouveauRetourPanel.tsx`, no cross-file type surface introduced.
- **Desktop-safety audit**: every CSS rule added or changed in Tasks 1, 2, 3, 5 is scoped inside an existing `@media (max-width: 768px)` block, with defaults (`display: none` or unchanged base rules) preserving current desktop rendering. Task 4 is purely additive (new touch handlers alongside unchanged mouse handlers) with zero desktop risk. Task 6's one `matchMedia`-driven state change is a state *default value*, not a layout/rendering toggle, and is proven to no-op on desktop widths by the same reasoning already validated for `Sidebar.tsx`'s `collapsed` state in the prior session.
