export default function AlimentsLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 240, height: 28, borderRadius: 10, marginBottom: 24 }} />
      <div className="skeleton" style={{ width: '100%', height: 40, borderRadius: 8, marginBottom: 16 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 48, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  )
}
