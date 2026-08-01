-- Répartition du cycle par diète : nombre de fois que chaque jour (meal_type)
-- revient dans un cycle. Ex: {"training":3,"rest":3,"Poule":1} = cycle de 7 jours.
-- Stocké sur toutes les lignes actives d'une même diète (même nom).
ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS cycle_days JSONB;

COMMENT ON COLUMN nutrition_plans.cycle_days IS
  'Répartition du cycle {meal_type: n}. Moyennes pondérées côté coach. NULL = non réglé.';
