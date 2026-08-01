# Jours de diète nommés librement (jusqu'à 6) — Design

**Date :** 2026-07-30
**Repos touchés :** COACH (web) + ATHLETE (mobile). DB inchangée.

## Problème

Aujourd'hui, une diète ne peut avoir que **2 types de jour** figés : Entraînement (`meal_type = 'training'`)
et Repos (`meal_type = 'rest'`). Le coach ne peut pas créer un troisième jour distinct (ex : un jour
« Push » avec sa propre diète, un « Jour OFF », un « Jour A »).

Le besoin : lever ce carcan pour permettre **jusqu'à 6 jours de diète distincts**, chacun avec un
**nom 100 % libre** choisi par le coach.

## Ce qui NE change PAS (explicitement hors périmètre)

- **Les variantes de repas restent intactes.** `variant_label` + `variant_order` continuent de servir
  exactement à leur usage actuel : regrouper plusieurs lignes du **même** `meal_type` en variantes que
  l'athlète picke (ex : pour le jour Push, une variante « repas poisson » vs « repas viande »). On n'y
  touche pas. Toute la logique d'appairage / de sélection de variante côté coach ET athlète est conservée.
- Le stockage des repas dans `meals_data` (JSON), les macros, les logs, le cache offline.
- Le schéma DB : aucune migration. Les colonnes nécessaires existent déjà.

## Modèle de données

Une ligne `nutrition_plans` = **un jour de diète** (comme aujourd'hui). Deux axes coexistent :

| Axe | Colonne | Rôle |
|-----|---------|------|
| **Jour** (nouveau besoin) | `meal_type` (TEXT libre, **sans contrainte CHECK** — vérifié) | Nom libre du jour. Défauts : `training`, `rest`. Renommer = update `meal_type`. |
| **Variantes de repas** (existant, conservé) | `variant_label` + `variant_order` | Regroupe plusieurs lignes du même `meal_type` en variantes pickables. Inchangé. |

- `training` / `rest` restent les valeurs par défaut → **rétro-compatibilité totale**, les diètes
  existantes ne bougent pas.
- Cap **applicatif** à 6 jours par athlète (pas de contrainte DB) : l'UI coach bloque l'ajout au-delà.
- Ordre des jours : réutilise l'ordre trié `variant_order` déjà en place ; les jours sont regroupés par
  `meal_type` puis affichés dans l'ordre de première apparition / `variant_order`.

## Composants à modifier

### 1. `ATHLETE/src/hooks/useNutrition.js`
Aujourd'hui : filtre en dur `training`/`rest` → au max 2 buckets (`fetchNutritionTabs`).
Après : **grouper les plans par `meal_type`** → 1 onglet par jour distinct (jusqu'à 6). Chaque onglet
conserve son tableau `variants` construit comme aujourd'hui (`buildVariant`). Label d'affichage :
`training` → « Entraînement », `rest` → « Repos », sinon le `meal_type` libre tel quel.
La forme de sortie (`tabs[]` avec `{ label, mealType, variants, plan, meals, macros }`) reste identique →
le reste de l'écran et le cache offline restent compatibles.

### 2. `ATHLETE/src/screens/NutritionScreen.js`
Quasi rien. `DietPicker` fait déjà `.map()` sur `tabs` → il affichera N jours. Ajuster l'icône d'onglet :
« bed-outline » si le nom contient « repos », sinon « barbell-outline » (fallback propre). La mécanique de
sélection de jour (`selectedTabIndex`) et de variante (`activeVariant`, `needsDayVariantPick`) est déjà
paramétrée sur `tabs[]`/`variants[]` → aucun changement.

### 3. `COACH/app/(app)/athletes/[id]/nutrition/page.tsx`
Passer des 2 blocs figés (Entraînement / Repos) à une **liste de jours (max 6)** :
- Nom de jour **éditable inline** → update `meal_type` sur les lignes du jour. Les 2 défauts affichent
  « Entraînement »/« Repos » tant que `meal_type` vaut `training`/`rest`, éditables comme les autres.
- Bouton **« + Ajouter un jour »**, désactivé à 6 jours. Crée une ligne avec `meal_type` = nom saisi
  (défaut « Jour X »).
- **Réordonnancement** des jours par flèches ↑↓ (pas de drag&drop — YAGNI), reflété chez l'athlète.
- **Toute la logique de variantes de repas est conservée** (pairing, `variant_label`, sélection).

## Rétro-compatibilité & risques

- Diètes existantes (`training`/`rest`) : affichées « Entraînement »/« Repos » sans intervention.
- Cache offline (`nutrition_${athleteId}`) : forme des tabs inchangée.
- À valider au moment du plan : cohérence du tri des jours COACH ↔ ATHLETE (même clé d'ordre) ; s'assurer
  que renommer un `meal_type` ne casse pas l'appairage de variantes existant (les variantes d'un même jour
  partagent le même `meal_type`, donc restent groupées après renommage).

## Vérification

- Coach : créer 6 jours nommés librement, en renommer, réordonner, ajouter des variantes de repas dans un
  jour → l'athlète voit 6 onglets dans l'ordre, avec les bons noms et les variantes pickables.
- Athlète : diète legacy (training/rest) s'affiche toujours correctement (rétro-compat).
- Le bouton « + Ajouter un jour » se désactive au 6ᵉ jour.
