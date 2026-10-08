'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import styles from '@/styles/bilans.module.css'
import VisualStudio, { type StudioPhoto } from './VisualStudio'
import { computeCoverCrop } from './visualRender'

export interface PhotoEntry {
  date: string
  url: string
  weight?: number | null
}

export type PhotoType = 'front' | 'side' | 'back'

interface PhotoCompareProps {
  isOpen: boolean
  onClose: () => void
  initialType: PhotoType
  initialDate: string
  photoHistory: Record<PhotoType, PhotoEntry[]>
  athleteName?: string
}

const TYPE_LABELS: Record<PhotoType, string> = { front: 'Face', side: 'Profil', back: 'Dos' }
const TYPE_ICONS: Record<PhotoType, string> = { front: 'fa-user', side: 'fa-user-alt', back: 'fa-user-alt-slash' }

const LAYOUT_BUCKET = 'content-drafts'
function layoutPath(userId: string) {
  return `${userId}/instagram-layout.png`
}

function formatPhotoDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

// Zone visible (coords image) d'une cellule : <img> en object-fit: cover,
// transformée par react-zoom-pan-pinch. Les cellules et les cadres du visuel
// ont le même ratio 3:4 → aucun étirement à l'export.
function cellCrop(cell: HTMLElement | null, wrap: ReactZoomPanPinchRef | null) {
  const img = cell?.querySelector('img')
  if (!cell || !img || !img.naturalWidth || !cell.clientWidth) return null
  const st = wrap?.state ?? { scale: 1, positionX: 0, positionY: 0 }
  return computeCoverCrop(img.naturalWidth, img.naturalHeight, cell.clientWidth, cell.clientHeight, st.scale, st.positionX, st.positionY)
}

export default function PhotoCompare({ isOpen, onClose, initialType, initialDate, photoHistory, athleteName }: PhotoCompareProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [type, setType] = useState<PhotoType>(initialType)
  const [leftIdx, setLeftIdx] = useState(0)
  const [rightIdx, setRightIdx] = useState(0)
  const [fading, setFading] = useState(false)
  const [studio, setStudio] = useState<{ before: StudioPhoto; after: StudioPhoto } | null>(null)
  const [hasLayout, setHasLayout] = useState<boolean | null>(null)

  const leftWrapRef = useRef<ReactZoomPanPinchRef | null>(null)
  const rightWrapRef = useRef<ReactZoomPanPinchRef | null>(null)
  const leftCellRef = useRef<HTMLDivElement | null>(null)
  const rightCellRef = useRef<HTMLDivElement | null>(null)

  // Reset state when opening
  useEffect(() => {
    if (!isOpen) return
    setStudio(null)
    setType(initialType)
    const photos = photoHistory[initialType] || []
    const ri = photos.findIndex(p => p.date === initialDate)
    const rIdx = ri >= 0 ? ri : photos.length - 1
    const lIdx = Math.max(0, rIdx - 1)
    setRightIdx(rIdx)
    setLeftIdx(lIdx)
  }, [isOpen, initialType, initialDate, photoHistory])

  // Check if coach has uploaded a layout
  useEffect(() => {
    if (!isOpen || !user?.id) return
    let cancelled = false
    ;(async () => {
      const { data } = supabase.storage.from(LAYOUT_BUCKET).getPublicUrl(layoutPath(user.id))
      // Test reachability with HEAD
      try {
        const res = await fetch(data.publicUrl, { method: 'HEAD' })
        if (!cancelled) setHasLayout(res.ok)
      } catch {
        if (!cancelled) setHasLayout(false)
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, user?.id, supabase])

  const photos = photoHistory[type] || []

  const navigate = useCallback((dir: number) => {
    setFading(true)
    setTimeout(() => {
      setLeftIdx(prev => {
        const newIdx = prev + dir
        if (newIdx < 0 || newIdx > rightIdx) return prev
        return newIdx
      })
      setFading(false)
      // Reset zoom on photo change
      leftWrapRef.current?.resetTransform()
    }, 150)
  }, [rightIdx])

  const switchType = useCallback((newType: PhotoType) => {
    const newPhotos = photoHistory[newType] || []
    if (!newPhotos.length) return
    const currentDate = photos[rightIdx]?.date
    let ri = newPhotos.findIndex(p => p.date === currentDate)
    if (ri < 0) ri = newPhotos.length - 1
    const li = Math.min(leftIdx, ri > 0 ? ri - 1 : 0)
    setType(newType)
    setRightIdx(ri)
    setLeftIdx(li)
    leftWrapRef.current?.resetTransform()
    rightWrapRef.current?.resetTransform()
  }, [photoHistory, photos, rightIdx, leftIdx])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (studio) {
        if (e.key === 'Escape') setStudio(null)
        return
      }
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') navigate(-1)
      if (e.key === 'ArrowRight') navigate(1)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose, navigate, studio])

  const openStudio = () => {
    const l = photos[leftIdx]
    const r = photos[rightIdx]
    if (!l || !r) { toast('Photos non disponibles', 'error'); return }
    setStudio({
      before: { url: l.url, date: l.date, weight: l.weight, crop: cellCrop(leftCellRef.current, leftWrapRef.current) },
      after: { url: r.url, date: r.date, weight: r.weight, crop: cellCrop(rightCellRef.current, rightWrapRef.current) },
    })
  }

  const layoutUrl = hasLayout && user?.id ? supabase.storage.from(LAYOUT_BUCKET).getPublicUrl(layoutPath(user.id)).data.publicUrl : null
  const firstName = (athleteName || '').split('_')[0] || ''

  if (!isOpen || typeof document === 'undefined') return null
  if (!photos.length) return null

  const leftPhoto = photos[leftIdx]
  const rightPhoto = photos[rightIdx]

  return createPortal(
    <div
      className={styles.pcOverlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.pcViewer}>
        {/* Header */}
        <div className={styles.pcHeader}>
          <div className={styles.pcTabs}>
            {(['front', 'side', 'back'] as PhotoType[]).map(t => {
              const hasPhotos = (photoHistory[t] || []).length > 0
              if (!hasPhotos) return null
              return (
                <button
                  key={t}
                  className={`${styles.pcTab} ${t === type ? styles.pcTabActive : ''}`}
                  onClick={() => switchType(t)}
                >
                  <i className={`fas ${TYPE_ICONS[t]}`} />
                  {TYPE_LABELS[t]}
                </button>
              )
            })}
          </div>
          <div className={styles.pcHeaderRight}>
            {!studio && (
              <button className={styles.pcExportBtn} onClick={openStudio} title="Créer un visuel post / story Instagram">
                <i className="fas fa-hashtag" /> Créer un visuel
              </button>
            )}
            <button className={styles.pcClose} onClick={onClose}>
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {studio && (
          <VisualStudio
            before={studio.before}
            after={studio.after}
            athleteFirstName={firstName}
            athleteFileName={(athleteName || 'athlete').replace(/[^\w-]+/g, '_')}
            layoutUrl={layoutUrl}
            onClose={() => setStudio(null)}
          />
        )}

        {/* Body — gardé monté (zoom conservé) mais masqué pendant le studio */}
        <div className={styles.pcBody} style={studio ? { display: 'none' } : undefined}>
          {/* Left side (comparison) */}
          <div className={styles.pcSide}>
            <button
              className={`${styles.pcNav} ${styles.pcNavPrev}`}
              onClick={() => navigate(-1)}
              disabled={leftIdx <= 0}
            >
              <i className="fas fa-chevron-left" />
            </button>
            <div className={styles.pcCellWrap}>
              <div className={styles.pcCaption}>
                <span className={styles.pcCaptionText}>
                  <b className={styles.pcCaptionTag}>AVANT</b>
                  {leftPhoto && <span className={styles.pcCaptionDate}>{formatPhotoDate(leftPhoto.date)}</span>}
                </span>
                <button
                  className={styles.pcResetLink}
                  onClick={() => leftWrapRef.current?.resetTransform()}
                  title="Réinitialiser le zoom"
                >
                  <i className="fas fa-arrows-rotate" /> Réinitialiser
                </button>
              </div>
              <div ref={leftCellRef} className={`${styles.pcCell} ${fading ? styles.pcImgFade : ''}`}>
                <TransformWrapper
                  ref={leftWrapRef}
                  initialScale={1}
                  minScale={1}
                  maxScale={5}
                  centerOnInit
                  doubleClick={{ disabled: false, mode: 'reset' }}
                  wheel={{ step: 0.1 }}
                >
                  <TransformComponent wrapperStyle={{ height: '100%', width: '100%' }} contentStyle={{ height: '100%', width: '100%' }}>
                    {leftPhoto && (
                      <img
                        src={leftPhoto.url}
                        alt={`${TYPE_LABELS[type]} - ${leftPhoto.date}`}
                        crossOrigin="anonymous"
                        style={{ height: '100%', width: '100%', objectFit: 'cover', userSelect: 'none' }}
                        draggable={false}
                      />
                    )}
                  </TransformComponent>
                </TransformWrapper>
              </div>
            </div>
            <button
              className={`${styles.pcNav} ${styles.pcNavNext}`}
              onClick={() => navigate(1)}
              disabled={leftIdx >= rightIdx}
            >
              <i className="fas fa-chevron-right" />
            </button>
          </div>

          <div className={styles.pcDivider} />

          {/* Right side (current) */}
          <div className={styles.pcSide}>
            <div className={styles.pcCellWrap}>
              <div className={styles.pcCaption}>
                <span className={styles.pcCaptionText}>
                  <b className={`${styles.pcCaptionTag} ${styles.pcCaptionTagAfter}`}>APRÈS</b>
                  {rightPhoto && <span className={`${styles.pcCaptionDate} ${styles.pcCaptionDateAfter}`}>{formatPhotoDate(rightPhoto.date)}</span>}
                </span>
                <button
                  className={styles.pcResetLink}
                  onClick={() => rightWrapRef.current?.resetTransform()}
                  title="Réinitialiser le zoom"
                >
                  <i className="fas fa-arrows-rotate" /> Réinitialiser
                </button>
              </div>
              <div ref={rightCellRef} className={styles.pcCell}>
                <TransformWrapper
                  ref={rightWrapRef}
                  initialScale={1}
                  minScale={1}
                  maxScale={5}
                  centerOnInit
                  doubleClick={{ disabled: false, mode: 'reset' }}
                  wheel={{ step: 0.1 }}
                >
                  <TransformComponent wrapperStyle={{ height: '100%', width: '100%' }} contentStyle={{ height: '100%', width: '100%' }}>
                    {rightPhoto && (
                      <img
                        src={rightPhoto.url}
                        alt={`${TYPE_LABELS[type]} - ${rightPhoto.date}`}
                        crossOrigin="anonymous"
                        style={{ height: '100%', width: '100%', objectFit: 'cover', userSelect: 'none' }}
                        draggable={false}
                      />
                    )}
                  </TransformComponent>
                </TransformWrapper>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
