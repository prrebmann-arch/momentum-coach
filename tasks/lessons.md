# Lessons Learned

[2026-03-31] | Supabase v2 type incompatibilities with `.catch()` on query builders | The newer `@supabase/supabase-js` returns `PostgrestFilterBuilder` (not a Promise) from `.insert()` etc., so `.catch(() => {})` fails at type-check. Remove the `.catch()` or use try/catch instead.

[2026-03-31] | Pre-existing type errors block build | Always run `npx tsc --noEmit` to verify new code doesn't introduce errors, but be aware pre-existing errors in other files may also surface during `npm run build`.

[2026-03-31] | Data leak — unfiltered queries | Any query on shared tables (daily_reports, notifications, etc.) MUST filter by coach's athlete user_ids. Never query without a coach/user scope filter.

[2026-03-31] | Object references in useCallback/useEffect deps cause re-render loops | Never use context-derived objects (selectedAthlete, user) as dependency array values. Use primitive fields instead (selectedAthlete?.id, user?.id). Also memoize context provider values with useMemo to prevent unnecessary consumer re-renders.

[2026-03-31] | setLoading(true) without try/finally leaves UI stuck | Always wrap the body of async functions that call setLoading(true) in a try/finally block with setLoading(false) in finally.

[2026-03-31] | select('*') wastes bandwidth and slows queries | Always use explicit column lists in Supabase .select() calls. Add .limit() to any query that could return many rows.

[2026-04-03] | Heavy JSON columns (meals_data) kill list view performance | Don't fetch large JSON columns in list queries. Only fetch them on demand.

[2026-04-03] | Sequential queries avoidable via context data | Use AthleteContext data (already loaded) instead of re-querying the DB for athlete info.

[2026-04-13] | NEVER wrapper le fetch global de Supabase | Le wrapper AbortController + fake 408 Response a cassé le refresh de token auth. Toutes les requêtes retournaient vide. Le client Supabase doit rester VANILLA. Pour les timeouts Safari, utiliser useRefetchOnResume (hook composant).

[2026-04-13] | revalidateOnFocus:true sur SWR = cascade de re-fetch | Chaque switch d'onglet/app relançait 3 requêtes AthleteContext. Toujours mettre revalidateOnFocus:false.

[2026-04-13] | setLoading(true) inconditionnel = skeleton flash sur refetch | Pattern correct : `if (!data.length) setLoading(true)` — skeleton uniquement au premier chargement, pas sur les refetch.

[2026-04-13] | useCallback deps sur user (objet) au lieu de user?.id (string) | L'objet user change de référence à chaque auth event, relançant tous les useCallback/useEffect qui en dépendent.

[2026-04-13] | Toujours npm run build avant push | Plusieurs commits pushés sans vérification ont cassé le site en prod.
