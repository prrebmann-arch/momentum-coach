-- Add complete_bilan configuration columns missing from athletes table
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS complete_bilan_frequency TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS complete_bilan_interval INTEGER,
  ADD COLUMN IF NOT EXISTS complete_bilan_day JSONB,
  ADD COLUMN IF NOT EXISTS complete_bilan_anchor_date DATE,
  ADD COLUMN IF NOT EXISTS complete_bilan_month_day INTEGER,
  ADD COLUMN IF NOT EXISTS complete_bilan_notif_time TEXT;
