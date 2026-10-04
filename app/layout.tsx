import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { BOOT_INLINE_SCRIPT } from '@/lib/bootTrace'
// FontAwesome — only solid + regular kept. Brands removed (~90 KB) since no `fa-brands` usage in app.
// If you ever add a brand icon, re-add brands.min.css OR use a SVG (preferred for one-off brand icons).
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'
import '@fortawesome/fontawesome-free/css/regular.min.css'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MOMENTUM — Coaching Platform',
  description: 'Plateforme de coaching sportif professionnelle',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Trace de boot : capte les chunks qui ne chargent pas + beacon si le JS ne démarre jamais (lib/bootTrace.ts) */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_INLINE_SCRIPT }} />
        <link rel="preconnect" href="https://kczcqnasnjufkgbnrbvp.supabase.co" />
        <link rel="dns-prefetch" href="https://kczcqnasnjufkgbnrbvp.supabase.co" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
              <SpeedInsights />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
