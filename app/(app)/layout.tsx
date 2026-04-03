'use client'

import { useAuth } from '@/contexts/AuthContext'
import { AthleteProvider } from '@/contexts/AthleteContext'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import styles from '@/styles/sidebar.module.css'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const checkedRef = useRef(false)
  const [timedOut, setTimedOut] = useState(false)

  // Check if returning from external redirect (Stripe, etc.)
  const isReturning = typeof window !== 'undefined' && (
    window.location.search.includes('connect=') ||
    window.location.search.includes('setup=') ||
    window.location.search.includes('payment=')
  )

  // Safety timeout: if loading takes more than 8s, stop waiting
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    const shouldRedirect = !loading || timedOut
    if (!shouldRedirect) return
    if (!user && !isReturning && !checkedRef.current) {
      checkedRef.current = true
      router.push('/login')
    }
  }, [user, loading, timedOut, router, isReturning])

  if (loading && !timedOut) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text2)' }}>Chargement...</div>
  if (!user && !isReturning) return null

  return (
    <AthleteProvider>
      <div className={styles.appLayout}>
        <Sidebar />
        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </AthleteProvider>
  )
}
