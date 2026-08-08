# Mobile responsive — nav globale + flux bilan — Design

## Contexte

Le coach utilise l'app COACH sur téléphone et rencontre des bugs bloquants — impossible de traiter un bilan correctement. Un audit du code confirme plusieurs causes concrètes :

1. **La sidebar mobile est déjà à moitié câblée mais inopérante** — `styles/sidebar.module.css` contient déjà un `@media (max-width: 1024px)` qui translate la sidebar hors écran (`transform: translateX(-100%)`) avec une classe `.sidebarOpen` prévue pour la ramener, mais cette classe n'est appliquée nulle part dans le code React. Résultat : sous 1024px, la sidebar disparaît et il n'existe aucun moyen de la rouvrir (pas de hamburger, pas de state).
2. **Les onglets de la page athlète clippent au lieu de scroller** — `styles/athletes.module.css` a 17 onglets (dont "Bilans") dans une rangée `overflow: hidden` sans wrap ; sur un écran de 375-430px, seuls ~5 onglets sont visibles/tapables.
3. **La table `/bilans` (vue cross-athlète) n'a aucune gestion mobile** — 6 colonnes fixes, aucune media query, déborde sur tout écran téléphone.
4. **L'accordéon de détail bilan déborde** — la grille de stats hebdomadaires (`.stats` dans `bilans.module.css`) a un `min-width: 720px` au breakpoint 768px mais, contrairement à `.daysTable`, pas de wrapper `overflow-x: auto` — ça fait déborder toute la page horizontalement.
5. Texte de détail journalier à 10-11px, difficilement lisible sur mobile.
6. Le dropdown de notifications a une largeur fixe de 340px, peut déborder sur les téléphones les plus étroits (< 360px).

**Contrainte non-négociable : la version desktop (≥1024px) ne doit subir aucun changement visuel ou fonctionnel.** Tous les changements passent exclusivement par des media queries `max-width` scopées, ou par des vues alternatives basculées en CSS (`display: none`/`block` selon breakpoint) — jamais de modification du style par défaut (desktop-first) ni de détection JS du viewport qui pourrait diverger entre SSR et client.

## Périmètre

- Nav globale : rendre la sidebar mobile réellement utilisable (ouverture/fermeture).
- Onglets athlète : rendre tous les onglets accessibles sur mobile (scroll horizontal).
- Flux bilan bout en bout : `/bilans` (vue d'ensemble) → `/athletes/[id]/bilans` (détail, accordéon) → actions (marquer traité, voir photos).
- Hors scope (sessions suivantes) : autres pages (training, nutrition, templates, business...), qui ne sont pas dans le chemin critique "traiter un bilan".

## Architecture

### 1. Sidebar mobile — activer le off-canvas existant

- `components/layout/Sidebar.tsx` : ajouter un état `mobileOpen` (distinct du `collapsed` existant, qui est un mécanisme desktop persisté en localStorage — on n'y touche pas). Exposer `mobileOpen` et un setter via une prop ou un contexte léger, pour que le bouton hamburger (dans `Topbar.tsx`) puisse le piloter.
- Approche retenue : un petit contexte React `MobileNavContext` (nouveau, `contexts/MobileNavContext.tsx`) plutôt que du prop-drilling — `Topbar` et `Sidebar` ne sont pas parent/enfant direct dans `(app)/layout.tsx`, un contexte est la façon la plus propre de les connecter sans changer la hiérarchie du layout.
- `Sidebar.tsx` applique `styles.sidebarOpen` (classe déjà existante en CSS) quand `mobileOpen === true`, en plus de `styles.sidebar` — la classe combinée respecte le pattern déjà en place (comme `sidebarCollapsed`).
- Ajout d'un overlay semi-transparent (nouveau, CSS uniquement sous le breakpoint mobile) qui ferme la sidebar au clic à l'extérieur — pattern déjà utilisé par le dropdown de notifications (`NotificationBell.tsx`, overlay `position: fixed; inset: 0`).
- `Topbar.tsx` : ajout d'un bouton hamburger (icône `fa-bars`), visible uniquement sous 1024px (`display: none` par défaut dans le CSS module, `display: flex` dans la media query — desktop inchangé), qui toggle `mobileOpen`.
- Navigation vers une nouvelle route (clic sur un lien de la sidebar) referme automatiquement `mobileOpen` sur mobile, pour ne pas laisser le menu ouvert après navigation.

### 2. Onglets athlète — scroll horizontal

- `styles/athletes.module.css` : le conteneur des onglets passe de `overflow: hidden` à `overflow-x: auto` uniquement sous le breakpoint mobile existant (ou un nouveau si absent) — `white-space: nowrap` reste, pas de wrap forcé (wrap sur 17 items casserait la mise en page). Ajout de `-webkit-overflow-scrolling: touch` pour un scroll fluide iOS, et `scrollbar-width: none`/`::-webkit-scrollbar { display: none }` pour masquer la barre de scroll disgracieuse tout en gardant le geste tactile fonctionnel.
- Desktop (≥1024px, ou le breakpoint où `overflow: hidden` s'applique actuellement) : comportement strictement inchangé.

### 3. `/bilans` — vue cartes sur mobile

- `components/bilans/BilansOverview.tsx` : la table existante (`boTableWrap`/`boTable`) reste le rendu par défaut. Une seconde vue JSX (cartes) est ajoutée en parallèle dans le même composant, chacune des deux enveloppée dans un conteneur avec une classe CSS dédiée (`.boTableWrap` gardé `display: none` sous le breakpoint mobile, nouvelle classe `.boCardsWrap` gardée `display: none` au-dessus) — bascule purement CSS, pas de détection JS de largeur d'écran (évite tout risque d'hydratation SSR/client différente).
- Chaque carte mobile reprend les mêmes données que la ligne de table (nom, statut, poids/soumission, échéance, dernier bilan, actions) dans une mise en page verticale empilée, boutons d'action en pleine largeur ou alignés en bas de carte pour rester facilement tapables (cible tactile ≥ 44px, standard iOS/Android).
- Le clic sur une carte navigue vers `/athletes/[id]/bilans`, comme le clic sur une ligne de table aujourd'hui.

### 4. Accordéon bilan — corriger les débordements

- `styles/bilans.module.css` : le conteneur de `.stats` reçoit le même traitement que `.daysTable` — un wrapper avec `overflow-x: auto` au breakpoint où `min-width: 720px` s'applique, pour que le débordement soit contenu et scrollable localement plutôt que de faire déborder toute la page.
- Texte des lignes de détail journalier (`BilanAccordion.tsx`, actuellement 10-11px) : légère augmentation (~12-13px) uniquement sous le breakpoint mobile, pour rester lisible sans changer la densité d'information sur desktop.

### 5. Notification bell — cap de largeur

- `styles/notificationBell.module.css` : `.dropdown` passe de `width: 340px` fixe à `width: min(340px, 90vw)` — changement anodin, s'applique à toutes les tailles d'écran mais n'a aucun effet visible au-dessus de ~378px de large (90vw > 340px dès 378px), donc sans impact desktop réel.

## Erreurs / edge cases

- Sidebar mobile ouverte puis rotation d'écran (portrait→paysage franchissant le seuil 1024px) : le CSS media query s'applique automatiquement, pas de gestion JS supplémentaire nécessaire — si l'écran devient ≥1024px, le `@media` desktop reprend la main indépendamment du state `mobileOpen` (qui devient sans effet, pas besoin de le reset).
- Table vs cartes `/bilans` : les deux DOM existent toujours (juste l'un est masqué en CSS), donc pas de flash de contenu ni de layout shift au chargement — léger surcoût de DOM, acceptable vu la taille de la liste (pagination/limite déjà en place selon l'audit précédent).

## Testing

- Sidebar : sur un viewport ≤1024px, ouvrir via le hamburger, vérifier que le clic sur un lien navigue ET referme le menu, vérifier que le clic sur l'overlay ferme sans naviguer.
- Onglets athlète : sur un viewport ≤430px, vérifier que tous les 17 onglets sont atteignables par scroll horizontal tactile, y compris "Bilans" et les derniers de la liste.
- `/bilans` sur mobile : vérifier que la vue cartes s'affiche (pas la table), que chaque carte affiche les bonnes infos, que les actions (marquer traité, rappel, voir) fonctionnent identiquement à la version desktop.
- `/athletes/[id]/bilans` : ouvrir un bilan avec beaucoup de données (stats hebdo + jours), vérifier qu'aucun débordement horizontal de la page entière ne se produit, que le scroll local fonctionne pour les zones larges.
- **Non-régression desktop obligatoire** : sur un viewport ≥1024px, comparer visuellement chaque page touchée avant/après — sidebar, `/bilans`, `/athletes/[id]/bilans`, dropdown notifications — aucune différence ne doit être perceptible.
