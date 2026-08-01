# Refonte module Complément (drag & drop) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'onglet Complément de `/athletes/[id]/supplements` par une vue drag-and-drop : timeline de la diète (zones de drop) + librairie de carrés.

**Architecture:** Un module de logique pure (`lib/complement.ts`) pour le mapping moments↔zones ; trois composants (`ComplementBoard` = DndContext + zones, `ComplementLibrary` = carrés draggables, `ComplementChip` = puce déposée) ; la page existante garde ses onglets, son volet supplémentation et son import de templates, seul le rendu du volet complément change.

**Tech Stack:** Next.js 16 App Router, @dnd-kit/core (déjà en dépendance), Supabase client, CSS Modules.

## Global Constraints

- Spec source : `docs/superpowers/specs/2026-07-22-refonte-complement-dnd-design.md`.
- **Aucun changement de schéma DB.** Format `moment_prise` inchangé : `R{n}_avant|pendant|apres`, `a_jeun`, `coucher`, `pre_training|intra_training|post_training`.
- **Aucun changement app ATHLETE.** Onglet Supplémentation : intouché.
- Toute mutation Supabase lit `error` → `toast(\`Erreur: ${error.message}\`, 'error')` + `console.error('[complement]', error)` (lessons.md).
- Tous les hooks AVANT tout early-return (lessons.md — Rules of Hooks, 4 incidents).
- Deps de hooks : primitives uniquement (`athleteId`, pas d'objets).
- **Repo sans infra de test** : la vérification est `npx tsc --noEmit` (0 nouvelle erreur sur les fichiers touchés) par task + `npm run build` + checklist manuelle en Task 6. (Déviation TDD assumée : convention du repo.)
- Branche de travail : `feature/bilans-complement-2026-07`.

---

### Task 1: lib/complement.ts — logique pure zones/moments

**Files:**
- Create: `lib/complement.ts`

**Interfaces:**
- Consumes: rien (module feuille).
- Produces (utilisés par Tasks 2-5) :
  - `interface DietMeal { num: number; label: string; time?: string }`
  - `interface ComplementAssignment { id: string; supplement_id: string; dosage: string | null; unite: string | null; frequence: string | null; notes: string | null; moment_prise: string | null; actif: boolean; supplements: { id: string; nom: string; marque: string | null; type: string; lien_achat: string | null } | null }`
  - `type ZoneId = string` (format `meal-{num}-{timing}` ou `fixed-{zone}`)
  - `extractDietMeals(mealsData: unknown): DietMeal[]`
  - `zoneToMoment(zoneId: ZoneId): string | null`
  - `momentToZone(moment: string | null, mealCount: number): ZoneId | null` (null = legacy/« À replacer »)
  - `buildZoneList(meals: DietMeal[]): { id: ZoneId; label: string; icon: string; group: string }[]`
  - `formatMoment(val: string): string` (réutilise la logique `formatMomentPrise` de la page)

- [ ] **Step 1: Créer le fichier avec l'implémentation complète**

```ts
// lib/complement.ts
// Logique pure du board Complément : mapping zones de drop <-> moment_prise.
// Le format moment_prise est partagé avec l'app ATHLETE — NE PAS le modifier.

export interface DietMeal { num: number; label: string; time?: string }

export interface ComplementAssignment {
  id: string
  supplement_id: string
  dosage: string | null
  unite: string | null
  frequence: string | null
  notes: string | null
  moment_prise: string | null
  actif: boolean
  supplements: { id: string; nom: string; marque: string | null; type: string; lien_achat: string | null } | null
}

export type ZoneId = string

const FIXED_ZONES = ['a_jeun', 'pre_training', 'intra_training', 'post_training', 'coucher'] as const
const MEAL_TIMINGS = ['avant', 'pendant', 'apres'] as const

/** meals_data (JSONB du plan training actif) -> repas avec label + heure. */
export function extractDietMeals(mealsData: unknown): DietMeal[] {
  let raw = mealsData
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(raw)) return []
  return raw.map((m: unknown, i: number) => {
    const meal = (m || {}) as { label?: string; time?: string }
    return { num: i + 1, label: meal.label || `Repas ${i + 1}`, time: meal.time || undefined }
  })
}

/** 'meal-2-avant' -> 'R2_avant' ; 'fixed-a_jeun' -> 'a_jeun'. null si zone inconnue. */
export function zoneToMoment(zoneId: ZoneId): string | null {
  const fixed = zoneId.match(/^fixed-(.+)$/)
  if (fixed && (FIXED_ZONES as readonly string[]).includes(fixed[1])) return fixed[1]
  const meal = zoneId.match(/^meal-(\d+)-(avant|pendant|apres)$/)
  if (meal) return `R${meal[1]}_${meal[2]}`
  return null
}

/** 'R2_avant' -> 'meal-2-avant' ; 'a_jeun' -> 'fixed-a_jeun'. null => legacy/« À replacer ». */
export function momentToZone(moment: string | null, mealCount: number): ZoneId | null {
  if (!moment) return null
  if ((FIXED_ZONES as readonly string[]).includes(moment)) return `fixed-${moment}`
  const m = moment.match(/^R(\d+)_(avant|pendant|apres)$/)
  if (m && parseInt(m[1]) <= mealCount) return `meal-${m[1]}-${m[2]}`
  return null
}

export interface ZoneDef { id: ZoneId; label: string; icon: string; group: string }

/** Liste ordonnée des zones de drop : À jeun -> repas (x3 bandes) -> Training (x3) -> Coucher. */
export function buildZoneList(meals: DietMeal[]): ZoneDef[] {
  const zones: ZoneDef[] = [
    { id: 'fixed-a_jeun', label: 'À jeun', icon: 'fas fa-sun', group: 'À jeun' },
  ]
  for (const meal of meals) {
    const title = meal.time ? `${meal.label} — ${meal.time}` : meal.label
    for (const t of MEAL_TIMINGS) {
      const tLabel = t === 'avant' ? 'Avant' : t === 'pendant' ? 'Pendant' : 'Après'
      zones.push({ id: `meal-${meal.num}-${t}`, label: tLabel, icon: 'fas fa-utensils', group: title })
    }
  }
  zones.push({ id: 'fixed-pre_training', label: 'Pré', icon: 'fas fa-dumbbell', group: 'Training' })
  zones.push({ id: 'fixed-intra_training', label: 'Intra', icon: 'fas fa-dumbbell', group: 'Training' })
  zones.push({ id: 'fixed-post_training', label: 'Post', icon: 'fas fa-dumbbell', group: 'Training' })
  zones.push({ id: 'fixed-coucher', label: 'Coucher', icon: 'fas fa-moon', group: 'Coucher' })
  return zones
}

/** Affichage lisible d'un moment (repris de la page supplements). */
export function formatMoment(val: string): string {
  if (!val) return ''
  if (val === 'a_jeun') return 'À jeun'
  if (val === 'coucher') return 'Coucher'
  if (val === 'pre_training') return 'Pré-training'
  if (val === 'intra_training') return 'Intra-training'
  if (val === 'post_training') return 'Post-training'
  const m = val.match(/^R(\d+)_(avant|pendant|apres)$/)
  if (m) {
    const t: Record<string, string> = { avant: 'Avant', pendant: 'Pendant', apres: 'Après' }
    return `${t[m[2]]} Repas ${m[1]}`
  }
  return val
}
```

- [ ] **Step 2: Vérifier le typage**

Run: `npx tsc --noEmit 2>&1 | grep "lib/complement"`
Expected: aucune sortie.

- [ ] **Step 3: Commit**

```bash
git add lib/complement.ts
git commit -m "feat(complement): logique pure zones/moments du board DnD"
```

---

### Task 2: ComplementLibrary — carrés draggables + catalogue

**Files:**
- Create: `components/supplements/ComplementLibrary.tsx`
- Create: `components/supplements/complement.module.css`

**Interfaces:**
- Consumes: `ComplementAssignment` de `lib/complement.ts`.
- Produces :
  - `interface CatalogItem { supplementId: string; nom: string; marque: string | null; lien_achat: string | null }`
  - `interface LibraryDragData { kind: 'library'; supplementId: string; nom: string; dosage: string; unite: string }` — **contrat lu par le onDragEnd du Board (Task 4)**.
  - Composant `<ComplementLibrary coachId assignments onCatalogChanged />` :
    `{ coachId: string; assignments: ComplementAssignment[]; onCatalogChanged?: () => void }`
- Le composant fetch lui-même le catalogue : `supabase.from('supplements').select('id, nom, marque, lien_achat, created_at').eq('coach_id', coachId).eq('type', 'complement').order('created_at', { ascending: false }).limit(300)`, dédupliqué par `nom.toLowerCase().trim()` (garde la ligne la plus récente).
- Dosage/unité du carré : état local par carte, pré-rempli avec le dernier `dosage`/`unite` d'une assignation du même `supplement.nom` (recherche dans `assignments`), sinon `'' / 'mg'`.

- [ ] **Step 1: Créer le CSS module**

```css
/* components/supplements/complement.module.css */
.board { display: grid; grid-template-columns: 1fr 280px; gap: 20px; align-items: start; }
@media (max-width: 900px) { .board { grid-template-columns: 1fr; } }

.library { position: sticky; top: 16px; background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
.libraryTitle { font-size: 13px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
.libraryGrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; max-height: 60vh; overflow-y: auto; }
.card { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 8px; cursor: grab; position: relative; }
.card:active { cursor: grabbing; }
.cardName { font-size: 12px; font-weight: 600; margin-bottom: 6px; padding-right: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cardBrand { font-size: 10px; color: var(--text3); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cardDosageRow { display: flex; gap: 4px; }
.cardDosageInput { width: 100%; min-width: 0; font-size: 11px; padding: 3px 5px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg2); color: var(--text); }
.cardUnitSelect { font-size: 11px; padding: 3px 2px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg2); color: var(--text); }
.cardInfoBtn { position: absolute; top: 6px; right: 6px; font-size: 11px; color: var(--text3); background: none; border: none; cursor: pointer; padding: 2px; }
.cardInfoBtn:hover { color: var(--text); }
.cardNew { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 68px; border-style: dashed; color: var(--text3); cursor: pointer; font-size: 12px; }

.timeline { display: flex; flex-direction: column; gap: 10px; }
.zoneGroup { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; }
.zoneGroupTitle { font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.zoneBand { display: flex; align-items: center; gap: 8px; min-height: 38px; border: 1px dashed transparent; border-radius: 8px; padding: 4px 8px; margin-bottom: 4px; }
.zoneBandLabel { font-size: 11px; font-weight: 600; color: var(--text3); width: 56px; flex-shrink: 0; }
.zoneBandOver { border-color: var(--primary); background: rgba(179, 8, 8, 0.06); }
.zoneChips { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }

.chip { display: inline-flex; align-items: center; gap: 6px; background: var(--bg); border: 1px solid var(--border); border-radius: 16px; padding: 4px 8px 4px 10px; font-size: 12px; cursor: grab; }
.chip:active { cursor: grabbing; }
.chipDose { color: var(--text3); font-size: 11px; }
.chipX { background: none; border: none; color: var(--text3); cursor: pointer; font-size: 11px; padding: 0 2px; }
.chipX:hover { color: var(--primary); }

.legacySection { border-style: dashed; }
.dragOverlayCard { background: var(--bg); border: 1px solid var(--primary); border-radius: 10px; padding: 6px 12px; font-size: 12px; font-weight: 600; box-shadow: 0 6px 18px rgba(0,0,0,0.35); }
```

- [ ] **Step 2: Créer ComplementLibrary.tsx**

```tsx
'use client'

// Librairie de compléments : catalogue global du coach (table supplements,
// type 'complement', dédupliqué par nom). Chaque carré est draggable vers le
// board ; le dosage/unité inline sont embarqués dans le drag data.
import { useCallback, useEffect, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { ComplementAssignment } from '@/lib/complement'
import styles from './complement.module.css'

export interface CatalogItem {
  supplementId: string
  nom: string
  marque: string | null
  lien_achat: string | null
}

export interface LibraryDragData {
  kind: 'library'
  supplementId: string
  nom: string
  dosage: string
  unite: string
}

const UNITS = ['mg', 'g', 'ml', 'caps', 'gelules', 'cuillere', 'UI']

function LibraryCard({ item, defaults, onInfo }: {
  item: CatalogItem
  defaults: { dosage: string; unite: string }
  onInfo: (item: CatalogItem) => void
}) {
  const [dosage, setDosage] = useState(defaults.dosage)
  const [unite, setUnite] = useState(defaults.unite)
  const data: LibraryDragData = { kind: 'library', supplementId: item.supplementId, nom: item.nom, dosage, unite }
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `lib-${item.supplementId}`, data })

  return (
    <div ref={setNodeRef} className={styles.card} onDoubleClick={() => onInfo(item)} {...listeners} {...attributes}>
      <div className={styles.cardName}>{item.nom}</div>
      <div className={styles.cardDosageRow}>
        <input
          className={styles.cardDosageInput}
          value={dosage}
          placeholder="Dose"
          onChange={(e) => setDosage(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <select
          className={styles.cardUnitSelect}
          value={unite}
          onChange={(e) => setUnite(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      {item.marque && <div className={styles.cardBrand}>{item.marque}</div>}
      <button
        type="button"
        className={styles.cardInfoBtn}
        title="Détails"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onInfo(item)}
      >
        <i className="fas fa-circle-info" />
      </button>
    </div>
  )
}

export default function ComplementLibrary({ coachId, assignments, onCatalogChanged }: {
  coachId: string
  assignments: ComplementAssignment[]
  onCatalogChanged?: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [showNew, setShowNew] = useState(false)
  const [info, setInfo] = useState<CatalogItem | null>(null)
  const [newNom, setNewNom] = useState('')
  const [newMarque, setNewMarque] = useState('')
  const [newLien, setNewLien] = useState('')
  const [saving, setSaving] = useState(false)

  const loadCatalog = useCallback(async () => {
    const { data, error } = await supabase
      .from('supplements')
      .select('id, nom, marque, lien_achat, created_at')
      .eq('coach_id', coachId)
      .eq('type', 'complement')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) { console.error('[complement] catalog error:', error); return }
    const seen = new Set<string>()
    const items: CatalogItem[] = []
    for (const s of (data || []) as { id: string; nom: string; marque: string | null; lien_achat: string | null }[]) {
      const key = (s.nom || '').toLowerCase().trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      items.push({ supplementId: s.id, nom: s.nom, marque: s.marque, lien_achat: s.lien_achat })
    }
    items.sort((a, b) => a.nom.localeCompare(b.nom))
    setCatalog(items)
  }, [coachId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadCatalog() }, [loadCatalog])

  // Dernier dosage utilisé pour un nom de complément (pré-remplissage du carré)
  function defaultsFor(nom: string): { dosage: string; unite: string } {
    const match = assignments.find((a) => (a.supplements?.nom || '').toLowerCase().trim() === nom.toLowerCase().trim())
    return { dosage: match?.dosage || '', unite: match?.unite || 'mg' }
  }

  async function createComplement() {
    if (!newNom.trim()) { toast('Nom obligatoire', 'error'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('supplements').insert({
        coach_id: coachId, type: 'complement',
        nom: newNom.trim(), marque: newMarque.trim() || null, lien_achat: newLien.trim() || null,
      })
      if (error) { console.error('[complement] create error:', error); toast(`Erreur: ${error.message}`, 'error'); return }
      toast('Complément ajouté au catalogue', 'success')
      setShowNew(false); setNewNom(''); setNewMarque(''); setNewLien('')
      loadCatalog(); onCatalogChanged?.()
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.library}>
      <div className={styles.libraryTitle}><i className="fas fa-pills" /> Librairie</div>
      <div className={styles.libraryGrid}>
        {catalog.map((item) => (
          <LibraryCard key={item.supplementId} item={item} defaults={defaultsFor(item.nom)} onInfo={setInfo} />
        ))}
        <div className={`${styles.card} ${styles.cardNew}`} onClick={() => setShowNew(true)}>
          <i className="fas fa-plus" /> Nouveau
        </div>
      </div>

      {showNew && (
        <Modal title="Nouveau complément" onClose={() => setShowNew(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="form-control" placeholder="Nom *" value={newNom} onChange={(e) => setNewNom(e.target.value)} />
            <input className="form-control" placeholder="Marque" value={newMarque} onChange={(e) => setNewMarque(e.target.value)} />
            <input className="form-control" placeholder="Lien d'achat" value={newLien} onChange={(e) => setNewLien(e.target.value)} />
            <button className="btn btn-red" disabled={saving} onClick={createComplement}>
              {saving ? 'Ajout…' : 'Ajouter au catalogue'}
            </button>
          </div>
        </Modal>
      )}

      {info && (
        <Modal title={info.nom} onClose={() => setInfo(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div><strong>Marque :</strong> {info.marque || '—'}</div>
            <div>
              <strong>Lien d'achat :</strong>{' '}
              {info.lien_achat
                ? <a href={info.lien_achat} target="_blank" rel="noopener noreferrer">{info.lien_achat}</a>
                : '—'}
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 12 }}>
              Glisse le carré sur un moment de la journée pour l'assigner.
              Dosage et unité se règlent directement sur le carré.
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Vérifier le typage**

Run: `npx tsc --noEmit 2>&1 | grep -E "ComplementLibrary|complement.module"`
Expected: aucune sortie. (Vérifier la signature réelle de `components/ui/Modal` avant : si les props sont `{ title, children, onClose }` différents, adapter l'appel.)

- [ ] **Step 4: Commit**

```bash
git add components/supplements/ComplementLibrary.tsx components/supplements/complement.module.css
git commit -m "feat(complement): librairie de carrés draggables (catalogue coach)"
```

---

### Task 3: ComplementChip — puce déposée (édition, retrait)

**Files:**
- Create: `components/supplements/ComplementChip.tsx`

**Interfaces:**
- Consumes: `ComplementAssignment` (Task 1), styles de `complement.module.css` (Task 2).
- Produces :
  - `interface ChipDragData { kind: 'chip'; assignmentId: string; nom: string; momentPrise: string | null }` — **contrat lu par onDragEnd du Board (Task 4)**.
  - `<ComplementChip assignment onEdit onRemove />` : `{ assignment: ComplementAssignment; onEdit: (a: ComplementAssignment) => void; onRemove: (a: ComplementAssignment) => void }`

- [ ] **Step 1: Créer ComplementChip.tsx**

```tsx
'use client'

// Puce d'un complément assigné, affichée dans une zone du board.
// Draggable (déplacement de zone), clic = édition, X = retrait (actif=false).
import { useDraggable } from '@dnd-kit/core'
import type { ComplementAssignment } from '@/lib/complement'
import styles from './complement.module.css'

export interface ChipDragData {
  kind: 'chip'
  assignmentId: string
  nom: string
  momentPrise: string | null
}

export default function ComplementChip({ assignment, onEdit, onRemove }: {
  assignment: ComplementAssignment
  onEdit: (a: ComplementAssignment) => void
  onRemove: (a: ComplementAssignment) => void
}) {
  const nom = assignment.supplements?.nom || 'Complément'
  const data: ChipDragData = {
    kind: 'chip',
    assignmentId: assignment.id,
    nom,
    momentPrise: assignment.moment_prise,
  }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `chip-${assignment.id}`, data })

  return (
    <span
      ref={setNodeRef}
      className={styles.chip}
      style={isDragging ? { opacity: 0.4 } : undefined}
      {...listeners}
      {...attributes}
    >
      <span onPointerDown={(e) => e.stopPropagation()} onClick={() => onEdit(assignment)} style={{ cursor: 'pointer' }}>
        {nom}
        {assignment.dosage && <span className={styles.chipDose}> {assignment.dosage}{assignment.unite || ''}</span>}
      </span>
      <button
        type="button"
        className={styles.chipX}
        title="Retirer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(assignment)}
      >
        <i className="fas fa-xmark" />
      </button>
    </span>
  )
}
```

- [ ] **Step 2: Vérifier le typage**

Run: `npx tsc --noEmit 2>&1 | grep ComplementChip`
Expected: aucune sortie.

- [ ] **Step 3: Commit**

```bash
git add components/supplements/ComplementChip.tsx
git commit -m "feat(complement): puce assignation draggable (édition/retrait)"
```

---

### Task 4: ComplementBoard — DndContext, zones, mutations

**Files:**
- Create: `components/supplements/ComplementBoard.tsx`

**Interfaces:**
- Consumes: `extractDietMeals` non (reçoit `dietMeals` en prop), `buildZoneList`, `zoneToMoment`, `momentToZone`, `formatMoment`, `ComplementAssignment`, `DietMeal` (Task 1) ; `ComplementLibrary` + `LibraryDragData` (Task 2) ; `ComplementChip` + `ChipDragData` (Task 3).
- Produces : `<ComplementBoard athleteId coachId assignments dietMeals onChanged onImportClick />` :
  `{ athleteId: string; coachId: string; assignments: ComplementAssignment[]; dietMeals: DietMeal[]; onChanged: () => void; onImportClick: () => void }`
  — **consommé par la page (Task 5)**. `assignments` = uniquement type `complement` et `actif`.

- [ ] **Step 1: Créer ComplementBoard.tsx**

```tsx
'use client'

// Board Complément : timeline de la diète (zones de drop) + librairie.
// Drop librairie -> INSERT athlete_supplements ; drop puce -> UPDATE moment_prise.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import {
  buildZoneList, zoneToMoment, momentToZone,
  type ComplementAssignment, type DietMeal, type ZoneId,
} from '@/lib/complement'
import ComplementLibrary, { type LibraryDragData } from './ComplementLibrary'
import ComplementChip, { type ChipDragData } from './ComplementChip'
import styles from './complement.module.css'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function DropBand({ zoneId, label, children }: { zoneId: ZoneId; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId, data: { zoneId } })
  return (
    <div ref={setNodeRef} className={`${styles.zoneBand} ${isOver ? styles.zoneBandOver : ''}`}>
      <span className={styles.zoneBandLabel}>{label}</span>
      <span className={styles.zoneChips}>{children}</span>
    </div>
  )
}

export default function ComplementBoard({ athleteId, coachId, assignments, dietMeals, onChanged, onImportClick }: {
  athleteId: string
  coachId: string
  assignments: ComplementAssignment[]
  dietMeals: DietMeal[]
  onChanged: () => void
  onImportClick: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const [editing, setEditing] = useState<ComplementAssignment | null>(null)
  const [editDosage, setEditDosage] = useState('')
  const [editUnite, setEditUnite] = useState('mg')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const zones = useMemo(() => buildZoneList(dietMeals), [dietMeals])
  const mealCount = dietMeals.length

  // zoneId -> assignations ; legacy = moment non parsable -> « À replacer »
  const { byZone, legacy } = useMemo(() => {
    const map = new Map<ZoneId, ComplementAssignment[]>()
    const leg: ComplementAssignment[] = []
    for (const a of assignments) {
      const z = momentToZone(a.moment_prise, mealCount)
      if (z) { if (!map.has(z)) map.set(z, []); map.get(z)!.push(a) }
      else leg.push(a)
    }
    return { byZone: map, legacy: leg }
  }, [assignments, mealCount])

  // Groupes ordonnés pour le rendu (un bloc par group, ses bandes dedans)
  const groups = useMemo(() => {
    const out: { title: string; icon: string; zones: typeof zones }[] = []
    for (const z of zones) {
      const last = out[out.length - 1]
      if (last && last.title === z.group) last.zones.push(z)
      else out.push({ title: z.group, icon: z.icon, zones: [z] })
    }
    return out
  }, [zones])

  function handleDragStart(e: DragStartEvent) {
    const d = e.active.data.current as LibraryDragData | ChipDragData | undefined
    setDragLabel(d?.nom || null)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDragLabel(null)
    const over = e.over
    const d = e.active.data.current as LibraryDragData | ChipDragData | undefined
    if (!over || !d) return
    const moment = zoneToMoment(String(over.id))
    if (!moment) return

    if (d.kind === 'library') {
      const { error } = await supabase.from('athlete_supplements').insert({
        athlete_id: athleteId,
        supplement_id: d.supplementId,
        dosage: d.dosage.trim() || '',
        unite: d.unite,
        frequence: '1x/jour',
        intervalle_jours: 1,
        moment_prise: moment,
        actif: true,
        start_date: todayIso(),
      })
      if (error) { console.error('[complement] insert error:', error); toast(`Erreur: ${error.message}`, 'error'); return }
      onChanged()
    } else {
      if (d.momentPrise === moment) return
      const { error } = await supabase.from('athlete_supplements').update({ moment_prise: moment }).eq('id', d.assignmentId)
      if (error) { console.error('[complement] move error:', error); toast(`Erreur: ${error.message}`, 'error'); return }
      onChanged()
    }
  }

  function openEdit(a: ComplementAssignment) {
    setEditing(a)
    setEditDosage(a.dosage || '')
    setEditUnite(a.unite || 'mg')
    setEditNotes(a.notes || '')
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const { error } = await supabase.from('athlete_supplements')
        .update({ dosage: editDosage.trim(), unite: editUnite, notes: editNotes.trim() || null })
        .eq('id', editing.id)
      if (error) { console.error('[complement] edit error:', error); toast(`Erreur: ${error.message}`, 'error'); return }
      setEditing(null)
      onChanged()
    } finally { setSaving(false) }
  }

  async function removeAssignment(a: ComplementAssignment) {
    const { error } = await supabase.from('athlete_supplements')
      .update({ actif: false, end_date: todayIso() })
      .eq('id', a.id)
    if (error) { console.error('[complement] remove error:', error); toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Complément retiré', 'success')
    onChanged()
  }

  if (dietMeals.length === 0) {
    return (
      <EmptyState
        icon="fas fa-utensils"
        message="Mets d'abord une diète en place pour construire le protocole de compléments"
      >
        <Link href={`/athletes/${athleteId}/nutrition`} className="btn btn-red btn-sm">
          Aller à la nutrition
        </Link>
      </EmptyState>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.board}>
        <div className={styles.timeline}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-outline btn-sm" onClick={onImportClick}>
              <i className="fas fa-file-import" style={{ marginRight: 6 }} /> Depuis un template
            </button>
          </div>
          {groups.map((g) => (
            <div key={g.title} className={styles.zoneGroup}>
              <div className={styles.zoneGroupTitle}><i className={g.icon} /> {g.title}</div>
              {g.zones.map((z) => (
                <DropBand key={z.id} zoneId={z.id} label={g.zones.length > 1 ? z.label : ''}>
                  {(byZone.get(z.id) || []).map((a) => (
                    <ComplementChip key={a.id} assignment={a} onEdit={openEdit} onRemove={removeAssignment} />
                  ))}
                </DropBand>
              ))}
            </div>
          ))}
          {legacy.length > 0 && (
            <div className={`${styles.zoneGroup} ${styles.legacySection}`}>
              <div className={styles.zoneGroupTitle}><i className="fas fa-clock" /> À replacer</div>
              <div className={styles.zoneChips}>
                {legacy.map((a) => (
                  <ComplementChip key={a.id} assignment={a} onEdit={openEdit} onRemove={removeAssignment} />
                ))}
              </div>
            </div>
          )}
        </div>

        <ComplementLibrary coachId={coachId} assignments={assignments} onCatalogChanged={onChanged} />
      </div>

      <DragOverlay>{dragLabel ? <div className={styles.dragOverlayCard}>{dragLabel}</div> : null}</DragOverlay>

      {editing && (
        <Modal title={editing.supplements?.nom || 'Complément'} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-control" style={{ flex: 1 }} placeholder="Dosage" value={editDosage} onChange={(e) => setEditDosage(e.target.value)} />
              <select className="form-control" style={{ width: 90 }} value={editUnite} onChange={(e) => setEditUnite(e.target.value)}>
                {['mg', 'g', 'ml', 'caps', 'gelules', 'cuillere', 'UI'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <textarea className="form-control" placeholder="Notes" rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            <button className="btn btn-red" disabled={saving} onClick={saveEdit}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
          </div>
        </Modal>
      )}
    </DndContext>
  )
}
```

- [ ] **Step 2: Vérifier le typage**

Run: `npx tsc --noEmit 2>&1 | grep ComplementBoard`
Expected: aucune sortie. (Vérifier les signatures réelles de `Modal` et `EmptyState` — si `EmptyState` n'accepte pas de children, mettre le bouton sous le composant.)

- [ ] **Step 3: Commit**

```bash
git add components/supplements/ComplementBoard.tsx
git commit -m "feat(complement): board DnD — zones diète, drop/insert, déplacement, retrait"
```

---

### Task 5: Intégration dans la page supplements

**Files:**
- Modify: `app/(app)/athletes/[id]/supplements/page.tsx`

**Interfaces:**
- Consumes: `<ComplementBoard>` (Task 4), `extractDietMeals` + `DietMeal` (Task 1).
- Produces: rien (feuille).

- [ ] **Step 1: Étendre loadData pour garder les repas (pas juste le count)**

Dans `SupplementsPage`, ajouter l'état :

```tsx
const [dietMeals, setDietMeals] = useState<DietMeal[]>([])
```

Dans `loadData`, remplacer le bloc « Step 2 » (lignes ~348-366) par :

```tsx
let detectedMeals: DietMeal[] = []
if (nutritionPlanList && nutritionPlanList.length > 0) {
  const trainingPlan = (nutritionPlanList as any[]).find((p) => p.meal_type === 'training' || p.meal_type === 'entrainement') || nutritionPlanList[0]
  const { data: planMeals, error: planErr } = await supabase
    .from('nutrition_plans')
    .select('meals_data')
    .eq('id', (trainingPlan as any).id)
    .single()
  if (planErr) {
    console.warn('[supplements] nutrition_plans.single error:', planErr.message)
  } else {
    detectedMeals = extractDietMeals((planMeals as any)?.meals_data)
  }
}
setDietMeals(detectedMeals)
setMealCount(detectedMeals.length || 5)
```

Imports à ajouter en tête de fichier :

```tsx
import ComplementBoard from '@/components/supplements/ComplementBoard'
import { extractDietMeals, type DietMeal, type ComplementAssignment } from '@/lib/complement'
```

- [ ] **Step 2: Remplacer le rendu du volet complément**

Localiser le JSX rendu quand `tab === 'complement'` (liste groupée + bouton « Ajouter » actuel) et le remplacer par :

```tsx
{tab === 'complement' && (
  <ComplementBoard
    athleteId={params.id}
    coachId={user!.id}
    assignments={(assignments as ComplementAssignment[]).filter((a) => a.supplements?.type === 'complement' && a.actif !== false)}
    dietMeals={dietMeals}
    onChanged={loadData}
    onImportClick={openImportModal}
  />
)}
```

Règles :
- Le volet `tab === 'supplementation'` reste STRICTEMENT identique (liste actuelle, modal d'ajout, MomentPicker, historique, toggle unlock).
- Le modal d'ajout (`showAddModal`) n'est plus déclenchable depuis le volet complément (le bouton « Ajouter » du volet complément est supprimé) mais reste utilisé par le volet supplémentation.
- Le modal d'import de template (`showImportModal`) est conservé tel quel — le board l'ouvre via `onImportClick`.
- Si du code du volet complément supprimé n'est plus référencé nulle part (helpers de groupement legacy…), le laisser si le volet supplémentation l'utilise, le supprimer sinon (vérifier avec grep avant).

- [ ] **Step 3: Vérifier typage + build**

Run: `npx tsc --noEmit 2>&1 | grep "supplements/page"` → aucune NOUVELLE erreur vs main.
Run: `npm run build` → succès.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/athletes/[id]/supplements/page.tsx"
git commit -m "feat(complement): la page rend le board DnD (volet supplémentation intouché)"
```

---

### Task 6: Vérification manuelle + docs + push

**Files:**
- Modify: `ARCHITECTURE.md` (section composants + table « Where to look for X »)

- [ ] **Step 1: Checklist manuelle (npm run dev, athlète de test)**

1. Athlète SANS diète active → onglet Complément affiche le message + lien nutrition. Aucune zone.
2. Athlète AVEC diète → zones : À jeun, chaque repas (nom+heure, 3 bandes), Training (3 bandes), Coucher.
3. Drag d'un carré librairie → bande « Avant R1 » → puce apparaît, ligne créée (vérifier dans l'onglet, refresh OK).
4. Re-drag du MÊME carré → « Coucher » → 2e puce (2 prises distinctes).
5. Modifier le dosage sur le carré AVANT drag → la puce porte ce dosage.
6. Drag d'une puce d'une zone à l'autre → moment mis à jour.
7. Clic puce → édition dosage/notes → sauvegarde OK.
8. X sur une puce → disparaît (actif=false), les logs athlète existants ne sont pas supprimés.
9. « + Nouveau » → carte ajoutée au catalogue → draggable.
10. « Depuis un template » → puces posées automatiquement aux bons moments.
11. Onglet Supplémentation → identique à avant (liste, ajout, historique).
12. App ATHLETE (Expo) : les prises apparaissent aux bons repas de NutritionScreen.

- [ ] **Step 2: Mettre à jour ARCHITECTURE.md**

Section 4 (components) — ajouter :

```markdown
### `supplements/`
- `ComplementBoard.tsx` — onglet Complément : DnD (dnd-kit) sur la timeline de la diète. Zones = moment_prise (`R{n}_avant|pendant|apres`, `a_jeun`, `coucher`, `*_training`).
- `ComplementLibrary.tsx` — catalogue coach (table supplements type complement, dédup par nom), carrés draggables avec dosage inline.
- `ComplementChip.tsx` — puce assignation (édition, retrait actif=false+end_date).
- Logique pure : `lib/complement.ts` (zones ↔ moment_prise, extractDietMeals).
```

Table « Where to look for X » — modifier la ligne existante :

```markdown
| Modify complément board (DnD, zones, librairie) | `components/supplements/*`, `lib/complement.ts` |
```

- [ ] **Step 3: Commit + push**

```bash
git add ARCHITECTURE.md
git commit -m "docs: ARCHITECTURE.md — module complément DnD"
git push -u origin feature/bilans-complement-2026-07
```

---

## Self-Review (fait à l'écriture)

- **Couverture spec** : sans-diète ✓(T4 EmptyState) ; timeline 3 bandes ✓(T1 buildZoneList + T4) ; librairie carrés + dosage inline + ⓘ/double-clic + Nouveau ✓(T2) ; multi-drop ✓(insert par drop) ; déplacement/édition/X ✓(T3/T4) ; « À replacer » legacy ✓(T4) ; templates conservés ✓(T5 onImportClick) ; zéro DB/ATHLETE ✓(aucune migration, moment_prise inchangé).
- **Placeholders** : aucun TBD ; les deux points d'incertitude assumés (signatures exactes de `Modal`/`EmptyState`) sont marqués comme vérifications explicites dans les steps concernés.
- **Cohérence de types** : `LibraryDragData`/`ChipDragData` définis en T2/T3, consommés à l'identique en T4 ; `ComplementBoardProps` de T4 = appel de T5.
