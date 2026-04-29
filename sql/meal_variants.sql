-- ============================================================
-- Migration : variantes de jour pour nutrition_plans
-- Variantes de repas vivent dans meals_data JSON, aucune migration SQL nécessaire.
-- Idempotente : peut être rejouée.
-- ============================================================

ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS variant_label TEXT,
  ADD COLUMN IF NOT EXISTS variant_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Index couvrant les lectures actives groupées par meal_type + tri par variant_order.
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_active_group
  ON nutrition_plans(athlete_id, meal_type, variant_order)
  WHERE actif = true AND archived_at IS NULL;

COMMENT ON COLUMN nutrition_plans.variant_label IS
  'Label de variante de jour (ex: Push, Pull). NULL = plan singleton sans variantes.';
COMMENT ON COLUMN nutrition_plans.variant_order IS
  'Ordre de tri de la variante au sein de son groupe (athlete_id, meal_type).';
COMMENT ON COLUMN nutrition_plans.archived_at IS
  'Timestamp de soft delete. Plan exclu des lectures actives mais conservé pour les logs historiques.';

-- Vérification (optionnel) :
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'nutrition_plans'
--   AND column_name IN ('variant_label', 'variant_order', 'archived_at');
