# Jours de diète nommés librement (max 6) — Plan (version légère)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dans l'éditeur de diète, à côté des 2 onglets Entraînement/Repos, ajouter un « + » qui crée des jours supplémentaires (jusqu'à 6 au total), chacun éditable et renommable librement ; l'athlète voit un onglet par jour.

**Architecture:** On généralise les 2 onglets internes de `MealEditor` (aujourd'hui `mealType: 'training' | 'rest'`) en une **liste dynamique d'onglets** `tabs: { key, mealType, label }[]`. Le nom libre du jour est stocké dans la colonne texte `meal_type` (sans contrainte CHECK). La sauvegarde écrit une ligne `nutrition_plans` par onglet. `training`/`rest` restent les 2 onglets par défaut, renommables. Côté athlète : grouper par `meal_type` au lieu de 2 buckets figés. Les variantes de repas (`variant_label`) ne changent pas.

**Tech Stack:** Next.js 16/React 19 + CSS Modules (COACH : `components/nutrition/MealEditor.tsx`, `app/(app)/athletes/[id]/nutrition/page.tsx`). React Native/Expo (ATHLETE : `src/hooks/useNutrition.js`, `src/screens/NutritionScreen.js`, `src/utils/nutrition.js`). Aucun framework de test → `npx tsc --noEmit` (COACH), `node --check` (ATHLETE), test manuel.

## Global Constraints

- **DB inchangée** : aucune migration. `meal_type` est TEXT libre sans CHECK (vérifié `sql/meal_variants.sql`).
- **On NE refond PAS `page.tsx`** : le modèle `DietGroup` (tPlan/rPlan/trainingVariants/restVariants) reste. On touche `page.tsx` au minimum (affichage des labels de jour). Tout le travail « N jours » vit dans `MealEditor.tsx`.
- **Variantes de repas conservées** : `variant_label`/`variant_order` et leur logique ne changent pas de rôle.
- **Rétro-compatibilité totale** : diètes existantes (`training`/`rest`) affichent « Entraînement »/« Repos », éditeur ouvre les 2 onglets par défaut comme avant.
- **Cap 6 jours** par diète (applicatif, dans l'éditeur).
- **Noms 100 % libres** : le coach édite le `meal_type` de chaque onglet.
- Label d'affichage : `training`/`entrainement` → « Entraînement » ; `rest`/`repos` → « Repos » ; sinon la valeur `meal_type` telle quelle.
- Pas de `git push`, pas d'`eas update`, pas de merge sans validation explicite de Pierre. Commits locaux uniquement.

---

## Fichiers touchés

| Fichier | Responsabilité | Tâches |
|---------|----------------|--------|
| `ATHLETE/src/utils/nutrition.js` | `dayLabelFromMealType()` | T1 |
| `ATHLETE/src/hooks/useNutrition.js` | Grouper par `meal_type` → N onglets | T2 |
| `ATHLETE/src/screens/NutritionScreen.js` | Icône d'onglet robuste | T3 |
| `COACH/components/nutrition/MealEditor.tsx` | 2 onglets figés → liste dynamique (+, renommer, save par onglet) | T4→T6 |
| `COACH/app/(app)/athletes/[id]/nutrition/page.tsx` | Labels de jour libres à l'affichage (liste + détail) | T7 |

---

### Task 1: Helper de label de jour (ATHLETE)

**Files:**
- Modify: `ATHLETE/src/utils/nutrition.js` (ajouter un export en fin de fichier)

**Interfaces:**
- Produces: `export function dayLabelFromMealType(mealType): string`.

- [ ] **Step 1: Ajouter le helper**

À la fin de `ATHLETE/src/utils/nutrition.js` :

```js
// Label d'affichage d'un jour à partir de son meal_type (défauts training/rest → FR).
export function dayLabelFromMealType(mealType) {
  const m = (mealType || '').toLowerCase();
  if (m === 'training' || m === 'entrainement') return 'Entraînement';
  if (m === 'rest' || m === 'repos') return 'Repos';
  return mealType || 'Jour';
}
```

- [ ] **Step 2: Vérifier**

Run: `cd /Users/pierrerebmann/MOMENTUM/ATHLETE && node --check src/utils/nutrition.js`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git add src/utils/nutrition.js
git commit -m "feat(nutrition): helper dayLabelFromMealType"
```

---

### Task 2: Grouper par meal_type dans useNutrition (ATHLETE)

**Files:**
- Modify: `ATHLETE/src/hooks/useNutrition.js:1-90`

**Interfaces:**
- Consumes: `dayLabelFromMealType` (T1), `buildVariant` (existant).
- Produces: `fetchNutritionTabs` renvoie 1 onglet par `meal_type` distinct, forme inchangée `{ label, mealType, variants, plan, meals, macros }`.

- [ ] **Step 1: Import**

Ligne 4, remplacer par :

```js
import { parseMeals, calcDayMacros, dayLabelFromMealType } from '../utils/nutrition';
```

- [ ] **Step 2: Remplacer le corps 2-buckets**

Remplacer le bloc de `const trainingPlans = plans.filter(` (~ligne 41) jusqu'à juste avant `cacheData(...)` (~ligne 86) par :

```js
  // 1 onglet = 1 jour distinct (meal_type). Variantes de repas groupées dans chaque onglet.
  const byDay = new Map();
  for (const p of plans) {
    const key = p.meal_type || 'custom';
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(p);
  }
  const dayRank = (mealType) => {
    const m = (mealType || '').toLowerCase();
    if (m === 'training' || m === 'entrainement') return 0;
    if (m === 'rest' || m === 'repos') return 1;
    return 2;
  };
  const result = Array.from(byDay.entries())
    .map(([mealType, dayPlans]) => {
      const variants = dayPlans.map(buildVariant);
      const first = variants[0];
      return {
        label: dayLabelFromMealType(mealType),
        mealType,
        variants,
        plan: first.plan,
        meals: first.meals,
        macros: first.macros,
        _rank: dayRank(mealType),
        _order: Math.min(...dayPlans.map((p) => p.variant_order ?? 0)),
      };
    })
    .sort((a, b) => (a._rank - b._rank) || (a._order - b._order))
    .map(({ _rank, _order, ...tab }) => tab);
```

(`getActiveNutritionPlans` trie déjà par `variant_order` asc → `variants[0]` reste la 1re variante.)

- [ ] **Step 3: Vérifier**

Run: `cd /Users/pierrerebmann/MOMENTUM/ATHLETE && node --check src/hooks/useNutrition.js`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git add src/hooks/useNutrition.js
git commit -m "feat(nutrition): 1 onglet par meal_type côté athlète"
```

---

### Task 3: Icône d'onglet robuste (ATHLETE)

**Files:**
- Modify: `ATHLETE/src/screens/NutritionScreen.js:~589` (composant `DietPicker`)

- [ ] **Step 1: Icône sur mealType + fallback nom**

Remplacer la ligne `name={tab.label.toLowerCase().includes('repos') ? 'bed-outline' : 'barbell-outline'}` par :

```js
              name={(() => {
                const m = (tab.mealType || '').toLowerCase();
                const l = (tab.label || '').toLowerCase();
                if (m === 'rest' || m === 'repos' || l.includes('repos') || l.includes('off')) return 'bed-outline';
                return 'barbell-outline';
              })()}
```

- [ ] **Step 2: Vérifier**

Run: `cd /Users/pierrerebmann/MOMENTUM/ATHLETE && node --check src/screens/NutritionScreen.js`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git add src/screens/NutritionScreen.js
git commit -m "feat(nutrition): icône d'onglet robuste aux jours nommés"
```

---

### Task 4: MealEditor — modèle d'onglets dynamique (COACH)

Remplace la notion « onglet courant = training|rest » par une **liste d'onglets** `tabs[]`, sans encore changer l'UI ni la sauvegarde (juste la donnée + le rendu des boutons d'onglet). L'app reste identique pour une diète training/rest.

**Files:**
- Modify: `COACH/components/nutrition/MealEditor.tsx:48-63` (props), `:295-368` (state + switchMealType), `:940-955` (boutons d'onglet).

**Interfaces:**
- Produces: `type DayTab = { mealType: string; label: string }` ; state `tabs: DayTab[]`, `activeMealType: string` remplace `mealType` ; `tempMeals` reste keyé par `mealType` (string). Nouvelle prop optionnelle `initialTabs?: DayTab[]` et `initialTempMeals?: Record<string, { meals: MealData[]; macros?: {...} }>` pour charger N jours existants (utilisée en T7 ; défaut = training/rest).

- [ ] **Step 1: Helper de label + type DayTab (haut du fichier)**

Avant le composant (après les imports), ajouter :

```ts
export function editorDayLabel(mealType: string): string {
  const m = (mealType || '').toLowerCase()
  if (m === 'training' || m === 'entrainement') return 'Entraînement'
  if (m === 'rest' || m === 'repos') return 'Repos'
  return mealType || 'Jour'
}
type DayTab = { mealType: string; label: string }
const MAX_DAYS = 6
```

- [ ] **Step 2: Élargir les props**

Dans `MealEditorProps` (ligne ~48), changer `mealType: 'training' | 'rest'` en `mealType: string`, et `initialOtherTab?: { type: 'training' | 'rest'; ... }` en `type: string`. Ajouter :

```ts
  /** Onglets de jour initiaux (défaut : Entraînement + Repos). */
  initialTabs?: DayTab[]
  /** Contenu préchargé des onglets non-actifs, keyé par meal_type. */
  initialTempMeals?: Record<string, { meals: MealData[]; macros?: { calories: number; proteines: number; glucides: number; lipides: number } }>
```

- [ ] **Step 3: State tabs + activeMealType**

Ligne ~312, remplacer `const [mealType, setMealType] = useState<'training' | 'rest'>(initMealType)` par :

```ts
  const [tabs, setTabs] = useState<DayTab[]>(() =>
    initialTabs && initialTabs.length
      ? initialTabs
      : [{ mealType: 'training', label: 'Entraînement' }, { mealType: 'rest', label: 'Repos' }]
  )
  const [mealType, setMealType] = useState<string>(initMealType)
```

Ligne ~344, initialiser `tempMeals` depuis `initialTempMeals` si fourni :

```ts
  const [tempMeals, setTempMeals] = useState<Record<string, { meals: MealData[]; macros?: { calories: number; proteines: number; glucides: number; lipides: number } }>>(() => {
    if (initialTempMeals) return initialTempMeals
    if (initialOtherTab) return { [initialOtherTab.type]: { meals: initialOtherTab.meals, macros: initialOtherTab.macros } }
    return {}
  })
```

- [ ] **Step 4: Généraliser switchMealType**

Remplacer `function switchMealType(newType: 'training' | 'rest')` (ligne ~352) — le corps marche déjà avec un `newType` string ; changer seulement la signature en `function switchMealType(newType: string)`.

- [ ] **Step 5: Rendre les boutons d'onglet depuis tabs[]**

Boutons ON/OFF (lignes ~940-955), remplacer les 2 boutons codés en dur par :

```tsx
            {tabs.map((t) => (
              <button
                key={t.mealType}
                type="button"
                className={`athlete-tab-btn ${mealType === t.mealType ? 'active' : ''}`}
                onClick={() => switchMealType(t.mealType)}
              >
                {t.label}
              </button>
            ))}
```

- [ ] **Step 6: Vérifier**

Run: `cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit`
Expected: propre (les usages internes `mealType === 'training'` dans la sauvegarde restent valides tant que T5 n'est pas fait — ils comparent une string).

- [ ] **Step 7: Test manuel**

`npm run dev` → éditer une diète : 2 onglets Entraînement/Repos, bascule OK, sauvegarde inchangée.

- [ ] **Step 8: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git add components/nutrition/MealEditor.tsx
git commit -m "refactor(MealEditor): onglets de jour en liste dynamique (defaut training/rest)"
```

---

### Task 5: MealEditor — sauvegarde N onglets (COACH)

Remplace le save « onglet courant + other tab » par une **boucle sur tous les onglets** (`tempMeals` + onglet courant), une ligne `nutrition_plans` par onglet keyée par son `meal_type`.

**Files:**
- Modify: `COACH/components/nutrition/MealEditor.tsx:782-907` (branche ATHLETE du save)
- Modify: `COACH/components/nutrition/MealEditor.tsx:688-757` (branche TEMPLATE `diete` — sérialise tous les onglets)

**Interfaces:**
- Consumes: `tabs`, `tempMeals`, `mealType`, `meals`, `manualMacros`, `isMacroOnly`, `variantLabel`, `variantOrder`.

- [ ] **Step 1: Snapshot de l'onglet courant dans tempMeals avant save**

Au début du handler de save (avant la branche `templateMode`), figer l'onglet courant :

```ts
      const allTabsData: Record<string, { meals: MealData[]; macros: { calories: number; proteines: number; glucides: number; lipides: number } }> = {
        ...Object.fromEntries(Object.entries(tempMeals).map(([k, v]) => [k, { meals: v.meals, macros: v.macros || { calories: 0, proteines: 0, glucides: 0, lipides: 0 } }])),
        [mealType]: { meals, macros: manualMacros },
      }
```

- [ ] **Step 2: Branche ATHLETE — boucle sur les onglets**

Remplacer tout le bloc depuis la désactivation (`if (variantLabel) { await ... }`, ligne ~789) jusqu'à la fin du bloc `otherTemp` (ligne ~907) par une boucle. Pour chaque `[mt, data]` de `allTabsData` qui a du contenu (`hasFood` ou macro-only avec macros), désactiver l'ancienne version (même `meal_type = mt`, scoping `variant_label` identique à l'existant) puis insérer la nouvelle ligne avec `meal_type: mt`. Le corps de calcul des macros/serialization est identique à celui déjà présent pour `otherTemp` (le réutiliser tel quel dans la boucle).

```ts
        const today2 = new Date().toISOString().split('T')[0]
        for (const [mt, data] of Object.entries(allTabsData)) {
          const isCurrent = mt === mealType
          const tabMeals = data.meals
          const tabMacros = data.macros
          const hasFood = tabMeals.some((m) => getMealFoods(m).length > 0)
          const hasMacros = !!(tabMacros.calories || tabMacros.proteines || tabMacros.glucides || tabMacros.lipides)
          if (!hasFood && !(isMacroOnly && hasMacros)) continue

          // Désactiver l'ancienne version de ce jour (même scoping variant_label qu'avant).
          if (variantLabel) {
            await supabase.from('nutrition_plans').update({ actif: false })
              .eq('athlete_id', athleteId).eq('meal_type', mt).eq('nom', planName.trim()).eq('variant_label', variantLabel)
          } else {
            await supabase.from('nutrition_plans').update({ actif: false })
              .eq('athlete_id', athleteId).eq('meal_type', mt).is('variant_label', null)
          }

          const withFresh: MealData[] = tabMeals.map((m) => hasVariants(m)
            ? { ...m, variants: m.variants!.map((v) => ({ ...v, foods: v.foods.map((f) => ({ ...f, ...calcFoodMacros(f), allow_conversion: f.allow_conversion || false })) })) }
            : { ...m, foods: (m.foods ?? []).map((f) => ({ ...f, ...calcFoodMacros(f), allow_conversion: f.allow_conversion || false })) })
          const mealsPayload = isMacroOnly ? [] : serializeMealsForSave(withFresh)
          let cal = 0, p = 0, g = 0, l = 0
          if (isMacroOnly) { cal = tabMacros.calories; p = tabMacros.proteines; g = tabMacros.glucides; l = tabMacros.lipides }
          else {
            const t = withFresh.reduce((acc, m) => { const x = calcMealTotals(getMealFoods(m)); return { kcal: acc.kcal + x.kcal, p: acc.p + x.p, g: acc.g + x.g, l: acc.l + x.l } }, { kcal: 0, p: 0, g: 0, l: 0 })
            cal = Math.round(t.kcal); p = Math.round(t.p); g = Math.round(t.g); l = Math.round(t.l)
          }
          await supabase.from('nutrition_plans').insert({
            nom: planName.trim(), meal_type: mt, meals_data: JSON.stringify(mealsPayload),
            calories_objectif: cal, proteines: p, glucides: g, lipides: l,
            valid_from: today2, actif: true, athlete_id: athleteId, coach_id: user.id,
            macro_only: isMacroOnly || false, variant_label: variantLabel ?? null, variant_order: variantOrder ?? 0,
          })
        }
```

Supprimer l'ancien `payload` de l'onglet courant + son insert (ligne ~806-824) et tout le bloc `otherTemp` (remplacés par la boucle). Garder la notification athlète (ligne ~909) après la boucle.

- [ ] **Step 3: Branche TEMPLATE diete — sérialiser tous les onglets**

Dans `if (templateType === 'diete')` (ligne ~688), remplacer la construction `{ [mealType]: currentTab, [otherType]: otherTab }` par un objet contenant **un jour par onglet** de `allTabsData` (même format `{ meals, macros, macro_only }` par clé `meal_type`). Les colonnes résumé du template gardent le jour `training` s'il existe, sinon le 1er onglet.

- [ ] **Step 4: Vérifier + grep résidus**

Run: `cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit`
Run: `grep -n "otherType\|otherTemp" components/nutrition/MealEditor.tsx`
Expected: tsc propre ; `otherType`/`otherTemp` supprimés de la branche ATHLETE (peuvent rester dans TEMPLATE si non refait — mais Step 3 les retire aussi ; viser 0).

- [ ] **Step 5: Test manuel de non-régression**

`npm run dev` → éditer une diète training+rest : remplir les 2 onglets, enregistrer → 2 lignes créées, athlète voit les 2 jours. Éditer une diète macro-only : OK. Éditer avec variantes de repas : variantes préservées.

- [ ] **Step 6: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git add components/nutrition/MealEditor.tsx
git commit -m "refactor(MealEditor): sauvegarde d'une ligne par onglet de jour"
```

---

### Task 6: MealEditor — bouton « + », renommer, retirer un jour (COACH)

Ajoute l'UI de gestion des onglets : « + » (max 6), renommage inline du `meal_type`, retrait d'un onglet ajouté. C'est le cœur visible de la feature.

**Files:**
- Modify: `COACH/components/nutrition/MealEditor.tsx` — barre d'onglets (T4 Step 5) + handlers.

**Interfaces:**
- Consumes: `tabs`, `setTabs`, `tempMeals`, `setTempMeals`, `mealType`, `switchMealType`, `MAX_DAYS`.

- [ ] **Step 1: Handler addTab**

```ts
  function addTab() {
    if (tabs.length >= MAX_DAYS) { toast('Maximum 6 jours', 'error'); return }
    const name = prompt('Nom du jour', `Jour ${tabs.length + 1}`)?.trim()
    if (!name) return
    if (tabs.some((t) => t.mealType.toLowerCase() === name.toLowerCase())) { toast('Ce nom existe déjà', 'error'); return }
    // Snapshot onglet courant, crée l'onglet vide, bascule dessus.
    setTempMeals((prev) => ({ ...prev, [mealType]: { meals: [...meals], macros: { ...manualMacros } } }))
    setTabs((prev) => [...prev, { mealType: name, label: name }])
    setMeals([{ foods: [] }])
    setManualMacros({ calories: 0, proteines: 0, glucides: 0, lipides: 0 })
    setActiveMealIdx(0)
    setMealType(name)
  }
```

- [ ] **Step 2: Handler renameTab (met à jour tabs + tempMeals + activeMealType)**

```ts
  function renameTab(oldType: string) {
    const next = prompt('Nom du jour', oldType)?.trim()
    if (!next || next === oldType) return
    if (tabs.some((t) => t.mealType.toLowerCase() === next.toLowerCase())) { toast('Ce nom existe déjà', 'error'); return }
    setTabs((prev) => prev.map((t) => t.mealType === oldType ? { mealType: next, label: next } : t))
    setTempMeals((prev) => {
      if (!(oldType in prev)) return prev
      const { [oldType]: moved, ...rest } = prev
      return { ...rest, [next]: moved }
    })
    if (mealType === oldType) setMealType(next)
  }
```

Note : au save (T5), la ligne est créée avec le nouveau `meal_type`. L'ancienne (`oldType`) reste `actif` en base tant qu'elle n'est pas désactivée. Pour un vrai renommage persistant, ajouter dans le save : après la boucle, désactiver les lignes dont le `meal_type` n'est plus dans `tabs` pour cette diète — voir Step 4.

- [ ] **Step 3: Handler removeTab (onglets ajoutés uniquement, pas les 2 defaults)**

```ts
  function removeTab(mt: string) {
    if (tabs.length <= 1) return
    if (!confirm(`Retirer le jour "${editorDayLabel(mt)}" ?`)) return
    setTabs((prev) => prev.filter((t) => t.mealType !== mt))
    setTempMeals((prev) => { const { [mt]: _drop, ...rest } = prev; return rest })
    if (mealType === mt) {
      const fallback = tabs.find((t) => t.mealType !== mt)!
      switchMealType(fallback.mealType)
    }
  }
```

- [ ] **Step 4: Nettoyage des jours renommés/retirés au save**

Dans le save ATHLETE (T5), après la boucle d'insert, désactiver les lignes orphelines (jours plus présents dans `tabs`) :

```ts
        const keepTypes = tabs.map((t) => t.mealType)
        if (keepTypes.length) {
          const q = supabase.from('nutrition_plans').update({ actif: false })
            .eq('athlete_id', athleteId).eq('nom', planName.trim()).not('meal_type', 'in', `(${keepTypes.map((t) => `"${t.replace(/"/g, '')}"`).join(',')})`)
          if (variantLabel) { await q.eq('variant_label', variantLabel) } else { await q.is('variant_label', null) }
        }
```

(Désactive l'ancien nom après renommage et les jours retirés — ils disparaissent côté athlète.)

- [ ] **Step 5: UI — crayon/croix par onglet + bouton +**

Enrichir la barre d'onglets (T4 Step 5). Chaque onglet gagne un mini bouton renommer ; les onglets au-delà des 2 premiers gagnent une croix ; un bouton « + » à la fin :

```tsx
            {tabs.map((t, i) => (
              <span key={t.mealType} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <button type="button" className={`athlete-tab-btn ${mealType === t.mealType ? 'active' : ''}`} onClick={() => switchMealType(t.mealType)}>{t.label}</button>
                <button type="button" title="Renommer" onClick={() => renameTab(t.mealType)}>&#9998;</button>
                {i >= 2 && <button type="button" title="Retirer" onClick={() => removeTab(t.mealType)}>&#10005;</button>}
              </span>
            ))}
            {tabs.length < MAX_DAYS && (
              <button type="button" title="Ajouter un jour" onClick={addTab}>+ Jour</button>
            )}
```

- [ ] **Step 6: Vérifier**

Run: `cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit`
Expected: propre.

- [ ] **Step 7: Test manuel — cœur de la feature**

`npm run dev` → éditer une diète :
1. « + Jour » → « Push » → onglet ajouté, éditable, enregistré → athlète voit « Push ».
2. Ajouter jusqu'à 6 → « + » disparaît au 6ᵉ.
3. Renommer « Entraînement » → « Jour A » → après save, l'ancien disparaît, « Jour A » apparaît côté athlète.
4. Retirer un jour ajouté → disparaît après save.
5. Variantes de repas d'un jour : toujours fonctionnelles.

- [ ] **Step 8: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git add components/nutrition/MealEditor.tsx
git commit -m "feat(MealEditor): ajouter/renommer/retirer des jours de diète (max 6)"
```

---

### Task 7: Labels de jour libres à l'affichage (COACH page.tsx)

Aujourd'hui la liste et le détail affichent « Entraînement »/« Repos » en dur et n'ouvrent que 2 jours. Rendre l'affichage tolérant aux `meal_type` libres **sans refondre `DietGroup`** : passer les jours existants à l'éditeur, et afficher leurs vrais noms.

**Files:**
- Modify: `COACH/app/(app)/athletes/[id]/nutrition/page.tsx` — `editDiet` (charge tous les jours → `initialTabs`/`initialTempMeals`), rendu liste/détail (labels).

**Interfaces:**
- Consumes: `editorDayLabel` (export de MealEditor, T4) ; props `initialTabs`/`initialTempMeals` de `<MealEditor>` (T4).

- [ ] **Step 1: Importer editorDayLabel**

Ligne ~14 : `import MealEditorDefault, { type MealData, editorDayLabel } from '@/components/nutrition/MealEditor'` (adapter à l'import dynamique existant : ajouter `import { editorDayLabel } from '@/components/nutrition/MealEditor'`).

- [ ] **Step 2: editDiet charge TOUS les jours de la diète**

Dans `editDiet` (ligne ~775), au lieu de ne résoudre que tPlan/rPlan, charger toutes les lignes actives de la diète (par `nom`), construire `initialTabs` = 1 onglet par `meal_type` distinct (tri training/rest d'abord) et `initialTempMeals` = contenu de chaque onglet non-primaire. Passer le 1er onglet comme `editMealType`/`editMeals`/`editMacros`. Stocker `initialTabs`/`initialTempMeals` dans des states `editTabs`/`editTempMeals`.

```ts
  const [editTabs, setEditTabs] = useState<{ mealType: string; label: string }[] | undefined>(undefined)
  const [editTempMeals, setEditTempMeals] = useState<Record<string, { meals: MealData[]; macros?: { calories: number; proteines: number; glucides: number; lipides: number } }> | undefined>(undefined)
```

Dans `editDiet`, après avoir chargé `loadedPlans` (toutes les lignes actives de la diète, pas seulement t/r) :

```ts
    const byType = new Map<string, NutritionPlan>()
    for (const p of loadedPlans as NutritionPlan[]) if (!byType.has(p.meal_type)) byType.set(p.meal_type, p)
    const rankT = (mt: string) => { const m = mt.toLowerCase(); return m === 'training' || m === 'entrainement' ? 0 : (m === 'rest' || m === 'repos' ? 1 : 2) }
    const ordered = Array.from(byType.values()).sort((a, b) => rankT(a.meal_type) - rankT(b.meal_type))
    const tabs = ordered.map((p) => ({ mealType: p.meal_type, label: editorDayLabel(p.meal_type) }))
    const primary = ordered[0]
    const temp: Record<string, { meals: MealData[]; macros: { calories: number; proteines: number; glucides: number; lipides: number } }> = {}
    for (const p of ordered.slice(1)) temp[p.meal_type] = { meals: parseMealsData(p), macros: { calories: p.calories_objectif || 0, proteines: p.proteines || 0, glucides: p.glucides || 0, lipides: p.lipides || 0 } }
    setEditTabs(tabs)
    setEditTempMeals(temp)
    setEditPlanId(primary.id)
    setEditPlanName(primary.nom || '')
    setEditMealType(primary.meal_type)
    setEditMeals(parseMealsData(primary))
    setEditMacroOnly(primary.macro_only === true)
    setEditMacros({ calories: primary.calories_objectif || 0, proteines: primary.proteines || 0, glucides: primary.glucides || 0, lipides: primary.lipides || 0 })
    setEditVariantLabel((primary as any).variant_label ?? null)
    setEditVariantOrder((primary as any).variant_order ?? 0)
    setEditOtherTab(null)
    setView('editor')
```

(La requête de `editDiet` doit charger toutes les lignes de la diète : filtrer par `nom` de la diète au lieu de charger seulement 2 ids. Adapter le `.in('id', idsToLoad)` en `.eq('nom', dietName).eq('athlete_id', athleteId).eq('actif', true)`.)

- [ ] **Step 3: Passer les nouvelles props à MealEditor**

Ligne ~983, ajouter : `initialTabs={editTabs}` et `initialTempMeals={editTempMeals}`.

- [ ] **Step 4: Labels libres dans liste + détail**

Partout où le JSX affiche « Entraînement »/« Repos » en dur pour un plan, remplacer par `editorDayLabel(plan.meal_type)`. Dans la vue détail, les 2 onglets training/rest peuvent rester (ils reflètent tPlan/rPlan) mais leurs labels passent par `editorDayLabel`. Les jours supplémentaires sont visibles/éditables via l'éditeur (ouverture par « Modifier ») ; le détail lecture-seule des jours+ n'est pas requis pour cette version légère.

- [ ] **Step 5: Vérifier**

Run: `cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit`
Expected: propre.

- [ ] **Step 6: Test manuel bout-en-bout**

`npm run dev` → créer une diète, ajouter « Push » et « Jour B », renommer « Repos » → « OFF », enregistrer. Rouvrir « Modifier » → les 4 onglets se rechargent avec leur contenu. Athlète (Expo Go) : 4 onglets dans le bon ordre, bons noms, variantes OK, diète legacy intacte.

- [ ] **Step 7: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git add "app/(app)/athletes/[id]/nutrition/page.tsx"
git commit -m "feat(nutrition): éditeur recharge N jours + labels de jour libres"
```

---

## Vérification finale (avant toute demande de déploiement)

- [ ] `cd ATHLETE && node --check src/hooks/useNutrition.js src/screens/NutritionScreen.js src/utils/nutrition.js` → exit 0.
- [ ] `cd COACH && npx tsc --noEmit` → propre.
- [ ] COACH : créer/renommer/retirer jusqu'à 6 jours dans l'éditeur, cap à 6 respecté, rechargement à la réédition, variantes de repas OK.
- [ ] ATHLETE (Expo Go) : N onglets de jour, bons noms/ordre, variantes pickables, diète legacy training/rest intacte.
- [ ] Mettre à jour `ATHLETE/ARCHITECTURE.md` / `COACH/ARCHITECTURE.md` si le modèle nutrition y est décrit (jour = `meal_type` libre, éditeur N onglets).
- [ ] **NE PAS** `git push`, `eas update`, ni merge sans validation explicite de Pierre.
```

