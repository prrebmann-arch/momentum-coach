'use client'

import { useState, useEffect, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from '@/styles/auth.module.css'

export default function ResetPasswordPage() {
  const supabase = createClient()

  const [ready, setReady] = useState(false)      // token de récupération détecté
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  // Supabase place le token de récupération dans l'URL (hash) au clic sur le lien email.
  // Le SDK le consomme et émet PASSWORD_RECOVERY → on autorise la saisie du nouveau mdp.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    // Fallback : si une session de récupération est déjà présente (rechargement), autoriser aussi.
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (data.session) setReady(true)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [supabase])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.authScreen}>
      <div className={styles.authBox}>
        <div className={styles.authLogo}>
          <div className={styles.authLogoText}>MOMENTUM</div>
          <div className={styles.authSubtitle}>Réinitialisation du mot de passe</div>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p style={{ marginBottom: 8 }}>✅ Mot de passe modifié !</p>
            <p style={{ fontSize: 14, color: 'var(--text3)' }}>
              Vous pouvez maintenant retourner dans l&apos;application et vous connecter avec votre nouveau mot de passe.
            </p>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text3)', fontSize: 14 }}>
            Vérification du lien de réinitialisation…
            <p style={{ marginTop: 12, fontSize: 13 }}>
              Si rien ne se passe, le lien a peut-être expiré. Redemandez une réinitialisation depuis l&apos;application.
            </p>
          </div>
        ) : (
          <>
            {error && <div className={styles.error}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>Nouveau mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label>Confirmer le mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? 'Enregistrement…' : 'Changer mon mot de passe'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
