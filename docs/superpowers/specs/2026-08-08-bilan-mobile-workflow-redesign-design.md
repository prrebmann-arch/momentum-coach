# Bilan mobile — refonte du workflow (photos, mensurations, retour vidéo) — Design

## Contexte

La première passe mobile (branche précédente, PR #254) a corrigé la navigation globale et deux bugs de débordement, mais le coach confirme que le flux de traitement d'un bilan reste quasi inutilisable sur téléphone. Un audit approfondi du code (`BilanAccordion.tsx`, `PhotoCompare.tsx`, `MensurationCharts.tsx`, `BilanPhotosUploadModal.tsx`, la stack "Nouveau retour") et une clarification du workflow réel du coach permettent de proposer une refonte ciblée plutôt qu'un nouveau patch de CSS.

**Workflow réel confirmé par le coach**, dans l'ordre : Photos (comparaison avant/après) → Poids/mensurations (tendance) → (détail jour par jour, seulement si quelque chose interpelle) → Retour (vidéo/vocal/texte) → Marquer traité. L'accordéon actuel présente l'inverse : une grille dense de 14 colonnes toujours visible en premier, les photos cachées derrière une icône caméra minuscule par jour, et le détail jour toujours affiché même quand il n'est pas consulté.

**Constat clé de l'audit — distinction platform wall vs. bug corrigible :**
- **Mur technique réel, non contournable** : le mode "Écran + cam" du retour vidéo (`NouveauRetourPanel.tsx`, `recordMode === 'screen'`) utilise `getDisplayMedia`, une API de capture d'écran **non supportée par les navigateurs mobiles** (Safari iOS, Chrome/Firefox Android). Ce n'est pas un bug CSS, c'est une limitation de plateforme — ce mode doit rester une capacité desktop uniquement.
- **Déjà techniquement viable sur mobile, juste pas mis en avant** : le mode "Selfie portrait" (webcam face, `getUserMedia`+`MediaRecorder`, sans capture d'écran) est déjà implémenté dans le même composant et fonctionne sur navigateur mobile. Idem pour l'enregistrement audio et le message texte.
- **Pur problème de CSS/architecture d'information, pas une limitation** : la grille 14 colonnes, les boutons d'action sous-dimensionnés (`.noteBtn` à ~20px), le tooltip souris-only de `MensurationCharts`, la modale d'upload photo à largeur fixe.

**Contrainte non-négociable, reconduite de la session précédente : la version desktop (≥1024px) ne doit subir aucun changement visuel ou fonctionnel.** Chaque changement passe exclusivement par des media queries `max-width` scopées ou des bascules CSS pures (`display`), jamais de modification du style/comportement par défaut desktop. Exception ciblée et justifiée : le choix du mode d'enregistrement vidéo par défaut (`recordMode`) est une valeur de state initial calculée une fois au montage via `window.matchMedia` — ce n'est pas une bascule de layout réactive au resize, donc pas de risque d'hydratation SSR/client (l'état initial reste `'screen'` côté serveur et lors du premier rendu client, la valeur mobile n'est appliquée qu'après un `useEffect` post-hydratation, suivant le pattern déjà en place dans ce repo pour `localStorage`/`window` — voir `Sidebar.tsx`'s `collapsed` state).

## Périmètre

1. Réorganisation de la hiérarchie visuelle du bilan sur mobile : photos en premier, puis poids/mensurations, puis notes, puis détail jour replié par défaut, puis actions — **sur desktop, l'accordéon garde son ordre et son apparence actuels sans aucun changement**.
2. Détail jour par jour : passe de "toujours visible en grille scrollable" à "replié par défaut, carte-par-jour empilée verticalement à l'ouverture" — mobile uniquement.
3. Agrandissement de toutes les cibles tactiles sous 44×44px dans l'accordéon bilan, `PhotoCompare`, et la modale d'upload photo — mobile uniquement.
4. Support tactile du tooltip de `MensurationCharts` (actuellement souris-only) — ajout, pas de suppression du comportement souris existant, donc pas de risque desktop.
5. Retour vidéo mobile : mode "Selfie portrait" présélectionné par défaut sur petit écran ; mode "Écran + cam" visuellement marqué comme indisponible sur mobile (désactivé + note explicative) plutôt que de planter silencieusement au clic.

Hors scope : refonte du flux d'envoi de bilan côté athlète (app mobile ATHLETE, hors de ce repo), refonte des autres pages non-bilan.

## Architecture

### 1. Réorganisation de `BilanAccordion.tsx` — nouvel ordre mobile via CSS `order`

Plutôt que dupliquer tout le JSX (coûteux et source de divergence, contrairement au cas `/bilans` de la session précédente où deux vues réellement différentes coexistaient), la réorganisation utilise **CSS Flexbox `order`** sur les sections existantes, scopé au breakpoint mobile. Chaque section de contenu du bilan (stats hebdo, nutrition, notes, photos, détail jour) devient un enfant flex direct d'un conteneur `.body` (déjà existant), avec un `order` explicite par défaut (0, l'ordre actuel du DOM) et un `order` mobile réassigné dans la media query. Cette approche :
- Ne change ni la structure du DOM ni son ordre de source (bon pour l'accessibilité/lecteurs d'écran, qui suivent l'ordre DOM, pas l'ordre visuel CSS) — acceptable ici car l'ordre DOM reste l'ordre desktop actuel, qui est déjà celui utilisé et validé par le coach.
- Ne nécessite aucune duplication de JSX.
- Est strictement scopée à la media query mobile : le desktop garde `order` implicite (0 partout, ordre DOM = ordre visuel, inchangé).

Nouvel ordre visuel mobile (valeurs `order` croissantes) :
1. Bloc photos (nouveau — voir §2)
2. Poids/mensurations en tête de la ligne de stats hebdo (repositionné, pas dupliqué — voir §3)
3. Notes de la semaine (inchangé)
4. Nutrition (inchangé, déjà fluide)
5. Détail jour par jour (replié par défaut — voir §4)

### 2. Bloc "Photos" — nouvelle entrée visible en haut du bilan mobile

Nouveau bouton/carte visible uniquement sur mobile (`display: none` par défaut, `display: flex` sous le breakpoint), inséré en tête du `.body` avec `order` bas. Au clic, ouvre `PhotoCompare` directement sur les photos les plus récentes disponibles pour ce bilan — réutilise l'`onOpenPhoto` déjà câblé (actuellement déclenché depuis l'icône caméra par jour dans la grille dense, `BilanAccordion.tsx:880-887`). Le composant `PhotoCompare` lui-même n'est pas modifié dans sa logique d'ouverture, seul le point d'entrée change.

### 3. Poids/mensurations — extraction visuelle sans duplication de données

La ligne de stats hebdo (`.stats`, grille 14 colonnes) reste techniquement une seule grille — pas de duplication des calculs (`w.avgWeight`, etc.). Sur mobile, un sous-ensemble "tendance clé" (poids + variation delta, déjà calculé en `deltaKg`) est extrait visuellement via un second bloc simple (nouveau, JSX minimal) placé en tête, réutilisant les mêmes variables déjà en scope dans le composant (`w.avgWeight`, `deltaKg`). La grille complète des 12 métriques reste disponible plus bas dans le flux mobile (elle n'est pas supprimée, seulement redescendue en priorité visuelle via `order`), pour ne pas perdre d'information — juste ne plus l'imposer en premier.

### 4. Détail jour par jour — replié par défaut, carte verticale à l'ouverture

- Un état `dayDetailOpen` (nouveau, par semaine/carte) contrôle la visibilité du bloc détail jour sur mobile — replié par défaut (`false`), bouton "Voir le détail jour par jour" pour l'ouvrir. Ce state n'affecte que l'affichage mobile ; sur desktop le bloc reste toujours visible comme aujourd'hui (le `display: none` conditionnel ne s'applique que dans la media query mobile — sur desktop, la classe CSS liée à `dayDetailOpen` n'a aucun effet, donc son état par défaut `false` est sans conséquence visuelle desktop).
- Quand ouvert sur mobile, le rendu passe de la grille `94px repeat(12,1fr) 70px 36px` scrollable horizontalement à une **carte par jour empilée verticalement**, réutilisant le pattern déjà existant `.detailGrid`/`.detailItem` (`BilanAccordion.tsx:922-928`, actuellement utilisé pour afficher les pas dans le sous-détail par jour) — étendu pour afficher toutes les métriques de la ligne en `label: valeur` empilés, au lieu des 12 colonnes de grille. Le DOM des lignes desktop (`.dayRow`) n'est pas remplacé : une vue alternative carte est ajoutée en parallèle (même pattern de bascule CSS `display` que `/bilans` table-vs-cartes de la session précédente), pas une réécriture du rendu existant.

### 5. Cibles tactiles — agrandissement scopé mobile

Tous les `.noteBtn` (marquer traité, pagination colonnes, expand semaine, expand jour, supprimer bilan) passent à `min-width: 44px; min-height: 44px` **à l'intérieur de la media query mobile existante**, sans toucher leur taille desktop (actuellement `padding: 4px 6px`, volontairement compacte pour la densité d'info sur grand écran). Idem pour les flèches de navigation photo dans `PhotoCompare` (`.pcNav`, qui rétrécissent actuellement à 32px sous 768px — corrigé pour remonter à 44px minimum sous ce même breakpoint) et le lien "reset zoom" (`.pcResetLink`, ajout d'un padding tactile).

### 6. `MensurationCharts` — support tactile du tooltip

Le composant a déjà `onMouseMove`/`onMouseLeave` pour afficher un tooltip au survol. Ajout de `onTouchMove`/`onTouchEnd` mappés sur la même logique (`handleMouseMove`), en calculant la position tactile (`e.touches[0].clientX`) au lieu de `e.clientX`. Purement additif — aucun changement du comportement souris existant, donc aucun risque desktop.

### 7. `BilanPhotosUploadModal` — passe responsive

La modale (`width: 540px` fixe, fallback `max-width: 92vw` déjà présent) reçoit un ajustement de padding/gap interne sous le breakpoint mobile pour éviter que le contenu soit trop compressé à `92vw` sur un téléphone étroit (~360-390px). Grille 3 colonnes de tuiles photo conservée (déjà raisonnable en largeur d'après l'audit), juste le padding externe et les espacements resserrés.

### 8. Retour vidéo — mode par défaut adaptatif sur mobile

Dans `NouveauRetourPanel.tsx`, le state `recordMode` (actuellement `useState<'screen' | 'selfie'>('screen')`) initialise sa valeur via une détection ponctuelle post-montage (`useEffect` avec `window.matchMedia('(max-width: 768px)').matches`, suivant le pattern déjà utilisé dans ce repo pour lire `localStorage` après hydratation — voir `Sidebar.tsx:61-63`) : si mobile, bascule `recordMode` sur `'selfie'`. Le bouton "Écran + cam" reste visible mais visuellement marqué `disabled` sur mobile avec un texte d'aide ("Disponible sur ordinateur uniquement") plutôt que de laisser le coach cliquer dessus et obtenir une erreur silencieuse de `getDisplayMedia`. Sur desktop, ce `useEffect` ne modifie jamais `recordMode` (la media query ne matche pas), donc le comportement desktop actuel (mode "Écran + cam" par défaut, sélectionnable librement) est strictement inchangé.

## Erreurs / edge cases

- Un bilan sans aucune photo pour la semaine : le bloc "Photos" mobile ne s'affiche pas (même condition `hasPhotos` déjà utilisée pour l'icône caméra actuelle).
- Détail jour ouvert puis le composant se re-render (nouvelle donnée bilan) : l'état `dayDetailOpen` est local à la carte semaine, pas de persistance nécessaire au-delà du cycle de vie du composant.
- Rotation d'écran franchissant le seuil desktop/mobile pendant que le détail jour est ouvert : géré par la media query CSS comme dans la session précédente, pas de logique JS supplémentaire.

## Testing

- Sur mobile (~375-430px) : ouvrir un bilan, confirmer que le bloc photos apparaît en premier, testable au tap, ouvre bien `PhotoCompare`.
- Confirmer que poids/mensurations sont visibles juste après les photos, sans avoir à scroller la grille complète.
- Confirmer que le détail jour est replié par défaut, et qu'une fois ouvert, chaque jour s'affiche en carte verticale lisible sans scroll horizontal.
- Confirmer que tous les boutons d'action (marquer traité, supprimer, pagination, nav photo) sont tapables sans mistap sur un écran ~375px.
- Tester le tooltip de `MensurationCharts` au doigt (tap-and-drag sur le graphique).
- Ouvrir "Nouveau retour" sur mobile : confirmer que le mode par défaut est "Selfie portrait", que "Écran + cam" est visuellement désactivé avec un message clair.
- **Non-régression desktop obligatoire** : sur ≥1024px, comparer visuellement l'accordéon bilan, `PhotoCompare`, la modale d'upload, et le panneau "Nouveau retour" avant/après — aucune différence perceptible, mode par défaut du retour vidéo toujours "Écran + cam" sur desktop.
