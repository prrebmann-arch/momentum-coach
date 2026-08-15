-- Removes RLS policies that are strict duplicates of another policy on the
-- same table/command/role (the "multiple_permissive_policies" linter
-- warning) — leftovers from migrations that recreated a rule under a new
-- name without dropping the old one. Postgres evaluates every permissive
-- policy matching a query and ORs the results, so each duplicate pair was
-- costing a second identical check on every query.
--
-- Only pairs verified byte-for-byte identical in USING/WITH CHECK are
-- included here (checked manually against pg_policies output). Keeping the
-- more descriptively-named policy of each pair, dropping the older/terser one.
-- Two other overlapping cases were found and deliberately left untouched:
--   - notifications: user_manage_own_notifs (ALL) legitimately overlaps
--     Athletes can .../update own notifications (SELECT/UPDATE) — not a
--     copy-paste duplicate, just broader scope.
--   - workout_logs UPDATE: "athlete can edit own unlocked logs" enforces
--     `now() < locked_at`, "logs_athlete_update" does not — a real
--     permission gap, not a perf issue; needs its own decision, not bundled
--     into a perf cleanup.

DROP POLICY IF EXISTS "athlete_manage_own_reports" ON public."daily_reports";
-- kept: "Athletes manage own reports" (strict duplicate, both
-- `user_id = (select auth.uid())` in USING and WITH CHECK)
--
-- NOT touched: "Coaches read athlete reports" vs "coach_read_athlete_reports"
-- looked like a pair but are NOT strict duplicates — the former has an
-- extra `AND athletes.user_id IS NOT NULL` guard the latter lacks. That's a
-- permission-scope difference, not a perf-only duplicate; leaving both as-is
-- rather than guessing which behavior is intended.

DROP POLICY IF EXISTS "coaches_manage_athletes" ON public."athletes";
DROP POLICY IF EXISTS "athletes_athlete_select" ON public."athletes";
-- kept: "coach_manage_own_athletes", "athlete_read_own"

DROP POLICY IF EXISTS "coach_insert_athlete_notifs" ON public."notifications";
-- kept: "Coaches can insert notifications for their athletes"

DROP POLICY IF EXISTS "logs_coach_select" ON public."workout_logs";
-- kept: "coach_read_athlete_logs"
