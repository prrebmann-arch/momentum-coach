-- Partial unique index: at most ONE default Premium template per coach.
-- Prevents the race condition where two parallel callers (templates page + athlete
-- onboarding page) both check, both see "no default", and both INSERT before either
-- transaction commits. Belt + suspenders with the in-flight Promise lock in
-- lib/onboarding.ts → ensurePremiumTemplate.
--
-- Applied to prod 2026-06-15 via Supabase MCP.
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_templates_one_default_per_coach
  ON onboarding_templates (coach_id)
  WHERE is_default = true;
