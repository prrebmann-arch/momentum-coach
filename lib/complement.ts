// Logique pure du board Complément : mapping zones de drop <-> moment_prise.
// Le format moment_prise est partagé avec l'app ATHLETE — NE PAS le modifier.

export interface DietMeal { num: number; label: string; time?: string }

export interface ComplementAssignment {
  id: string
  supplement_id: string
  dosage: string | null
  unite: string | null
  frequence: string | null
  notes: string | null
  moment_prise: string | null
  actif: boolean
  supplements: { id: string; nom: string; marque: string | null; type: string; lien_achat: string | null } | null
}

export type ZoneId = string

const FIXED_ZONES = ['a_jeun', 'pre_training', 'intra_training', 'post_training', 'coucher'] as const
const MEAL_TIMINGS = ['avant', 'pendant', 'apres'] as const

/** meals_data (JSONB du plan training actif) -> repas avec label + heure. */
export function extractDietMeals(mealsData: unknown): DietMeal[] {
  let raw = mealsData
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(raw)) return []
  return raw.map((m: unknown, i: number) => {
    const meal = (m || {}) as { label?: string; time?: string }
    return { num: i + 1, label: meal.label || `Repas ${i + 1}`, time: meal.time || undefined }
  })
}

/** 'meal-2-avant' -> 'R2_avant' ; 'fixed-a_jeun' -> 'a_jeun'. null si zone inconnue. */
export function zoneToMoment(zoneId: ZoneId): string | null {
  const fixed = zoneId.match(/^fixed-(.+)$/)
  if (fixed && (FIXED_ZONES as readonly string[]).includes(fixed[1])) return fixed[1]
  const meal = zoneId.match(/^meal-(\d+)-(avant|pendant|apres)$/)
  if (meal) return `R${meal[1]}_${meal[2]}`
  return null
}

/** 'R2_avant' -> 'meal-2-avant' ; 'a_jeun' -> 'fixed-a_jeun'. null => legacy/« À replacer ». */
export function momentToZone(moment: string | null, mealCount: number): ZoneId | null {
  if (!moment) return null
  if ((FIXED_ZONES as readonly string[]).includes(moment)) return `fixed-${moment}`
  const m = moment.match(/^R(\d+)_(avant|pendant|apres)$/)
  if (m && parseInt(m[1]) <= mealCount) return `meal-${m[1]}-${m[2]}`
  return null
}

export interface ZoneDef { id: ZoneId; label: string; icon: string; group: string }

/** Liste ordonnée des zones de drop : À jeun -> repas (x3 bandes) -> Training (x3) -> Coucher. */
export function buildZoneList(meals: DietMeal[]): ZoneDef[] {
  const zones: ZoneDef[] = [
    { id: 'fixed-a_jeun', label: 'À jeun', icon: 'fas fa-sun', group: 'À jeun' },
  ]
  for (const meal of meals) {
    const title = meal.time ? `${meal.label} — ${meal.time}` : meal.label
    for (const t of MEAL_TIMINGS) {
      const tLabel = t === 'avant' ? 'Avant' : t === 'pendant' ? 'Pendant' : 'Après'
      zones.push({ id: `meal-${meal.num}-${t}`, label: tLabel, icon: 'fas fa-utensils', group: title })
    }
  }
  zones.push({ id: 'fixed-pre_training', label: 'Pré', icon: 'fas fa-dumbbell', group: 'Training' })
  zones.push({ id: 'fixed-intra_training', label: 'Intra', icon: 'fas fa-dumbbell', group: 'Training' })
  zones.push({ id: 'fixed-post_training', label: 'Post', icon: 'fas fa-dumbbell', group: 'Training' })
  zones.push({ id: 'fixed-coucher', label: 'Coucher', icon: 'fas fa-moon', group: 'Coucher' })
  return zones
}

/** Affichage lisible d'un moment (repris de la page supplements). */
export function formatMoment(val: string): string {
  if (!val) return ''
  if (val === 'a_jeun') return 'À jeun'
  if (val === 'coucher') return 'Coucher'
  if (val === 'pre_training') return 'Pré-training'
  if (val === 'intra_training') return 'Intra-training'
  if (val === 'post_training') return 'Post-training'
  const m = val.match(/^R(\d+)_(avant|pendant|apres)$/)
  if (m) {
    const t: Record<string, string> = { avant: 'Avant', pendant: 'Pendant', apres: 'Après' }
    return `${t[m[2]]} Repas ${m[1]}`
  }
  return val
}
