export default function TemplatesLoading() {
  return (
    <div>
      {/* Page header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 180, height: 28, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 140, height: 38, borderRadius: 10 }} />
      </div>

      {/* Tab bar skeleton */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ width: 100, height: 36, borderRadius: 8 }} />
        ))}
      </div>

      {/* Template card grid skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
