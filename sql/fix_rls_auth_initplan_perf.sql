-- Fixes the "auth_rls_initplan" Supabase linter warning across every RLS
-- policy in `public` that calls an unwrapped auth.uid()/auth.jwt()/auth.role().
-- Unwrapped calls are re-evaluated by Postgres for every row scanned; wrapping
-- them as (select auth.uid()) lets the planner evaluate them once per query
-- (Postgres treats a scalar subquery as an InitPlan). This is a pure
-- performance fix — the wrapped expression is semantically identical, so it
-- does not change who can read/write what. Run this whole file as one query
-- in the Supabase SQL Editor.
--
-- Mechanism: builds each policy's DROP + CREATE text from the live
-- pg_policies catalog (so the exact existing USING/WITH CHECK condition is
-- preserved verbatim, just with auth.<fn>() wrapped), then executes each
-- statement via EXECUTE inside a DO block. Wrapped in a transaction
-- (implicit — the SQL Editor runs the whole paste as one statement/battery,
-- but each DROP+CREATE pair is atomic per policy via EXECUTE).

DO $$
DECLARE
  rec RECORD;
  stmt TEXT;
BEGIN
  FOR rec IN
    SELECT
      tablename,
      policyname,
      cmd,
      roles,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ~ 'auth\.(uid|jwt|role)\(\)'
        OR coalesce(with_check, '') ~ 'auth\.(uid|jwt|role)\(\)'
      )
  LOOP
    -- DROP
    stmt := format('DROP POLICY %I ON public.%I;', rec.policyname, rec.tablename);
    EXECUTE stmt;

    -- CREATE, rebuilt with wrapped auth.<fn>() calls
    stmt := format(
      'CREATE POLICY %I ON public.%I FOR %s TO %s',
      rec.policyname, rec.tablename, rec.cmd, array_to_string(rec.roles, ', ')
    );
    IF rec.qual IS NOT NULL THEN
      stmt := stmt || ' USING (' || regexp_replace(rec.qual, 'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g') || ')';
    END IF;
    IF rec.with_check IS NOT NULL THEN
      stmt := stmt || ' WITH CHECK (' || regexp_replace(rec.with_check, 'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g') || ')';
    END IF;
    stmt := stmt || ';';
    EXECUTE stmt;

    RAISE NOTICE 'Fixed policy: % on %', rec.policyname, rec.tablename;
  END LOOP;
END $$;
