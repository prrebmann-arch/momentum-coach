export default function VideosLoading() {
  return (
    <div>
      {/* Page header: title + filter pills skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 140, height: 28, borderRadius: 10 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ width: 80, height: 34, borderRadius: 8 }} />
          ))}
        </div>
      </div>

      {/* Video card grid skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 180, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
