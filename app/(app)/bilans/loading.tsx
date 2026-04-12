export default function BilansLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 200, height: 28, borderRadius: 10, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
    </div>
  )
}
