-- Add default_tempo and default_reps columns to exercices table
ALTER TABLE exercices ADD COLUMN IF NOT EXISTS default_tempo text;
ALTER TABLE exercices ADD COLUMN IF NOT EXISTS default_reps text;

COMMENT ON COLUMN exercices.default_tempo IS 'Default tempo for the exercise, e.g. 3-1-2-0';
COMMENT ON COLUMN exercices.default_reps IS 'Default rep range for the exercise, e.g. 10-15';
