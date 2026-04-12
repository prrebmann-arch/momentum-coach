export default function VideosLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 200, height: 28, borderRadius: 10, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 180, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
