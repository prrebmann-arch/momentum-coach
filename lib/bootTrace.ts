/**
 * Trace du premier chargement (boot) côté navigateur.
 *
 * But : savoir, en prod, POURQUOI un chargement reste bloqué ou lent — sans
 * demander au coach d'ouvrir la console. Chaque étape (auth, profil coach,
 * athlètes, erreurs JS, échecs de chargement de chunks) est horodatée depuis
 * le début de la navigation (performance.now()) et :
 *   - loguée en console avec le préfixe `[boot]`,
 *   - envoyée via sendBeacon à /api/client-log (stockée dans client_boot_logs) :
 *       ready      → boot terminé (timings normaux, pour suivre la vitesse)
 *       slow       → pas prêt après 5 s
 *       stalled    → pas prêt après 15 s
 *       abandoned  → onglet fermé / rechargé AVANT d'être prêt (= le reload manuel)
 *       error      → échec de chargement des données de boot
 *   (`no-hydration` est envoyé par le script inline de app/layout.tsx quand
 *   le bundle JS n'a jamais démarré.)
 *
 * Observation uniquement : aucun timer ici ne recharge la page ni ne relance
 * de requête (cf. lessons.md : pas de watchdog reload).
 */

type BootEvent = { t: number; ev: string; d?: Record<string, unknown> }

declare global {
  interface Window {
    __bootErrors?: string[]
    __bootHydrated?: boolean
  }
}

const ENDPOINT = '/api/client-log'
const SLOW_MS = 5_000
const STALL_MS = 15_000
const MAX_EVENTS = 80
const MAX_ERRORS = 20

const state = {
  installed: false,
  tracking: false,
  events: [] as BootEvent[],
  errors: [] as string[],
  readyAt: null as number | null,
  userId: null as string | null,
  sent: new Set<string>(),
}

const isBrowser = () => typeof window !== 'undefined'
const now = () => Math.round(performance.now())

export function bootMark(ev: string, d?: Record<string, unknown>) {
  if (!isBrowser()) return
  const t = now()
  if (state.events.length < MAX_EVENTS) state.events.push(d ? { t, ev, d } : { t, ev })
  console.info(`[boot] +${t}ms ${ev}`, d ?? '')
}

function recordError(msg: string) {
  if (state.errors.length < MAX_ERRORS) state.errors.push(msg.slice(0, 300))
  bootMark('error', { msg: msg.slice(0, 300) })
}

// Requêtes Supabase TERMINÉES (resource timing) : montre laquelle a été lente.
// Une requête encore pendante n'apparaît pas — son absence est l'indice.
function supabaseRequests() {
  return (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
    .filter((r) => r.name.includes('.supabase.co/'))
    .slice(0, 30)
    .map((r) => ({
      path: new URL(r.name).pathname,
      start: Math.round(r.startTime),
      ms: Math.round(r.duration),
      status: (r as PerformanceResourceTiming & { responseStatus?: number }).responseStatus,
    }))
}

function send(reason: string) {
  if (state.sent.has(reason)) return
  // Visiteur anonyme (landing, login) : seuls les blocages comptent, pas les "ready".
  if (reason === 'ready' && !state.userId) return
  state.sent.add(reason)
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  const body = JSON.stringify({
    reason,
    path: location.pathname,
    userId: state.userId,
    readyMs: state.readyAt,
    atMs: now(),
    nav: nav ? {
      type: nav.type, // 'reload' = l'utilisateur a rechargé
      ttfb: Math.round(nav.responseStart),
      domInteractive: Math.round(nav.domInteractive),
      dcl: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      transfer: nav.transferSize,
    } : null,
    visibility: document.visibilityState,
    online: navigator.onLine,
    ua: navigator.userAgent,
    events: state.events,
    errors: state.errors,
    supabase: supabaseRequests(),
  })
  try {
    if (navigator.sendBeacon?.(ENDPOINT, body)) return
  } catch { /* fallback ci-dessous */ }
  fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => { /* best-effort */ })
}

/** Appelé une fois au montage de l'AuthProvider (toutes les pages). */
export function installBootTrace() {
  if (!isBrowser() || state.installed) return
  state.installed = true
  window.__bootHydrated = true
  // Erreurs capturées par le script inline AVANT que ce bundle ne démarre.
  for (const e of window.__bootErrors ?? []) recordError(e)

  window.addEventListener('error', (e) => {
    const target = e.target as (HTMLScriptElement & HTMLLinkElement) | null
    if (target && target !== (window as unknown) && (target.src || target.href)) {
      recordError(`resource: ${target.src || target.href}`) // chunk JS/CSS qui n'a pas chargé
    } else {
      recordError(`js: ${e.message} @ ${e.filename}:${e.lineno}`)
    }
  }, true)
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { name?: string; message?: string } | undefined
    recordError(`rejection: ${r?.name ?? ''} ${r?.message ?? String(e.reason)}`)
  })
  document.addEventListener('visibilitychange', () => bootMark(`tab:${document.visibilityState}`))
  window.addEventListener('pagehide', () => {
    if (state.tracking && state.readyAt === null) {
      bootMark('abandoned')
      send('abandoned')
    }
  })
  bootMark('js:start')
}

/**
 * Appelé par le layout (app) : à partir d'ici, on attend un `bootReady()`.
 * Les seuils sont comptés depuis le début de la navigation.
 */
export function bootExpectReady() {
  if (!isBrowser() || state.tracking) return
  state.tracking = true
  const arm = (ms: number, reason: string) =>
    setTimeout(() => {
      if (state.readyAt !== null) return
      bootMark(reason)
      send(reason)
    }, Math.max(0, ms - now()))
  arm(SLOW_MS, 'slow')
  arm(STALL_MS, 'stalled')
}

export function bootSetUser(userId: string | null) {
  state.userId = userId
}

export function bootReady(source: string) {
  if (!isBrowser() || state.readyAt !== null) return
  state.readyAt = now()
  bootMark('ready', { source })
  // 1 s de marge pour capter les erreurs post-rendu dans le même envoi.
  setTimeout(() => send('ready'), 1000)
}

export function bootFail(source: string, d?: Record<string, unknown>) {
  if (!isBrowser()) return
  bootMark(`fail:${source}`, d)
  if (state.readyAt === null) send('error')
}

/**
 * Script inline injecté dans <head> par app/layout.tsx. Il s'exécute avant
 * tout bundle : il capture les échecs de chargement (chunks 404, réseau) et,
 * si le JS n'a toujours pas démarré après 15 s, envoie un beacon `no-hydration`.
 * Garder ce code ES5 et minuscule.
 */
export const BOOT_INLINE_SCRIPT = `(function(){try{var E=window.__bootErrors=[];addEventListener('error',function(e){var t=e.target;if(t&&t!==window&&(t.src||t.href)){E.push('resource: '+(t.src||t.href))}else{E.push('js: '+(e.message||''))}},true);addEventListener('unhandledrejection',function(e){var r=e.reason;E.push('rejection: '+(r&&r.message||String(r)))});setTimeout(function(){if(window.__bootHydrated||!navigator.sendBeacon)return;navigator.sendBeacon('${ENDPOINT}',JSON.stringify({reason:'no-hydration',path:location.pathname,errors:E.slice(0,${MAX_ERRORS}),visibility:document.visibilityState,online:navigator.onLine,ua:navigator.userAgent}))},${STALL_MS})}catch(_){}})();`
