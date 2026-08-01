# Pages de colonnes dans le tableau bilans (infos custom + builtin orphelines)

**Date** : 2026-07-24 · **Statut** : validé Pierre · **Périmètre** : COACH front, `BilanAccordion.tsx`

## Problème

Le tableau des bilans a des colonnes hardcodées (poids, adhérence, plaisir, cardio,
courbatures, stress, énergie, maladie, sommeil, nuit). Toutes les autres questions
du template de l'athlète — **builtin orphelines** (ex `sleep_efficiency`) **et
custom** (récup, perf subjective, photos/vidéos…) — ne sont visibles nulle part ou
mal (pastille + détail déplié "horriblement fait"). Ça varie par athlète.

## Vision validée

Le tableau garde ses **lignes de jours identiques**. Un contrôle **‹ Page X/N ›**
en haut de la page fait défiler des **pages de colonnes** :
- **Page 1** : colonnes fixes actuelles (inchangées). Y compris moyennes semaine.
- **Pages 2+** : les questions du template **sans colonne en page 1**, ~6 par page,
  **dédupliquées** (une question déjà en page 1 n'est pas répétée).
- Dynamique par athlète : 0 question orpheline → pas de flèches. N questions → pages calculées.
- La bascule s'applique à **tous les blocs-semaine d'un coup** (état global).

### Colonnes déjà en page 1 (à exclure des pages 2+)

`weight, adherence, session_enjoyment, cardio_minutes, soreness, stress, energy,
sick_signs, sleep_quality, bedtime, wakeup` (+ perf/séances qui sont dérivés, pas
des questions). Les notes `positive_week/negative_week/general_notes` restent dans
le bloc-semaine → **exclues des pages** aussi. Les mensurations
`belly/hip/thigh_measurement` et `photo_front/side/back` builtin restent gérées par
leur UI dédiée (détail mensurations + bouton photo) → **exclues des pages**.

Donc pages 2+ = questions du template dont le champ/clé n'est pas dans cet ensemble
d'exclusion. Concrètement : `sleep_efficiency` (builtin orpheline) + toutes les
questions `type: 'custom'`.

### Rendu des cellules (pages 2+)

Valeur lue dans `b.custom_data[key]` (custom) ou `b[field]` (builtin orpheline) :
- `slider_1_10` / `number` → valeur (ex `8`, avec unit si dispo).
- `boolean` → Oui / Non.
- `single_choice` → la valeur ; `multiple_choice` → joint par `, `.
- `text_short` / `text_long` → texte tronqué (1 ligne), `title` = texte complet.
- `photo` / `video` → **vignette cliquable** (réutilise `CustomMediaAnswer` déjà
  présent dans BilanAccordion) ; clic → média en grand.
- `time` → l'heure.

### En-tête et navigation

- Un `<div>` de contrôle au-dessus des blocs-semaine :
  `‹  [Label de la page]  ›  (Page i/N)`. Page 1 label = « Mesures ».
  Pages 2+ label = « Suivi perso » (ou n° de page). Flèches désactivées aux bornes.
- `columnPage` = state dans `BilanAccordion` (0 = base). Passé à chaque rendu de
  tableau-semaine et de ligne-jour.

## Architecture

- Tout dans `components/bilans/BilanAccordion.tsx` :
  - Nouveau helper `buildColumnPages(templateQuestions): ColumnDef[][]` — page 0 =
    marqueur "base", pages suivantes = groupes de `ColumnDef` (≤6).
  - `ColumnDef = { key: string; label: string; input_type: string; unit?: string; source: 'custom' | 'builtin' }`.
  - État `columnPage` + contrôle nav.
  - Le header de tableau (`dayHdr`) et chaque `dayRow` rendent soit les colonnes
    fixes (page 0), soit les `ColumnDef` de la page courante (grid-template-columns
    dynamique en style inline selon le nb de colonnes).
  - Rendu d'une cellule custom : fonction `renderCustomCell(bilan, colDef)`.
- Suppression de la pastille 📎 et du bloc « Réponses personnalisées » du détail
  déplié (remplacés par les pages). Le reste du détail (mensurations, photos
  builtin, pas) reste.

## Contraintes

- Zéro DB, zéro migration, zéro impact ATHLETE.
- `templateQuestions` est déjà chargé et passé en prop (fix récent : agrège
  quotidien+complet, dédup par key).
- Hooks avant early-return ; pas de deps d'objets.
- `npm run build` OK.

## Hors périmètre

- Les moyennes de semaine restent affichées uniquement en page 1 (les pages custom
  n'ont pas de ligne de moyenne — juste les valeurs par jour).
- Export, tri, édition inline.

## Vérification

Manuel : athlète avec questions custom (compte review) → flèches présentes,
page 2 montre récup/perf/etc. par jour ; athlète sans custom → pas de flèches ;
photo custom → vignette cliquable ; `sleep_efficiency` (si dans le template)
apparaît en page 2. `npm run build` OK.
