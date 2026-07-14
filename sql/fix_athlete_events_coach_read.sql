-- Fix: allow coaches to read athlete_events created by their athletes
-- Problem: when an athlete creates an event, coach_id is null,
-- so the existing coach_id = auth.uid() policy blocks the coach from reading it.

DO $$
BEGIN
  DROP POLICY IF EXISTS "coach_read_athlete_events" ON public.athlete_events;

  CREATE POLICY "coach_read_athlete_events" ON public.athlete_events
    FOR SELECT
    USING (
      athlete_id IN (
        SELECT id FROM public.athletes WHERE coach_id = auth.uid()
      )
    );
END;
$$;
