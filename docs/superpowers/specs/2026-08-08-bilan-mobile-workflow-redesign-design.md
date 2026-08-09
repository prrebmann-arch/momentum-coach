# Bilan mobile — refonte du workflow (photos, mensurations, retour vidéo) — Design

## Contexte

La première passe mobile (branche précédente, PR #254) a corrigé la navigation globale et deux bugs de débordement, mais le coach confirme que le flux de traitement d'un bilan reste quasi inutilisable sur téléphone. Un audit approfondi du code (`BilanAccordion.tsx`, `PhotoCompare.tsx`, `MensurationCharts.tsx`, `BilanPhotosUploadModal.tsx`, la stack "Nouveau retour") et une clarification du workflow réel du coach permettent de proposer une refonte ciblée plutôt qu'un nouveau patch de CSS.

**Workflow réel confirmé par le coach**, dans l'ordre : Photos (comparaison avant/après) → Poids/mensurations (tendance) → (détail jour par jour, seulement si quelque chose interpelle) → Retour (vidéo/vocal/texte) → Marquer traité.

**Précision issue de la relecture du code réel** (`BilanAccordion.tsx:573-635`) : la ligne de stats hebdo (poids, adhérence, etc.) vit dans `.header`, une zone **toujours visible** même carte semaine fermée (`.header` n'est pas soumis au mécanisme replié/déplié — seul `.body`, qui contient nutrition/notes/tableau jour, l'est via `.cardOpen .body { max-height: 3000px }`, sinon `max-height: 0`). Le poids est donc déjà "en premier" au sens où il est visible sans action. Ce qui manque réellement au regard du workflow du coach : un accès aux **photos** au même niveau de visibilité immédiate (aujourd'hui elles sont cachées derrière une icône caméra minuscule par jour, à l'intérieur du tableau dense dans `.body`, donc invisibles tant que la carte n'est pas ouverte ET que le détail jour n'est pas déplié). Le tableau jour par jour, lui, est déjà dans la zone repliable `.body` — mais toujours affiché en entier dès que `.body` est ouvert, plutôt que d'être lui-même replié séparément derrière un bouton dédié, ce qui correspondrait mieux au fait que le coach n'y va "que si quelque chose interpelle".

**Constat clé de l'audit — distinction platform wall vs. bug corrigible :**
- **Mur technique réel, non contournable** : le mode "Écran + cam" du retour vidéo (`NouveauRetourPanel.tsx`, `recordMode === 'screen'`) utilise `getDisplayMedia`, une API de capture d'écran **non supportée par les navigateurs mobiles** (Safari iOS, Chrome/Firefox Android). Ce n'est pas un bug CSS, c'est une limitation de plateforme — ce mode doit rester une capacité desktop uniquement.
- **Déjà techniquement viable sur mobile, juste pas mis en avant** : le mode "Selfie portrait" (webcam face, `getUserMedia`+`MediaRecorder`, sans capture d'écran) est déjà implémenté dans le même composant et fonctionne sur navigateur mobile. Idem pour l'enregistrement audio et le message texte.
- **Pur problème de CSS/architecture d'information, pas une limitation** : la grille 14 colonnes, les boutons d'action sous-dimensionnés (`.noteBtn` à ~20px), le tooltip souris-only de `MensurationCharts`, la modale d'upload photo à largeur fixe.

**Contrainte non-négociable, reconduite de la session précédente : la version desktop (≥1024px) ne doit subir aucun changement visuel ou fonctionnel.** Chaque changement passe exclusivement par des media queries `max-width` scopées ou des bascules CSS pures (`display`), jamais de modification du style/comportement par défaut desktop. Exception ciblée et justifiée : le choix du mode d'enregistrement vidéo par défaut (`recordMode`) est une valeur de state initial calculée une fois au montage via `window.matchMedia` — ce n'est pas une bascule de layout réactive au resize, donc pas de risque d'hydratation SSR/client (l'état initial reste `'screen'` côté serveur et lors du premier rendu client, la valeur mobile n'est appliquée qu'après un `useEffect` post-hydratation, suivant le pattern déjà en place dans ce repo pour `localStorage`/`window` — voir `Sidebar.tsx`'s `collapsed` state).

## Périmètre

1. Ajout d'un accès Photos dans la zone toujours-visible du header, au même niveau que le poids — mobile uniquement, sans toucher au header desktop.
2. Détail jour par jour (déjà dans `.body`, la zone repliable) : passe de "toujours affiché en entier dès que la carte est ouverte, en grille scrollable" à "repliable indépendamment derrière son propre bouton, carte-par-jour empilée verticalement quand déplié" — mobile uniquement.
3. Agrandissement de toutes les cibles tactiles sous 44×44px dans l'accordéon bilan, `PhotoCompare`, et la modale d'upload photo — mobile uniquement.
4. Support tactile du tooltip de `MensurationCharts` (actuellement souris-only) — ajout, pas de suppression du comportement souris existant, donc pas de risque desktop.
5. Retour vidéo mobile : mode "Selfie portrait" présélectionné par défaut sur petit écran ; mode "Écran + cam" visuellement marqué comme indisponible sur mobile (désactivé + note explicative) plutôt que de planter silencieusement au clic.

Hors scope : refonte du flux d'envoi de bilan côté athlète (app mobile ATHLETE, hors de ce repo), refonte des autres pages non-bilan.

## Architecture

### 1. Bloc "Photos" dans le header — nouvelle entrée toujours visible sur mobile

Nouveau bouton, ajouté dans `.headerRight` (`BilanAccordion.tsx:586-603`, aux côtés du bouton "Bilan traité" et des points de statut journaliers), visible uniquement sur mobile (`display: none` par défaut, `display: inline-flex` sous le breakpoint). Au tap, ouvre `PhotoCompare` sur les photos les plus récentes disponibles pour la semaine — réutilise `onOpenPhoto`, déjà une prop du composant et déjà câblée à l'icône caméra existante par jour (`BilanAccordion.tsx:880-887`). N'affiché que si `hasPhotos` pour au moins un jour de la semaine (même condition que l'icône caméra actuelle). Le composant `PhotoCompare` lui-même n'est pas modifié dans sa logique d'ouverture, seul un second point d'entrée est ajouté.

Ce bouton vit dans le header, donc au même niveau de visibilité immédiate que le poids/stats hebdo (déjà toujours visibles) — pas besoin d'ouvrir la carte semaine pour y accéder, cohérent avec "photos + poids en premier" du workflow décrit.

### 2. Détail jour par jour — repliable indépendamment, carte verticale à l'ouverture

- Un état `dayDetailOpen` (nouveau, local par carte semaine) contrôle la visibilité du tableau de détail jour (`BilanAccordion.tsx:745-936`, actuellement rendu en entier dès que `.body` est ouvert) — replié par défaut sur mobile (`false`), bouton "Voir le détail jour par jour" pour l'ouvrir. Ce state n'a d'effet que sous la media query mobile ; sur desktop, la classe CSS conditionnée par `dayDetailOpen` n'a aucune règle définie hors media query, donc le tableau reste affiché en entier dès que `.body` est ouvert, exactement comme aujourd'hui.
- Quand déplié sur mobile, le rendu bascule de la grille `94px repeat(12,1fr) 70px 36px` scrollable horizontalement vers une **carte par jour empilée verticalement**, en étendant le pattern déjà existant `.detailGrid`/`.detailItem` (`BilanAccordion.tsx:922-928`, aujourd'hui limité à l'affichage des pas dans le sous-détail par jour) pour y afficher toutes les métriques de la ligne en paires `label: valeur` empilées. Le DOM des lignes desktop (`.dayRow`, grille) n'est pas remplacé : une vue carte alternative est ajoutée en parallèle et basculée en CSS pur (même pattern que `/bilans` table-vs-cartes de la session précédente) — pas de réécriture du rendu desktop existant.

### 3. Cibles tactiles — agrandissement scopé mobile

Tous les `.noteBtn` (marquer traité, pagination colonnes, expand semaine, expand jour, supprimer bilan) passent à `min-width: 44px; min-height: 44px` **à l'intérieur de la media query mobile existante**, sans toucher leur taille desktop (actuellement `padding: 4px 6px`, volontairement compacte pour la densité d'info sur grand écran). Idem pour les flèches de navigation photo dans `PhotoCompare` (`.pcNav`, qui rétrécissent actuellement à 32px sous 768px — corrigé pour remonter à 44px minimum sous ce même breakpoint) et le lien "reset zoom" (`.pcResetLink`, ajout d'un padding tactile).

### 4. `MensurationCharts` — support tactile du tooltip

Le composant a déjà `onMouseMove`/`onMouseLeave` pour afficher un tooltip au survol. Ajout de `onTouchMove`/`onTouchEnd` mappés sur la même logique (`handleMouseMove`), en calculant la position tactile (`e.touches[0].clientX`) au lieu de `e.clientX`. Purement additif — aucun changement du comportement souris existant, donc aucun risque desktop.

### 5. `BilanPhotosUploadModal` — passe responsive

La modale (`width: 540px` fixe, fallback `max-width: 92vw` déjà présent) reçoit un ajustement de padding/gap interne sous le breakpoint mobile pour éviter que le contenu soit trop compressé à `92vw` sur un téléphone étroit (~360-390px). Grille 3 colonnes de tuiles photo conservée (déjà raisonnable en largeur d'après l'audit), juste le padding externe et les espacements resserrés.

### 6. Retour vidéo — mode par défaut adaptatif sur mobile

Dans `NouveauRetourPanel.tsx`, le state `recordMode` (actuellement `useState<'screen' | 'selfie'>('screen')`) initialise sa valeur via une détection ponctuelle post-montage (`useEffect` avec `window.matchMedia('(max-width: 768px)').matches`, suivant le pattern déjà utilisé dans ce repo pour lire `localStorage` après hydratation — voir `Sidebar.tsx:61-63`) : si mobile, bascule `recordMode` sur `'selfie'`. Le bouton "Écran + cam" reste visible mais visuellement marqué `disabled` sur mobile avec un texte d'aide ("Disponible sur ordinateur uniquement") plutôt que de laisser le coach cliquer dessus et obtenir une erreur silencieuse de `getDisplayMedia`. Sur desktop, ce `useEffect` ne modifie jamais `recordMode` (la media query ne matche pas), donc le comportement desktop actuel (mode "Écran + cam" par défaut, sélectionnable librement) est strictement inchangé.

## Erreurs / edge cases

- Un bilan sans aucune photo pour la semaine : le bloc "Photos" mobile ne s'affiche pas (même condition `hasPhotos` déjà utilisée pour l'icône caméra actuelle).
- Détail jour ouvert puis le composant se re-render (nouvelle donnée bilan) : l'état `dayDetailOpen` est local à la carte semaine, pas de persistance nécessaire au-delà du cycle de vie du composant.
- Rotation d'écran franchissant le seuil desktop/mobile pendant que le détail jour est ouvert : géré par la media query CSS comme dans la session précédente, pas de logique JS supplémentaire.

## Testing

- Sur mobile (~375-430px) : confirmer que le bouton photos est visible dans le header sans ouvrir la carte semaine, tapable, ouvre bien `PhotoCompare` — au même niveau de visibilité que le poids/stats hebdo (déjà toujours visibles).
- Ouvrir la carte semaine : confirmer que le détail jour est replié par défaut derrière son propre bouton (le reste de `.body` — nutrition, notes — s'affiche normalement), et qu'une fois déplié, chaque jour s'affiche en carte verticale lisible sans scroll horizontal.
- Confirmer que tous les boutons d'action (marquer traité, supprimer, pagination, nav photo) sont tapables sans mistap sur un écran ~375px.
- Tester le tooltip de `MensurationCharts` au doigt (tap-and-drag sur le graphique).
- Ouvrir "Nouveau retour" sur mobile : confirmer que le mode par défaut est "Selfie portrait", que "Écran + cam" est visuellement désactivé avec un message clair.
- **Non-régression desktop obligatoire** : sur ≥1024px, comparer visuellement l'accordéon bilan, `PhotoCompare`, la modale d'upload, et le panneau "Nouveau retour" avant/après — aucune différence perceptible, mode par défaut du retour vidéo toujours "Écran + cam" sur desktop.
