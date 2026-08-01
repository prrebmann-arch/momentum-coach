# Refonte module Complément — drag & drop sur la diète

**Date** : 2026-07-22 · **Statut** : validé par Pierre · **Périmètre** : COACH uniquement

## Problème

Assigner des compléments à un athlète passe aujourd'hui par un formulaire lourd
(`MomentPicker` : catégorie → select repas → select timing, une ligne à la fois).
Placer un complément « avant R1 » ou « une fois le matin + une fois le soir »
demande trop de clics et n'est pas visuel.

## Vision validée

L'onglet **Complément** de `/athletes/[id]/supplements` devient une vue
drag-and-drop construite sur la diète. L'onglet **Supplémentation** ne change pas.

### 1. Vue principale (colonne gauche — timeline de la journée)

- **Sans diète training active** : EmptyState « Mets d'abord une diète en place
  pour construire le protocole » + lien vers l'onglet Nutrition. Rien d'autre.
- **Avec diète** : zones de drop empilées verticalement :
  - **À jeun** (haut)
  - **Un bloc par repas de la diète** (nom + heure issus de `meals_data` du plan
    training actif) avec **3 bandes de drop : Avant / Pendant / Après**
  - **Training** : 3 bandes Pré / Intra / Post
  - **Coucher** (bas)
- Les assignations existantes s'affichent placées à leur `moment_prise`.
  Les moments legacy texte libre non parsables → section **« À replacer »**
  en bas, puces draggables vers les zones.

### 2. Librairie (colonne droite, sticky)

- Grille de **carrés** : nom au-dessus, **dosage + unité éditables directement
  sur le carré** (pré-remplis avec le dernier dosage utilisé pour ce complément,
  calculé depuis la dernière ligne `athlete_supplements` — pas de migration),
  badge marque.
- **ⓘ ou double-clic** → panneau détail (marque, lien d'achat, fréquence,
  intervalle, notes, concentration).
- Carte **« + Nouveau »** → mini-form (nom, dosage, unité) → crée dans le
  catalogue coach.
- **Source** : catalogue global du coach = table `supplements` type
  `'complement'`, dédupliqué par nom. Le carré reste après un drop
  (multi-prises = plusieurs drops du même carré).

### 3. Interactions puces déposées

- **Drop** = INSERT `athlete_supplements` (`moment_prise` = zone,
  `dosage`/`unite` = valeurs du carré, `frequence` = `'1x/jour'`, `actif` = true,
  `start_date` = today).
- **Clic** sur la puce = popover édition (dosage, unité, notes).
- **X** = désactivation propre : `actif = false` + `end_date = today`
  (préserve l'historique athlète).
- **Drag zone → zone** = UPDATE `moment_prise`.

### 4. Templates

- Bouton « Depuis un template » conservé tel quel : applique le pack → crée les
  lignes avec leurs `moment_prise` → les puces apparaissent automatiquement aux
  bons moments. Un item multi-prises = plusieurs puces.

## Contraintes / invariants

- **Aucun changement de schéma DB.** Mêmes tables (`supplements`,
  `athlete_supplements`), mêmes colonnes, même format `moment_prise`
  (`R{n}_avant|pendant|apres`, `a_jeun`, `coucher`,
  `pre_training|intra_training|post_training`).
- **Aucun changement côté app ATHLETE** — vérifié :
  `ATHLETE/src/screens/NutritionScreen.js` (`groupSupplements`) parse déjà tous
  ces formats et a un fallback « Autre ».
- L'onglet Supplémentation (fréquences, cycles, historique) : intouché.
- DnD : **@dnd-kit** (déjà en dépendance, pattern existant dans
  `components/bilans/BilanTemplateEditor.tsx`).
- Toute mutation Supabase lit `error` + toast (règle lessons).

## Architecture cible

- `app/(app)/athletes/[id]/supplements/page.tsx` : garde les onglets + tout le
  volet supplémentation ; le volet complément est remplacé par le nouveau
  composant.
- Nouveau `components/supplements/ComplementBoard.tsx` : DndContext, zones,
  timeline (données diète en props).
- Nouveau `components/supplements/ComplementLibrary.tsx` : grille de carrés +
  carte « + Nouveau » + panneau détail.
- Nouveau `components/supplements/ComplementChip.tsx` : puce déposée
  (dosage, popover, X).
- La récupération de la diète (plan training actif → `meals_data` → repas
  avec label/heure) réutilise la logique déjà présente dans la page
  (fetch léger existant, étendu pour récupérer labels + heures des repas,
  pas seulement le count).

## Hors périmètre

- Onglet Supplémentation, app ATHLETE, schéma DB, templates (éditeur).
- Réordonner les puces à l'intérieur d'une même bande (pas de sort_order).

## Vérification

- `npm run build` OK.
- Manuel : athlète sans diète → message ; avec diète → drop dans chaque type de
  zone, multi-drop du même carré, déplacement de zone, X, édition dosage,
  application d'un template → puces placées ; app ATHLETE (préexistante) affiche
  les prises aux bons repas.
