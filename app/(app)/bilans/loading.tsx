export default function BilansLoading() {
  return (
    <div>
      {/* Page title skeleton */}
      <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 10, marginBottom: 24 }} />

      {/* Filter pills skeleton */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ width: 90, height: 34, borderRadius: 8 }} />
        ))}
      </div>

      {/* Bilan card grid skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
