# AUDIT COMPLET — Supabase + App Coach
## Date : 24 mars 2026

---

# PARTIE 1 : AUDIT SUPABASE

## 1.1 Vue d'ensemble

| Métrique | Valeur |
|----------|--------|
| Taille base | 15 MB |
| Tables | 36 |
| Users auth | 3 (tous actifs 7j) |
| Athletes | 1 |
| Orphelins | 0 |
| Doublons email | 0 |
| Storage | 96 MB (3 buckets) |

## 1.2 FAILLES SÉCURITÉ RLS

### CRITIQUE — Table `exercices` : policies ouvertes à tous

Les 4 policies utilisent `condition = true` → **n'importe quel utilisateur authentifié peut lire, modifier et supprimer TOUS les exercices de TOUS les coachs**.

```
exercices_read_all  → SELECT → true
exercices_insert    → INSERT → true
exercices_update    → UPDATE → true
exercices_delete    → DELETE → true
```

**FIX SQL :**
```sql
-- Supprimer les policies ouvertes
DROP POLICY IF EXISTS exercices_read_all ON exercices;
DROP POLICY IF EXISTS exercices_insert ON exercices;
DROP POLICY IF EXISTS exercices_update ON exercices;
DROP POLICY IF EXISTS exercices_delete ON exercices;

-- Recréer avec isolation par coach
CREATE POLICY "exercices_select" ON exercices FOR SELECT
  USING (coach_id = auth.uid() OR coach_id IS NULL);

CREATE POLICY "exercices_insert" ON exercices FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "exercices_update" ON exercices FOR UPDATE
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

CREATE POLICY "exercices_delete" ON exercices FOR DELETE
  USING (coach_id = auth.uid());
```

### CRITIQUE — Table `aliments_db` : policy ALL trop permissive

La policy `Coaches manage own aliments` a pour condition `auth.role() = 'authenticated'` → **tout user authentifié (y compris les athlètes) peut modifier/supprimer les aliments de n'importe quel coach**.

**FIX SQL :**
```sql
DROP POLICY IF EXISTS "Coaches manage own aliments" ON aliments_db;

CREATE POLICY "Coaches manage own aliments" ON aliments_db FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Garder la lecture pour les athlètes (aliments partagés)
-- La policy "Authenticated users read aliments" en SELECT est OK
```

### MOYEN — 15 policies ALL sans WITH CHECK

Ces tables ont des policies `ALL` avec une condition de lecture (USING) mais **aucune condition d'écriture** (WITH CHECK = null). Un coach pourrait théoriquement insérer des données avec le `coach_id` d'un autre coach :

| Table | Policy |
|-------|--------|
| coach_settings | coach_own |
| formations | Coaches manage own formations |
| formation_videos | Coach manages formation videos |
| np_coach (nutrition_plans) | np_coach |
| wp_coach (workout_programs) | wp_coach |
| roadmap_phases | Coaches manage roadmap |
| programming_weeks | coach_access |
| questionnaire_templates | Coach manages own templates |
| training_templates | (pas de with_check) |
| posing_retours | Coach manages posing retours |
| onboarding_workflows | coach_manage_workflows |
| push_tokens | Users manage own tokens |
| workout_sessions | ws_coach_all |
| formation_video_progress | Users manage own progress |
| questionnaire_assignments | Coach manages own assignments |

**FIX SQL (exemple pour toutes) :**
```sql
-- Modèle à appliquer sur chaque table listée ci-dessus
-- Exemple pour formations :
DROP POLICY IF EXISTS "Coaches manage own formations" ON formations;
CREATE POLICY "Coaches manage own formations" ON formations FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Exemple pour workout_programs :
DROP POLICY IF EXISTS "wp_coach" ON workout_programs;
CREATE POLICY "wp_coach" ON workout_programs FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Exemple pour nutrition_plans :
DROP POLICY IF EXISTS "np_coach" ON nutrition_plans;
CREATE POLICY "np_coach" ON nutrition_plans FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Exemple pour roadmap_phases :
DROP POLICY IF EXISTS "Coaches manage roadmap" ON roadmap_phases;
CREATE POLICY "Coaches manage roadmap" ON roadmap_phases FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Exemple pour programming_weeks :
DROP POLICY IF EXISTS "coach_access" ON programming_weeks;
CREATE POLICY "coach_access" ON programming_weeks FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Exemple pour coach_settings :
DROP POLICY IF EXISTS "coach_own" ON coach_settings;
CREATE POLICY "coach_own" ON coach_settings FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Exemple pour questionnaire_templates :
DROP POLICY IF EXISTS "Coach manages own templates" ON questionnaire_templates;
CREATE POLICY "Coach manages own templates" ON questionnaire_templates FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Exemple pour training_templates :
DROP POLICY IF EXISTS "Coaches manage their own training templates" ON training_templates;
CREATE POLICY "Coaches manage their own training templates" ON training_templates FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Exemple pour posing_retours :
DROP POLICY IF EXISTS "Coach manages posing retours" ON posing_retours;
CREATE POLICY "Coach manages posing retours" ON posing_retours FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Exemple pour onboarding_workflows :
DROP POLICY IF EXISTS "coach_manage_workflows" ON onboarding_workflows;
CREATE POLICY "coach_manage_workflows" ON onboarding_workflows FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Pour push_tokens (user_id) :
DROP POLICY IF EXISTS "Users manage own tokens" ON push_tokens;
CREATE POLICY "Users manage own tokens" ON push_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Pour formation_video_progress (user_id) :
DROP POLICY IF EXISTS "Users manage own progress" ON formation_video_progress;
CREATE POLICY "Users manage own progress" ON formation_video_progress FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Pour questionnaire_assignments :
DROP POLICY IF EXISTS "Coach manages own assignments" ON questionnaire_assignments;
CREATE POLICY "Coach manages own assignments" ON questionnaire_assignments FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Pour formation_videos (via formation_id) :
DROP POLICY IF EXISTS "Coach manages formation videos" ON formation_videos;
CREATE POLICY "Coach manages formation videos" ON formation_videos FOR ALL
  USING (formation_id IN (SELECT id FROM formations WHERE coach_id = auth.uid()))
  WITH CHECK (formation_id IN (SELECT id FROM formations WHERE coach_id = auth.uid()));

-- Pour workout_sessions (via program_id) :
DROP POLICY IF EXISTS "ws_coach_all" ON workout_sessions;
CREATE POLICY "ws_coach_all" ON workout_sessions FOR ALL
  USING (auth.uid() IN (SELECT coach_id FROM workout_programs WHERE id = workout_sessions.program_id))
  WITH CHECK (auth.uid() IN (SELECT coach_id FROM workout_programs WHERE id = workout_sessions.program_id));
```

### MOYEN — Storage : 3 policies INSERT sans condition

```
athlete_upload_own_exec_videos → INSERT → qual = null
athlete_upload_own_photos      → INSERT → qual = null
coach_upload_audio             → INSERT → qual = null
```

N'importe quel user authentifié peut uploader dans ces buckets. C'est partiellement mitigé par le fait que les buckets sont privés, mais ça permet du spam storage.

**FIX SQL :**
```sql
-- Sécuriser upload photos
DROP POLICY IF EXISTS "athlete_upload_own_photos" ON storage.objects;
CREATE POLICY "athlete_upload_own_photos" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'athlete-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Sécuriser upload videos
DROP POLICY IF EXISTS "athlete_upload_own_exec_videos" ON storage.objects;
CREATE POLICY "athlete_upload_own_exec_videos" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'execution-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Sécuriser upload audio coach
DROP POLICY IF EXISTS "coach_upload_audio" ON storage.objects;
CREATE POLICY "coach_upload_audio" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'coach-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

### FAIBLE — Storage : execution-videos lisible par tous

`authenticated_read_exec_videos` → SELECT → `bucket_id = 'execution-videos'` → Tout user authentifié peut voir TOUTES les vidéos d'exécution de tous les athlètes.

**FIX SQL :**
```sql
DROP POLICY IF EXISTS "authenticated_read_exec_videos" ON storage.objects;

-- Athlète voit ses propres vidéos
CREATE POLICY "athlete_read_own_exec_videos" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'execution-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Coach voit les vidéos de ses athlètes
CREATE POLICY "coach_read_athlete_exec_videos" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'execution-videos'
    AND (storage.foldername(name))[1] IN (
      SELECT user_id::text FROM athletes WHERE coach_id = auth.uid() AND user_id IS NOT NULL
    )
  );
```

## 1.3 TRIGGERS EN DOUBLE

5 tables ont **2 triggers `updated_at` qui font la même chose** (un appelle `set_updated_at`, l'autre `update_updated_at_column`). Ça exécute le même code 2 fois à chaque UPDATE.

| Table | Trigger 1 | Trigger 2 |
|-------|-----------|-----------|
| athletes | trg_athletes_updated_at | update_athletes_updated_at |
| nutrition_plans | trg_nutrition_plans_updated_at | update_nutrition_plans_updated_at |
| users | trg_users_updated_at | update_users_updated_at |
| workout_programs | trg_workout_programs_updated_at | update_workout_programs_updated_at |
| workout_sessions | trg_workout_sessions_updated_at | update_workout_sessions_updated_at |

**FIX SQL :**
```sql
-- Garder les trg_ (convention cohérente), supprimer les update_
DROP TRIGGER IF EXISTS update_athletes_updated_at ON athletes;
DROP TRIGGER IF EXISTS update_nutrition_plans_updated_at ON nutrition_plans;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_workout_programs_updated_at ON workout_programs;
DROP TRIGGER IF EXISTS update_workout_sessions_updated_at ON workout_sessions;

-- Supprimer la fonction dupliquée (vérifier qu'elle n'est plus utilisée)
-- DROP FUNCTION IF EXISTS update_updated_at_column();
```

## 1.4 COLONNES NULLABLE QUI NE DEVRAIENT PAS L'ÊTRE

| Table | Colonne | Risque |
|-------|---------|--------|
| athletes | prenom | Athlète sans prénom = bug affichage |
| athletes | nom | Athlète sans nom = bug affichage |
| athletes | email | Athlète sans email = impossible de se connecter |
| athlete_onboarding | athlete_id | Onboarding sans athlète = orphelin |
| programming_weeks | athlete_id | Semaine sans athlète = orphelin |
| programming_weeks | coach_id | Semaine sans coach = orphelin |
| roadmap_phases | coach_id | Phase sans coach = orphelin |
| roadmap_phases | athlete_id | Phase sans athlète = orphelin |
| onboarding_workflows | coach_id | Workflow sans coach = orphelin |

**FIX SQL :**
```sql
-- ATTENTION: vérifier qu'il n'y a pas de NULL existants avant chaque ALTER
-- SELECT count(*) FROM athletes WHERE prenom IS NULL;

ALTER TABLE athletes ALTER COLUMN prenom SET NOT NULL;
ALTER TABLE athletes ALTER COLUMN nom SET NOT NULL;
ALTER TABLE athletes ALTER COLUMN email SET NOT NULL;
ALTER TABLE athlete_onboarding ALTER COLUMN athlete_id SET NOT NULL;
ALTER TABLE programming_weeks ALTER COLUMN athlete_id SET NOT NULL;
ALTER TABLE programming_weeks ALTER COLUMN coach_id SET NOT NULL;
ALTER TABLE roadmap_phases ALTER COLUMN coach_id SET NOT NULL;
ALTER TABLE roadmap_phases ALTER COLUMN athlete_id SET NOT NULL;
ALTER TABLE onboarding_workflows ALTER COLUMN coach_id SET NOT NULL;
```

## 1.5 INDEX MANQUANTS

Colonnes fréquemment filtrées (dans les queries app + dans les policies RLS) sans index dédié :

| Table | Colonne | Pourquoi c'est important |
|-------|---------|--------------------------|
| bilan_retours | coach_id | Filtré dans la policy RLS à chaque requête |
| exercices | coach_id | Filtré dans la future policy RLS |
| formations | coach_id | Filtré dans la policy RLS |
| nutrition_templates | coach_id | Filtré dans la policy RLS |
| training_templates | coach_id | Filtré dans la policy RLS |
| onboarding_workflows | coach_id | Filtré dans la policy RLS |
| posing_retours | coach_id | Filtré dans la policy RLS |
| posing_videos | coach_id | Filtré dans la policy RLS |
| roadmap_phases | status | Filtré dans l'app coach |
| nutrition_plans | actif | Filtré dans l'app coach |
| workout_programs | actif | Filtré dans l'app coach |

**FIX SQL :**
```sql
CREATE INDEX IF NOT EXISTS idx_bilan_retours_coach ON bilan_retours(coach_id);
CREATE INDEX IF NOT EXISTS idx_exercices_coach ON exercices(coach_id);
CREATE INDEX IF NOT EXISTS idx_formations_coach ON formations(coach_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_templates_coach ON nutrition_templates(coach_id);
CREATE INDEX IF NOT EXISTS idx_training_templates_coach ON training_templates(coach_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_workflows_coach ON onboarding_workflows(coach_id);
CREATE INDEX IF NOT EXISTS idx_posing_retours_coach ON posing_retours(coach_id);
CREATE INDEX IF NOT EXISTS idx_posing_videos_coach ON posing_videos(coach_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_phases_status ON roadmap_phases(status);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_actif ON nutrition_plans(athlete_id, actif);
CREATE INDEX IF NOT EXISTS idx_workout_programs_actif ON workout_programs(athlete_id, actif);
```

## 1.6 TABLES VIDES (potentiellement inutiles)

| Table | Lignes | Dead rows | Statut |
|-------|--------|-----------|--------|
| programming_weeks | 0 | 40 | Utilisée dans le code → garder |
| biz_clients | 0 | 0 | Utilisée dans business.js → garder |
| formation_video_progress | 0 | 4 | Utilisée dans formations.js → garder |
| exercise_settings | 0 | 0 | Utilisée dans l'app mobile → garder |
| messages | 0 | 0 | Pas utilisée dans le code coach → A VÉRIFIER |
| posing_retours | 0 | 0 | Utilisée dans posing.js → garder |

## 1.7 DEAD ROWS (lignes mortes)

Plusieurs tables ont beaucoup de dead rows par rapport aux lignes vivantes. Ça impacte la performance des scans.

| Table | Vivantes | Mortes | Ratio |
|-------|----------|--------|-------|
| nutrition_plans | 34 | 50 | 1.5x |
| execution_videos | 5 | 34 | 6.8x |
| roadmap_phases | 3 | 40 | 13x |
| users | 3 | 41 | 14x |
| daily_tracking | 1 | 29 | 29x |
| athletes | 1 | 28 | 28x |
| programming_weeks | 0 | 40 | ∞ |
| workout_logs | 6 | 31 | 5x |

**FIX SQL :**
```sql
-- Forcer un VACUUM sur les tables les plus touchées
VACUUM ANALYZE athletes;
VACUUM ANALYZE users;
VACUUM ANALYZE daily_tracking;
VACUUM ANALYZE roadmap_phases;
VACUUM ANALYZE execution_videos;
VACUUM ANALYZE programming_weeks;
VACUUM ANALYZE nutrition_plans;
VACUUM ANALYZE workout_logs;
```

## 1.8 COLONNES JSON SANS VALIDATION

17 colonnes JSONB sans contrainte CHECK → données corrompues possibles.

Tables les plus à risque :
- `nutrition_plans.meals_data` + `repas_detail` (2 colonnes JSON pour la même info ?)
- `workout_sessions.exercices`
- `workout_logs.exercices_completes`
- `workout_programs.pattern_data`

**Question** : `nutrition_plans` a `meals_data` ET `repas_detail` en JSONB — est-ce que les deux sont utilisées ou l'une est obsolète ?

---

# PARTIE 2 : AUDIT APP COACH (code)

## 2.1 SÉCURITÉ CODE

### CRITIQUE — Clés API hardcodées (config.js)

```javascript
const SUPABASE_URL = 'https://kczcqnasnjufkgbnrbvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOi...';
const PUSH_SECRET = 'prc-push-2026-secret';
```

Visible par n'importe qui dans le DevTools. Le `SUPABASE_KEY` est l'anon key (pas le service role), donc le risque est limité par le RLS, mais le `PUSH_SECRET` permet à quiconque de forger des push notifications.

**FIX** : Déplacer `PUSH_SECRET` dans une variable d'environnement Vercel. L'anon key Supabase côté client est un pattern normal, mais il faut s'assurer que le RLS est solide (cf. partie 1).

### MOYEN — 297 innerHTML sans échappement systématique

`escHtml()` existe dans utils.js mais n'est pas utilisé partout. Chaque `innerHTML` est un vecteur XSS potentiel.

### MOYEN — Aucune validation d'input

Les formulaires envoient les données brutes. Pas de trim, pas de min/max, pas de validation de format email.

## 2.2 PERFORMANCE CODE

### Pas de pagination
- `dashboard.js` : charge 500 reports
- `videos.js` : charge 200 vidéos
- Aucune liste n'a de `.range()`

### Pas de cache
- Chaque changement d'onglet refetch tout
- Aucun cache mémoire, aucun localStorage

### 23 fichiers JS chargés en synchrone
- Pas de `defer`, pas de lazy loading
- ~300 KB non minifié

## 2.3 QUALITÉ CODE

### State management global
- Variables `window.*` partout
- Race conditions possibles entre onglets

### Fichiers trop gros
- `nutrition.js` : 1,118 lignes
- `videos.js` : 902 lignes

### Code dupliqué
- Pattern JSON parse x16
- Logique modale dupliquée partout

### Variables mortes
- `LOCALE_FR` déclarée jamais utilisée
- `DEFAULT_WATER_GOAL` déclarée jamais utilisée

---

# PARTIE 3 : PLAN D'ACTION COMPLET

## PRIORITÉ 1 — Sécurité Supabase (URGENT)

- [ ] 1. Fixer les policies `exercices` (condition `true` → `coach_id = auth.uid()`)
- [ ] 2. Fixer la policy `aliments_db` ALL (authenticated → coach_id)
- [ ] 3. Ajouter `WITH CHECK` aux 15 policies ALL sans condition d'écriture
- [ ] 4. Sécuriser les 3 policies INSERT storage (ajouter vérification folder = uid)
- [ ] 5. Restreindre SELECT execution-videos storage (tout user → owner/coach seulement)

## PRIORITÉ 2 — Intégrité Supabase

- [ ] 6. Supprimer les 5 triggers en double
- [ ] 7. Mettre NOT NULL sur athletes.prenom/nom/email
- [ ] 8. Mettre NOT NULL sur les colonnes _id critiques (athlete_onboarding, programming_weeks, roadmap_phases, onboarding_workflows)
- [ ] 9. Ajouter les 11 index manquants
- [ ] 10. Lancer VACUUM ANALYZE sur les tables avec beaucoup de dead rows
- [ ] 11. Vérifier si `nutrition_plans.repas_detail` est obsolète (doublon avec `meals_data` ?)

## PRIORITÉ 3 — Sécurité Code

- [ ] 12. Déplacer PUSH_SECRET dans les env vars Vercel
- [ ] 13. Auditer les 297 innerHTML et ajouter escHtml systématiquement
- [ ] 14. Ajouter validation d'input sur tous les formulaires

## PRIORITÉ 4 — Performance Code

- [ ] 15. Ajouter pagination (.range()) sur toutes les listes
- [ ] 16. Ajouter cache mémoire pour les données stables (aliments, templates)
- [ ] 17. Ajouter defer/async sur les scripts
- [ ] 18. Minifier le JS pour la production

## PRIORITÉ 5 — Qualité Code

- [ ] 19. Refactor nutrition.js (split en modules)
- [ ] 20. Refactor videos.js (split)
- [ ] 21. Extraire les patterns dupliqués en utilitaires
- [ ] 22. Supprimer les variables mortes
- [ ] 23. Centraliser le state

---

# SQL COMPLET À EXÉCUTER (tout en un)

Exécuter dans l'ordre :

```sql
-- ================================================
-- ÉTAPE 1 : FIXER LES POLICIES CRITIQUES
-- ================================================

-- 1A. exercices
DROP POLICY IF EXISTS exercices_read_all ON exercices;
DROP POLICY IF EXISTS exercices_insert ON exercices;
DROP POLICY IF EXISTS exercices_update ON exercices;
DROP POLICY IF EXISTS exercices_delete ON exercices;

CREATE POLICY "exercices_select" ON exercices FOR SELECT
  USING (coach_id = auth.uid() OR coach_id IS NULL);
CREATE POLICY "exercices_insert" ON exercices FOR INSERT
  WITH CHECK (coach_id = auth.uid());
CREATE POLICY "exercices_update" ON exercices FOR UPDATE
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
CREATE POLICY "exercices_delete" ON exercices FOR DELETE
  USING (coach_id = auth.uid());

-- 1B. aliments_db
DROP POLICY IF EXISTS "Coaches manage own aliments" ON aliments_db;
CREATE POLICY "Coaches manage own aliments" ON aliments_db FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ================================================
-- ÉTAPE 2 : AJOUTER WITH CHECK AUX POLICIES ALL
-- ================================================

DROP POLICY IF EXISTS "coach_own" ON coach_settings;
CREATE POLICY "coach_own" ON coach_settings FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches manage own formations" ON formations;
CREATE POLICY "Coaches manage own formations" ON formations FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "np_coach" ON nutrition_plans;
CREATE POLICY "np_coach" ON nutrition_plans FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "wp_coach" ON workout_programs;
CREATE POLICY "wp_coach" ON workout_programs FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches manage roadmap" ON roadmap_phases;
CREATE POLICY "Coaches manage roadmap" ON roadmap_phases FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "coach_access" ON programming_weeks;
CREATE POLICY "coach_access" ON programming_weeks FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coach manages own templates" ON questionnaire_templates;
CREATE POLICY "Coach manages own templates" ON questionnaire_templates FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches manage their own training templates" ON training_templates;
CREATE POLICY "Coaches manage their own training templates" ON training_templates FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coach manages posing retours" ON posing_retours;
CREATE POLICY "Coach manages posing retours" ON posing_retours FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "coach_manage_workflows" ON onboarding_workflows;
CREATE POLICY "coach_manage_workflows" ON onboarding_workflows FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own tokens" ON push_tokens;
CREATE POLICY "Users manage own tokens" ON push_tokens FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own progress" ON formation_video_progress;
CREATE POLICY "Users manage own progress" ON formation_video_progress FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Coach manages own assignments" ON questionnaire_assignments;
CREATE POLICY "Coach manages own assignments" ON questionnaire_assignments FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coach manages formation videos" ON formation_videos;
CREATE POLICY "Coach manages formation videos" ON formation_videos FOR ALL
  USING (formation_id IN (SELECT id FROM formations WHERE coach_id = auth.uid()))
  WITH CHECK (formation_id IN (SELECT id FROM formations WHERE coach_id = auth.uid()));

DROP POLICY IF EXISTS "ws_coach_all" ON workout_sessions;
CREATE POLICY "ws_coach_all" ON workout_sessions FOR ALL
  USING (auth.uid() IN (SELECT coach_id FROM workout_programs WHERE id = workout_sessions.program_id))
  WITH CHECK (auth.uid() IN (SELECT coach_id FROM workout_programs WHERE id = workout_sessions.program_id));

-- ================================================
-- ÉTAPE 3 : STORAGE POLICIES
-- ================================================

DROP POLICY IF EXISTS "athlete_upload_own_photos" ON storage.objects;
CREATE POLICY "athlete_upload_own_photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'athlete-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "athlete_upload_own_exec_videos" ON storage.objects;
CREATE POLICY "athlete_upload_own_exec_videos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'execution-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "coach_upload_audio" ON storage.objects;
CREATE POLICY "coach_upload_audio" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'coach-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "authenticated_read_exec_videos" ON storage.objects;
CREATE POLICY "athlete_read_own_exec_videos" ON storage.objects FOR SELECT
  USING (bucket_id = 'execution-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "coach_read_athlete_exec_videos" ON storage.objects FOR SELECT
  USING (bucket_id = 'execution-videos' AND (storage.foldername(name))[1] IN (
    SELECT user_id::text FROM athletes WHERE coach_id = auth.uid() AND user_id IS NOT NULL
  ));

-- ================================================
-- ÉTAPE 4 : TRIGGERS EN DOUBLE
-- ================================================

DROP TRIGGER IF EXISTS update_athletes_updated_at ON athletes;
DROP TRIGGER IF EXISTS update_nutrition_plans_updated_at ON nutrition_plans;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_workout_programs_updated_at ON workout_programs;
DROP TRIGGER IF EXISTS update_workout_sessions_updated_at ON workout_sessions;

-- ================================================
-- ÉTAPE 5 : INDEX MANQUANTS
-- ================================================

CREATE INDEX IF NOT EXISTS idx_bilan_retours_coach ON bilan_retours(coach_id);
CREATE INDEX IF NOT EXISTS idx_exercices_coach ON exercices(coach_id);
CREATE INDEX IF NOT EXISTS idx_formations_coach ON formations(coach_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_templates_coach ON nutrition_templates(coach_id);
CREATE INDEX IF NOT EXISTS idx_training_templates_coach ON training_templates(coach_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_workflows_coach ON onboarding_workflows(coach_id);
CREATE INDEX IF NOT EXISTS idx_posing_retours_coach ON posing_retours(coach_id);
CREATE INDEX IF NOT EXISTS idx_posing_videos_coach ON posing_videos(coach_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_phases_status ON roadmap_phases(status);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_actif ON nutrition_plans(athlete_id, actif);
CREATE INDEX IF NOT EXISTS idx_workout_programs_actif ON workout_programs(athlete_id, actif);

-- ================================================
-- ÉTAPE 6 : VACUUM
-- ================================================

VACUUM ANALYZE athletes;
VACUUM ANALYZE users;
VACUUM ANALYZE daily_tracking;
VACUUM ANALYZE roadmap_phases;
VACUUM ANALYZE execution_videos;
VACUUM ANALYZE programming_weeks;
VACUUM ANALYZE nutrition_plans;
VACUUM ANALYZE workout_logs;
```
