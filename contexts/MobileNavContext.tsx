'use client'

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'

interface MobileNavContextValue {
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  toggleMobileOpen: () => void
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleMobileOpen = useCallback(() => {
    setMobileOpen((prev) => !prev)
  }, [])

  const value = useMemo<MobileNavContextValue>(
    () => ({ mobileOpen, setMobileOpen, toggleMobileOpen }),
    [mobileOpen, toggleMobileOpen]
  )

  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
}

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext)
  if (!ctx) throw new Error('useMobileNav must be used within MobileNavProvider')
  return ctx
}
