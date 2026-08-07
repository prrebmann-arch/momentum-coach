'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/contexts/NotificationsContext'
import type { CoachNotification } from '@/lib/notifications'
import styles from '@/styles/notificationBell.module.css'

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleItemClick = useCallback(
    async (notif: CoachNotification) => {
      setOpen(false)
      router.push(notif.resourceLink)
      await markRead(notif.id)
    },
    [markRead, router]
  )

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={styles.bellButton}
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <i className="fa-solid fa-bell" />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 190 }}
            onClick={() => setOpen(false)}
          />
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <span>Notifications</span>
              {notifications.length > 0 && (
                <button type="button" className={styles.markAllButton} onClick={() => markAllRead()}>
                  Tout marquer lu
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>Aucune nouvelle activité</div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  className={styles.notifItem}
                  onClick={() => handleItemClick(notif)}
                >
                  <div className={styles.notifTitle}>{notif.title}</div>
                  {notif.body && <div className={styles.notifBody}>{notif.body}</div>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
