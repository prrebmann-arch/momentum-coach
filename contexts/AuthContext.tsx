'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearAllCaches } from '@/lib/clientCaches'
import { bootMark, bootSetUser, installBootTrace } from '@/lib/bootTrace'
import type { User, CoachProfile } from '@/lib/types'

const CACHE_KEY_USER = 'coach_cached_user'
const CACHE_KEY_PROFILE = 'coach_profile'

function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_USER)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function getCachedCoach(): CoachProfile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PROFILE)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

interface AuthContextType {
  user: User | null
  coach: CoachProfile | null
  loading: boolean
  accessToken: string | null
  signIn: (email: string, password: string) => Promise<CoachProfile | null>
  signUp: (email: string, password: string, plan: string) => Promise<CoachProfile | null>
  signOut: () => Promise<void>
  refreshCoach: () => Promise<void>
  updateCoach: (partial: Partial<CoachProfile>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initial state MUST match on server and client to avoid hydration mismatches.
  // localStorage is only available on the client — reading it during initial
  // render produces different HTML on SSR (null) vs client (cached user),
  // triggering React error #418 and leaving the UI stuck in a broken state.
  // We populate from localStorage inside useEffect instead (post-hydration).
  const [user, setUser] = useState<User | null>(null)
  const [coach, setCoach] = useState<CoachProfile | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const initRef = useRef(false)
  // Prevents onAuthStateChange from interfering during explicit signIn/signUp
  const signingInRef = useRef(false)

  // Profil coach en vol / chargé, par user. Au boot, init(), INITIAL_SESSION,
  // SIGNED_IN et TOKEN_REFRESHED arrivent quasi en même temps : une seule
  // requête coach_profiles. Un échec (null) libère la place pour réessayer.
  const coachLoadRef = useRef<{ userId: string; promise: Promise<CoachProfile | null> } | null>(null)

  const supabase = createClient()

  const fetchCoach = useCallback(async (userId: string): Promise<CoachProfile | null> => {
    const t0 = performance.now()
    try {
      const { data, error } = await supabase
        .from('coach_profiles')
        .select('id, user_id, email, display_name, plan, trial_ends_at, has_payment_method, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, avatar_url, created_at')
        .eq('user_id', userId)
        .single()
      const ms = Math.round(performance.now() - t0)
      if (error) {
        console.error('[AuthContext] fetchCoach', error)
        bootMark('auth:coach', { ms, ok: false, code: error.code, msg: error.message })
        // Pas de profil (PGRST116) = vraiment aucun profil. Toute autre erreur
        // (réseau, 5xx) : on garde le profil en cache plutôt que de le vider.
        if (error.code === 'PGRST116') setCoach(null)
        return null
      }
      const profile = data as CoachProfile
      setCoach(profile)
      bootMark('auth:coach', { ms, ok: true })
      // Cache for instant load on next visit
      try { localStorage.setItem(CACHE_KEY_PROFILE, JSON.stringify(profile)) } catch { /* quota */ }
      return profile
    } catch (err) {
      console.error('[AuthContext] fetchCoach', err)
      bootMark('auth:coach', { ms: Math.round(performance.now() - t0), ok: false, msg: String(err) })
      return null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadCoach = useCallback((userId: string, force = false): Promise<CoachProfile | null> => {
    const current = coachLoadRef.current
    if (!force && current && current.userId === userId) return current.promise
    const promise = fetchCoach(userId).then((profile) => {
      if (!profile && coachLoadRef.current?.promise === promise) coachLoadRef.current = null
      return profile
    })
    coachLoadRef.current = { userId, promise }
    return promise
  }, [fetchCoach])

  const userId = user?.id
  const refreshCoach = useCallback(async () => {
    if (userId) await loadCoach(userId, true)
  }, [userId, loadCoach])

  const updateCoach = useCallback((partial: Partial<CoachProfile>) => {
    setCoach((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...partial }
      try { localStorage.setItem(CACHE_KEY_PROFILE, JSON.stringify(updated)) } catch { /* quota */ }
      return updated
    })
  }, [])

  // Preserve la reference de `user` si id/email inchanges : sinon chaque
  // TOKEN_REFRESHED (~1x/h) cree un nouvel objet et refire tous les
  // useEffect/useCallback qui dependent de [user] (~20 sites) — refetch storm.
  const setUserStable = useCallback((u: User | null) => {
    setUser((prev) => (prev && u && prev.id === u.id && prev.email === u.email ? prev : u))
  }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    installBootTrace()

    // Populate from localStorage immediately after hydration (safe — client only).
    // `loading` reste true jusqu'à getSession() : la session vit dans les cookies
    // (@supabase/ssr), pas dans localStorage — le layout affiche déjà le shell
    // grâce au user en cache.
    const cachedU = getCachedUser()
    const cachedC = getCachedCoach()
    if (cachedU) setUser(cachedU)
    if (cachedC) setCoach(cachedC)
    bootSetUser(cachedU?.id ?? null)
    bootMark('auth:cache', { cachedUser: !!cachedU, cachedCoach: !!cachedC })

    const init = async () => {
      const t0 = performance.now()
      bootMark('auth:init')
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        bootMark('auth:session', {
          ms: Math.round(performance.now() - t0),
          hasSession: !!session,
          expiresInS: session?.expires_at ? Math.round(session.expires_at - Date.now() / 1000) : null,
          error: error?.message,
        })
        if (session?.user) {
          const u = { id: session.user.id, email: session.user.email! }
          setUserStable(u)
          bootSetUser(u.id)
          setAccessToken(session.access_token)
          try { localStorage.setItem(CACHE_KEY_USER, JSON.stringify(u)) } catch { /* quota */ }
          // Background refresh of coach profile (UI already showing cached data)
          await loadCoach(session.user.id)
        } else {
          // No valid session — clear cache and state
          setUser(null)
          setCoach(null)
          setAccessToken(null)
          bootSetUser(null)
          coachLoadRef.current = null
          localStorage.removeItem(CACHE_KEY_USER)
          localStorage.removeItem(CACHE_KEY_PROFILE)
        }
      } catch (err) {
        console.error('[AuthContext] init', err)
        bootMark('auth:init-error', { msg: String(err) })
      } finally {
        setLoading(false)
      }
    }
    init()

    // ⚠️ Ce callback doit rester SYNCHRONE : aucun `await` d'appel Supabase ici.
    // auth-js l'exécute À L'INTÉRIEUR de son verrou interne — et pendant
    // initialize() quand le JWT expiré est rafraîchi au chargement — et attend
    // qu'il se termine. Une requête Supabase awaitée ici attend getSession(),
    // qui attend initialize()/le verrou, qui attend ce callback → deadlock :
    // toutes les requêtes de l'app restent pendantes (« la page ne charge pas,
    // il faut recharger »). Pattern officiel : différer avec setTimeout(…, 0).
    // https://supabase.com/docs/reference/javascript/auth-onauthstatechange
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: { user?: { id: string; email?: string }; access_token: string } | null) => {
        bootMark('auth:event', { event, hasSession: !!session })
        // Skip if signIn/signUp is handling state updates directly
        if (signingInRef.current) return
        if (session?.user) {
          const u = { id: session.user.id, email: session.user.email! }
          setUserStable(u)
          bootSetUser(u.id)
          setAccessToken(session.access_token)
          setLoading(false)
          try { localStorage.setItem(CACHE_KEY_USER, JSON.stringify(u)) } catch { /* quota */ }
          const uid = u.id
          setTimeout(() => { void loadCoach(uid) }, 0)
        } else {
          setUser(null)
          setCoach(null)
          setAccessToken(null)
          setLoading(false)
          bootSetUser(null)
          coachLoadRef.current = null
          localStorage.removeItem(CACHE_KEY_USER)
          localStorage.removeItem(CACHE_KEY_PROFILE)
        }
      }
    )

    // Tab visibility handler — THE official Supabase fix for Safari tab
    // freezing and orphaned auth locks. See:
    //   https://supabase.com/docs/reference/javascript/auth-startautorefresh
    //
    // Root cause: @supabase/auth-js auto-refreshes the JWT on a timer. Safari
    // throttles / freezes background-tab fetch calls. If the refresh fires
    // while the tab is hidden, its fetch can be frozen mid-flight while
    // holding the navigator.locks-based auth mutex. When the tab wakes up,
    // every subsequent Supabase call queues behind that orphan lock for 5s
    // (the library's internal timeout) — the "skeleton stuck on tab switch"
    // bug.
    //
    // Fix: stop the auto-refresh timer when the tab is hidden; restart it on
    // return. No await, no getSession, no blocking call inside the handler.
    // We also dispatch 'coach:wake' so useRefetchOnResume consumers can
    // refetch their data if they want.
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        supabase.auth.stopAutoRefresh()
      } else {
        supabase.auth.startAutoRefresh()
        window.dispatchEvent(new CustomEvent('coach:wake'))
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<CoachProfile | null> => {
    signingInRef.current = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Check user is not an athlete
      const { data: athleteRow } = await supabase
        .from('athletes')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (athleteRow) {
        await supabase.auth.signOut()
        throw new Error('Cet espace est reserve aux coachs. Connectez-vous via l\'app athlete.')
      }

      const u = { id: data.user.id, email: data.user.email! }
      setUserStable(u)
      bootSetUser(u.id)
      setAccessToken(data.session?.access_token ?? null)
      try { localStorage.setItem(CACHE_KEY_USER, JSON.stringify(u)) } catch { /* quota */ }
      const profile = await loadCoach(data.user.id, true)
      return profile
    } finally {
      signingInRef.current = false
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCoach])

  const signUp = useCallback(async (email: string, password: string, plan: string): Promise<CoachProfile | null> => {
    signingInRef.current = true
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      if (!data.user) throw new Error('Erreur lors de la creation du compte.')

      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 14)

      const { error: profileError } = await supabase
        .from('coach_profiles')
        .upsert({
          user_id: data.user.id,
          email,
          display_name: email.split('@')[0],
          plan,
          trial_ends_at: trialEnd.toISOString(),
          has_payment_method: false,
        }, { onConflict: 'user_id' })

      if (profileError) throw profileError

      const u = { id: data.user.id, email: data.user.email! }
      setUserStable(u)
      bootSetUser(u.id)
      setAccessToken(data.session?.access_token ?? null)
      try { localStorage.setItem(CACHE_KEY_USER, JSON.stringify(u)) } catch { /* quota */ }
      const profile = await loadCoach(data.user.id, true)
      return profile
    } finally {
      signingInRef.current = false
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCoach])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setCoach(null)
    setAccessToken(null)
    bootSetUser(null)
    coachLoadRef.current = null
    localStorage.removeItem(CACHE_KEY_USER)
    localStorage.removeItem(CACHE_KEY_PROFILE)
    // Module-level caches (aliments_db, exercices) survive auth events;
    // flush them so the next coach login doesn't see the previous coach's data.
    clearAllCaches()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({ user, coach, loading, accessToken, signIn, signUp, signOut, refreshCoach, updateCoach }),
    [user, coach, loading, accessToken, signIn, signUp, signOut, refreshCoach, updateCoach],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
