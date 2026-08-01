# Améliorations COACH nutrition — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vue détail affichant tous les jours nommés, duplication d'un jour dans l'éditeur, onglets de jour stylés, et un calculateur de moyennes de cycle (kcal/P/G/L) sauvegardé par diète.

**Architecture:** COACH Next.js. La vue détail (`page.tsx`) et l'éditeur (`MealEditor.tsx`) sont généralisés/enrichis. Le cycle est stocké en colonne JSONB `cycle_days` sur `nutrition_plans` (une diète = lignes de même `nom`). Composant partagé `CycleCalculator` pour vue détail + éditeur.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, CSS Modules (`nutrition.module.css`), Supabase (`nutrition_plans`). Pas de framework de test → vérification `npx tsc --noEmit` + test manuel navigateur.

## Global Constraints

- **DB :** 1 migration idempotente `sql/add_cycle_days.sql` : `ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS cycle_days JSONB;`. NON appliquée par le code (MCP non connecté) — Pierre la lance dans Supabase SQL Editor. Le code doit **dégrader proprement** si la colonne n'existe pas (try/catch sur lecture/écriture de `cycle_days`).
- **Périmètre COACH uniquement.** ATHLETE non touché.
- **On garde l'approche légère** : pas de refonte du modèle DietGroup (`nom` groupe la diète).
- **Variantes de repas** (`variant_label`) conservées partout.
- Label de jour : `editorDayLabel(mealType)` (exporté de MealEditor) — training/entrainement→« Entraînement », rest/repos→« Repos », sinon le nom brut.
- Moyennes pondérées : `Σ(macro_jour × N_jour) / Σ(N_jour)` ; si `Σ(N)=0` → état neutre. Défaut : tous N vides/0.
- `cycle_days` format `{ "<meal_type>": <int>, ... }`, écrit sur **toutes** les lignes actives de la diète.
- Vérification : `npx tsc --noEmit` ne doit ajouter AUCUNE erreur sur les fichiers touchés (le repo a des erreurs pré-existantes non liées — les ignorer). Pas de test unitaire (pas de runner).
- Pas de `git push` ni merge sans validation explicite de Pierre. Commits locaux.

---

## Fichiers touchés

| Fichier | Responsabilité | Tâches |
|---------|----------------|--------|
| `sql/add_cycle_days.sql` | Migration colonne cycle_days | T1 |
| `components/nutrition/CycleCalculator.tsx` (créer) | Composant calculateur réutilisable | T2 |
| `components/nutrition/MealEditor.tsx` | Dupliquer jour + UI onglets stylée + calc dans éditeur + save cycle_days | T3, T4, T6 |
| `styles/nutrition.module.css` | Styles onglets + calculateur | T4 |
| `app/(app)/athletes/[id]/nutrition/page.tsx` | Vue détail N jours + calc en détail + charge/sauve cycle_days | T5, T6 |

Ordre : migration → composant isolé → éditeur → vue détail → persistance. Chaque tâche laisse l'app compilable.

---

### Task 1: Migration SQL cycle_days

**Files:**
- Create: `sql/add_cycle_days.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Répartition du cycle par diète : nombre de fois que chaque jour (meal_type)
-- revient dans un cycle. Ex: {"training":3,"rest":3,"Poule":1} = cycle de 7 jours.
-- Stocké sur toutes les lignes actives d'une même diète (même nom).
ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS cycle_days JSONB;

COMMENT ON COLUMN nutrition_plans.cycle_days IS
  'Répartition du cycle {meal_type: n}. Moyennes pondérées côté coach. NULL = non réglé.';
```

- [ ] **Step 2: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git add sql/add_cycle_days.sql
git commit -m "feat(sql): colonne cycle_days pour répartition de cycle nutrition"
```

Note : Pierre lancera ce SQL dans Supabase. Le code des tâches suivantes ne présume PAS que la colonne existe déjà (try/catch).

---

### Task 2: Composant CycleCalculator

Composant isolé, testable visuellement, réutilisé en vue détail (T5) et éditeur (T6).

**Files:**
- Create: `components/nutrition/CycleCalculator.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type DayMacro = { mealType: string; label: string; calories: number; proteines: number; glucides: number; lipides: number }
  export function CycleCalculator(props: {
    days: DayMacro[]
    counts: Record<string, number>
    onChange: (counts: Record<string, number>) => void
    readOnly?: boolean
  }): JSX.Element
  ```

- [ ] **Step 1: Écrire le composant**

```tsx
'use client'
import styles from '@/styles/nutrition.module.css'

export type DayMacro = {
  mealType: string
  label: string
  calories: number
  proteines: number
  glucides: number
  lipides: number
}

export function CycleCalculator({
  days,
  counts,
  onChange,
  readOnly = false,
}: {
  days: DayMacro[]
  counts: Record<string, number>
  onChange: (counts: Record<string, number>) => void
  readOnly?: boolean
}) {
  const totalDays = days.reduce((s, d) => s + (counts[d.mealType] || 0), 0)
  const set = (mealType: string, v: string) => {
    const n = Math.max(0, Math.min(31, parseInt(v || '0', 10) || 0))
    onChange({ ...counts, [mealType]: n })
  }
  const avg = (key: 'calories' | 'proteines' | 'glucides' | 'lipides') => {
    if (totalDays === 0) return 0
    const sum = days.reduce((s, d) => s + d[key] * (counts[d.mealType] || 0), 0)
    return Math.round(sum / totalDays)
  }

  return (
    <div className={styles.cycleCalc}>
      <div className={styles.cycleCalcTitle}>Moyenne sur le cycle</div>
      <div className={styles.cycleCalcRows}>
        {days.map((d) => (
          <div key={d.mealType} className={styles.cycleCalcRow}>
            <span className={styles.cycleCalcLabel}>{d.label}</span>
            <input
              type="number"
              min={0}
              max={31}
              className={styles.cycleCalcInput}
              value={counts[d.mealType] ? String(counts[d.mealType]) : ''}
              placeholder="0"
              disabled={readOnly}
              onChange={(e) => set(d.mealType, e.target.value)}
            />
            <span className={styles.cycleCalcUnit}>×/cycle</span>
          </div>
        ))}
      </div>
      <div className={styles.cycleCalcCycleLen}>Cycle : {totalDays} jour{totalDays > 1 ? 's' : ''}</div>
      {totalDays === 0 ? (
        <div className={styles.cycleCalcEmpty}>Réglez la répartition pour voir les moyennes.</div>
      ) : (
        <div className={styles.cycleCalcResults}>
          <div className={styles.cycleCalcResult}><b>{avg('calories')}</b><span>kcal moy.</span></div>
          <div className={styles.cycleCalcResult}><b>{avg('proteines')}g</b><span>Prot. moy.</span></div>
          <div className={styles.cycleCalcResult}><b>{avg('glucides')}g</b><span>Gluc. moy.</span></div>
          <div className={styles.cycleCalcResult}><b>{avg('lipides')}g</b><span>Lip. moy.</span></div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Ajouter les styles dans `styles/nutrition.module.css`** (fin du fichier)

```css
.cycleCalc { margin-top: 16px; padding: 16px; background: var(--bg2); border: 1px solid var(--border-subtle); border-radius: 10px; }
.cycleCalcTitle { font-size: 13px; font-weight: 700; color: var(--text2); margin-bottom: 10px; }
.cycleCalcRows { display: flex; flex-direction: column; gap: 6px; }
.cycleCalcRow { display: flex; align-items: center; gap: 8px; }
.cycleCalcLabel { flex: 1; font-size: 13px; color: var(--text); }
.cycleCalcInput { width: 56px; padding: 4px 8px; background: var(--bg3); border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--text); text-align: center; }
.cycleCalcUnit { font-size: 12px; color: var(--text3); width: 64px; }
.cycleCalcCycleLen { margin-top: 8px; font-size: 12px; color: var(--text3); }
.cycleCalcEmpty { margin-top: 10px; font-size: 12px; color: var(--text3); font-style: italic; }
.cycleCalcResults { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-top: 12px; }
.cycleCalcResult { text-align: center; padding: 10px; background: var(--bg3); border-radius: 8px; }
.cycleCalcResult b { display: block; font-size: 18px; color: var(--primary); }
.cycleCalcResult span { font-size: 11px; color: var(--text3); }
```

- [ ] **Step 3: Vérifier compilation**

Run: `cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit 2>&1 | grep -E "CycleCalculator"`
Expected: aucune sortie (pas d'erreur sur ce fichier).

- [ ] **Step 4: Commit**

```bash
git add components/nutrition/CycleCalculator.tsx styles/nutrition.module.css
git commit -m "feat(nutrition): composant CycleCalculator (moyennes pondérées)"
```

---

### Task 3: Dupliquer un jour (MealEditor)

**Files:**
- Modify: `components/nutrition/MealEditor.tsx` (près de `addTab`/`renameTab`/`removeTab`, ~387-420)

**Interfaces:**
- Consumes: state `tabs`, `tempMeals`, `mealType`, `meals`, `manualMacros`, `switchMealType`, `MAX_DAYS`, `editorDayLabel`.
- Produces: `duplicateTab()` — copie le jour actif dans un nouvel onglet.

- [ ] **Step 1: Ajouter le handler `duplicateTab`** (après `addTab`)

```tsx
  function duplicateTab() {
    if (tabs.length >= MAX_DAYS) { toast('Maximum 6 jours', 'error'); return }
    // Nom : "<label courant> (copie)", dédupliqué.
    const base = `${editorDayLabel(mealType)} (copie)`
    let name = base, k = 2
    while (tabs.some((t) => t.mealType.toLowerCase() === name.toLowerCase())) { name = `${base} ${k++}` }
    // Snapshot du jour actif dans tempMeals, puis crée l'onglet dupliqué à partir d'une copie profonde.
    const copiedMeals: MealData[] = JSON.parse(JSON.stringify(meals))
    const copiedMacros = { ...manualMacros }
    setTempMeals((prev) => ({
      ...prev,
      [mealType]: { meals: [...meals], macros: { ...manualMacros } },
      [name]: { meals: copiedMeals, macros: copiedMacros },
    }))
    setTabs((prev) => [...prev, { mealType: name, label: name }])
    setMeals(copiedMeals)
    setManualMacros(copiedMacros)
    setActiveMealIdx(0)
    setMealType(name)
  }
```

- [ ] **Step 2: Vérifier compilation**

Run: `cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit 2>&1 | grep "MealEditor.tsx"`
Expected: aucune sortie.

- [ ] **Step 3: Commit** (le bouton UI arrive en T4)

```bash
git add components/nutrition/MealEditor.tsx
git commit -m "feat(MealEditor): handler duplicateTab (copie profonde d'un jour)"
```

---

### Task 4: UI onglets stylée + boutons (MealEditor)

**Files:**
- Modify: `components/nutrition/MealEditor.tsx` (barre d'onglets, lignes ~933-951)
- Modify: `styles/nutrition.module.css` (styles onglets)

**Interfaces:**
- Consumes: `tabs`, `mealType`, `switchMealType`, `renameTab`, `removeTab`, `duplicateTab` (T3), `addTab`, `MAX_DAYS`.

- [ ] **Step 1: Ajouter les styles onglets dans `nutrition.module.css`**

```css
.dayTabsBar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-left: 12px; }
.dayTab { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 999px; background: var(--bg3); border: 1px solid var(--border-subtle); cursor: pointer; }
.dayTabActive { background: var(--primary); border-color: var(--primary); }
.dayTabActive .dayTabLabel { color: #fff; }
.dayTabLabel { font-size: 13px; font-weight: 600; color: var(--text); border: none; background: none; cursor: pointer; padding: 0; }
.dayTabIcon { border: none; background: none; cursor: pointer; font-size: 12px; opacity: .7; padding: 0 2px; }
.dayTabActive .dayTabIcon { color: #fff; }
.dayTabAdd { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 999px; background: transparent; border: 1px dashed var(--primary); color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer; }
```

- [ ] **Step 2: Remplacer le JSX de la barre d'onglets** (lignes ~934-951)

```tsx
            <div className={styles.dayTabsBar}>
              {tabs.map((t, i) => (
                <span key={t.mealType} className={`${styles.dayTab} ${mealType === t.mealType ? styles.dayTabActive : ''}`}>
                  <button type="button" className={styles.dayTabLabel} onClick={() => switchMealType(t.mealType)}>{t.label}</button>
                  <button type="button" className={styles.dayTabIcon} title="Renommer" onClick={() => renameTab(t.mealType)}>&#9998;</button>
                  {i >= 2 && <button type="button" className={styles.dayTabIcon} title="Retirer" onClick={() => removeTab(t.mealType)}>&#10005;</button>}
                </span>
              ))}
              <button type="button" className={styles.dayTabAdd} title="Dupliquer le jour actif" onClick={duplicateTab}>&#10697; Dupliquer</button>
              {tabs.length < MAX_DAYS && (
                <button type="button" className={styles.dayTabAdd} title="Ajouter un jour" onClick={addTab}>+ Jour</button>
              )}
            </div>
```

- [ ] **Step 3: Vérifier compilation**

Run: `cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit 2>&1 | grep "MealEditor.tsx"`
Expected: aucune sortie.

- [ ] **Step 4: Test manuel**

Run: `cd /Users/pierrerebmann/MOMENTUM/COACH && npm run dev`
Éditer une diète : onglets stylés (pills), renommer OK, retirer (dès le 3e), « Dupliquer » crée un jour copié, « + Jour » ajoute vide. Cap à 6.

- [ ] **Step 5: Commit**

```bash
git add components/nutrition/MealEditor.tsx styles/nutrition.module.css
git commit -m "feat(MealEditor): onglets de jour stylés + bouton Dupliquer"
```

---

### Task 5: Vue détail — tous les jours (page.tsx)

**Files:**
- Modify: `app/(app)/athletes/[id]/nutrition/page.tsx` : state `detailType`/`detailDiet` (~205-206), `viewDiet` (~838-857), JSX détail (~1034-1071).

**Interfaces:**
- Produces: `detailDayType: string` remplace `detailType`; `detailDiet: { name: string; days: DetailDay[] }` où `DetailDay = { mealType: string; label: string; variants: NutritionPlan[]; plan: NutritionPlan | null }`.
- Consumes: `editorDayLabel` (import depuis MealEditor), `DayVariantTabs` (existant).

- [ ] **Step 1: Importer editorDayLabel** (si pas déjà) en haut de page.tsx

```ts
import { editorDayLabel } from '@/components/nutrition/MealEditor'
```
(Vérifier : `grep -n "editorDayLabel" app/(app)/athletes/[id]/nutrition/page.tsx` — l'import existe peut-être déjà d'une tâche précédente ; ne pas dupliquer.)

- [ ] **Step 2: Remplacer les states**

Remplacer (lignes ~205-206) :
```ts
  const [detailType, setDetailType] = useState<'training' | 'rest'>('training')
  const [detailDiet, setDetailDiet] = useState<{ name: string; tPlan: NutritionPlan | null; rPlan: NutritionPlan | null; trainingVariants: NutritionPlan[]; restVariants: NutritionPlan[] } | null>(null)
```
par :
```ts
  type DetailDay = { mealType: string; label: string; variants: NutritionPlan[]; plan: NutritionPlan | null }
  const [detailDayType, setDetailDayType] = useState<string>('training')
  const [detailDiet, setDetailDiet] = useState<{ name: string; days: DetailDay[] } | null>(null)
```

- [ ] **Step 3: Réécrire `viewDiet` pour charger TOUS les jours**

Remplacer le corps de `viewDiet` (lignes ~838-857) par :
```ts
  const viewDiet = useCallback(async (_t: NutritionPlan | null, _r: NutritionPlan | null, diet?: DietGroup) => {
    const idsToLoad = diet?.ids ?? []
    if (!idsToLoad.length) return
    const { data: fullPlans } = await supabase
      .from('nutrition_plans')
      .select('id, nom, athlete_id, coach_id, meal_type, calories_objectif, proteines, glucides, lipides, meals_data, actif, valid_from, created_at, macro_only, meal_times, variant_label, variant_order, archived_at')
      .in('id', idsToLoad)
    const loaded = ((fullPlans || []) as NutritionPlan[]).filter((p) => !p.archived_at)
    const byOrder = (a: NutritionPlan, b: NutritionPlan) => (a.variant_order ?? 0) - (b.variant_order ?? 0)
    const rankT = (mt: string) => { const m = (mt || '').toLowerCase(); return m === 'training' || m === 'entrainement' ? 0 : (m === 'rest' || m === 'repos' ? 1 : 2) }
    const byDay = new Map<string, NutritionPlan[]>()
    for (const p of loaded) { const k = p.meal_type || 'custom'; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k)!.push(p) }
    const days: DetailDay[] = Array.from(byDay.entries())
      .map(([mealType, plans]) => { const v = [...plans].sort(byOrder); return { mealType, label: editorDayLabel(mealType), variants: v, plan: v[0] || null } })
      .sort((a, b) => rankT(a.mealType) - rankT(b.mealType))
    const name = diet?.name ?? loaded[0]?.nom ?? 'Diete'
    setDetailDiet({ name, days })
    setDetailDayType(days[0]?.mealType ?? 'training')
    setDetailPlan(days[0]?.plan ?? null)
    setView('detail')
  }, [supabase])
```
(Vérifier les setters réellement présents : `setDetailPlan`, `setView`. Adapter si `viewDiet` faisait d'autres `set*` — les préserver.)

- [ ] **Step 4: Réécrire le JSX de la vue détail** (lignes ~986 à ~1071)

Remplacer la résolution `selT/selR/currentT/currentR/plan/dietGroup` et les 2 onglets ON/OFF + DayVariantTabs par :
```tsx
    const dietName = detailDiet.name
    const currentDay = detailDiet.days.find((d) => d.mealType === detailDayType) || detailDiet.days[0]
    const selVarId = selectedVariantByDay[`${dietName}|${currentDay?.mealType}`]
    const plan = (selVarId && currentDay?.variants.find((p) => p.id === selVarId)) || currentDay?.plan || null
    const dietGroup = diets.find((d) => d.name === dietName)
```
Puis la barre d'onglets de jour :
```tsx
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
          {detailDiet.days.map((d) => (
            <button
              key={d.mealType}
              className={`athlete-tab-btn ${detailDayType === d.mealType ? 'active' : ''}`}
              onClick={() => { setDetailDayType(d.mealType); setDetailPlan(d.plan) }}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 20px 0' }}>
          <DayVariantTabs
            variants={currentDay?.variants ?? []}
            selectedId={plan?.id ?? null}
            onSelect={(id) => setSelectedVariantByDay({ ...selectedVariantByDay, [`${dietName}|${currentDay?.mealType}`]: id })}
            onAddVariant={() => dietGroup && currentDay && addDayVariant(dietGroup, currentDay.mealType)}
            onRenameVariant={renameDayVariant}
            onArchiveVariant={archiveDayVariant}
          />
        </div>
```
Ajouter le state `selectedVariantByDay` (remplace `selectedTrainingByDiet`/`selectedRestByDiet` dans la vue détail) :
```ts
  const [selectedVariantByDay, setSelectedVariantByDay] = useState<Record<string, string>>({})
```
Note : `addDayVariant(group, mealType)` a une signature `(group, mealType: 'training'|'rest')` héritée — élargir son type `mealType` à `string` (elle utilise `mealType` comme valeur `meal_type`, donc compatible). Grep `addDayVariant` et changer la signature du paramètre en `string`.

- [ ] **Step 5: Corriger le message vide et les refs `detailType` restantes**

Remplacer toute occurrence restante de `detailType` par `detailDayType` (grep). Le message « Aucun plan pour les jours d'entrainement/repos » → `Aucun plan pour ce jour`.
Run: `grep -n "detailType\|selectedTrainingByDiet\|selectedRestByDiet\|detailDiet.tPlan\|detailDiet.rPlan\|trainingVariants\|restVariants" "app/(app)/athletes/[id]/nutrition/page.tsx"`
→ dans la portée de la vue détail : 0 résultat (ailleurs, `trainingVariants`/`restVariants` de DietGroup peuvent rester).

- [ ] **Step 6: Vérifier compilation**

Run: `cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit 2>&1 | grep "nutrition/page.tsx"`
Expected: seulement d'éventuelles erreurs pré-existantes déjà connues (ex ligne ~737 template_type) ; aucune NOUVELLE liée à detailDay/detailDiet.

- [ ] **Step 7: Test manuel**

`npm run dev` → visualiser une diète training+rest+« Poule » → 3 onglets avec bons noms, bascule OK, variantes de repas préservées, macros du jour affichées.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/athletes/[id]/nutrition/page.tsx"
git commit -m "fix(nutrition): vue détail affiche tous les jours nommés (plus seulement ON/OFF)"
```

---

### Task 6: Calculateur de cycle branché + persistance (détail + éditeur)

**Files:**
- Modify: `app/(app)/athletes/[id]/nutrition/page.tsx` (vue détail : monter CycleCalculator + charger/sauver cycle_days)
- Modify: `components/nutrition/MealEditor.tsx` (éditeur : monter CycleCalculator + inclure cycle_days au save)

**Interfaces:**
- Consumes: `CycleCalculator`, `DayMacro` (T2) ; `editorDayLabel`.

- [ ] **Step 1: page.tsx — état cycleCounts + lecture**

Ajouter un state et le remplir dans `viewDiet` (après avoir chargé `loaded`) :
```ts
  const [cycleCounts, setCycleCounts] = useState<Record<string, number>>({})
```
Dans `viewDiet`, après `const days = ...` :
```ts
    let cc: Record<string, number> = {}
    try { const raw = loaded.find((p) => (p as any).cycle_days)?.['cycle_days' as keyof NutritionPlan] as any; if (raw && typeof raw === 'object') cc = raw as Record<string, number> } catch { cc = {} }
    setCycleCounts(cc)
```
(La lecture est défensive : si la colonne n'existe pas, `cycle_days` est `undefined` → `cc = {}`.)
Ajouter `cycle_days` au `select(...)` de `viewDiet` **entre try/catch** — comme la colonne peut manquer, si l'ajout au select fait échouer la requête, garder le select SANS `cycle_days` et lire `cycle_days` uniquement s'il est présent. Approche simple et robuste : NE PAS ajouter `cycle_days` au select ; à la place, faire une 2e requête tolérante :
```ts
    try {
      const { data: cd } = await supabase.from('nutrition_plans').select('cycle_days').eq('nom', name).eq('athlete_id', athleteId).not('cycle_days', 'is', null).limit(1)
      const raw = (cd?.[0] as any)?.cycle_days
      if (raw && typeof raw === 'object') setCycleCounts(raw as Record<string, number>); else setCycleCounts({})
    } catch { setCycleCounts({}) }
```
(Si la colonne n'existe pas, la requête lève → catch → `{}`. Aucune régression.)

- [ ] **Step 2: page.tsx — sauvegarde du cycle (handler + persistance)**

Ajouter un handler qui écrit `cycle_days` sur toutes les lignes actives de la diète, tolérant à l'absence de colonne :
```ts
  const saveCycleCounts = useCallback(async (dietName: string, counts: Record<string, number>) => {
    setCycleCounts(counts)
    try {
      await supabase.from('nutrition_plans').update({ cycle_days: counts }).eq('athlete_id', athleteId).eq('nom', dietName).eq('actif', true)
    } catch { /* colonne cycle_days absente : ignore (migration pas encore lancée) */ }
  }, [supabase, athleteId])
```

- [ ] **Step 3: page.tsx — monter le CycleCalculator sous le résumé macro**

Après la grille des 4 cases macro (~ligne 1098, dans `view === 'detail'`), insérer :
```tsx
              <CycleCalculator
                days={detailDiet.days.map((d) => ({
                  mealType: d.mealType,
                  label: d.label,
                  calories: d.plan?.calories_objectif || 0,
                  proteines: d.plan?.proteines || 0,
                  glucides: d.plan?.glucides || 0,
                  lipides: d.plan?.lipides || 0,
                }))}
                counts={cycleCounts}
                onChange={(c) => saveCycleCounts(detailDiet.name, c)}
              />
```
Importer en haut : `import { CycleCalculator } from '@/components/nutrition/CycleCalculator'`.

- [ ] **Step 4: MealEditor — état + save de cycle_days**

Dans MealEditor, ajouter un state `cycleCounts` initialisé depuis une prop `initialCycleCounts?: Record<string, number>` (défaut `{}`), et l'inclure dans chaque `insert` de ligne du save ATHLETE (branche nutrition_plans, la boucle sur `allTabsData` de la feature précédente) : ajouter `cycle_days: cycleCounts` au payload d'insert — mais **de façon tolérante** : si la colonne n'existe pas, l'insert échouerait. Pour rester sûr sans casser les saves existants, NE PAS mettre `cycle_days` dans l'insert principal ; faire un update séparé tolérant APRÈS la boucle :
```ts
    try {
      if (Object.keys(cycleCounts).length) {
        await supabase.from('nutrition_plans').update({ cycle_days: cycleCounts }).eq('athlete_id', athleteId).eq('nom', planName.trim()).eq('actif', true)
      }
    } catch { /* colonne absente : ignore */ }
```
Props : ajouter `initialCycleCounts?: Record<string, number>` à `MealEditorProps`. `page.tsx` charge la valeur dans `editDiet` (même requête tolérante qu'en T6 Step 1) et la passe `initialCycleCounts={editCycleCounts}`.

- [ ] **Step 5: MealEditor — monter le CycleCalculator**

Sous le bloc des macros manuelles/summary de l'éditeur, monter :
```tsx
      <CycleCalculator
        days={tabs.map((t) => {
          const isCurrent = t.mealType === mealType
          const src = isCurrent ? manualMacros : (tempMeals[t.mealType]?.macros || { calories: 0, proteines: 0, glucides: 0, lipides: 0 })
          return { mealType: t.mealType, label: t.label, calories: src.calories || 0, proteines: src.proteines || 0, glucides: src.glucides || 0, lipides: src.lipides || 0 }
        })}
        counts={cycleCounts}
        onChange={setCycleCounts}
      />
```
Import : `import { CycleCalculator } from '@/components/nutrition/CycleCalculator'`.
Note : en éditeur les macros par jour viennent de `manualMacros`/`tempMeals` (peuvent être 0 si repas non re-calculés) — acceptable : le calcul reste indicatif tant qu'on édite, et devient exact en vue détail (valeurs persistées).

- [ ] **Step 6: Vérifier compilation**

Run: `cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit 2>&1 | grep -E "nutrition/page.tsx|MealEditor.tsx|CycleCalculator"`
Expected: aucune NOUVELLE erreur (hors pré-existantes connues).

- [ ] **Step 7: Test manuel (après avoir lancé la migration SQL en base)**

`npm run dev`. Vue détail d'une diète : régler 3/3/1 → moyennes correctes ; recharger la page → valeurs conservées. Sans avoir lancé la migration : le calculateur marche en session mais ne persiste pas (pas de crash). Éditeur : calculateur visible, valeurs modifiables.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/athletes/[id]/nutrition/page.tsx" components/nutrition/MealEditor.tsx
git commit -m "feat(nutrition): calculateur de cycle branché + persistance cycle_days (tolérant)"
```

---

## Vérification finale

- [ ] `cd COACH && npx tsc --noEmit` → aucune nouvelle erreur sur les 3 fichiers touchés.
- [ ] Migration `sql/add_cycle_days.sql` fournie ; rappeler à Pierre de la lancer dans Supabase.
- [ ] Vue détail : tous les jours nommés visibles, variantes OK.
- [ ] Éditeur : Dupliquer + onglets stylés + cap 6.
- [ ] Calculateur : moyennes pondérées correctes, persistance après migration, dégrade sans la colonne.
- [ ] **NE PAS** push / merge sans validation explicite de Pierre.
