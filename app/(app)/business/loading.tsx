export default function BusinessLoading() {
  return (
    <div>
      {/* Page title skeleton */}
      <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 10, marginBottom: 24 }} />

      {/* Stat cards row skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20, marginBottom: 24 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 90, borderRadius: 16 }} />
        ))}
      </div>

      {/* Chart area skeleton */}
      <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
    </div>
  )
}
