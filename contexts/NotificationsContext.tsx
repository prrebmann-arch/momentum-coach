'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchUnreadNotifications,
  markNotificationRead as markNotificationReadApi,
  markAllNotificationsRead as markAllNotificationsReadApi,
  type CoachNotification,
} from '@/lib/notifications'

interface NotificationsContextValue {
  notifications: CoachNotification[]
  unreadCount: number
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const POLL_MS = 60_000

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<CoachNotification[]>([])

  const userId = user?.id
  const reload = useCallback(async () => {
    if (!userId) return
    try {
      const rows = await fetchUnreadNotifications(userId)
      setNotifications(rows)
    } catch (err) {
      console.error('[Notifications] fetch failed:', err)
    }
  }, [userId])

  // Vérification périodique (60 s, onglet visible uniquement) au lieu de
  // Supabase Realtime : le temps réel (postgres_changes) faisait tourner
  // realtime.list_changes en continu = ~55 % du temps de la base sur une
  // petite instance, pour quelques notifications par jour. Une minute de
  // délai sur la cloche est acceptable. + resync au retour d'onglet.
  useEffect(() => {
    if (!userId) {
      setNotifications([])
      return
    }
    reload()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload()
    }, POLL_MS)
    const handleWake = () => reload()
    window.addEventListener('coach:wake', handleWake)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('coach:wake', handleWake)
    }
  }, [userId, reload])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    try {
      await markNotificationReadApi(id)
    } catch (err) {
      console.error('[Notifications] markRead failed:', err)
      reload()
    }
  }, [reload])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    setNotifications([])
    try {
      await markAllNotificationsReadApi(userId)
    } catch (err) {
      console.error('[Notifications] markAllRead failed:', err)
      reload()
    }
  }, [userId, reload])

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount: notifications.length, markRead, markAllRead }),
    [notifications, markRead, markAllRead]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
