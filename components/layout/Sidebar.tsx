'use client'

// Rail de navigation vertical façon Insyder (même direction que la sidebar de
// ClosRM desktop) : carte flottante arrondie centrée verticalement, icônes
// seules, état actif discret, libellé en tooltip au survol.
import { memo, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useAuth } from '@/contexts/AuthContext'
import styles from '@/styles/sidebar.module.css'

interface NavItem {
  label: string
  icon: string
  route: string
}

// Module-scope const — referenced once per render, never recreated.
const navGroups: NavItem[][] = [
  [
    { label: 'Dashboard', icon: 'fa-chart-line', route: '/dashboard' },
    { label: 'Athlètes', icon: 'fa-users', route: '/athletes' },
  ],
  [
    { label: 'Bilans', icon: 'fa-clipboard-check', route: '/bilans' },
    { label: 'Vidéos', icon: 'fa-video', route: '/videos' },
    { label: 'Questionnaires', icon: 'fa-clipboard-question', route: '/questionnaires' },
    { label: 'Annonces', icon: 'fa-bullhorn', route: '/annonces' },
  ],
  [
    { label: 'Templates', icon: 'fa-copy', route: '/templates' },
    { label: 'Aliments', icon: 'fa-utensils', route: '/aliments' },
    { label: 'Exercices', icon: 'fa-dumbbell', route: '/exercices' },
    { label: 'Formations', icon: 'fa-graduation-cap', route: '/formations' },
  ],
]

function SidebarImpl() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()

  const isActive = (route: string) => {
    if (route === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(route)
  }

  const handleLogout = useCallback(async () => {
    await signOut()
    router.push('/')
  }, [signOut, router])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? 'C'

  return (
    <nav className={styles.rail} aria-label="Navigation principale">
      <div className={styles.railCard}>
        <Link href="/dashboard" className={styles.railLogo} aria-label="Momentum">M</Link>

        {navGroups.map((group, gi) => (
          <div key={gi} className={styles.railSection}>
            <div className={styles.railDivider} />
            <div className={styles.railGroup}>
              {group.map((item) => (
                <Link
                  key={item.route}
                  href={item.route}
                  className={`${styles.railItem} ${isActive(item.route) ? styles.railItemActive : ''}`}
                  aria-label={item.label}
                  aria-current={isActive(item.route) ? 'page' : undefined}
                >
                  <i className={`fas ${item.icon}`} />
                  <span className={styles.railTooltip}>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className={styles.railSection}>
          <div className={styles.railDivider} />
          <div className={styles.railGroup}>
            <Link
              href="/profile"
              className={`${styles.railItem} ${isActive('/profile') ? styles.railItemActive : ''}`}
              aria-label="Mon profil"
            >
              <span className={styles.railAvatar}>{userInitial}</span>
              <span className={styles.railTooltip}>Mon profil</span>
            </Link>
            <button type="button" className={styles.railItem} onClick={toggleTheme} aria-label="Mode jour / nuit">
              <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`} />
              <span className={styles.railTooltip}>{theme === 'light' ? 'Mode nuit' : 'Mode jour'}</span>
            </button>
            <button type="button" className={styles.railItem} onClick={handleLogout} aria-label="Se déconnecter">
              <i className="fas fa-sign-out-alt" />
              <span className={styles.railTooltip}>Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

// Sidebar mounts on every (app) route. memo skips re-render unless the
// (rare) hooks it consumes return new values.
const Sidebar = memo(SidebarImpl)
export default Sidebar
