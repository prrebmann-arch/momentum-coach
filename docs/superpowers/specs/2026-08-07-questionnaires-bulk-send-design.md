# Envoi de questionnaire à plusieurs athlètes — Design

## Contexte

Aujourd'hui, un coach envoie un questionnaire (depuis un template ou "questionnaire rapide") un athlète à la fois, depuis `/athletes/[id]/questionnaires`. Pour un coach avec plusieurs athlètes suivant le même protocole (ex: bilan mensuel groupé, check-in de début de cycle), il n'existe pas de moyen d'envoyer le même questionnaire à plusieurs athlètes en une seule action.

## Périmètre

- Nouveau flux d'envoi groupé sur `/questionnaires` (la page cross-athlète livrée cette session) : bouton "Envoyer", sélection multi-athlètes, choix template ou questionnaire rapide, envoi en un clic.
- L'envoi solo existant sur `/athletes/[id]/questionnaires` reste inchangé — pas de régression, pas de fusion des deux flux.
- Réutilisation de l'éditeur "questionnaire rapide" déjà existant (extrait dans un composant partagé pour éviter la duplication, même pattern que l'extraction `QuestionnaireAnswer.tsx` faite cette session).

## Architecture

### 1. UI — `QuestionnairesOverview.tsx`

- Bouton "Envoyer" en haut de la page (à côté des filtres), ouvre un panneau (même style visuel que la toolbar "Envoyer" de la page per-athlète).
- **Sélection destinataires** : liste à cocher des athlètes du coach (`useAthleteContext()`, déjà chargés — pas de requête supplémentaire), avec un bouton "Tout sélectionner" / "Tout désélectionner". Compteur "N athlète(s) sélectionné(s)".
- **Choix du contenu** : deux modes, bascule par bouton — "Depuis un template" (select des templates du coach) ou "Questionnaire rapide" (éditeur à la volée).
- Case "Obligatoire" (comme l'existant).
- Bouton "Envoyer à N athlète(s)" — désactivé si 0 athlète sélectionné ou (mode template) aucun template choisi ou (mode rapide) aucune question valide.

### 2. Composant partagé — `QuickQuestionnaireEditor.tsx`

Extrait de la vue `showQuick` de `app/(app)/athletes/[id]/questionnaires/page.tsx` (état des questions, ajout/suppression, sélection du type par question, options pour `choice`, position pour `photo`). Prend en props `questions`, `onChange`, plutôt que de gérer son propre state interne, pour être réutilisable par les deux pages (envoi solo et envoi groupé).

- `app/(app)/athletes/[id]/questionnaires/page.tsx` est modifié pour utiliser ce composant partagé au lieu de sa vue `showQuick` inline — pas de changement de comportement pour l'utilisateur.

### 3. Logique d'envoi — `lib/questionnaires.ts` (nouveau)

- `sendQuestionnaireToAthletes(coachId, athleteIds, { templateId, questions, titre, obligatoire }): Promise<{ sent: number; failed: string[] }>`
  - Résout le contenu des questions (soit depuis le template en base, soit depuis les questions fournies en mode rapide).
  - Un seul `insert` Supabase avec un tableau de lignes `questionnaire_assignments` (une par athlete_id) — pas de boucle de N requêtes séparées.
  - Résout les `user_id` des athlètes sélectionnés (déjà disponibles via `useAthleteContext()`, pas de requête supplémentaire) et déclenche `notifyAthlete()` par athlète en parallèle (`Promise.all`), sans bloquer l'insert principal en cas d'échec d'une notification individuelle (best-effort — l'assignment existe même si la notif échoue, cohérent avec le comportement actuel solo).
  - Retourne un compte de succès/échecs pour le toast.

### 4. Erreurs / edge cases

- Un athlète sans `user_id` (compte non activé côté app mobile) : l'assignment est quand même créé (comme pour l'envoi solo actuel), mais aucune notification n'est tentée pour cet athlète — pas d'erreur bloquante.
- Échec partiel de l'insert batché (ex: un `athlete_id` invalide) : Postgres rejette l'insert entier en cas d'erreur sur une ligne — pas d'insert partiel silencieux. Le toast affiche l'erreur complète, aucun assignment n'est créé, le coach retente.
- 0 athlète sélectionné : bouton d'envoi désactivé, pas de requête déclenchée.

## Testing

- Sélectionner 3 athlètes, envoyer un template — vérifier que 3 lignes `questionnaire_assignments` sont créées, que chaque athlète reçoit une notification (visible dans `notifications` table + push si device enregistré).
- Sélectionner 2 athlètes, créer un questionnaire rapide de 2 questions, envoyer — même vérification.
- Vérifier "Tout sélectionner" / "Tout désélectionner".
- Vérifier que l'envoi solo sur `/athletes/[id]/questionnaires` fonctionne toujours à l'identique après l'extraction de `QuickQuestionnaireEditor.tsx`.
- Vérifier le compteur "N athlète(s) sélectionné(s)" et l'état désactivé du bouton d'envoi.
