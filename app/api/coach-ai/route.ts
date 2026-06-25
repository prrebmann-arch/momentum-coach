import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

// ── intent detection — only load relevant data ────────────────────────────────

function detectIntent(text: string): 'training' | 'nutrition' | 'both' {
  const lower = text.toLowerCase()
  const trainingKw = ['programme', 'entraîn', 'séance', 'session', 'push', 'pull', 'upper', 'lower', 'legs', 'ppl', 'split', 'exercice', 'muscl', 'squat', 'bench', 'deadlift', 'template']
  const nutritionKw = ['plan', 'diète', 'diete', 'repas', 'aliment', 'calorie', 'protéine', 'proteines', 'nutrition', 'kcal', 'macro', 'glucide', 'lipide', 'manger', 'alimentation', 'calories']
  const isT = trainingKw.some(w => lower.includes(w))
  const isN = nutritionKw.some(w => lower.includes(w))
  if (isT && !isN) return 'training'
  if (isN && !isT) return 'nutrition'
  return 'both'
}

// ── system prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(params: {
  athleteName: string
  athleteProfile: string
  existingPrograms: string
  existingNutrition: string
  exercicesJson: string
  alimentsJson: string
  nutritionTemplatesJson: string
  trainingTemplatesJson: string
  intent: 'training' | 'nutrition' | 'both'
}): string {
  const {
    athleteName, athleteProfile, existingPrograms, existingNutrition,
    exercicesJson, alimentsJson, nutritionTemplatesJson, trainingTemplatesJson, intent,
  } = params

  const trainingSection = intent !== 'nutrition' ? `
EXERCICES DISPONIBLES (utilise UNIQUEMENT ces exercices — référence par exercice_id) :
${exercicesJson}

TEMPLATES ENTRAÎNEMENT (copie sessions_data directement si le coach en référence un par nom) :
${trainingTemplatesJson}` : ''

  const nutritionSection = intent !== 'training' ? `
ALIMENTS DISPONIBLES (utilise UNIQUEMENT ces aliments — référence par le champ "nom" exact) :
${alimentsJson}

TEMPLATES NUTRITION (copie meals_data directement si le coach en référence un par nom) :
${nutritionTemplatesJson}` : ''

  return `Tu es l'assistant IA du coach sur l'app Momentum — expert en programmation sportive et nutrition sportive.
Tu travailles sur l'athlète : ${athleteName}.

## PROFIL ATHLÈTE
${athleteProfile}

## PROGRAMMES EN COURS
${existingPrograms}

## PLANS NUTRITIONNELS EN COURS
${existingNutrition}
${trainingSection}${nutritionSection}

## RÈGLES DE COMPORTEMENT
1. **Autonomie maximale** : fais des choix techniques toi-même (sélection d'exercices, volumes, intensité, répartition des macros, timing des repas). Ne demande une clarification QUE si une info BLOQUANTE manque (ex: nombre de séances souhaité, objectif calorique précis).
2. **Une seule clarification** : si tu dois clarifier, liste TOUTES tes questions en une seule fois. Jamais deux rounds de questions.
3. **Après clarification → génère directement** : quand le coach répond, produis le plan complet sans redemander.
4. **Exercices** : uniquement dans la liste fournie. Si un exercice demandé est absent, signale-le dans la clarification.
5. **Aliments** : uniquement dans la liste fournie, référencés par leur champ "nom" exact. Ne invente pas d'aliment absent.
6. **Templates** : si le coach cite un template par nom, copie ses données exactement (sessions_data ou meals_data), puis applique les modifications demandées.

## CONVENTIONS DE L'APP
- **tempo** : "excentrique-pause basse-concentrique-pause haute" → ex: "3-1-2-0"
- **repos** : en secondes → ex: 90
- **reps** : plage recommandée → ex: "8-10"
- **pattern_type** : "fixed" (jours de la semaine fixes) | "flexible" (ordre libre)
- **meal_type** : "training" (jour d'entraînement) | "rest" (jour de repos) | "both" (universel)

## SCHÉMAS DE SORTIE

CLARIFICATION (infos bloquantes manquantes) :
{"type":"clarification","questions":["question 1","question 2"]}

PROGRAMME — créer :
{"type":"preview","action":"create_program","summary":"1-2 phrases","data":{"nom":"string","pattern_type":"fixed","sessions":[{"nom":"string","jour":1,"ordre":0,"exercices":[{"exercice_id":"uuid","nom":"string","muscle_principal":"string","sets":[{"type":"normal","reps":"8-10","tempo":"3-1-2-0","repos":90,"kg":null}]}]}]}}

PROGRAMME — modifier (inclure programme_id) :
{"type":"preview","action":"update_program","summary":"1-2 phrases","data":{"programme_id":"uuid","nom":"string","pattern_type":"fixed","sessions":[...]}}

NUTRITION — plan unique :
{"type":"preview","action":"create_nutrition","summary":"1-2 phrases","data":{"nom":"string","meal_type":"both","calories_objectif":2500,"proteines":180,"glucides":300,"lipides":70,"meals_data":[{"nom":"Petit-déjeuner","foods":[{"nom":"Flocons d'avoine/farine d'avoine","qte":80,"kcal":312,"p":10.4,"g":54,"l":5.6}]}]}}

NUTRITION — jour ON + jour OFF (même nom partagé pour grouper dans l'app) :
{"type":"preview","action":"create_nutrition_pair","summary":"1-2 phrases","data":{"nom":"string — nom commun","training":{"meal_type":"training","calories_objectif":2800,"proteines":200,"glucides":350,"lipides":70,"meals_data":[...]},"rest":{"meal_type":"rest","calories_objectif":2200,"proteines":190,"glucides":250,"lipides":65,"meals_data":[...]}}}

NUTRITION — modifier (inclure plan_id) :
{"type":"preview","action":"update_nutrition","summary":"1-2 phrases","data":{"plan_id":"uuid","nom":"string","meal_type":"training","calories_objectif":2500,"proteines":180,"glucides":300,"lipides":70,"meals_data":[...]}}`
}

// ── route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const { athleteId, instruction, clarifications } = await req.json()
  if (!athleteId || !instruction) {
    return NextResponse.json({ error: 'missing athleteId or instruction' }, { status: 400 })
  }

  const intent = detectIntent(clarifications ? `${instruction} ${clarifications}` : instruction)

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  const { data: athlete } = await admin
    .from('athletes')
    .select('id, prenom, nom, objectif')
    .eq('id', athleteId)
    .eq('coach_id', user.id)
    .single()
  if (!athlete) return NextResponse.json({ error: 'athlete not found or forbidden' }, { status: 404 })

  const needsTraining = intent !== 'nutrition'
  const needsNutrition = intent !== 'training'

  const [progsRes, nutrRes, weekRes, exsRes, trainingTplRes, alimRes, nutritionTplRes] = await Promise.all([
    admin.from('workout_programs').select('id, nom, workout_sessions(nom, jour, ordre)').eq('athlete_id', athleteId).limit(20),
    admin.from('nutrition_plans').select('id, nom, meal_type, calories_objectif, proteines, glucides, lipides').eq('athlete_id', athleteId).limit(20),
    admin.from('programming_weeks').select('pdc_moyenne, week_date').eq('athlete_id', athleteId).order('week_date', { ascending: false }).limit(1),
    needsTraining
      ? admin.from('exercices').select('id, nom, muscle_principal, categorie').or(`coach_id.eq.${user.id},coach_id.is.null`).limit(500)
      : Promise.resolve({ data: [] }),
    needsTraining
      ? admin.from('training_templates').select('id, nom, category, sessions_data').eq('coach_id', user.id).limit(50)
      : Promise.resolve({ data: [] }),
    needsNutrition
      ? admin.from('aliments_db').select('id, nom, calories, proteines, glucides, lipides').or(`coach_id.eq.${user.id},coach_id.is.null`).limit(1000)
      : Promise.resolve({ data: [] }),
    needsNutrition
      ? admin.from('nutrition_templates').select('id, nom, template_type, category, calories_objectif, proteines, glucides, lipides, meals_data').eq('coach_id', user.id).limit(50)
      : Promise.resolve({ data: [] }),
  ])

  // Build athlete profile context
  const latestWeight = (weekRes as any)?.data?.[0]?.pdc_moyenne
  const athleteProfile = JSON.stringify({
    objectif: athlete.objectif || 'non renseigné',
    ...(latestWeight ? { poids_actuel_kg: latestWeight } : {}),
  })

  const nutritionTemplates = ((nutritionTplRes as any)?.data || []).map((t: any) => ({
    ...t,
    meals_data: (() => { try { return typeof t.meals_data === 'string' ? JSON.parse(t.meals_data) : t.meals_data } catch { return [] } })(),
  }))

  const systemPrompt = buildSystemPrompt({
    athleteName: `${athlete.prenom} ${athlete.nom}`,
    athleteProfile,
    existingPrograms: JSON.stringify((progsRes as any)?.data || []),
    existingNutrition: JSON.stringify((nutrRes as any)?.data || []),
    exercicesJson: JSON.stringify((exsRes as any)?.data || []),
    alimentsJson: JSON.stringify((alimRes as any)?.data || []),
    nutritionTemplatesJson: JSON.stringify(nutritionTemplates),
    trainingTemplatesJson: JSON.stringify((trainingTplRes as any)?.data || []),
    intent,
  })

  const userMessage = clarifications
    ? `Instruction initiale : ${instruction}\n\nRéponses aux questions : ${clarifications}`
    : instruction

  const tools: Anthropic.Tool[] = [
    {
      name: 'respond',
      description: 'Retourne soit une demande de clarification soit un aperçu complet prêt à créer.',
      input_schema: {
        type: 'object' as const,
        properties: {
          type: { type: 'string', enum: ['clarification', 'preview'] },
          questions: { type: 'array', items: { type: 'string' }, description: 'Uniquement si type=clarification' },
          action: { type: 'string', enum: ['create_program', 'update_program', 'create_nutrition', 'create_nutrition_pair', 'update_nutrition'], description: 'Uniquement si type=preview' },
          summary: { type: 'string', description: 'Uniquement si type=preview — 1-2 phrases' },
          data: { type: 'object', description: 'Uniquement si type=preview — le programme ou plan complet selon le schéma' },
        },
        required: ['type'],
      },
    },
  ]

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  let parsed: unknown
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: systemPrompt,
      tools,
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: userMessage }],
    })
    const toolBlock = response.content.find((b) => b.type === 'tool_use')
    if (toolBlock && toolBlock.type === 'tool_use') {
      parsed = toolBlock.input
    } else {
      throw new Error('no tool_use block in response')
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[coach-ai] claude error', e)
    return NextResponse.json({ error: 'claude_error', detail: msg }, { status: 502 })
  }

  return NextResponse.json(parsed)
}
