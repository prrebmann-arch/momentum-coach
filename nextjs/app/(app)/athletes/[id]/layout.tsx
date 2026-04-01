export default function AthleteDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* AthleteTabBar placeholder — will be implemented in a later phase */}
      <nav style={{ marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <span style={{ color: 'var(--text3)', fontSize: 13 }}>Onglets athlète (placeholder)</span>
      </nav>
      {children}
    </div>
  )
}
