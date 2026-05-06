import { useEffect, useRef } from 'react'

/**
 * Refetch on tab return. AuthContext emits 'coach:wake' when the tab becomes
 * visible again (after pausing autoRefresh while hidden — the official
 * Supabase fix for Safari tab freezing).
 *
 * Also refetches on direct visibility change if the page was mid-loading
 * when the user switched away — a fetch frozen by Safari won't resolve,
 * so we re-issue it.
 *
 * No timers / reloads here. The auth-lock orphan that used to cause
 * infinite skeletons is now prevented upstream by the startAutoRefresh /
 * stopAutoRefresh pair in AuthContext, plus the no-op lock configured in
 * lib/supabase/client.ts.
 */
export function useRefetchOnResume(refetch: () => void, isLoading: boolean) {
  const loadingRef = useRef(isLoading)
  loadingRef.current = isLoading
  // Dedupe: coach:wake + visibilitychange both fire on tab return within ms,
  // causing a duplicate refetch. Coalesce into a single call per 1s window.
  const lastFetchAt = useRef(0)

  useEffect(() => {
    const dedupedRefetch = () => {
      const now = Date.now()
      if (now - lastFetchAt.current < 1000) return
      lastFetchAt.current = now
      refetch()
    }
    const handleWake = () => dedupedRefetch()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && loadingRef.current) dedupedRefetch()
    }
    window.addEventListener('coach:wake', handleWake)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('coach:wake', handleWake)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refetch])
}
