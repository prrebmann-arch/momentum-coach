export default function ExercicesLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 240, height: 28, borderRadius: 10, marginBottom: 24 }} />
      <div className="skeleton" style={{ width: '100%', height: 40, borderRadius: 8, marginBottom: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
