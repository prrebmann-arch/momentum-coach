import type { MealData, FoodItem, MealVariant } from '@/components/nutrition/MealEditor'

/**
 * Retourne les `foods` d'un repas, qu'il soit en mode simple ou multi-variantes.
 * Fallback sur la première variante si `chosenVariantId` n'est pas trouvé.
 */
export function getMealFoods(meal: MealData, chosenVariantId?: string | null): FoodItem[] {
  if (!meal.variants || meal.variants.length === 0) {
    return meal.foods ?? []
  }
  const found = chosenVariantId
    ? meal.variants.find((v) => v.id === chosenVariantId)
    : null
  return (found ?? meal.variants[0]).foods
}

/** Retourne l'objet variant (ou null si repas simple). */
export function getActiveVariant(meal: MealData, chosenVariantId?: string | null): MealVariant | null {
  if (!meal.variants || meal.variants.length === 0) return null
  if (!chosenVariantId) return meal.variants[0]
  return meal.variants.find((v) => v.id === chosenVariantId) ?? meal.variants[0]
}

/** True si le repas a ≥1 variante. */
export function hasVariants(meal: MealData): boolean {
  return Array.isArray(meal.variants) && meal.variants.length > 0
}

/** Génère un UUID v4 court pour identifier une variante. */
export function newVariantId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `v_${crypto.randomUUID().slice(0, 8)}`
  }
  return `v_${Math.random().toString(36).slice(2, 10)}`
}
