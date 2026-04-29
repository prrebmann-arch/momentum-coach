# Variantes de diète — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au coach d'ajouter des variantes de jour (training-1/2/3, rest-1/2…) et des variantes de repas (Solide / Shake) dans une diète assignée à un athlète, avec choix athlète et adhérence non cassée.

**Architecture:** Variantes de jour = plusieurs rows actives par `(athlete_id, meal_type)` distinguées par `variant_label` + `variant_order` + soft delete via `archived_at`. Variantes de repas = inline JSON dans `meals_data` avec UUID stables. Helper `getMealFoods` centralisé pour éviter les régressions sur lectures directes de `meals_data[i].foods`.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase (PostgreSQL JSONB), React Native (Expo) côté ATHLETE, modules CSS.

**Spec source:** `docs/superpowers/specs/2026-04-29-meal-variants-design.md`

**Pas de tests automatisés** — la codebase nutrition n'en a pas. Validation par checklist manuelle sur preview Vercel + dev local Expo.

---

## Phase 0 — Setup branche & SQL

### Task 0.1 : Créer la branche feature

**Files:** aucun

- [ ] **Step 1: Créer la branche depuis develop**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git checkout develop && git pull
git checkout -b feature/meal-variants
```

- [ ] **Step 2: Vérifier**

```bash
git branch --show-current
```
Expected: `feature/meal-variants`

---

### Task 0.2 : Migration SQL

**Files:**
- Create: `sql/meal_variants.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- sql/meal_variants.sql
-- Migration : variantes de jour pour nutrition_plans.
-- Variantes de repas vivent dans meals_data JSON, aucune migration SQL nécessaire.
-- Idempotente : peut être rejouée.

ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS variant_label TEXT,
  ADD COLUMN IF NOT EXISTS variant_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Index couvrant les lectures actives groupées par meal_type + tri par variant_order.
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_active_group
  ON nutrition_plans(athlete_id, meal_type, variant_order)
  WHERE actif = true AND archived_at IS NULL;

COMMENT ON COLUMN nutrition_plans.variant_label IS
  'Label de variante de jour (ex: Push, Pull). NULL = plan singleton sans variantes.';
COMMENT ON COLUMN nutrition_plans.variant_order IS
  'Ordre de tri de la variante au sein de son groupe (athlete_id, meal_type).';
COMMENT ON COLUMN nutrition_plans.archived_at IS
  'Timestamp de soft delete. Plan exclu des lectures actives mais conservé pour les logs historiques.';
```

- [ ] **Step 2: Jouer la migration sur Supabase preview**

Ouvrir Supabase Dashboard → SQL Editor → coller le contenu → Run.

Expected: `Success. No rows returned`.

- [ ] **Step 3: Vérifier les colonnes**

Dans le même SQL Editor :

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'nutrition_plans'
  AND column_name IN ('variant_label', 'variant_order', 'archived_at');
```

Expected: 3 rows, `variant_order` default `0`, autres nullable.

- [ ] **Step 4: Commit**

```bash
git add sql/meal_variants.sql
git commit -m "feat(db): variantes de jour sur nutrition_plans (variant_label, variant_order, archived_at)"
```

---

## Phase 1 — Types & helper centralisé

### Task 1.1 : Étendre `MealData` avec variantes (COACH)

**Files:**
- Modify: `components/nutrition/MealEditor.tsx:13-27`

- [ ] **Step 1: Étendre les types**

Remplacer le bloc `interface FoodItem ... interface MealData` (lignes 13-27) par :

```ts
export interface FoodItem {
  aliment: string
  qte: number
  kcal: number
  p: number
  g: number
  l: number
  allow_conversion?: boolean
}

export interface MealVariant {
  /** Stable UUID, généré côté client à la création. */
  id: string
  label: string
  foods: FoodItem[]
}

export interface MealData {
  /** Label du repas (ex: "Repas 1"). */
  label?: string
  /** Heure (HH:MM). */
  time?: string
  /** Pré-workout flag. */
  pre_workout?: boolean
  /** Foods d'un repas SANS variantes. Mutuellement exclusif avec `variants`. */
  foods?: FoodItem[]
  /** Variantes d'un repas (max 3). Mutuellement exclusif avec `foods`. */
  variants?: MealVariant[]
}
```

- [ ] **Step 2: Build TS pour valider**

```bash
npm run build 2>&1 | tail -20
```

Expected: échecs TS sur les sites qui lisent `meal.foods` directement (c'est attendu, on les fixera dans la Task 1.2 puis dans les phases 2+). On note les fichiers concernés mais on n'arrête pas le plan ici.

- [ ] **Step 3: Lister les sites à fixer**

```bash
grep -rn "meal\.foods\|meals\[.*\]\.foods\|\.foods\.length\|\.foods\.map\|\.foods\.forEach" components/ app/ lib/ --include="*.ts" --include="*.tsx" | grep -v node_modules > /tmp/meal-foods-sites.txt
wc -l /tmp/meal-foods-sites.txt
```

Garder ce fichier pour audit dans la Phase 7.

---

### Task 1.2 : Helper `getMealFoods` (COACH)

**Files:**
- Create: `lib/nutrition.ts`

- [ ] **Step 1: Créer le helper**

```ts
// lib/nutrition.ts
import type { MealData, FoodItem, MealVariant } from '@/components/nutrition/MealEditor'

/**
 * Retourne les `foods` d'un repas, qu'il soit en mode simple ou multi-variantes.
 * Fallback sur la première variante si `chosenVariantId` n'est pas trouvé.
 */
export function getMealFoods(meal: MealData, chosenVariantId?: string | null): FoodItem[] {
  if (!meal.variants || meal.variants.length === 0) {
    return meal.foods ?? []
  }
  const found = chosenVariantId
    ? meal.variants.find((v) => v.id === chosenVariantId)
    : null
  return (found ?? meal.variants[0]).foods
}

/** Retourne l'objet variant (ou null si repas simple). */
export function getActiveVariant(meal: MealData, chosenVariantId?: string | null): MealVariant | null {
  if (!meal.variants || meal.variants.length === 0) return null
  if (!chosenVariantId) return meal.variants[0]
  return meal.variants.find((v) => v.id === chosenVariantId) ?? meal.variants[0]
}

/** True si le repas a ≥1 variante. */
export function hasVariants(meal: MealData): boolean {
  return Array.isArray(meal.variants) && meal.variants.length > 0
}

/** Génère un UUID v4 court pour identifier une variante. */
export function newVariantId(): string {
  // crypto.randomUUID est dispo en Node 20+ et navigateurs modernes
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `v_${crypto.randomUUID().slice(0, 8)}`
  }
  return `v_${Math.random().toString(36).slice(2, 10)}`
}
```

- [ ] **Step 2: Build pour vérifier**

```bash
npm run build 2>&1 | grep "lib/nutrition" || echo "lib/nutrition OK"
```

- [ ] **Step 3: Commit**

```bash
git add lib/nutrition.ts components/nutrition/MealEditor.tsx
git commit -m "feat(nutrition): types MealVariant + helper getMealFoods/hasVariants/newVariantId"
```

---

## Phase 2 — COACH MealEditor : variantes de repas

### Task 2.1 : Migrer le state interne pour supporter les variantes

**Files:**
- Modify: `components/nutrition/MealEditor.tsx`

- [ ] **Step 1: Lire le state actuel**

```bash
grep -n "useState\|setMeals\|meals\[" components/nutrition/MealEditor.tsx | head -40
```

- [ ] **Step 2: Ajouter un state `activeVariantIdByMeal`**

Sous la ligne `const [activeMealIdx, setActiveMealIdx] = useState(0)` :

```ts
// Map meal_index -> variant id actif dans l'éditeur (UI seulement, pas persisté).
const [activeVariantIdByMeal, setActiveVariantIdByMeal] = useState<Record<number, string>>({})
```

- [ ] **Step 3: Ajouter un helper local pour lire/écrire les foods de la variante active**

Sous la fonction `calcMealTotals` (après ligne 90) :

```ts
import { getActiveVariant, hasVariants, newVariantId } from '@/lib/nutrition'

function getEditableFoods(meal: MealData, activeVariantId?: string): FoodItem[] {
  if (!hasVariants(meal)) return meal.foods ?? []
  const v = getActiveVariant(meal, activeVariantId)
  return v?.foods ?? []
}

function setEditableFoods(meal: MealData, activeVariantId: string | undefined, newFoods: FoodItem[]): MealData {
  if (!hasVariants(meal)) {
    return { ...meal, foods: newFoods }
  }
  const variants = meal.variants!.map((v) =>
    v.id === activeVariantId ? { ...v, foods: newFoods } : v
  )
  return { ...meal, variants }
}
```

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -15
```

Erreurs attendues : les setters de foods existants utilisent `meal.foods` directement. On les fixera step 5.

- [ ] **Step 5: Remplacer les lectures `meal.foods` directes dans MealEditor**

Grep dans le fichier pour les sites :

```bash
grep -n "\.foods" components/nutrition/MealEditor.tsx
```

Pour chaque site, remplacer :
- Lecture : `meal.foods` → `getEditableFoods(meal, activeVariantIdByMeal[mealIdx])`
- Écriture : `setMeals([...meals], { ...meal, foods: newFoods })` → `setMeals(setEditableFoods(meal, activeVariantIdByMeal[mealIdx], newFoods))`

**Important :** quand on appelle `calcMealTotals`, le passer les foods retournés par `getEditableFoods`, pas `meal.foods` direct.

- [ ] **Step 6: Build OK**

```bash
npm run build 2>&1 | tail -15
```

Expected: 0 erreurs TS dans `MealEditor.tsx`.

- [ ] **Step 7: Commit**

```bash
git add components/nutrition/MealEditor.tsx
git commit -m "refactor(MealEditor): state activeVariantIdByMeal + helpers getEditableFoods/setEditableFoods"
```

---

### Task 2.2 : Boutons et UI tabs des variantes

**Files:**
- Modify: `components/nutrition/MealEditor.tsx`
- Modify: `styles/nutrition.module.css`

- [ ] **Step 1: Ajouter les actions de variante**

Sous les helpers `getEditableFoods` :

```ts
function addVariantToMeal(meal: MealData, label: string): MealData {
  const newVariant: MealVariant = { id: newVariantId(), label, foods: [] }
  if (!hasVariants(meal)) {
    // Conversion repas simple → multi-variantes : la 1re variante reprend les foods existants.
    const first: MealVariant = { id: newVariantId(), label: 'Variante 1', foods: meal.foods ?? [] }
    return { label: meal.label, time: meal.time, pre_workout: meal.pre_workout, variants: [first, { ...newVariant, label }] }
  }
  if (meal.variants!.length >= 3) return meal
  return { ...meal, variants: [...meal.variants!, newVariant] }
}

function duplicateVariant(meal: MealData, variantId: string): MealData {
  if (!hasVariants(meal) || meal.variants!.length >= 3) return meal
  const src = meal.variants!.find((v) => v.id === variantId)
  if (!src) return meal
  const copy: MealVariant = { id: newVariantId(), label: `${src.label} (copie)`, foods: [...src.foods] }
  return { ...meal, variants: [...meal.variants!, copy] }
}

function renameVariant(meal: MealData, variantId: string, newLabel: string): MealData {
  if (!hasVariants(meal)) return meal
  return { ...meal, variants: meal.variants!.map((v) => v.id === variantId ? { ...v, label: newLabel } : v) }
}

function removeVariant(meal: MealData, variantId: string): MealData {
  if (!hasVariants(meal)) return meal
  if (meal.variants!.length <= 1) return meal // bloqué : on garde au moins 1
  return { ...meal, variants: meal.variants!.filter((v) => v.id !== variantId) }
}

function convertToSimpleMeal(meal: MealData, keepVariantId: string): MealData {
  if (!hasVariants(meal)) return meal
  const keep = meal.variants!.find((v) => v.id === keepVariantId) ?? meal.variants![0]
  return { label: meal.label, time: meal.time, pre_workout: meal.pre_workout, foods: keep.foods }
}
```

- [ ] **Step 2: Render des tabs de variantes dans le JSX**

Identifier la section qui render un meal (chercher `meals.map((meal, mealIdx)` ou similaire). Au-dessus de la liste de foods, insérer un block conditionnel :

```tsx
{hasVariants(meal) && (
  <div className={styles.variantTabs}>
    {meal.variants!.map((v) => {
      const isActive = (activeVariantIdByMeal[mealIdx] ?? meal.variants![0].id) === v.id
      return (
        <button
          key={v.id}
          type="button"
          className={`${styles.variantTab} ${isActive ? styles.variantTabActive : ''}`}
          onClick={() => setActiveVariantIdByMeal({ ...activeVariantIdByMeal, [mealIdx]: v.id })}
        >
          {v.label}
        </button>
      )
    })}
    {meal.variants!.length < 3 && (
      <button
        type="button"
        className={styles.variantTabAdd}
        onClick={() => {
          const label = prompt('Label de la nouvelle variante (ex: Shake)')
          if (!label) return
          const updated = addVariantToMeal(meal, label)
          const newMeals = [...meals]; newMeals[mealIdx] = updated; setMeals(newMeals)
        }}
      >+ Option</button>
    )}
    <div className={styles.variantActions}>
      <button type="button" onClick={() => {
        const activeId = activeVariantIdByMeal[mealIdx] ?? meal.variants![0].id
        const updated = duplicateVariant(meal, activeId)
        const newMeals = [...meals]; newMeals[mealIdx] = updated; setMeals(newMeals)
      }}>Dupliquer</button>
      <button type="button" onClick={() => {
        const activeId = activeVariantIdByMeal[mealIdx] ?? meal.variants![0].id
        const cur = meal.variants!.find((v) => v.id === activeId)!
        const newLabel = prompt('Nouveau label', cur.label)
        if (!newLabel) return
        const updated = renameVariant(meal, activeId, newLabel)
        const newMeals = [...meals]; newMeals[mealIdx] = updated; setMeals(newMeals)
      }}>Renommer</button>
      <button type="button" disabled={meal.variants!.length <= 1} onClick={() => {
        if (!confirm('Supprimer cette variante ?')) return
        const activeId = activeVariantIdByMeal[mealIdx] ?? meal.variants![0].id
        const updated = removeVariant(meal, activeId)
        const newMeals = [...meals]; newMeals[mealIdx] = updated; setMeals(newMeals)
        setActiveVariantIdByMeal({ ...activeVariantIdByMeal, [mealIdx]: updated.variants![0].id })
      }}>Supprimer</button>
      <button type="button" onClick={() => {
        if (!confirm('Convertir en repas simple ? Les autres variantes seront perdues.')) return
        const activeId = activeVariantIdByMeal[mealIdx] ?? meal.variants![0].id
        const updated = convertToSimpleMeal(meal, activeId)
        const newMeals = [...meals]; newMeals[mealIdx] = updated; setMeals(newMeals)
      }}>Convertir en simple</button>
    </div>
  </div>
)}

{!hasVariants(meal) && !isMacroOnly && (
  <button
    type="button"
    className={styles.addVariantBtn}
    onClick={() => {
      const label = prompt('Label de la 2e variante (ex: Shake)')
      if (!label) return
      const updated = addVariantToMeal(meal, label)
      const newMeals = [...meals]; newMeals[mealIdx] = updated; setMeals(newMeals)
      setActiveVariantIdByMeal({ ...activeVariantIdByMeal, [mealIdx]: updated.variants![1].id })
    }}
  >+ Ajouter une option</button>
)}
```

- [ ] **Step 3: CSS minimal pour les tabs**

Ajouter à la fin de `styles/nutrition.module.css` :

```css
.variantTabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
  align-items: center;
}
.variantTab, .variantTabAdd {
  padding: 4px 10px;
  border: 1px solid var(--border, #d4d4d8);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.variantTabActive {
  background: var(--accent, #18181b);
  color: white;
  border-color: var(--accent, #18181b);
}
.variantActions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.variantActions button {
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid var(--border, #d4d4d8);
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
}
.variantActions button:disabled { opacity: 0.4; cursor: not-allowed; }
.addVariantBtn {
  margin: 8px 0;
  padding: 4px 10px;
  border: 1px dashed var(--border, #d4d4d8);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
```

- [ ] **Step 4: Build + smoke**

```bash
npm run build 2>&1 | tail -15
npm run dev
```

Ouvrir un athlète, page nutrition, créer/éditer une diète, ajouter une variante au repas 4. Vérifier :
- Tab "Variante 1" apparaît avec foods initiaux.
- Tab nouvelle variante apparaît, vide.
- Cliquer sur tab change la liste de foods éditée.
- Dupliquer / Renommer / Supprimer marchent.
- "Convertir en simple" repasse en mode `foods`.

- [ ] **Step 5: Commit**

```bash
git add components/nutrition/MealEditor.tsx styles/nutrition.module.css
git commit -m "feat(MealEditor): UI tabs variantes de repas (add, duplicate, rename, remove, convert-to-simple)"
```

---

### Task 2.3 : Tableau comparatif kcal/macros

**Files:**
- Modify: `components/nutrition/MealEditor.tsx`

- [ ] **Step 1: Ajouter le composant comparatif**

Au-dessus du `return` de `MealEditor`, ajouter un sous-composant local :

```tsx
function VariantCompareTable({ meal }: { meal: MealData }) {
  const [open, setOpen] = useState(false)
  if (!hasVariants(meal) || meal.variants!.length < 2) return null
  const rows = meal.variants!.map((v) => ({
    label: v.label,
    totals: calcMealTotals(v.foods),
  }))
  const ref = rows[0].totals
  return (
    <div className={styles.compareWrap}>
      <button type="button" onClick={() => setOpen(!open)} className={styles.compareToggle}>
        {open ? '▼' : '▶'} Comparer ({rows.length} variantes)
      </button>
      {open && (
        <table className={styles.compareTable}>
          <thead>
            <tr><th>Variante</th><th>kcal</th><th>P</th><th>G</th><th>L</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.label}</td>
                <td>{r.totals.kcal}</td>
                <td>{r.totals.p}</td>
                <td>{r.totals.g}</td>
                <td>{r.totals.l}</td>
              </tr>
            ))}
            {rows.slice(1).map((r, i) => (
              <tr key={`d${i}`} className={styles.compareDelta}>
                <td>Δ {r.label}</td>
                <td>{r.totals.kcal - ref.kcal > 0 ? '+' : ''}{r.totals.kcal - ref.kcal}</td>
                <td>{(r.totals.p - ref.p).toFixed(1)}</td>
                <td>{(r.totals.g - ref.g).toFixed(1)}</td>
                <td>{(r.totals.l - ref.l).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Render le composant sous les tabs**

Juste après le block des tabs (Task 2.2 step 2), ajouter :

```tsx
<VariantCompareTable meal={meal} />
```

- [ ] **Step 3: CSS**

Ajouter à `styles/nutrition.module.css` :

```css
.compareWrap { margin: 8px 0; font-size: 12px; }
.compareToggle {
  background: transparent; border: none; padding: 2px 0;
  color: var(--muted, #71717a); cursor: pointer; font-size: 12px;
}
.compareTable {
  margin-top: 4px; width: 100%; border-collapse: collapse; font-size: 12px;
}
.compareTable th, .compareTable td { padding: 4px 8px; text-align: right; }
.compareTable th:first-child, .compareTable td:first-child { text-align: left; }
.compareTable th { color: var(--muted, #71717a); font-weight: 500; }
.compareDelta td { color: var(--muted, #71717a); font-style: italic; }
```

- [ ] **Step 4: Smoke test**

`npm run dev`, créer 2 variantes avec foods différents, vérifier que le tableau affiche les bons totaux et delta.

- [ ] **Step 5: Commit**

```bash
git add components/nutrition/MealEditor.tsx styles/nutrition.module.css
git commit -m "feat(MealEditor): tableau comparatif kcal/macros entre variantes"
```

---

### Task 2.4 : Save flow — sérialiser les variantes correctement

**Files:**
- Modify: `components/nutrition/MealEditor.tsx`

- [ ] **Step 1: Identifier le save**

```bash
grep -n "from('nutrition_plans')\|.insert\|.update\|.upsert" components/nutrition/MealEditor.tsx | head
```

- [ ] **Step 2: Vérifier que `meals_data` est bien sérialisé tel quel**

Le shape JSON est déjà compatible (variantes incluses dans `meals_data: meals`). Mais le code peut filtrer/réécrire les foods avant save. Audit :

```bash
grep -B2 -A5 "meals_data" components/nutrition/MealEditor.tsx | head -60
```

Si une transformation type `meals.map((m) => ({ foods: m.foods, ... }))` existe, la remplacer par une version qui préserve `variants` ET `foods` :

```ts
const serializableMeals = meals.map((m) => {
  if (hasVariants(m)) {
    return {
      label: m.label,
      time: m.time,
      pre_workout: m.pre_workout,
      variants: m.variants!.map((v) => ({
        id: v.id,
        label: v.label,
        foods: v.foods.map((f) => ({
          aliment: f.aliment, qte: f.qte, kcal: f.kcal, p: f.p, g: f.g, l: f.l,
          ...(f.allow_conversion ? { allow_conversion: true } : {}),
        })),
      })),
    }
  }
  return {
    label: m.label,
    time: m.time,
    pre_workout: m.pre_workout,
    foods: (m.foods ?? []).map((f) => ({
      aliment: f.aliment, qte: f.qte, kcal: f.kcal, p: f.p, g: f.g, l: f.l,
      ...(f.allow_conversion ? { allow_conversion: true } : {}),
    })),
  }
})
```

Utiliser `serializableMeals` dans l'INSERT/UPDATE.

- [ ] **Step 3: Smoke test full save**

Créer une diète, ajouter une variante au repas 4, sauvegarder. Vérifier dans Supabase Dashboard → Table editor → `nutrition_plans` → la row a `meals_data` avec `variants: [...]` et UUID stables.

- [ ] **Step 4: Reload + édition**

Recharger la page, rouvrir l'éditeur sur la même diète. Vérifier :
- Variantes présentes avec mêmes labels.
- UUID préservés (cliquer sur tab et inspecter le DOM si nécessaire).
- Édition d'une variante puis save → mêmes UUID conservés.

- [ ] **Step 5: Commit**

```bash
git add components/nutrition/MealEditor.tsx
git commit -m "feat(MealEditor): sérialisation des variantes dans meals_data au save"
```

---

### Task 2.5 : Désactiver les variantes de repas si `macro_only`

**Files:**
- Modify: `components/nutrition/MealEditor.tsx`

- [ ] **Step 1: Conditionner l'affichage des boutons**

Le bouton "+ Ajouter une option" est déjà conditionné par `!isMacroOnly` (Task 2.2). Vérifier dans le code et ajouter une condition similaire au render des tabs :

Wrapper le block tabs/actions de la Task 2.2 step 2 dans :

```tsx
{!isMacroOnly && (
  <>
    {/* tabs et actions */}
  </>
)}
```

Si l'utilisateur active `macro_only` sur un plan qui a déjà des variantes, on cache l'UI mais on ne supprime pas les data (au cas où).

- [ ] **Step 2: Smoke test**

Activer le toggle `macro_only`, vérifier que les tabs et le bouton disparaissent. Désactiver, vérifier qu'ils reviennent.

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/MealEditor.tsx
git commit -m "feat(MealEditor): désactiver UI variantes si macro_only=true"
```

---

## Phase 3 — COACH page nutrition athlète : variantes de jour

### Task 3.1 : Lire les colonnes `variant_*` dans les requêtes

**Files:**
- Modify: `app/(app)/athletes/[id]/nutrition/page.tsx:121-162`
- Modify: `app/(app)/athletes/[id]/nutrition/page.tsx:35-52` (interface `NutritionPlan`)

- [ ] **Step 1: Étendre `NutritionPlan`**

Ajouter dans l'interface `NutritionPlan` (ligne 35-51) :

```ts
variant_label?: string | null
variant_order?: number
archived_at?: string | null
```

- [ ] **Step 2: Ajouter les colonnes au SELECT**

Ligne 128, modifier le SELECT pour inclure `variant_label, variant_order, archived_at` :

```ts
.select('id, nom, athlete_id, coach_id, meal_type, calories_objectif, proteines, glucides, lipides, actif, valid_from, created_at, macro_only, meal_times, variant_label, variant_order, archived_at')
```

- [ ] **Step 3: Filtrer les archivés en lecture active**

Dans `loadPlans`, après le SELECT, filtrer :

```ts
const allPlans = (data || []) as NutritionPlan[]
const activePlans = allPlans.filter((p) => !p.archived_at)
setPlans(activePlans)
```

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/athletes/[id]/nutrition/page.tsx"
git commit -m "feat(nutrition page): lecture colonnes variant_label/order/archived_at + filtre archivés"
```

---

### Task 3.2 : Étendre `DietGroup` pour multi-variantes par type

**Files:**
- Modify: `app/(app)/athletes/[id]/nutrition/page.tsx:53-60`
- Modify: `app/(app)/athletes/[id]/nutrition/page.tsx:135-156` (logique de groupage)

- [ ] **Step 1: Étendre l'interface `DietGroup`**

Remplacer (ligne 53-60) :

```ts
interface DietGroup {
  name: string
  /** Toutes les variantes de jour, triées par variant_order. */
  trainingVariants: NutritionPlan[]
  restVariants: NutritionPlan[]
  /** Premier plan training/rest pour rétro-compat avec le code de detail. */
  tPlan: NutritionPlan | null
  rPlan: NutritionPlan | null
  isActive: boolean
  versionCount: number
  ids: string[]
}
```

- [ ] **Step 2: Adapter le groupage**

Remplacer le block `Object.entries(byName).forEach` (lignes 145-153) par :

```ts
Object.entries(byName).forEach(([name, dietPlans]) => {
  const sorted = [...dietPlans].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  const tAll = sorted.filter((p) => p.meal_type === 'training' || p.meal_type === 'entrainement')
  const rAll = sorted.filter((p) => p.meal_type === 'rest' || p.meal_type === 'repos')

  const tActive = tAll.filter((p) => p.actif).sort((a, b) => (a.variant_order ?? 0) - (b.variant_order ?? 0))
  const rActive = rAll.filter((p) => p.actif).sort((a, b) => (a.variant_order ?? 0) - (b.variant_order ?? 0))

  const tPlan = tActive[0] ?? tAll[0] ?? null
  const rPlan = rActive[0] ?? rAll[0] ?? null

  const isActive = dietPlans.some((p) => p.actif)
  groups.push({
    name,
    trainingVariants: tActive.length ? tActive : (tAll[0] ? [tAll[0]] : []),
    restVariants: rActive.length ? rActive : (rAll[0] ? [rAll[0]] : []),
    tPlan, rPlan,
    isActive,
    versionCount: dietPlans.length,
    ids: dietPlans.map((p) => p.id),
  })
})
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Smoke test**

Démarrer le dev server, naviguer sur la page nutrition d'un athlète existant. Vérifier qu'aucune diète existante ne casse (toutes ont `variant_label = null`, donc 1 variante par type, comportement identique).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/athletes/[id]/nutrition/page.tsx"
git commit -m "refactor(nutrition page): DietGroup contient trainingVariants[]/restVariants[] (rétro-compat singleton)"
```

---

### Task 3.3 : UI tabs variantes de jour dans la liste des diètes

**Files:**
- Modify: `app/(app)/athletes/[id]/nutrition/page.tsx`
- Modify: `styles/nutrition.module.css`

- [ ] **Step 1: Identifier le render d'une diète dans la liste**

```bash
grep -n "diets.map\|dietGroup\|tPlan\|rPlan" app/\(app\)/athletes/\[id\]/nutrition/page.tsx | head
```

- [ ] **Step 2: Ajouter un sous-composant `DayVariantTabs`**

Quelque part au-dessus du `export default function NutritionPage`, dans le même fichier :

```tsx
function DayVariantTabs({
  variants,
  selectedId,
  onSelect,
  onAddVariant,
  onRenameVariant,
  onArchiveVariant,
}: {
  variants: NutritionPlan[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAddVariant: () => void
  onRenameVariant: (id: string, label: string) => void
  onArchiveVariant: (id: string) => void
}) {
  if (variants.length <= 1 && !variants[0]?.variant_label) return null
  return (
    <div className={styles.dayVariantTabs}>
      {variants.map((v) => (
        <div key={v.id} className={`${styles.dayVariantTab} ${v.id === selectedId ? styles.dayVariantTabActive : ''}`}>
          <button type="button" onClick={() => onSelect(v.id)}>
            {v.variant_label || 'Standard'}
          </button>
          <button type="button" className={styles.iconBtn} title="Renommer" onClick={() => {
            const label = prompt('Label de variante', v.variant_label || '')
            if (label != null) onRenameVariant(v.id, label)
          }}>✎</button>
          <button type="button" className={styles.iconBtn} title="Archiver" onClick={() => {
            if (variants.length <= 1) { alert('Impossible : variante unique'); return }
            if (!confirm(`Archiver "${v.variant_label || 'Standard'}" ?`)) return
            onArchiveVariant(v.id)
          }}>🗑</button>
        </div>
      ))}
      {variants.length < 4 && (
        <button type="button" className={styles.dayVariantAdd} onClick={onAddVariant}>
          + Variante
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire les actions au niveau page**

Ajouter ces helpers dans le composant `NutritionPage` :

```ts
async function addDayVariant(group: DietGroup, mealType: 'training' | 'rest') {
  const label = prompt('Label de la nouvelle variante (ex: Push)')
  if (!label) return
  const sourceArr = mealType === 'training' ? group.trainingVariants : group.restVariants
  const source = sourceArr[0]
  if (!source) { toast({ message: 'Crée d\'abord une variante de base', tone: 'error' }); return }

  // Charger les données complètes de la source pour les copier
  const { data: full } = await supabase
    .from('nutrition_plans')
    .select('*')
    .eq('id', source.id)
    .single()
  if (!full) return

  const nextOrder = Math.max(0, ...sourceArr.map((p) => p.variant_order ?? 0)) + 1
  const { error } = await supabase.from('nutrition_plans').insert({
    nom: full.nom,
    athlete_id: full.athlete_id,
    coach_id: full.coach_id,
    meal_type: full.meal_type,
    calories_objectif: full.calories_objectif,
    proteines: full.proteines,
    glucides: full.glucides,
    lipides: full.lipides,
    meals_data: full.meals_data,
    actif: true,
    valid_from: new Date().toISOString().split('T')[0],
    macro_only: full.macro_only,
    meal_times: full.meal_times,
    variant_label: label,
    variant_order: nextOrder,
  })
  if (error) { toast({ message: 'Erreur création variante', tone: 'error' }); return }

  // Si la source n'avait pas encore de label, lui en attribuer un
  if (!source.variant_label) {
    await supabase.from('nutrition_plans').update({ variant_label: 'Standard' }).eq('id', source.id)
  }
  await loadPlans()
}

async function renameDayVariant(planId: string, label: string) {
  const { error } = await supabase.from('nutrition_plans').update({ variant_label: label || null }).eq('id', planId)
  if (error) { toast({ message: 'Erreur renommage', tone: 'error' }); return }
  await loadPlans()
}

async function archiveDayVariant(planId: string) {
  const { error } = await supabase.from('nutrition_plans').update({ archived_at: new Date().toISOString() }).eq('id', planId)
  if (error) { toast({ message: 'Erreur archivage', tone: 'error' }); return }
  await loadPlans()
}
```

- [ ] **Step 4: Render les tabs dans la carte diète**

Identifier le bloc de render d'un `DietGroup` (chercher `diet.tPlan` ou `dietGroup.name`). Y intégrer un state local pour la variante sélectionnée et le composant :

```tsx
// Dans le composant qui render une carte diète
const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(diet.trainingVariants[0]?.id ?? null)
const [selectedRestId, setSelectedRestId] = useState<string | null>(diet.restVariants[0]?.id ?? null)

useEffect(() => {
  if (!diet.trainingVariants.find((p) => p.id === selectedTrainingId)) {
    setSelectedTrainingId(diet.trainingVariants[0]?.id ?? null)
  }
  if (!diet.restVariants.find((p) => p.id === selectedRestId)) {
    setSelectedRestId(diet.restVariants[0]?.id ?? null)
  }
}, [diet.trainingVariants, diet.restVariants])

// ... dans le JSX, au-dessus de la zone tPlan/rPlan :
<DayVariantTabs
  variants={diet.trainingVariants}
  selectedId={selectedTrainingId}
  onSelect={setSelectedTrainingId}
  onAddVariant={() => addDayVariant(diet, 'training')}
  onRenameVariant={renameDayVariant}
  onArchiveVariant={archiveDayVariant}
/>

// Et utiliser le plan sélectionné :
const currentTraining = diet.trainingVariants.find((p) => p.id === selectedTrainingId) ?? diet.tPlan
```

- [ ] **Step 5: CSS**

Ajouter à `styles/nutrition.module.css` :

```css
.dayVariantTabs {
  display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0;
}
.dayVariantTab {
  display: flex; align-items: center;
  border: 1px solid var(--border, #d4d4d8);
  border-radius: 6px; overflow: hidden;
}
.dayVariantTab > button:first-child {
  padding: 4px 10px; background: transparent; border: none;
  cursor: pointer; font-size: 13px;
}
.dayVariantTabActive > button:first-child {
  background: var(--accent, #18181b); color: white;
}
.iconBtn {
  padding: 4px 6px; border: none; background: transparent;
  cursor: pointer; opacity: 0.6; font-size: 12px;
}
.iconBtn:hover { opacity: 1; }
.dayVariantAdd {
  padding: 4px 10px; border: 1px dashed var(--border, #d4d4d8);
  background: transparent; border-radius: 6px; cursor: pointer; font-size: 13px;
}
```

- [ ] **Step 6: Smoke test**

Sur un athlète avec une diète existante, ajouter une variante "Push" du training. Vérifier :
- Tabs apparaissent.
- Sélection bascule le détail / l'éditeur sur la bonne variante.
- Renommer marche.
- Archiver enlève la variante de la liste.
- Sur un athlète sans variante, l'UI reste exactement comme avant.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/athletes/[id]/nutrition/page.tsx" styles/nutrition.module.css
git commit -m "feat(nutrition page): UI tabs variantes de jour (add/rename/archive) avec rétro-compat singleton"
```

---

### Task 3.4 : Adapter le bouton "Modifier" pour ouvrir l'éditeur sur la variante sélectionnée

**Files:**
- Modify: `app/(app)/athletes/[id]/nutrition/page.tsx`

- [ ] **Step 1: Identifier le handler d'édition**

```bash
grep -n "setEditPlanId\|setView('editor')\|onEdit" app/\(app\)/athletes/\[id\]/nutrition/page.tsx | head
```

- [ ] **Step 2: Passer le bon plan à l'éditeur**

Là où le code passe `tPlan` ou `rPlan` au MealEditor, remplacer par `currentTraining` / `currentRest` (les variantes sélectionnées via les tabs).

S'assurer que la lecture full des `meals_data` au moment d'ouvrir l'éditeur cible bien le `id` de la variante sélectionnée :

```ts
const { data: full } = await supabase
  .from('nutrition_plans')
  .select('meals_data, calories_objectif, proteines, glucides, lipides, macro_only, meal_times, nom, meal_type')
  .eq('id', selectedTrainingId)
  .single()
```

- [ ] **Step 3: Smoke test**

Cliquer "Modifier" sur la variante "Push" → l'éditeur charge les meals_data de Push, pas de Standard. Sauvegarder → ne crée pas une nouvelle row, met à jour la bonne.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/athletes/[id]/nutrition/page.tsx"
git commit -m "fix(nutrition page): éditeur ouvre la variante sélectionnée et persiste sur la bonne row"
```

---

## Phase 4 — ATHLETE : helpers + lecture multi-variantes

### Task 4.1 : Helper `getMealFoods` (JS)

**Files:**
- Create: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/utils/nutrition.js`

- [ ] **Step 1: Créer le helper côté ATHLETE**

```js
// src/utils/nutrition.js

/** True si le repas a ≥1 variante. */
export function hasVariants(meal) {
  return Array.isArray(meal?.variants) && meal.variants.length > 0
}

/** Retourne la variante active (ou null si repas simple). */
export function getActiveVariant(meal, chosenVariantId) {
  if (!hasVariants(meal)) return null
  if (!chosenVariantId) return meal.variants[0]
  return meal.variants.find((v) => v.id === chosenVariantId) || meal.variants[0]
}

/** Retourne les `foods` d'un repas (variante active ou foods simples). */
export function getMealFoods(meal, chosenVariantId) {
  if (!hasVariants(meal)) return meal?.foods || []
  return getActiveVariant(meal, chosenVariantId)?.foods || []
}
```

- [ ] **Step 2: Vérifier le path est lisible par Metro**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
ls src/utils/
```

Si `src/utils/` n'existe pas, créer le dossier puis le fichier.

- [ ] **Step 3: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git checkout -b feature/meal-variants
git add src/utils/nutrition.js
git commit -m "feat(nutrition): helpers hasVariants/getActiveVariant/getMealFoods"
```

---

### Task 4.2 : Étendre `meals_log` shape pour stocker `chosen_variant_id`

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/NutritionScreen.js`

- [ ] **Step 1: Identifier la création/hydration du log par défaut**

```bash
grep -n "meals_log\|chosen_variant_id\|hydrateLog\|defaultLog\|emptyLog" /Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/NutritionScreen.js | head -30
```

- [ ] **Step 2: Hydrater le log avec `chosen_variant_id` initial**

Là où on hydrate `meals_log` à partir du plan (création d'un log vide par défaut), pour chaque meal :

```js
import { hasVariants } from '../utils/nutrition'

function hydrateMealsLog(planMeals) {
  return planMeals.map((meal, idx) => {
    const base = {
      meal_index: idx,
      meal_label: meal.label || `Repas ${idx + 1}`,
      foods: [],
      validated_all: false,
    }
    if (hasVariants(meal)) {
      base.chosen_variant_id = meal.variants[0].id // default = première variante
    }
    return base
  })
}
```

Remplacer la création du log vide existante par cet appel. **Si le log est déjà persisté en DB**, on ne le modifie pas — on utilise `chosen_variant_id` existant ou fallback `variants[0].id`.

- [ ] **Step 3: Render uniquement les foods de la variante choisie**

Dans le render des repas (chercher `meal.foods.map`), remplacer par :

```js
import { getMealFoods, getActiveVariant } from '../utils/nutrition'

// ...
const chosenVariantId = mealLog?.chosen_variant_id
const foods = getMealFoods(meal, chosenVariantId)
const activeVariant = getActiveVariant(meal, chosenVariantId)
// foods.map(...) au lieu de meal.foods.map(...)
```

- [ ] **Step 4: Smoke test**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
npx expo start
```

Sur un athlète test (créer une diète avec une variante côté COACH d'abord), ouvrir Nutrition → vérifier que la première variante s'affiche par défaut, et que les foods sont ceux de la variante.

- [ ] **Step 5: Commit**

```bash
git add src/screens/NutritionScreen.js
git commit -m "feat(NutritionScreen): hydrate chosen_variant_id par défaut + render foods de la variante active"
```

---

## Phase 5 — ATHLETE : picker variante de jour

### Task 5.1 : Charger les plans actifs groupés par meal_type

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/NutritionScreen.js`
- Modify (peut-être): `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/api/nutrition.js`

- [ ] **Step 1: Identifier le load des plans**

```bash
grep -n "from('nutrition_plans')\|fetchPlans\|loadPlans\|nutrition_plans" /Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/NutritionScreen.js /Users/pierrerebmann/MOMENTUM/ATHLETE/src/api/*.js
```

- [ ] **Step 2: Étendre la requête**

Modifier le SELECT pour ajouter `variant_label, variant_order, archived_at` et filtrer `archived_at IS NULL` :

```js
const { data: plans } = await supabase
  .from('nutrition_plans')
  .select('id, nom, meal_type, meals_data, calories_objectif, proteines, glucides, lipides, macro_only, meal_times, variant_label, variant_order, archived_at, actif')
  .eq('athlete_id', athlete.id)
  .eq('actif', true)
  .is('archived_at', null)
  .order('variant_order', { ascending: true })
```

- [ ] **Step 3: Grouper par meal_type côté JS**

```js
const trainingVariants = plans.filter((p) => p.meal_type === 'training' || p.meal_type === 'entrainement')
const restVariants = plans.filter((p) => p.meal_type === 'rest' || p.meal_type === 'repos')
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/NutritionScreen.js
git commit -m "feat(NutritionScreen): charge plans groupés par meal_type avec filtre archived_at"
```

---

### Task 5.2 : UI picker variante de jour

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/NutritionScreen.js`

- [ ] **Step 1: Ajouter un state de sélection**

```js
const [chosenDayPlanId, setChosenDayPlanId] = useState(null)
```

Hydrater depuis `nutrition_logs.plan_id` au load du log :

```js
useEffect(() => {
  if (todayLog?.plan_id) setChosenDayPlanId(todayLog.plan_id)
}, [todayLog])
```

- [ ] **Step 2: Logique de visibilité du picker**

```js
// activeMealType = 'training' ou 'rest' (selon le tab existant)
const variantsForType = activeMealType === 'training' ? trainingVariants : restVariants
const needsDayVariantPick = variantsForType.length >= 2 && !chosenDayPlanId
const activePlan = chosenDayPlanId
  ? variantsForType.find((p) => p.id === chosenDayPlanId)
  : (variantsForType.length === 1 ? variantsForType[0] : null)
```

- [ ] **Step 3: Render du picker**

Au-dessus du render des meals :

```jsx
{needsDayVariantPick && (
  <View style={styles.dayVariantPicker}>
    <Text style={styles.dayVariantTitle}>Choisis ta journée</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      {variantsForType.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => handlePickDayVariant(p)}
          style={[styles.dayVariantPill, chosenDayPlanId === p.id && styles.dayVariantPillActive]}
        >
          <Text style={[styles.dayVariantPillText, chosenDayPlanId === p.id && styles.dayVariantPillTextActive]}>
            {p.variant_label || 'Standard'}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  </View>
)}
```

- [ ] **Step 4: Handler avec UPSERT du log**

```js
async function handlePickDayVariant(plan) {
  // Si log déjà existant avec un plan_id différent ET meals_log non vide → confirmation
  if (todayLog?.plan_id && todayLog.plan_id !== plan.id && Array.isArray(todayLog.meals_log) && todayLog.meals_log.some((m) => m.foods?.length > 0)) {
    const confirmed = await new Promise((resolve) => {
      Alert.alert(
        'Changer ta journée ?',
        'Tu as commencé à logger cette journée. Changer remet à zéro ce qui a été validé.',
        [
          { text: 'Annuler', onPress: () => resolve(false), style: 'cancel' },
          { text: 'Confirmer', onPress: () => resolve(true), style: 'destructive' },
        ]
      )
    })
    if (!confirmed) return
  }
  setChosenDayPlanId(plan.id)
  // UPSERT log
  await saveNutritionLog(athlete.id, plan.id, dateStr, hydrateMealsLog(parseMealsData(plan.meals_data)))
}
```

- [ ] **Step 5: Reset du log au changement effectif**

`saveNutritionLog` doit accepter `plan_id` à mettre à jour. Si elle n'existe pas, créer dans `src/api/nutrition.js` :

```js
export async function saveNutritionLog(athleteId, planId, date, mealsLog) {
  return supabase.from('nutrition_logs').upsert({
    athlete_id: athleteId,
    plan_id: planId,
    date,
    meals_log: mealsLog,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'athlete_id,date' })
}
```

- [ ] **Step 6: Styles**

Ajouter dans le StyleSheet :

```js
dayVariantPicker: { paddingVertical: 12 },
dayVariantTitle: { fontSize: 15, fontWeight: '600', paddingHorizontal: 16, marginBottom: 8 },
dayVariantPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: '#d4d4d8' },
dayVariantPillActive: { backgroundColor: '#18181b', borderColor: '#18181b' },
dayVariantPillText: { fontSize: 14, color: '#27272a' },
dayVariantPillTextActive: { color: 'white' },
```

- [ ] **Step 7: Smoke test**

Côté COACH, créer une 2e variante "Push" sur un athlète. Côté ATHLETE (Expo Go), ouvrir Nutrition → tab Entraînement → picker apparaît avec "Standard" et "Push", aucune sélectionnée. Cliquer "Push" → meals s'affichent. Logger un aliment. Cliquer "Standard" → modal confirmation → confirmer → reset.

- [ ] **Step 8: Commit**

```bash
git add src/screens/NutritionScreen.js src/api/nutrition.js
git commit -m "feat(NutritionScreen): picker variante de jour avec UPSERT log + modal reset"
```

---

## Phase 6 — ATHLETE : picker variante de repas + reset

### Task 6.1 : Flèches ◀ ▶ pour cycler entre variantes de repas

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/NutritionScreen.js`

- [ ] **Step 1: Ajouter un handler de changement**

```js
async function handleSwitchMealVariant(mealIndex, direction) {
  const meal = activePlan.meals_data?.[mealIndex] ?? parseMealsData(activePlan.meals_data)[mealIndex]
  if (!hasVariants(meal)) return
  const variants = meal.variants
  const currentLog = todayLog?.meals_log?.[mealIndex]
  const currentId = currentLog?.chosen_variant_id || variants[0].id
  const currentIdx = variants.findIndex((v) => v.id === currentId)
  const nextIdx = (currentIdx + direction + variants.length) % variants.length
  const nextVariant = variants[nextIdx]

  // Confirmation si le repas actuel a des foods loggés
  const hasLoggedFoods = (currentLog?.foods?.length ?? 0) > 0 && currentLog.foods.some((f) => f.status && f.status !== 'pending')
  if (hasLoggedFoods) {
    const ok = await new Promise((resolve) => {
      Alert.alert(
        'Changer d\'option ?',
        'Tu as commencé à logger ce repas. Changer remet à zéro ce qui a été validé.',
        [
          { text: 'Annuler', onPress: () => resolve(false), style: 'cancel' },
          { text: 'Confirmer', onPress: () => resolve(true), style: 'destructive' },
        ]
      )
    })
    if (!ok) return
  }

  // Update log : nouveau chosen_variant_id, foods reset
  const newMealsLog = [...(todayLog?.meals_log || [])]
  newMealsLog[mealIndex] = {
    ...newMealsLog[mealIndex],
    meal_index: mealIndex,
    meal_label: meal.label || `Repas ${mealIndex + 1}`,
    chosen_variant_id: nextVariant.id,
    foods: [],
    validated_all: false,
  }
  await saveNutritionLog(athlete.id, activePlan.id, dateStr, newMealsLog)
  // refresh state local
  setTodayLog((prev) => ({ ...prev, meals_log: newMealsLog }))
}
```

- [ ] **Step 2: UI flèches dans le header de meal**

Dans le render des meals, ajouter conditionnellement au header :

```jsx
{hasVariants(meal) && (
  <View style={styles.variantSwitcher}>
    <Pressable onPress={() => handleSwitchMealVariant(mealIndex, -1)} style={styles.variantArrow}>
      <Text style={styles.variantArrowText}>◀</Text>
    </Pressable>
    <Text style={styles.variantLabel}>
      {activeVariant?.label} ({(meal.variants.findIndex((v) => v.id === (todayLog?.meals_log?.[mealIndex]?.chosen_variant_id || meal.variants[0].id)) + 1)}/{meal.variants.length})
    </Text>
    <Pressable onPress={() => handleSwitchMealVariant(mealIndex, +1)} style={styles.variantArrow}>
      <Text style={styles.variantArrowText}>▶</Text>
    </Pressable>
  </View>
)}
```

- [ ] **Step 3: Styles**

```js
variantSwitcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 8 },
variantArrow: { padding: 4 },
variantArrowText: { fontSize: 18, color: '#52525b' },
variantLabel: { fontSize: 14, fontWeight: '500', minWidth: 100, textAlign: 'center' },
```

- [ ] **Step 4: Smoke test**

Côté COACH, sur un athlète, ajouter une variante "Shake" au repas 4. Côté ATHLETE :
- Ouvrir Nutrition → repas 4 affiche "Solide (1/2)" (ou la 1re variante).
- Flèche droite → bascule sur "Shake (2/2)".
- Logger 1 aliment → flèche → modal confirmation → reset.

- [ ] **Step 5: Commit**

```bash
git add src/screens/NutritionScreen.js
git commit -m "feat(NutritionScreen): picker flèches variantes de repas + modal reset"
```

---

### Task 6.2 : Adapter le log par-aliment pour la variante active

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/NutritionScreen.js`

- [ ] **Step 1: Identifier `onUpdateFood`**

```bash
grep -n "onUpdateFood\|updateFood\|setMealFoodStatus" /Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/NutritionScreen.js | head
```

- [ ] **Step 2: Vérifier que les actions log opèrent bien sur la variante active**

Le `meals_log[mealIndex].foods` est une array indépendante du shape `meal.variants`. Le seul lien est via `chosen_variant_id`. La logique existante de `onUpdateFood(mealIndex, foodIndex, status, replacement)` fonctionne tant que `foodIndex` est l'index dans la variante active (matche `getMealFoods(meal, chosen_variant_id)`).

S'assurer que le render des foods utilise bien `getMealFoods(meal, chosenId)` (déjà fait Task 4.2 step 3) et que les indices passés à `onUpdateFood` correspondent à cette même array.

- [ ] **Step 3: Tout valider — adapter pour la variante active**

Identifier `onValidateAll(mealIndex)` (autour ligne 1856-1860 du fichier original). Le code marque tous les foods de `meal.foods` comme followed. Adapter :

```js
function onValidateAll(mealIndex) {
  const meal = activePlanMeals[mealIndex]
  const chosenId = todayLog?.meals_log?.[mealIndex]?.chosen_variant_id
  const foods = getMealFoods(meal, chosenId)
  const newMealsLog = [...(todayLog?.meals_log || [])]
  newMealsLog[mealIndex] = {
    ...newMealsLog[mealIndex],
    meal_index: mealIndex,
    meal_label: meal.label || `Repas ${mealIndex + 1}`,
    chosen_variant_id: chosenId, // préserver
    foods: foods.map((f, fi) => ({
      food_index: fi,
      status: 'followed',
      original: f,
      replacement: null,
    })),
    validated_all: true,
  }
  saveNutritionLog(athlete.id, activePlan.id, dateStr, newMealsLog)
  setTodayLog((prev) => ({ ...prev, meals_log: newMealsLog }))
}
```

- [ ] **Step 4: Smoke test**

Sur un repas avec 2 variantes : passer sur Shake, "Tout valider", vérifier que `meals_log[i].foods` contient les foods de Shake (pas Solide), avec `chosen_variant_id` = Shake.

- [ ] **Step 5: Commit**

```bash
git add src/screens/NutritionScreen.js
git commit -m "fix(NutritionScreen): onValidateAll utilise les foods de la variante active"
```

---

## Phase 7 — Audit grep & robustesse

### Task 7.1 : Audit `meals_data` côté COACH

**Files:** lecture seule + corrections ponctuelles.

- [ ] **Step 1: Lister tous les sites qui lisent `meals_data` ou `.foods`**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
grep -rn "meals_data\|\.foods" components/ app/ lib/ --include="*.ts" --include="*.tsx" | grep -v node_modules > /tmp/coach-meals-audit.txt
cat /tmp/coach-meals-audit.txt
```

- [ ] **Step 2: Pour chaque site qui lit `meals[i].foods` ou `meals_data[i].foods` directement**

Décider : c'est un site d'**affichage** (calcul totaux, render, dashboard) → remplacer par `getMealFoods(meal)` (sans `chosenVariantId` côté coach = première variante).

C'est un site d'**édition** (MealEditor) → déjà fait phase 2.

C'est un site de **persistance** (save) → déjà fait Task 2.4.

Sites probables à vérifier :
- `components/dashboard/` (totaux d'un athlète sur un jour)
- `components/bilans/` (lecture historique)
- `app/(app)/athletes/[id]/apercu/page.tsx`

Pour chaque site identifié :

```ts
import { getMealFoods } from '@/lib/nutrition'
// ...
const foods = getMealFoods(meal)
const totals = foods.reduce(...)
```

- [ ] **Step 3: Build complet pour valider**

```bash
npm run build 2>&1 | tail -20
```

Expected: 0 erreurs.

- [ ] **Step 4: Commit (un par fichier touché ou un commit global)**

```bash
git add components/ app/
git commit -m "fix(nutrition): utiliser getMealFoods sur tous les sites d'affichage (totaux, dashboard, bilans)"
```

---

### Task 7.2 : Audit côté ATHLETE

**Files:** lecture seule + corrections.

- [ ] **Step 1: Lister**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
grep -rn "meals_data\|\.foods" src/ --include="*.js" --include="*.jsx" | grep -v node_modules > /tmp/athlete-meals-audit.txt
cat /tmp/athlete-meals-audit.txt
```

- [ ] **Step 2: Pour chaque site, remplacer par `getMealFoods`**

Sites probables :
- `src/screens/NutritionScreen.js` (déjà partiellement fait)
- `src/screens/HomeScreen.js` ou Dashboard (totaux jour)
- `src/components/Macros*` ou similaire

- [ ] **Step 3: Smoke test**

`npx expo start`, naviguer dashboard / home / nutrition. Aucune crash, totaux corrects sur athlètes avec et sans variantes.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "fix(nutrition): utiliser getMealFoods côté ATHLETE pour tous les calculs (dashboard, totaux)"
```

---

## Phase 8 — Vérification & checklist

### Task 8.1 : Push branches + PR

- [ ] **Step 1: Push COACH**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git push -u origin feature/meal-variants
gh pr create --base develop --title "feat: variantes de diète (jour + repas)" --body "$(cat <<'EOF'
## Summary
- Variantes de jour : multiples plans actifs par meal_type, distinguées par variant_label + variant_order, soft delete via archived_at.
- Variantes de repas : inline JSON dans meals_data avec UUID stables, max 3 par repas.
- UX coach : tabs variantes de jour, tabs variantes de repas dans MealEditor, tableau comparatif kcal/macros.
- Backward compat : 100% des plans existants sans variant_label = singletons, comportement inchangé.

## Spec
\`docs/superpowers/specs/2026-04-29-meal-variants-design.md\`

## Plan
\`docs/superpowers/plans/2026-04-29-meal-variants.md\`

## Test plan
- [ ] Migration SQL jouée sur Supabase preview, colonnes ajoutées.
- [ ] Athlète sans variante : aucune régression visuelle ni fonctionnelle.
- [ ] Coach crée une variante "Push" → tab apparaît, MealEditor charge la bonne variante.
- [ ] Coach ajoute variante "Shake" au repas 4 → tableau comparatif affiche kcal/macros + delta.
- [ ] Coach archive une variante → disparaît côté athlète.
- [ ] Athlète avec 2 variantes de jour → picker visible, choix persisté.
- [ ] Athlète flèche variante de repas → cycle, modal reset si déjà loggé.
- [ ] Plan macro_only=true → bouton "+ Ajouter une option" caché.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Push ATHLETE**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git push -u origin feature/meal-variants
gh pr create --base develop --title "feat: variantes de diète (jour + repas)" --body "$(cat <<'EOF'
## Summary
- Picker variante de jour quand plusieurs plans actifs par meal_type.
- Picker flèches ◀ ▶ pour variantes de repas.
- Modals de confirmation avant reset du log au changement de variante.
- Helpers \`hasVariants\`, \`getActiveVariant\`, \`getMealFoods\` dans \`src/utils/nutrition.js\`.

## Spec
COACH repo: \`docs/superpowers/specs/2026-04-29-meal-variants-design.md\`

## Test plan
- [ ] Athlète sans variante : aucune régression.
- [ ] Athlète avec 2+ variantes de jour : picker, persist, reset.
- [ ] Athlète avec variantes de repas : flèches cyclent, modal reset si loggé.
- [ ] Tout valider sur la variante active utilise les bons foods.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 8.2 : Checklist manuelle finale sur preview

- [ ] **Step 1: Attendre que Vercel déploie le preview**

```bash
gh pr view --json statusCheckRollup -q '.statusCheckRollup[]?.context, .url'
```

- [ ] **Step 2: Coach (preview Vercel)**

| # | Cas | OK ? |
|---|---|---|
| 1 | Diète existante sans variante → aucune régression | [ ] |
| 2 | Ajouter variante de jour "Push" → tab apparaît | [ ] |
| 3 | Renommer "Push" → "Push v2" → label updated | [ ] |
| 4 | Archiver "Push v2" → disparaît | [ ] |
| 5 | Modifier la variante "Standard" → ouvre la bonne | [ ] |
| 6 | Repas 4 : ajouter variante "Shake" → tabs internes | [ ] |
| 7 | Tableau comparatif affiche kcal/macros + delta | [ ] |
| 8 | Dupliquer une variante → copie foods | [ ] |
| 9 | Convertir en repas simple → repasse en foods | [ ] |
| 10 | Plan macro_only=true → boutons cachés | [ ] |

- [ ] **Step 3: Athlète (Expo Go)**

| # | Cas | OK ? |
|---|---|---|
| 11 | Athlète sans variante → comportement identique | [ ] |
| 12 | Athlète avec 2 variantes jour → picker visible | [ ] |
| 13 | Choix variante jour → meals correspondants | [ ] |
| 14 | Changer variante jour après log → modal + reset | [ ] |
| 15 | Repas avec variantes → flèches cyclent | [ ] |
| 16 | Logger food puis cycler → modal + reset | [ ] |
| 17 | Tout valider sur Shake → foods de Shake loggés | [ ] |

---

## Hors scope (rappel)

Notés dans `tasks/todo.md` ou différés en V2 :

- Adhérence calculée vs saisie manuelle (audit séparé).
- Indicateur "nouvelles options dispo" côté athlète.
- Tags de couplage entre variantes.
- Auto-suggestion macros pour iso-macros.
- Stats par variante côté coach.
- Variante de jour calquée sur le programme d'entraînement.
