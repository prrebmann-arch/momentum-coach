'use client'

import NotificationBell from '@/components/layout/NotificationBell'
import { useMobileNav } from '@/contexts/MobileNavContext'
import styles from '@/styles/topbar.module.css'

export default function Topbar() {
  const { toggleMobileOpen } = useMobileNav()

  return (
    <div className={styles.topbar}>
      <button
        type="button"
        className={styles.hamburgerBtn}
        aria-label="Ouvrir le menu"
        onClick={toggleMobileOpen}
      >
        <i className="fa-solid fa-bars" />
      </button>
      <div className={styles.topbarSpacer} />
      <NotificationBell />
    </div>
  )
}
