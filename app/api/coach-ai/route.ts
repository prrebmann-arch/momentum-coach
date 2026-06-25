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

SCHÉMA CLARIFICATION (quand il manque des infos) :
{"type":"clarification","questions":["question 1","question 2"]}

SCHÉMA PROGRAMME (create) :
{"type":"preview","action":"create_program","summary":"1-2 phrases","data":{"nom":"string","pattern_type":"fixed","sessions":[{"nom":"string","jour":1,"ordre":0,"exercices":[{"exercice_id":"uuid","nom":"string","muscle_principal":"string","sets":[{"type":"normal","reps":"8-10","tempo":"3-1-2-0","repos":90,"kg":null}]}]}]}}

SCHÉMA PROGRAMME (update — inclure programme_id) :
{"type":"preview","action":"update_program","summary":"1-2 phrases","data":{"programme_id":"uuid","nom":"string","pattern_type":"fixed","sessions":[...]}}

SCHÉMA NUTRITION (create) :
{"type":"preview","action":"create_nutrition","summary":"1-2 phrases","data":{"nom":"string","meal_type":"training","calories_objectif":2500,"proteines":180,"glucides":300,"lipides":70,"meals_data":[{"meal_index":0,"nom":"Petit-déjeuner","foods":[{"aliment_id":"uuid","nom":"string","qte":100,"kcal":350,"p":12,"g":45,"l":8}]}]}}

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

  const [progsRes, nutrRes, exsRes, alimRes] = await Promise.all([
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
  ])

  const athleteContext = JSON.stringify({
    programmes_existants: progsRes.data || [],
    plans_nutritionnels_existants: nutrRes.data || [],
  })

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{athleteName}', `${athlete.prenom} ${athlete.nom}`)
    .replace('{athleteContext}', athleteContext)
    .replace('{exercicesJson}', JSON.stringify(exsRes.data || []))
    .replace('{alimentsJson}', JSON.stringify(alimRes.data || []))

  const userMessage = clarifications
    ? `Instruction initiale : ${instruction}\n\nRéponses aux questions : ${clarifications}`
    : instruction

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  let responseText: string
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('no text block in response')
    responseText = textBlock.text.trim()
    // Strip markdown code fences if present
    if (responseText.includes('```')) {
      const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fenceMatch) responseText = fenceMatch[1].trim()
    }
    // Extract JSON object if there's surrounding prose
    const jsonStart = responseText.indexOf('{')
    const jsonEnd = responseText.lastIndexOf('}')
    if (jsonStart > 0 || jsonEnd < responseText.length - 1) {
      if (jsonStart !== -1 && jsonEnd !== -1) {
        responseText = responseText.slice(jsonStart, jsonEnd + 1)
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[coach-ai] claude error', e)
    return NextResponse.json({ error: 'claude_error', detail: msg }, { status: 502 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    console.error('[coach-ai] json parse error', responseText.slice(0, 300))
    return NextResponse.json({ error: 'invalid_json', detail: responseText.slice(0, 300) }, { status: 502 })
  }

  return NextResponse.json(parsed)
}
