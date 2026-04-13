export default function ProfileLoading() {
  return (
    <div>
      {/* Page title skeleton */}
      <div className="skeleton" style={{ width: 140, height: 28, borderRadius: 10, marginBottom: 24 }} />

      {/* Avatar + text lines skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skeleton" style={{ width: 160, height: 22, borderRadius: 10 }} />
          <div className="skeleton" style={{ width: 120, height: 18, borderRadius: 10 }} />
        </div>
      </div>

      {/* Settings block skeleton */}
      <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
    </div>
  )
}
