export default function ExercicesLoading() {
  return (
    <div>
      {/* Page header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 140, height: 38, borderRadius: 10 }} />
      </div>

      {/* Search bar skeleton */}
      <div className="skeleton" style={{ width: 300, height: 40, borderRadius: 10, marginBottom: 24 }} />

      {/* Exercise card grid skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
