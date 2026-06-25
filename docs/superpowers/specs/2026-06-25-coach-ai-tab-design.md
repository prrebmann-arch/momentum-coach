# Coach AI Tab — Design Spec
**Date:** 2026-06-25  
**Scope:** Coach-side only (`/athletes/[id]/ia`)  
**Status:** Approved

---

## Overview

A dedicated "IA" tab on each athlete page that lets the coach describe in natural language what he wants to create or modify (training program or nutrition plan). Claude generates a structured preview; the coach confirms before anything is written to the DB.

---

## User Flow

```
1. Coach opens /athletes/[id]/ia
2. Types a free-form instruction in French
   e.g. "Crée un programme 4 séances Push/Pull/Legs/Full.
        Séance 1 Push: développé couché 4x8, dips 3x12, élévations latérales 3x15"
3. Clicks "Envoyer"
4. Server gathers athlete context + available exercises + available foods
5. Claude analyzes the instruction:
   a) If critical info is missing → returns a grouped list of questions
      Coach answers in a second text field → re-submit
   b) If complete → returns structured preview JSON
6. UI renders a human-readable preview:
   - Program: sessions → exercises → sets/reps
   - Nutrition: meals → foods → macro totals
7. Coach clicks "Créer" (or "Appliquer")
8. /api/coach-ai/apply writes to DB
```

---

## Architecture

### New Files

| Path | Role |
|---|---|
| `app/(app)/athletes/[id]/ia/page.tsx` | New athlete tab: UI (form, clarification, preview) |
| `app/api/coach-ai/route.ts` | POST — calls Claude, returns clarification or preview |
| `app/api/coach-ai/apply/route.ts` | POST — writes validated preview to DB |

### Athlete Nav

Add "IA" tab to the existing athlete navigation alongside Training, Nutrition, Roadmap, etc.

---

## API: `/api/coach-ai` (POST)

### Request
```ts
{
  athleteId: string
  instruction: string           // coach's free-form text
  clarifications?: string       // optional: answers to Claude's questions
}
```

### Server-side context gathering (before calling Claude)

Load from Supabase in parallel:
- **Athlete**: name, current roadmap phase
- **Existing programs**: `workout_programs` → for each: id, nom, sessions with exercises list
- **Existing nutrition plans**: `nutrition_plans` → id, nom, calories_objectif, proteines, glucides, lipides, meals_data
- **Available exercises**: `exercices` where `coach_id = user.id OR coach_id IS NULL` → id, nom, muscle_principal, muscle_secondaire, categorie
- **Available foods**: `aliments_db` where `coach_id = user.id OR coach_id IS NULL` → id, nom, calories, proteines, glucides, lipides (per 100g)

### Claude call

- **Model**: `claude-sonnet-4-6` (fast, cheap, sufficient for structured generation)
- **System prompt** (see section below)
- **User message**: instruction + optional clarifications

### Response (one of two shapes)

```ts
// When info is missing
{ type: 'clarification', questions: string[] }

// When ready to generate
{
  type: 'preview',
  action: 'create_program' | 'update_program' | 'create_nutrition' | 'update_nutrition',
  summary: string,   // 1-2 sentence human description of what will happen
  data: ProgramData | NutritionData
}
```

---

## Claude System Prompt

```
Tu es l'assistant IA du coach Pierre sur l'app Momentum.
Tu travailles TOUJOURS sur un athlète spécifique : {athleteName}.

RÈGLES STRICTES :
1. Tu n'utilises QUE les exercices de la liste fournie (champ "exercices_disponibles").
   Ne crée jamais un exercice qui n'y est pas. Si l'exercice demandé n'existe pas, signale-le.
2. Tu n'utilises QUE les aliments de la liste fournie (champ "aliments_disponibles").
   Ne crée jamais un aliment qui n'y est pas. Si l'aliment demandé n'existe pas, signale-le.
3. Si des informations critiques manquent (jour d'une séance, nombre de séries, aliment non précisé),
   liste TOUTES les questions manquantes en une seule réponse JSON de type "clarification".
   Ne génère pas un programme incomplet.
4. Quand tu génères, retourne UNIQUEMENT du JSON valide correspondant au schéma demandé.
   Pas de texte libre, pas de markdown autour du JSON.

CONTEXTE ATHLÈTE :
{athleteContext}

EXERCICES DISPONIBLES :
{exercicesJson}

ALIMENTS DISPONIBLES :
{alimentsJson}
```

---

## Output JSON Schemas

### create_program / update_program

```ts
{
  programme_id?: string        // if update_program: which one to update
  nom: string
  pattern_type: 'fixed'
  sessions: Array<{
    nom: string                // e.g. "Séance 1 — Push"
    jour: number               // 1–7 (lundi–dimanche)
    ordre: number
    exercices: Array<{
      exercice_id: string      // must exist in exercices_disponibles
      nom: string
      muscle_principal: string
      sets: Array<{
        type: 'normal' | 'warmup' | 'dropset'
        reps: string           // e.g. "8-10" or "12"
        tempo: string          // e.g. "3-1-2-0"
        repos: number          // seconds
        kg: number | null
      }>
    }>
  }>
}
```

### create_nutrition / update_nutrition

```ts
{
  plan_id?: string             // if update: which plan
  nom: string
  meal_type: 'training' | 'rest' | 'both'
  calories_objectif: number
  proteines: number
  glucides: number
  lipides: number
  meals_data: Array<{
    meal_index: number
    nom: string                // e.g. "Petit-déjeuner"
    foods: Array<{
      aliment_id: string       // must exist in aliments_disponibles
      nom: string
      qte: number              // grams
      kcal: number             // computed: qte/100 * calories
      p: number
      g: number
      l: number
    }>
  }>
}
```

---

## API: `/api/coach-ai/apply` (POST)

Receives the validated `data` object and `action` string from the preview.

- `create_program`: inserts into `workout_programs` + N `workout_sessions` rows
- `update_program`: deletes existing `workout_sessions` for that program, re-inserts with new data (full replace, not partial merge)
- `create_nutrition`: inserts into `nutrition_plans`
- `update_nutrition`: updates `meals_data`, `calories_objectif`, macros on the existing `nutrition_plans` row (full replace of meals_data)

Uses Supabase service role (same as other API routes).

---

## UI: `/athletes/[id]/ia/page.tsx`

### States

1. **Idle** — Large textarea + "Envoyer" button. Short placeholder examples.
2. **Loading** — Spinner while calling `/api/coach-ai`
3. **Clarification** — List of Claude's questions displayed. A second textarea for answers. "Envoyer les réponses" button.
4. **Preview** — Human-readable card showing what will be created/modified:
   - Program preview: sessions stacked, each session shows exercises + sets
   - Nutrition preview: meals stacked, each meal shows foods + macros row + total macros
   - Two buttons: "Créer / Appliquer" (calls /apply) and "Modifier ma demande" (back to idle)
5. **Success** — "Créé !" confirmation with link to the training/nutrition page

### No conversation history

Each interaction is independent. No session storage between visits.

---

## Constraints & Non-Goals

- **Coach-side only** — athletes never see or trigger this tab
- **No new exercises/foods created** — Claude can only use existing DB entries
- **No free-form chat** — input → preview → apply, not a chatbot
- **No history persistence** — no table to store past AI requests
- **French language** — Claude always responds in French
- **API key** — uses existing `ANTHROPIC_API_KEY` env var, no per-coach configuration

---

## Error Handling

- Exercise not found in DB → Claude flags it in the clarification response, doesn't hallucinate
- Food not found in DB → same
- Claude returns malformed JSON → API returns a generic error, coach retries
- Supabase write fails → standard toast error, no partial writes (transactions where possible)
