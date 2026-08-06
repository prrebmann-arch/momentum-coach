# Centre de notifications coach — Design

## Contexte

Le coach doit actuellement ouvrir chaque onglet athlète (bilans, questionnaires, vidéos, posing, fodmap) pour découvrir qu'un athlète a soumis quelque chose. Objectif : une cloche en haut à droite, visible sur toutes les pages, qui liste l'activité récente des athlètes et permet de la marquer comme traitée.

La table `notifications` existante (+ `notifyAthlete()` dans `lib/push.ts`) est **athlète-facing** : elle sert à notifier un athlète depuis le coach (push Expo). Ce projet est le flux inverse (athlète → coach) et utilise un nouveau modèle de données dédié, séparé, pour ne pas mélanger les deux sens.

**Périmètre v1** — 5 événements, tous déclenchés par une action athlète dans l'app mobile :
- `daily_reports` — bilan soumis
- `questionnaire_responses` — réponse à un questionnaire
- `execution_videos` — vidéo technique ajoutée
- `posing_videos` — vidéo posing ajoutée
- `athlete_fodmap_logs` — log FODMAP

Hors scope v1 : messages athlète→coach, notifications push/email au coach (in-app uniquement), tout autre event.

**Contrainte forte** : aucune modification du repo ATHLETE. Toute la capture d'événement se fait au niveau base de données (triggers Postgres), pas dans le code applicatif mobile.

## Architecture

### 1. Table `coach_notifications` (nouvelle, migration SQL dans `sql/`)

```sql
create table coach_notifications (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id),
  athlete_id uuid not null references athletes(id),
  type text not null,              -- 'bilan' | 'questionnaire' | 'execution_video' | 'posing_video' | 'fodmap'
  title text not null,
  body text,
  resource_link text not null,     -- ex: /athletes/{athlete_id}/bilans
  source_table text not null,
  source_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_coach_notifications_unread
  on coach_notifications(coach_id, created_at desc)
  where read_at is null;
```

RLS : coach ne voit/modifie que ses propres lignes (`coach_id = auth.uid()`), lecture + update (`read_at`) seulement — pas d'insert/delete côté client (réservé aux triggers, `security definer`).

### 2. Triggers (5, un par table source)

`AFTER INSERT` sur `daily_reports`, `questionnaire_responses`, `execution_videos`, `posing_videos`, `athlete_fodmap_logs`. Chaque trigger :
1. Résout `coach_id` via `athletes.coach_id` (JOIN sur `athlete_id` de la ligne insérée).
2. Construit `title`/`body`/`resource_link` (texte spécifique au type d'event, lien vers l'onglet concerné de l'athlète).
3. Insère la ligne dans `coach_notifications`.

Fonction trigger `security definer` pour bypasser RLS proprement (mêmes garanties que le pattern service-role déjà utilisé côté `/api/athlete-onboarding/init`).

Si `athletes.coach_id` est null (edge case), le trigger ne crée pas de notification (pas d'orphelin).

### 3. Marquage "lu"

- **Manuel** : clic sur une notif dans le dropdown de la cloche → `UPDATE coach_notifications SET read_at = now() WHERE id = ...`, puis navigation vers `resource_link`.
- **Automatique par consultation** : chaque page consommatrice (`/athletes/[id]/bilans`, `/questionnaires`, `/videos`, `/posing`, `/fodmap`) appelle au montage un helper `markResourceNotificationsRead(athleteId, type)` qui marque lues toutes les notifs non-lues de ce type pour cet athlète. Évite le bruit résiduel si le coach a navigué directement sans passer par la cloche.
- Bouton "tout marquer lu" dans le dropdown.

### 4. Frontend COACH

- **`NotificationBell.tsx`** (nouveau, `components/layout/`) — icône cloche + badge count rond, dropdown listant les notifs non lues (triées par `created_at desc`, limite ~30), clic = mark read + navigate, bouton "tout marquer lu".
- **Emplacement** : petite topbar globale ajoutée en haut de `(app)/layout.tsx` (le repo n'a actuellement que la `Sidebar`, pas de topbar) — cloche alignée à droite. Nouveau `styles/topbar.module.css`, cohérent avec le pattern CSS Modules existant.
- **`NotificationsContext.tsx`** (nouveau contexte, pattern proche de `RecorderContext`) : charge les notifs non lues au mount, expose `notifications`, `unreadCount`, `markRead(id)`, `markAllRead()`. S'abonne à Supabase Realtime (`postgres_changes` sur `coach_notifications`, filtre `coach_id=eq.<uid>`, events `INSERT` + `UPDATE`) pour mise à jour instantanée du badge sans polling — c'est le choix explicitement demandé ("le plus pro").
- Ajouté au provider tree : `AthleteProvider` → `NotificationsProvider` → `RecorderProvider` → shell, dans `(app)/layout.tsx`.

### 5. Erreurs / edge cases

- Realtime déconnecté (tab en veille) : le pattern existant `useRefetchOnResume` (refetch sur `coach:wake`) sert de filet de sécurité pour resynchroniser au retour d'onglet, en plus du canal Realtime.
- Notification pour un athlète supprimé entre-temps : `resource_link` peut 404 côté navigation — acceptable, pas de traitement spécial v1.

## Testing

- Insérer manuellement une ligne test dans chacune des 5 tables sources (via SQL ou en simulant l'action côté app mobile existante) et vérifier que `coach_notifications` se peuple avec le bon `coach_id`/type/lien.
- Vérifier que le badge de la cloche se met à jour sans refresh (Realtime) pendant qu'une insertion se produit.
- Vérifier que le clic sur une notif marque `read_at` et navigue vers la bonne page.
- Vérifier que la visite directe de la page concernée (sans passer par la cloche) marque aussi les notifs correspondantes comme lues.
- Vérifier RLS : un coach ne voit jamais les notifications d'un autre coach.
