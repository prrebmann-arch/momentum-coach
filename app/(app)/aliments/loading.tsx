export default function AlimentsLoading() {
  return (
    <div>
      {/* Page title skeleton */}
      <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 10, marginBottom: 24 }} />

      {/* Search bar skeleton */}
      <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 10, marginBottom: 24 }} />

      {/* Food row list skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 56, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
