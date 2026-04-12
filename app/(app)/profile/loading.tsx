export default function ProfileLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 180, height: 28, borderRadius: 10, marginBottom: 24 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
