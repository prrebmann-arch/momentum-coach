# Améliorations COACH nutrition : vue détail N jours, duplication, UI onglets, calculateur de cycle

**Date :** 2026-08-01
**Repo :** COACH uniquement. Fichiers : `app/(app)/athletes/[id]/nutrition/page.tsx`, `components/nutrition/MealEditor.tsx`, `styles/nutrition.module.css`, + 1 migration SQL.

## Contexte

La feature « jours de diète nommés » (max 6, `meal_type` = nom libre) a été livrée : l'ÉDITEUR gère déjà N onglets de jour dynamiques. Mais 3 zones sont restées incomplètes ou perfectibles, et une nouvelle feature est demandée. Une diète = plusieurs lignes `nutrition_plans` partageant le même `nom` ; chaque ligne a un `meal_type` (nom du jour) + éventuellement des variantes de repas (`variant_label`).

## Améliorations

### 1. Vue détail : afficher tous les jours (bug)

**Problème :** la vue détail (`view === 'detail'`, visualisation sans édition) est figée sur 2 onglets codés en dur « Jour ON » (training) / « Jour OFF » (rest), lignes ~1035-1048 de `page.tsx`. Les jours nommés (Poule, etc.) n'apparaissent pas.

**Fix :** généraliser comme l'éditeur — un onglet par `meal_type` distinct, avec le vrai label via `editorDayLabel(mealType)`. `detailDiet` passe d'une forme `{ tPlan, rPlan, trainingVariants, restVariants }` à une forme `{ name, days: DetailDay[] }` où `DetailDay = { mealType, label, variants, plan }`. Les variantes de repas par jour (`DayVariantTabs`) restent affichées pour le jour sélectionné. `detailType: 'training'|'rest'` devient `detailDayType: string` (le meal_type sélectionné).

### 2. Dupliquer un jour entier (éditeur)

**Besoin :** copier un jour complet (tous ses repas) pour en faire un nouveau, au lieu de copier repas par repas.

**Solution :** dans la barre d'onglets de `MealEditor`, un bouton **« Dupliquer »** sur le jour actif. Il crée un nouvel onglet dont le `meal_type` = `${nom} (copie)` (dédupliqué si déjà pris) et dont le contenu (`meals` + `macros`) est une copie profonde du jour courant. L'utilisateur renomme ensuite via le crayon existant. Réutilise la mécanique `tabs`/`tempMeals`/`switchMealType` déjà en place (T4-T6 de la feature précédente). Respecte le cap `MAX_DAYS = 6`.

### 3. UI des onglets de jour plus soignée (éditeur)

**Problème :** les onglets de jour + boutons crayon/croix + « + Jour » sont bruts et peu lisibles.

**Solution :** styliser dans `nutrition.module.css` (style COACH existant, variables CSS `--primary`, `--bg2/3`, `--border-subtle`) :
- chaque jour = une pill arrondie ; jour actif surligné (`--primary`).
- bouton renommer (crayon) discret à droite du label, visible sur le jour actif.
- bouton retirer (croix) uniquement sur les jours au-delà des 2 premiers (règle existante conservée).
- « + Jour » et « Dupliquer » = boutons propres (pill pointillée / icône), alignés dans la même barre.
Aucune logique changée — uniquement le rendu (classes CSS au lieu des styles inline actuels).

### 4. Calculateur de moyennes de cycle (vue détail + éditeur)

**Besoin :** connaître les moyennes kcal/P/G/L sur un cycle où chaque jour de diète revient N fois (ex : cycle 7j = 3 Entraînement + 3 Repos + 1 Poule).

**Emplacement :** sous le résumé macro (les 4 cases kcal/P/G/L), à la fois en vue détail (~ligne 1098) et dans l'éditeur.

**Fonctionnement :**
- Un champ numérique « ×N » par jour de la diète (nombre de fois par cycle). **Défaut : 0 / vide** — aucune moyenne affichée tant que rien n'est saisi.
- Longueur du cycle = Σ N (affichée, non saisie).
- Sorties = moyennes pondérées : `moyenne_macro = Σ(macro_du_jour × N_du_jour) / Σ(N)`. Calculé pour kcal, protéines, glucides, lipides. Si Σ(N) = 0 → afficher un état neutre (« Réglez la répartition »).
- Le `macro_du_jour` = les totaux de la variante active/première de ce jour (mêmes valeurs que le résumé macro).

**Persistance (par diète) :**
- Migration SQL : `ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS cycle_days JSONB;` (idempotente).
- Format : `{ "<meal_type>": <n>, ... }` ex `{"training":3,"rest":3,"Poule":1}`.
- Écrit sur **toutes** les lignes actives de la diète (même `nom`) à la sauvegarde, pour survivre indépendamment de quelle ligne est lue. Au chargement, on lit le `cycle_days` de n'importe quelle ligne de la diète (elles sont identiques).
- Migration non appliquée par MCP (non connecté) → fichier `sql/add_cycle_days.sql` fourni, Pierre le lance dans Supabase SQL Editor. Le code doit dégrader proprement si la colonne n'existe pas encore (try/catch, cycle_days optionnel).

## Hors périmètre
- Pas de refonte du modèle DietGroup (on garde l'approche légère : `nom` groupe la diète).
- Pas de calendrier jour-par-jour (répartition = compteurs par type, décidé au brainstorming).
- ATHLETE non touché (feature coach-only).

## Vérification
- Vue détail : une diète training + rest + « Poule » montre 3 onglets avec les bons noms ; bascule OK ; variantes de repas préservées.
- Duplication : dupliquer « Entraînement » crée « Entraînement (copie) » avec les mêmes repas, éditable/renommable, bloqué à 6 jours.
- UI : onglets lisibles, cohérents avec le style COACH.
- Calculateur : régler 3/3/1 sur un cycle 7j affiche les bonnes moyennes pondérées ; se sauvegarde et se recharge ; état neutre si non réglé ; dégrade sans la colonne.
- `npx tsc --noEmit` propre sur les fichiers touchés (repo a des erreurs pré-existantes non liées).
