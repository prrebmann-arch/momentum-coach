export default function TemplatesLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 200, height: 28, borderRadius: 10, marginBottom: 24 }} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ width: 120, height: 36, borderRadius: 8 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
