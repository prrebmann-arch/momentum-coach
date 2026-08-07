'use client'

import NotificationBell from '@/components/layout/NotificationBell'
import styles from '@/styles/topbar.module.css'

export default function Topbar() {
  return (
    <div className={styles.topbar}>
      <NotificationBell />
    </div>
  )
}
