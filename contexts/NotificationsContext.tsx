'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
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

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<CoachNotification[]>([])

  const reload = useCallback(async () => {
    if (!user) return
    try {
      const rows = await fetchUnreadNotifications(user.id)
      setNotifications(rows)
    } catch (err) {
      console.error('[Notifications] fetch failed:', err)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }
    reload()

    const supabase = createClient()
    const channel = supabase
      .channel(`coach_notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coach_notifications', filter: `coach_id=eq.${user.id}` },
        () => {
          // Any insert/update for this coach — just reload the unread set.
          // Simpler and safer than hand-merging partial payloads.
          reload()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, reload])

  // Filet de sécurité: resynchronise au retour d'onglet si le canal
  // Realtime a été coupé pendant la veille (cf. hooks/useRefetchOnResume.ts).
  useEffect(() => {
    const handleWake = () => reload()
    window.addEventListener('coach:wake', handleWake)
    return () => window.removeEventListener('coach:wake', handleWake)
  }, [reload])

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
    if (!user) return
    setNotifications([])
    try {
      await markAllNotificationsReadApi(user.id)
    } catch (err) {
      console.error('[Notifications] markAllRead failed:', err)
      reload()
    }
  }, [user, reload])

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
