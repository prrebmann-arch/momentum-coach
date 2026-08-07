# Page questionnaires cross-athlète — Design

## Contexte

Le coach ne peut actuellement voir les réponses aux questionnaires qu'athlète par athlète (`/athletes/[id]/questionnaires`) ou via une notification individuelle. Il n'existe pas de vue globale listant l'activité questionnaire de tous les athlètes, contrairement aux bilans (`/bilans`) et vidéos d'exécution (`/videos`) qui ont déjà ce pattern cross-athlète.

## Périmètre

- Nouvelle page `/questionnaires`, cross-athlète, en lecture (le coach y consulte l'activité — l'envoi de nouveaux questionnaires reste sur `/athletes/[id]/questionnaires`, hors scope ici).
- Deux vues filtrées : **Complétés** (réponses soumises) et **En attente** (assignments envoyés, pas encore répondus).
- Accordion : ligne compacte (athlète, titre questionnaire, date, statut) → clic déplie les réponses détaillées.
- Le lien de la notification "réponse au questionnaire" (cloche, voir centre de notifications) pointe désormais vers cette vue globale `/questionnaires` plutôt que l'onglet per-athlète.

## Architecture

### 1. Route & nav

- `app/(app)/questionnaires/page.tsx` → rend `components/questionnaires/QuestionnairesOverview.tsx`.
- Ajout à `components/layout/Sidebar.tsx` (`navGroups`), section "Suivi", entre "Vidéos" et "Annonces" : `{ label: 'Questionnaires', icon: 'fa-clipboard-question', route: '/questionnaires' }`.
- Ajout à la table de routes dans `ARCHITECTURE.md` §2, section "Cross-athlete review pages".

### 2. Extraction du code d'affichage partagé (éviter la duplication)

`app/(app)/athletes/[id]/questionnaires/page.tsx` contient déjà `formatAnswer()`, `isPhotoAnswer()`, `PhotoAnswer` et la liste `Q_TYPES`/`PHOTO_POSITIONS` nécessaires pour afficher une réponse. Ces éléments sont extraits vers un nouveau fichier partagé :

- Créer `components/questionnaires/QuestionnaireAnswer.tsx` : exporte `formatAnswer`, `isPhotoAnswer`, `PhotoAnswer`, `Q_TYPES`, `PHOTO_POSITIONS`.
- Modifier `app/(app)/athletes/[id]/questionnaires/page.tsx` pour importer depuis ce nouveau fichier au lieu de définir ces éléments localement (suppression du code dupliqué, pas de changement de comportement).

### 3. `QuestionnairesOverview.tsx` — composant principal

Pattern calqué sur `components/bilans/BilansOverview.tsx` :

- Consomme `useAthleteContext()` pour la liste des athlètes du coach (déjà chargée, pas de requête supplémentaire).
- Fetch cross-athlète : `questionnaire_assignments` (`*, questionnaire_templates(titre)`) filtré sur `athlete_id IN (athletes du coach)`, triée par `sent_at desc`, limite raisonnable (ex. 200 — même ordre de grandeur que `MAX_VIDEOS_LOAD`).
- Pour les assignments avec `status = 'completed'`, fetch `questionnaire_responses` par lot (`in('assignment_id', completedIds)`), même pattern que l'onglet per-athlète existant.
- Deux filtres : `'completed' | 'pending'` (mappé sur `status`), boutons style `FILTER_BTNS` de `BilansOverview`.
- Recherche texte par nom d'athlète (comme `/videos`), optionnelle mais peu coûteuse à ajouter avec le pattern déjà en place.
- Liste rendue en accordion : chaque item = nom athlète (lien vers `/athletes/[id]/questionnaires` pour action complète), titre questionnaire, date (`sent_at` si pending, `submitted_at` si completed), badge statut. Clic → déplie et affiche les réponses via `QuestionnaireAnswer`.
- `useRefetchOnResume` pour le refresh au retour d'onglet, cohérent avec les autres pages cross-athlète.

### 4. Notification → lien vers la vue globale

Modifier `sql/coach_notifications.sql`, fonction `notify_coach_on_questionnaire` : `resource_link` passe de `'/athletes/' || NEW.athlete_id || '/questionnaires'` à `'/questionnaires'`. C'est un changement SQL à appliquer manuellement dans le SQL Editor Supabase (pattern du repo), avec un `CREATE OR REPLACE FUNCTION` idempotent — pas de nouvelle migration de table, juste une mise à jour de fonction.

## Erreurs / edge cases

- Coach sans athlètes : état vide, cohérent avec `BilansOverview`/`VideosPage`.
- Réponse à un questionnaire supprimé/template supprimé entretemps : `questionnaire_templates(titre)` peut être `null` — afficher un fallback ("Questionnaire supprimé") plutôt que planter.
- Notification pointant vers `/questionnaires` pour un assignment qui n'existe plus au clic : la page se charge normalement (vue globale, pas de dépendance à une ressource précise), pas de 404 possible.

## Testing

- Vérifier que la page affiche bien les questionnaires de plusieurs athlètes différents, triés par date.
- Vérifier que le filtre Complétés/En attente fonctionne.
- Vérifier qu'un clic déplie les réponses (texte, choix, note, oui/non, photo) sans régression par rapport à l'affichage per-athlète existant.
- Vérifier que le lien depuis la cloche de notification atterrit bien sur `/questionnaires` après le changement SQL.
- Vérifier que `app/(app)/athletes/[id]/questionnaires/page.tsx` fonctionne toujours à l'identique après l'extraction du code partagé (pas de régression sur l'onglet per-athlète).
