'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import styles from './RetourVideoPlayer.module.css'

interface Props {
  retourId: string
  archived?: boolean
}

interface SignedUrls {
  videoUrl: string
  thumbnailUrl: string
  expiresAt: string
}

const SPEEDS = [1, 1.5, 2]

export default function RetourVideoPlayer({ retourId, archived }: Props) {
  const auth = useAuth() as { accessToken?: string | null }
  const videoRef = useRef<HTMLVideoElement>(null)
  const [urls, setUrls] = useState<SignedUrls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speed, setSpeed] = useState<number>(1)
  // Defer mounting the <video> element (which triggers a metadata fetch)
  // until the user actually clicks Play. With many retours in a list, this
  // saves ~50-100KB of metadata fetches per video that the user never opens.
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (archived) return
    if (!auth.accessToken) return  // wait for auth context to provide token
    let cancelled = false

    async function fetchUrls() {
      try {
        const res = await fetch(`/api/videos/retour-signed-url?id=${encodeURIComponent(retourId)}`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        })
        if (!res.ok) {
          const body = await res.text()
          if (!cancelled) setError(`Erreur ${res.status}: ${body}`)
          return
        }
        const json = await res.json() as SignedUrls
        if (!cancelled) setUrls(json)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }
    }

    fetchUrls()
    return () => { cancelled = true }
  }, [retourId, archived, auth.accessToken])

  useEffect(() => {
    if (armed && videoRef.current) {
      videoRef.current.playbackRate = speed
      // Auto-play on arm so the user's click reaches the video state directly.
      videoRef.current.play().catch(() => { /* user gesture lost, ignore */ })
    }
  }, [speed, armed])

  if (archived) {
    return <div className={styles.archived}>
      <i className="fas fa-archive" /> Vidéo archivée (plus de 30 jours)
    </div>
  }

  if (error) {
    return <div className={styles.archived}>{error}</div>
  }

  if (!urls) {
    return <div className={styles.archived}>Chargement…</div>
  }

  // Pre-armed state: thumbnail + click-to-play overlay. No <video> element yet,
  // so the browser doesn't fetch the video file or its metadata.
  if (!armed) {
    return (
      <div
        className={styles.wrapper}
        onClick={() => setArmed(true)}
        style={{ position: 'relative', cursor: 'pointer' }}
      >
        {urls.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urls.thumbnailUrl}
            alt="Aperçu retour vidéo"
            className={styles.video}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={styles.video} style={{ background: '#000' }} />
        )}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.25)', borderRadius: 'inherit',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontSize: 22,
          }}>
            <i className="fas fa-play" style={{ marginLeft: 4 }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <video
        ref={videoRef}
        className={styles.video}
        src={urls.videoUrl}
        poster={urls.thumbnailUrl}
        controls
        playsInline
        preload="metadata"
        autoPlay
      />
      <div className={styles.controls}>
        {SPEEDS.map(s => (
          <button
            key={s}
            className={`${styles.speedBtn} ${speed === s ? styles.speedBtnActive : ''}`}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
