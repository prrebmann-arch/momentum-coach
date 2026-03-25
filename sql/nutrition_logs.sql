-- ===== TABLE nutrition_logs =====
-- Tracks what athletes actually ate vs their nutrition plan each day.
-- One row per athlete per date.

CREATE TABLE IF NOT EXISTS nutrition_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  date DATE NOT NULL,
  meals_log JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(athlete_id, date)
);

-- Index for fast lookups by athlete + date range
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_athlete_date ON nutrition_logs(athlete_id, date DESC);

-- Enable RLS
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;

-- Athletes can read/write their own logs
CREATE POLICY "Athletes can manage their own nutrition logs"
  ON nutrition_logs
  FOR ALL
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Coaches can read logs of their athletes
CREATE POLICY "Coaches can read their athletes nutrition logs"
  ON nutrition_logs
  FOR SELECT
  USING (
    athlete_id IN (
      SELECT user_id FROM athletes WHERE coach_id = auth.uid()
    )
  );

-- =============================================
-- meals_log JSON structure:
-- [
--   {
--     "meal_index": 0,
--     "meal_label": "Repas 1",
--     "foods": [
--       {
--         "food_index": 0,
--         "status": "followed",        -- "followed" | "replaced" | "skipped"
--         "original": {
--           "aliment": "Poulet",
--           "qte": 150,
--           "kcal": 195,
--           "p": 30.4,
--           "g": 0,
--           "l": 4.5
--         },
--         "replacement": null           -- null if followed/skipped, food object if replaced:
--                                       -- { "aliment": "Dinde", "qte": 150, "kcal": 180, "p": 29, "g": 0, "l": 3 }
--       }
--     ],
--     "validated_all": true             -- true if user clicked "Tout valider"
--   }
-- ]
-- =============================================
