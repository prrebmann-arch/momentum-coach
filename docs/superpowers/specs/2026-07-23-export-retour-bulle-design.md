# Export d'un retour de bilan en bulle de message (Instagram)

**Date** : 2026-07-23 · **Statut** : validé par Pierre · **Périmètre** : COACH uniquement, front seul

## Problème

Le coach récolte beaucoup de retours dans les bilans (Points positifs / À améliorer /
Notes générales — 3 lignes de texte par période) mais ne peut rien en faire.
Avant (WhatsApp), il faisait un screen d'un message pour le poster en story.
Ici c'est une ligne dans un tableau : il faut la mettre en forme.

## Vision validée

Cliquer sur une ligne de commentaire d'un bilan ouvre une **modale d'export** qui met
le texte en **bulle de message** et l'exporte en **PNG** (transparent par défaut),
prêt à poser sur un fond de story. Preview validée sur localhost (canvas natif).

### Déclencheur

Les lignes de commentaire des blocs-semaine de `BilanAccordion` (`positive_week`,
`negative_week`, `general_notes` — déjà rendues en `weekNoteText`) deviennent
**cliquables** (clic simple) : curseur pointer + léger hover. Clic → ouvre
`BubbleExportModal` avec le texte de la ligne. Aucun bouton ajouté.

### Modale `BubbleExportModal`

- **Aperçu live** de la bulle sur un fond damier (pour visualiser la transparence),
  re-rendu à chaque changement de réglage.
- **Réglages** (tous au choix, à chaque ouverture) :
  - Couleur de bulle : `white` (#fff/#111) | `ios` (#e9e9eb/#000) | `dark` (#262d31/#ececec)
  - Forme : `imsg` (arrondi 20, coin bas-gauche 5) | `wa` (arrondi 9, coin haut-gauche 2)
  - Taille du texte : slider 13→22 px
  - Largeur max : slider 220→360 px
  - Fond de l'image : `transparent` | `white` | `black`
- **Bouton "Télécharger PNG"** → dessin canvas natif (pixelRatio 3), download.
- Le texte est **non éditable** (on exporte ce que l'athlète a écrit).

### Mémoire des réglages

Les réglages (couleur, forme, taille, largeur, fond) sont **persistés en
localStorage** (`prc-bubble-export`) et re-chargés à l'ouverture suivante.
Lecture localStorage uniquement en `useEffect` post-hydration (règle #418).

## Technique — dessin canvas (repris de la preview validée)

- Word-wrap manuel via `measureText` sur la largeur max.
- Dessin de la forme (chemin arrondi selon `imsg`/`wa`), fill couleur bulle,
  puis texte ligne par ligne (`textBaseline='top'`).
- `scale = 3` pour la netteté. Fond : si non transparent, `fillRect` avant la bulle.
- Export : `canvas.toDataURL('image/png')` + `<a download>`.
- **Aucune dépendance externe** (`html-to-image` n'est pas installé ; `PhotoCompare`
  utilise déjà canvas natif — même approche).

## Architecture

- `components/bilans/BubbleExportModal.tsx` (nouveau) : modale, aperçu, réglages,
  logique canvas, persistance localStorage. ~200 lignes, responsabilité unique.
- `components/bilans/BilanAccordion.tsx` : les 3 lignes `weekNoteText` gagnent
  `onClick={() => setBubbleText(e.text)}` + style cliquable ; monte la modale
  quand `bubbleText != null`.
- `styles/bilans.module.css` : classe `.weekNoteClickable` (curseur + hover).

## Contraintes / invariants

- Zéro DB, zéro migration, zéro impact app ATHLETE.
- `useState`/`useEffect` de la modale : tous les hooks avant tout early-return.
- localStorage lu en `useEffect` (jamais au render initial).
- Le composant modale suit le pattern `Modal` du repo (`isOpen`/`onClose`/`title`).

## Hors périmètre

- Vue centralisée "Témoignages" (liste cross-athlète de tous les positifs) — option B, plus tard.
- Prénom de l'athlète sur la bulle, fonds/templates décoratifs, édition du texte.
- Export des réponses custom (photos/vidéos) — déjà couvert ailleurs.

## Vérification

- `npm run build` OK.
- Manuel : clic sur un point positif → modale ; changer chaque réglage → aperçu suit ;
  télécharger en transparent → PNG bulle seule ; rouvrir → réglages mémorisés ;
  fond blanc/noir → PNG avec fond plein.
