-- Performance indexes for frequently queried columns
-- Execute in Supabase SQL Editor

-- Athletes lookups (used on every page)
CREATE INDEX IF NOT EXISTS idx_athletes_coach_id ON athletes(coach_id);
CREATE INDEX IF NOT EXISTS idx_athletes_user_id ON athletes(user_id);
CREATE INDEX IF NOT EXISTS idx_athletes_email ON athletes(email);

-- Daily reports (bilans, dashboard — heaviest queries)
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id_date ON daily_reports(user_id, date DESC);

-- Workout data
CREATE INDEX IF NOT EXISTS idx_workout_programs_coach_id ON workout_programs(coach_id);
CREATE INDEX IF NOT EXISTS idx_workout_programs_athlete_id ON workout_programs(athlete_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_athlete_id_date ON workout_logs(athlete_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_program_id ON workout_sessions(program_id);

-- Nutrition
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_athlete_id_actif ON nutrition_plans(athlete_id, actif);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_athlete_id_date ON nutrition_logs(athlete_id, date DESC);

-- Supplements
CREATE INDEX IF NOT EXISTS idx_athlete_supplements_athlete_id ON athlete_supplements(athlete_id);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_athlete_date ON supplement_logs(athlete_supplement_id, taken_date DESC);

-- Roadmap
CREATE INDEX IF NOT EXISTS idx_roadmap_phases_athlete_id ON roadmap_phases(athlete_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_phases_coach_status ON roadmap_phases(coach_id, status);

-- Business
CREATE INDEX IF NOT EXISTS idx_daily_entries_coach_date ON daily_entries(coach_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_biz_clients_coach_id ON biz_clients(coach_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);

-- Payment
CREATE INDEX IF NOT EXISTS idx_athlete_payment_plans_coach ON athlete_payment_plans(coach_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_coach ON payment_history(coach_id);

-- Instagram
CREATE INDEX IF NOT EXISTS idx_ig_accounts_user_id ON ig_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_ig_reels_user_id ON ig_reels(user_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);

-- Execution videos
CREATE INDEX IF NOT EXISTS idx_execution_videos_athlete_id ON execution_videos(athlete_id);

-- Templates
CREATE INDEX IF NOT EXISTS idx_training_templates_coach ON training_templates(coach_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_templates_coach ON nutrition_templates(coach_id);
