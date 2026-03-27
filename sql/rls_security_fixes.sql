-- ============================================================
-- RLS SECURITY FIXES — Coach App
-- Execute in Supabase SQL Editor
-- Date: 2026-03-27
-- ============================================================

-- ============================================================
-- A) Table exercices — Fix condition=true policies
-- ============================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "exercices_read_all" ON exercices;
DROP POLICY IF EXISTS "exercices_insert" ON exercices;
DROP POLICY IF EXISTS "exercices_update" ON exercices;
DROP POLICY IF EXISTS "exercices_delete" ON exercices;
DROP POLICY IF EXISTS "exercices_select_policy" ON exercices;
DROP POLICY IF EXISTS "exercices_insert_policy" ON exercices;
DROP POLICY IF EXISTS "exercices_update_policy" ON exercices;
DROP POLICY IF EXISTS "exercices_delete_policy" ON exercices;

-- Coach can manage their own exercises
CREATE POLICY "coach_manage_exercices" ON exercices FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Athletes can read their coach's exercises
CREATE POLICY "athlete_read_coach_exercices" ON exercices FOR SELECT
  USING (coach_id IN (SELECT coach_id FROM athletes WHERE user_id = auth.uid()));


-- ============================================================
-- B) Table aliments_db — Fix auth.role()='authenticated'
-- ============================================================

DROP POLICY IF EXISTS "Coaches manage own aliments" ON aliments_db;
DROP POLICY IF EXISTS "aliments_db_select_policy" ON aliments_db;

-- Coach can manage their own foods (or global foods with coach_id IS NULL)
CREATE POLICY "coach_manage_aliments" ON aliments_db FOR ALL
  USING (coach_id = auth.uid() OR coach_id IS NULL)
  WITH CHECK (coach_id = auth.uid());

-- Athletes can read their coach's foods + global foods
CREATE POLICY "athlete_read_coach_aliments" ON aliments_db FOR SELECT
  USING (
    coach_id IN (SELECT coach_id FROM athletes WHERE user_id = auth.uid())
    OR coach_id IS NULL
  );


-- ============================================================
-- C) Add WITH CHECK to policies missing it
--    Pattern: drop + recreate with both USING and WITH CHECK
-- ============================================================

-- coach_settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coach_settings') THEN
    DROP POLICY IF EXISTS "coach_manage_settings" ON coach_settings;
    DROP POLICY IF EXISTS "coach_all_own_settings" ON coach_settings;
    CREATE POLICY "coach_manage_settings" ON coach_settings FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
  END IF;
END $$;

-- formations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'formations') THEN
    DROP POLICY IF EXISTS "coach_manage_formations" ON formations;
    DROP POLICY IF EXISTS "coach_all_own_formations" ON formations;
    CREATE POLICY "coach_manage_formations" ON formations FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
  END IF;
END $$;

-- formation_videos
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'formation_videos') THEN
    DROP POLICY IF EXISTS "coach_manage_formation_videos" ON formation_videos;
    DROP POLICY IF EXISTS "coach_all_own_formation_videos" ON formation_videos;
    CREATE POLICY "coach_manage_formation_videos" ON formation_videos FOR ALL
      USING (formation_id IN (SELECT id FROM formations WHERE coach_id = auth.uid()))
      WITH CHECK (formation_id IN (SELECT id FROM formations WHERE coach_id = auth.uid()));
  END IF;
END $$;

-- nutrition_plans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nutrition_plans') THEN
    DROP POLICY IF EXISTS "coach_manage_nutrition_plans" ON nutrition_plans;
    DROP POLICY IF EXISTS "coach_all_own_nutrition_plans" ON nutrition_plans;
    CREATE POLICY "coach_manage_nutrition_plans" ON nutrition_plans FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
    -- Athletes read their own plans
    DROP POLICY IF EXISTS "athlete_read_own_plans" ON nutrition_plans;
    CREATE POLICY "athlete_read_own_plans" ON nutrition_plans FOR SELECT
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
END $$;

-- workout_programs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workout_programs') THEN
    DROP POLICY IF EXISTS "coach_manage_workout_programs" ON workout_programs;
    DROP POLICY IF EXISTS "coach_all_own_workout_programs" ON workout_programs;
    CREATE POLICY "coach_manage_workout_programs" ON workout_programs FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
    DROP POLICY IF EXISTS "athlete_read_own_programs" ON workout_programs;
    CREATE POLICY "athlete_read_own_programs" ON workout_programs FOR SELECT
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
END $$;

-- roadmap_phases
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'roadmap_phases') THEN
    DROP POLICY IF EXISTS "coach_manage_roadmap_phases" ON roadmap_phases;
    DROP POLICY IF EXISTS "coach_all_own_roadmap_phases" ON roadmap_phases;
    CREATE POLICY "coach_manage_roadmap_phases" ON roadmap_phases FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
    DROP POLICY IF EXISTS "athlete_read_own_roadmap" ON roadmap_phases;
    CREATE POLICY "athlete_read_own_roadmap" ON roadmap_phases FOR SELECT
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
END $$;

-- programming_weeks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'programming_weeks') THEN
    DROP POLICY IF EXISTS "coach_manage_programming_weeks" ON programming_weeks;
    DROP POLICY IF EXISTS "coach_all_own_programming_weeks" ON programming_weeks;
    CREATE POLICY "coach_manage_programming_weeks" ON programming_weeks FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
    DROP POLICY IF EXISTS "athlete_read_own_weeks" ON programming_weeks;
    CREATE POLICY "athlete_read_own_weeks" ON programming_weeks FOR SELECT
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
END $$;

-- questionnaire_templates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questionnaire_templates') THEN
    DROP POLICY IF EXISTS "coach_manage_questionnaire_templates" ON questionnaire_templates;
    DROP POLICY IF EXISTS "coach_all_own_questionnaire_templates" ON questionnaire_templates;
    CREATE POLICY "coach_manage_questionnaire_templates" ON questionnaire_templates FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
  END IF;
END $$;

-- training_templates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_templates') THEN
    DROP POLICY IF EXISTS "coach_manage_training_templates" ON training_templates;
    DROP POLICY IF EXISTS "coach_all_own_training_templates" ON training_templates;
    CREATE POLICY "coach_manage_training_templates" ON training_templates FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
  END IF;
END $$;

-- posing_retours
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posing_retours') THEN
    DROP POLICY IF EXISTS "coach_manage_posing_retours" ON posing_retours;
    DROP POLICY IF EXISTS "coach_all_own_posing_retours" ON posing_retours;
    CREATE POLICY "coach_manage_posing_retours" ON posing_retours FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
    DROP POLICY IF EXISTS "athlete_read_own_posing" ON posing_retours;
    CREATE POLICY "athlete_read_own_posing" ON posing_retours FOR SELECT
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
END $$;

-- onboarding_workflows
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onboarding_workflows') THEN
    DROP POLICY IF EXISTS "coach_manage_onboarding_workflows" ON onboarding_workflows;
    DROP POLICY IF EXISTS "coach_all_own_onboarding_workflows" ON onboarding_workflows;
    CREATE POLICY "coach_manage_onboarding_workflows" ON onboarding_workflows FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
  END IF;
END $$;

-- push_tokens
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_tokens') THEN
    DROP POLICY IF EXISTS "user_manage_own_tokens" ON push_tokens;
    DROP POLICY IF EXISTS "user_all_own_tokens" ON push_tokens;
    CREATE POLICY "user_manage_own_tokens" ON push_tokens FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- workout_sessions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workout_sessions') THEN
    DROP POLICY IF EXISTS "coach_manage_workout_sessions" ON workout_sessions;
    DROP POLICY IF EXISTS "coach_all_own_workout_sessions" ON workout_sessions;
    CREATE POLICY "coach_manage_workout_sessions" ON workout_sessions FOR ALL
      USING (program_id IN (SELECT id FROM workout_programs WHERE coach_id = auth.uid()))
      WITH CHECK (program_id IN (SELECT id FROM workout_programs WHERE coach_id = auth.uid()));
    DROP POLICY IF EXISTS "athlete_read_own_sessions" ON workout_sessions;
    CREATE POLICY "athlete_read_own_sessions" ON workout_sessions FOR SELECT
      USING (program_id IN (SELECT id FROM workout_programs WHERE athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())));
  END IF;
END $$;

-- formation_video_progress
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'formation_video_progress') THEN
    DROP POLICY IF EXISTS "user_manage_own_progress" ON formation_video_progress;
    DROP POLICY IF EXISTS "user_all_own_progress" ON formation_video_progress;
    CREATE POLICY "user_manage_own_progress" ON formation_video_progress FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- questionnaire_assignments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questionnaire_assignments') THEN
    DROP POLICY IF EXISTS "coach_manage_assignments" ON questionnaire_assignments;
    DROP POLICY IF EXISTS "coach_all_own_assignments" ON questionnaire_assignments;
    CREATE POLICY "coach_manage_assignments" ON questionnaire_assignments FOR ALL
      USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
    DROP POLICY IF EXISTS "athlete_read_own_assignments" ON questionnaire_assignments;
    CREATE POLICY "athlete_read_own_assignments" ON questionnaire_assignments FOR SELECT
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
    DROP POLICY IF EXISTS "athlete_update_own_assignments" ON questionnaire_assignments;
    CREATE POLICY "athlete_update_own_assignments" ON questionnaire_assignments FOR UPDATE
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
END $$;


-- ============================================================
-- D) Secure RPC functions with permission checks
-- ============================================================

-- admin_stripe_overview: restrict to admin
CREATE OR REPLACE FUNCTION admin_stripe_overview()
RETURNS JSON AS $$
DECLARE
  result JSON;
  admin_id UUID;
BEGIN
  -- Get admin user ID from auth.users by email
  SELECT id INTO admin_id FROM auth.users WHERE email = 'rebmannpierre1@gmail.com' LIMIT 1;
  IF auth.uid() IS NULL OR auth.uid() != admin_id THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT json_build_object(
    'total_coaches', (SELECT count(*) FROM coach_profiles),
    'total_athletes', (SELECT count(*) FROM athletes),
    'total_revenue', (SELECT COALESCE(sum(amount), 0) FROM payment_history WHERE status = 'succeeded' AND is_platform_payment = true),
    'pending_invoices', (SELECT count(*) FROM platform_invoices WHERE status IN ('pending', 'retry_1', 'retry_2', 'retry_3')),
    'blocked_coaches', (SELECT count(*) FROM coach_profiles WHERE is_blocked = true)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- coach_payment_stats: verify caller is the coach
CREATE OR REPLACE FUNCTION coach_payment_stats(p_coach_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  IF auth.uid() != p_coach_id THEN
    RAISE EXCEPTION 'Unauthorized: can only view own stats';
  END IF;

  SELECT json_build_object(
    'total_athletes', (SELECT count(*) FROM athletes WHERE coach_id = p_coach_id),
    'active_subscriptions', (SELECT count(*) FROM stripe_customers WHERE coach_id = p_coach_id AND subscription_status = 'active'),
    'monthly_revenue', (SELECT COALESCE(sum(monthly_amount), 0) FROM stripe_customers WHERE coach_id = p_coach_id AND subscription_status = 'active'),
    'total_received', (SELECT COALESCE(sum(amount), 0) FROM payment_history WHERE coach_id = p_coach_id AND status = 'succeeded' AND is_platform_payment = false)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- E) Add stripe_webhook_secret column to coach_profiles
-- ============================================================

ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT;


-- ============================================================
-- F) Ensure RLS is enabled on all critical tables
-- ============================================================

ALTER TABLE exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE aliments_db ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- DONE — Verify by running:
-- SELECT tablename, policyname, permissive, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
-- ============================================================
