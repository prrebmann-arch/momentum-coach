'use client'

import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/layout/NotificationBell'
import styles from '@/styles/topbar.module.css'

// Sur le dashboard, la liste et les pages athlète, la cloche est intégrée à
// l'en-tête de la page (à côté de « Ajouter un athlète » / du nom de l'athlète).
// Ailleurs elle flotte dans la marge en haut à droite, sans décaler la page.
const INLINE_BELL_PATHS = ['/dashboard', '/athletes', '/exercices', '/formations']

function hasInlineBell(pathname: string) {
  return INLINE_BELL_PATHS.includes(pathname) || pathname.startsWith('/athletes/')
}

export default function Topbar() {
  const pathname = usePathname()
  if (hasInlineBell(pathname)) return null
  return (
    <div className={styles.topbar}>
      <NotificationBell />
    </div>
  )
}
