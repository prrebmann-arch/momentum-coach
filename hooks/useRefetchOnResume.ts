import { useEffect, useRef } from 'react'

/**
 * Three safety nets for data fetching to survive Safari tab suspension:
 *
 * 1. Always refetch on resume: when the tab becomes visible again after being
 *    hidden for more than BACKGROUND_THRESHOLD_MS, re-trigger the fetch. Safari
 *    suspends JS in background tabs — the underlying HTTP/2 connection to
 *    Supabase may be dead, and cached state is stale. A proactive refetch
 *    re-establishes the connection and refreshes data.
 *
 * 2. Resume-while-loading: if a fetch was in flight when the tab was hidden,
 *    it may never resolve. On resume, immediately refetch.
 *
 * 3. Loading timeout: if loading takes more than 8s, retry once. Handles
 *    any scenario where a fetch silently fails (network issue, frozen tab,
 *    Supabase timeout, etc.).
 */

const BACKGROUND_THRESHOLD_MS = 3000
const LOADING_RETRY_MS = 8000

export function useRefetchOnResume(refetch: () => void, isLoading: boolean) {
  const loadingRef = useRef(isLoading)
  loadingRef.current = isLoading
  const hiddenAtRef = useRef<number | null>(null)

  // Safety net 1+2: track hidden time, refetch on resume if hidden >threshold or still loading
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      // visible
      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      const hiddenDuration = hiddenAt ? Date.now() - hiddenAt : 0
      if (loadingRef.current || hiddenDuration > BACKGROUND_THRESHOLD_MS) {
        refetch()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refetch])

  // Safety net 3: retry once if loading takes more than LOADING_RETRY_MS
  const retriedRef = useRef(false)
  useEffect(() => {
    if (!isLoading) {
      retriedRef.current = false
      return
    }
    if (retriedRef.current) return
    const timer = setTimeout(() => {
      retriedRef.current = true
      refetch()
    }, LOADING_RETRY_MS)
    return () => clearTimeout(timer)
  }, [isLoading, refetch])
}
