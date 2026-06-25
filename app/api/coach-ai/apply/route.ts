import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const { athleteId, action, data } = await req.json()
  if (!athleteId || !action || !data) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  const { data: athlete } = await admin
    .from('athletes')
    .select('id')
    .eq('id', athleteId)
    .eq('coach_id', user.id)
    .single()
  if (!athlete) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  if (action === 'create_program')       return applyCreateProgram(admin, user.id, athleteId, data)
  if (action === 'update_program')       return applyUpdateProgram(admin, athleteId, data)
  if (action === 'create_nutrition')     return applyCreateNutrition(admin, user.id, athleteId, data)
  if (action === 'create_nutrition_pair') return applyCreateNutritionPair(admin, user.id, athleteId, data)
  if (action === 'update_nutrition')     return applyUpdateNutrition(admin, athleteId, data)

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyCreateProgram(admin: SupabaseClient, coachId: string, athleteId: string, data: any) {
  const { data: prog, error: progErr } = await admin
    .from('workout_programs')
    .insert({
      nom: data.nom,
      athlete_id: athleteId,
      coach_id: coachId,
      pattern_type: data.pattern_type || 'fixed',
      actif: true,
    })
    .select('id')
    .single()
  if (progErr || !prog) {
    console.error('[coach-ai/apply] create_program', progErr)
    return NextResponse.json({ error: progErr?.message || 'insert failed' }, { status: 500 })
  }

  for (let i = 0; i < (data.sessions || []).length; i++) {
    const s = data.sessions[i]
    const { error: sessErr } = await admin.from('workout_sessions').insert({
      nom: s.nom,
      jour: s.jour ?? null,
      program_id: prog.id,
      exercices: JSON.stringify(s.exercices || []),
      ordre: s.ordre ?? i,
    })
    if (sessErr) {
      console.error('[coach-ai/apply] insert session', sessErr)
      return NextResponse.json({ error: sessErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, programme_id: prog.id })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyUpdateProgram(admin: SupabaseClient, athleteId: string, data: any) {
  const programmeId = data.programme_id
  if (!programmeId) return NextResponse.json({ error: 'missing programme_id' }, { status: 400 })

  const { data: existing } = await admin
    .from('workout_programs')
    .select('id')
    .eq('id', programmeId)
    .eq('athlete_id', athleteId)
    .single()
  if (!existing) return NextResponse.json({ error: 'program not found' }, { status: 404 })

  const { error: updErr } = await admin
    .from('workout_programs')
    .update({ nom: data.nom, pattern_type: data.pattern_type || 'fixed' })
    .eq('id', programmeId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const { error: delErr } = await admin.from('workout_sessions').delete().eq('program_id', programmeId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  for (let i = 0; i < (data.sessions || []).length; i++) {
    const s = data.sessions[i]
    const { error: sessErr } = await admin.from('workout_sessions').insert({
      nom: s.nom,
      jour: s.jour ?? null,
      program_id: programmeId,
      exercices: JSON.stringify(s.exercices || []),
      ordre: s.ordre ?? i,
    })
    if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// AI generates { aliment_id, nom, qte, kcal, p, g, l }
// MealEditor FoodItem.aliment = food name (findAliment does a.nom === food.aliment)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeMealsData(mealsData: any[]): any[] {
  return (mealsData || []).map((meal: any) => ({
    foods: (meal.foods || []).map((f: any) => ({
      aliment: f.nom ?? f.aliment,
      qte: f.qte,
      kcal: f.kcal,
      p: f.p,
      g: f.g,
      l: f.l,
    })),
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyCreateNutrition(admin: SupabaseClient, coachId: string, athleteId: string, data: any) {
  const { error } = await admin.from('nutrition_plans').insert({
    nom: data.nom,
    athlete_id: athleteId,
    coach_id: coachId,
    meal_type: data.meal_type || 'both',
    calories_objectif: data.calories_objectif,
    proteines: data.proteines,
    glucides: data.glucides,
    lipides: data.lipides,
    meals_data: JSON.stringify(normalizeMealsData(data.meals_data)),
    actif: true,
    valid_from: new Date().toISOString().split('T')[0],
  })
  if (error) {
    console.error('[coach-ai/apply] create_nutrition', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyCreateNutritionPair(admin: SupabaseClient, coachId: string, athleteId: string, data: any) {
  const today = new Date().toISOString().split('T')[0]
  // Both plans share the same nom so the nutrition page groups them as one diet (ON + OFF tabs)
  const sharedNom = data.nom || data.training?.nom || 'Diète'
  const plans = [
    { ...data.training, meal_type: 'training' },
    { ...data.rest, meal_type: 'rest' },
  ]
  for (const plan of plans) {
    const { error } = await admin.from('nutrition_plans').insert({
      nom: sharedNom,
      athlete_id: athleteId,
      coach_id: coachId,
      meal_type: plan.meal_type,
      calories_objectif: plan.calories_objectif,
      proteines: plan.proteines,
      glucides: plan.glucides,
      lipides: plan.lipides,
      meals_data: JSON.stringify(normalizeMealsData(plan.meals_data)),
      actif: true,
      valid_from: today,
    })
    if (error) {
      console.error('[coach-ai/apply] create_nutrition_pair', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyUpdateNutrition(admin: SupabaseClient, athleteId: string, data: any) {
  const planId = data.plan_id
  if (!planId) return NextResponse.json({ error: 'missing plan_id' }, { status: 400 })

  const { data: existing } = await admin
    .from('nutrition_plans')
    .select('id')
    .eq('id', planId)
    .eq('athlete_id', athleteId)
    .single()
  if (!existing) return NextResponse.json({ error: 'plan not found' }, { status: 404 })

  const { error } = await admin.from('nutrition_plans').update({
    nom: data.nom,
    meal_type: data.meal_type || 'both',
    calories_objectif: data.calories_objectif,
    proteines: data.proteines,
    glucides: data.glucides,
    lipides: data.lipides,
    meals_data: JSON.stringify(normalizeMealsData(data.meals_data)),
  }).eq('id', planId)
  if (error) {
    console.error('[coach-ai/apply] update_nutrition', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
