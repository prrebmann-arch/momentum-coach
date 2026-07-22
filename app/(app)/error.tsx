'use client'

import { useEffect } from 'react'

/**
 * Error boundary du segment (app). Sans lui, tout crash client (ex: violation
 * Rules of Hooks) = page blanche sans retry, percu comme "chargement dans le
 * vide" et invisible dans les logs Vercel.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app-error]', error)
  }, [error])

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <h2 style={{ margin: 0, fontSize: 20 }}>Une erreur est survenue sur cette page</h2>
      <p style={{ margin: 0, color: 'var(--text3, #888)', fontSize: 14, maxWidth: 420 }}>
        {error?.message || 'Erreur inattendue.'}
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={reset}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--primary, #B30808)', color: '#fff', fontWeight: 600,
          }}
        >
          Réessayer
        </button>
        <button
          onClick={() => { window.location.href = '/dashboard' }}
          style={{
            padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', color: 'var(--text2, #bbb)', border: '1px solid var(--border, #333)',
          }}
        >
          Retour au dashboard
        </button>
      </div>
    </div>
  )
}
