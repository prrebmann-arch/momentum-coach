import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

const SYSTEM_PROMPT_TEMPLATE = `Tu es l'assistant IA du coach sur l'app Momentum.
Tu travailles TOUJOURS sur un athlète spécifique : {athleteName}.

RÈGLES STRICTES :
1. Tu n'utilises QUE les exercices de la liste fournie (champ "exercices_disponibles").
   Ne crée jamais un exercice qui n'y est pas. Si l'exercice demandé n'existe pas, signale-le dans la clarification.
2. Tu n'utilises QUE les aliments de la liste fournie (champ "aliments_disponibles").
   Ne crée jamais un aliment qui n'y est pas. Si l'aliment demandé n'existe pas, signale-le dans la clarification.
3. Si des informations critiques manquent, liste TOUTES les questions en une seule réponse JSON de type "clarification".
   Ne génère pas un programme incomplet.
4. Quand le coach a fourni des réponses aux clarifications, GÉNÈRE LE PROGRAMME COMPLET sans poser d'autres questions.
   Fais les meilleurs choix possibles avec les infos disponibles. N'interromps plus le flux.
5. Ta réponse est EXCLUSIVEMENT un objet JSON. ZÉRO texte avant ou après. ZÉRO markdown. ZÉRO explication.
   La première chose que tu écris est { et la dernière est }. Rien d'autre.

CONTEXTE ATHLÈTE :
{athleteContext}

EXERCICES DISPONIBLES :
{exercicesJson}

ALIMENTS DISPONIBLES :
{alimentsJson}

TEMPLATES NUTRITION DISPONIBLES :
Ces templates sont des journées ou repas pré-construits par le coach.
- template_type 'jour' ou 'repas' : meals_data est un tableau de repas → copier directement dans meals_data du plan.
- template_type 'diete' : meals_data contient { training: { meals: [...] }, rest: { meals: [...] } } → extraire la bonne journée.
Quand le coach référence un template par nom, copie ses meals_data dans le plan (sans modifier les aliments).
{templatesJson}

SCHÉMA CLARIFICATION (quand il manque des infos) :
{"type":"clarification","questions":["question 1","question 2"]}

SCHÉMA PROGRAMME (create) :
{"type":"preview","action":"create_program","summary":"1-2 phrases","data":{"nom":"string","pattern_type":"fixed","sessions":[{"nom":"string","jour":1,"ordre":0,"exercices":[{"exercice_id":"uuid","nom":"string","muscle_principal":"string","sets":[{"type":"normal","reps":"8-10","tempo":"3-1-2-0","repos":90,"kg":null}]}]}]}}

SCHÉMA PROGRAMME (update — inclure programme_id) :
{"type":"preview","action":"update_program","summary":"1-2 phrases","data":{"programme_id":"uuid","nom":"string","pattern_type":"fixed","sessions":[...]}}

SCHÉMA NUTRITION plan unique (create) :
{"type":"preview","action":"create_nutrition","summary":"1-2 phrases","data":{"nom":"string","meal_type":"both","calories_objectif":2500,"proteines":180,"glucides":300,"lipides":70,"meals_data":[{"meal_index":0,"nom":"Petit-déjeuner","foods":[{"aliment_id":"uuid","nom":"string","qte":100,"kcal":350,"p":12,"g":45,"l":8}]}]}}

SCHÉMA NUTRITION jour ON + jour OFF (create_nutrition_pair) — utilise ce schéma quand le coach veut deux journées distinctes :
IMPORTANT : "nom" à la racine de data = nom PARTAGÉ des deux plans (ils s'affichent sous la même diète).
{"type":"preview","action":"create_nutrition_pair","summary":"1-2 phrases","data":{"nom":"string — nom commun (ex: Prise de Masse)","training":{"meal_type":"training","calories_objectif":2800,"proteines":200,"glucides":350,"lipides":70,"meals_data":[...]},"rest":{"meal_type":"rest","calories_objectif":2200,"proteines":190,"glucides":250,"lipides":65,"meals_data":[...]}}}

SCHÉMA NUTRITION (update — inclure plan_id) :
{"type":"preview","action":"update_nutrition","summary":"1-2 phrases","data":{"plan_id":"uuid","nom":"string","meal_type":"training","calories_objectif":2500,"proteines":180,"glucides":300,"lipides":70,"meals_data":[...]}}`

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

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  const { data: athlete } = await admin
    .from('athletes')
    .select('id, prenom, nom')
    .eq('id', athleteId)
    .eq('coach_id', user.id)
    .single()
  if (!athlete) return NextResponse.json({ error: 'athlete not found or forbidden' }, { status: 404 })

  const [progsRes, nutrRes, exsRes, alimRes, tplRes] = await Promise.all([
    admin
      .from('workout_programs')
      .select('id, nom, workout_sessions(nom, jour, ordre)')
      .eq('athlete_id', athleteId)
      .limit(20),
    admin
      .from('nutrition_plans')
      .select('id, nom, calories_objectif, proteines, glucides, lipides')
      .eq('athlete_id', athleteId)
      .limit(20),
    admin
      .from('exercices')
      .select('id, nom, muscle_principal, muscle_secondaire, categorie')
      .or(`coach_id.eq.${user.id},coach_id.is.null`)
      .limit(500),
    admin
      .from('aliments_db')
      .select('id, nom, calories, proteines, glucides, lipides')
      .or(`coach_id.eq.${user.id},coach_id.is.null`)
      .limit(1000),
    admin
      .from('nutrition_templates')
      .select('id, nom, template_type, category, calories_objectif, proteines, glucides, lipides, meals_data')
      .eq('coach_id', user.id)
      .limit(50),
  ])

  const athleteContext = JSON.stringify({
    programmes_existants: progsRes.data || [],
    plans_nutritionnels_existants: nutrRes.data || [],
  })

  const templates = (tplRes.data || []).map((t) => ({
    ...t,
    meals_data: (() => { try { return typeof t.meals_data === 'string' ? JSON.parse(t.meals_data) : t.meals_data } catch { return [] } })(),
  }))

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{athleteName}', `${athlete.prenom} ${athlete.nom}`)
    .replace('{athleteContext}', athleteContext)
    .replace('{exercicesJson}', JSON.stringify(exsRes.data || []))
    .replace('{alimentsJson}', JSON.stringify(alimRes.data || []))
    .replace('{templatesJson}', JSON.stringify(templates))

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
      // Fallback: extract JSON from text block
      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') throw new Error('no usable block in response')
      let txt = textBlock.text.trim()
      if (txt.includes('```')) {
        const m = txt.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (m) txt = m[1].trim()
      }
      const s = txt.indexOf('{'), e = txt.lastIndexOf('}')
      if (s !== -1 && e !== -1) txt = txt.slice(s, e + 1)
      parsed = JSON.parse(txt)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[coach-ai] claude error', e)
    return NextResponse.json({ error: 'claude_error', detail: msg }, { status: 502 })
  }

  return NextResponse.json(parsed)
}
