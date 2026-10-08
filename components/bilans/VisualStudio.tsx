'use client'

// Studio « Créer un visuel » (inspiré de Synergy) : options à gauche, aperçu
// live à droite, export PNG au format Post 4:5 ou Story 9:16.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Anton, Bebas_Neue, Outfit } from 'next/font/google'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  renderVisual, visualSize,
  type Crop, type VisualAmbiance, type VisualBackground, type VisualFormat,
} from './visualRender'
import styles from '@/styles/visualStudio.module.css'

const outfit = Outfit({ subsets: ['latin'], weight: ['800'] })
const anton = Anton({ subsets: ['latin'], weight: ['400'] })
const bebas = Bebas_Neue({ subsets: ['latin'], weight: ['400'] })

const FONTS = [
  { key: 'outfit', label: 'Outfit', family: outfit.style.fontFamily, weight: 800 },
  { key: 'anton', label: 'Anton', family: anton.style.fontFamily, weight: 400 },
  { key: 'bebas', label: 'Bebas Neue', family: bebas.style.fontFamily, weight: 400 },
] as const

export interface StudioPhoto { url: string; date: string; weight?: number | null; crop: Crop | null }

interface Props {
  before: StudioPhoto
  after: StudioPhoto
  athleteFirstName: string
  athleteFileName: string
  layoutUrl: string | null
  onClose: () => void
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Image non chargée : ${url}`))
    img.src = url
  })
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string; sub?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className={styles.seg}>
      {options.map((o) => (
        <button key={o.v} type="button" className={`${styles.segBtn} ${value === o.v ? styles.segActive : ''}`} onClick={() => onChange(o.v)}>
          {o.label}
          {o.sub && <span className={styles.segSub}>{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`${styles.toggleRow} ${disabled ? styles.toggleDisabled : ''}`}>
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled}
        className={`${styles.switch} ${checked ? styles.switchOn : ''}`} onClick={() => onChange(!checked)}>
        <span className={styles.knob} />
      </button>
    </label>
  )
}

export default function VisualStudio({ before, after, athleteFirstName, athleteFileName, layoutUrl, onClose }: Props) {
  const { coach } = useAuth()
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [ambiance, setAmbiance] = useState<VisualAmbiance>('noir')
  const [fontKey, setFontKey] = useState<(typeof FONTS)[number]['key']>('outfit')
  const [format, setFormat] = useState<VisualFormat>('post')
  const [background, setBackground] = useState<VisualBackground>('after')
  const [showName, setShowName] = useState(true)
  const [name, setName] = useState(athleteFirstName)
  const [showLogo, setShowLogo] = useState(true)
  const [showDates, setShowDates] = useState(true)
  const [showWeight, setShowWeight] = useState(false)
  const [useLayout, setUseLayout] = useState(false)

  const [imgs, setImgs] = useState<{ before: HTMLImageElement; after: HTMLImageElement; logo: HTMLImageElement | null; layout: HTMLImageElement | null } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const font = FONTS.find((f) => f.key === fontKey) ?? FONTS[0]
  const hasWeights = before.weight != null || after.weight != null

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [b, a] = await Promise.all([loadImage(before.url), loadImage(after.url)])
        const logo = coach?.avatar_url ? await loadImage(coach.avatar_url).catch(() => null) : null
        const layout = layoutUrl ? await loadImage(`${layoutUrl}?t=${Date.now()}`).catch(() => null) : null
        if (!cancelled) setImgs({ before: b, after: a, logo, layout })
      } catch (e) {
        console.error('[VisualStudio] load', e)
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => { cancelled = true }
  }, [before.url, after.url, coach?.avatar_url, layoutUrl])

  const [fontReady, setFontReady] = useState(0)
  useEffect(() => {
    let cancelled = false
    document.fonts.load(`${font.weight} 100px ${font.family}`).catch(() => {}).finally(() => { if (!cancelled) setFontReady((n) => n + 1) })
    return () => { cancelled = true }
  }, [font.family, font.weight])

  const options = useMemo(() => {
    if (!imgs) return null
    const crop = (img: HTMLImageElement, c: Crop | null): Crop => c ?? { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight }
    return {
      format, ambiance, background, showName, showLogo, showDates, showWeight,
      fontFamily: font.family, fontWeight: font.weight,
      name, brandName: coach?.display_name || 'Momentum',
      logoImg: imgs.logo,
      layoutImg: useLayout ? imgs.layout : null,
      before: { img: imgs.before, crop: crop(imgs.before, before.crop), date: before.date, weight: before.weight },
      after: { img: imgs.after, crop: crop(imgs.after, after.crop), date: after.date, weight: after.weight },
    }
  }, [imgs, format, ambiance, background, showName, showLogo, showDates, showWeight, font, name, coach?.display_name, useLayout, before, after])

  useEffect(() => {
    if (options && canvasRef.current) renderVisual(canvasRef.current, options)
  }, [options, fontReady])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas || !options) return
    canvas.toBlob((blob) => {
      if (!blob) { toast("Échec de l'export", 'error'); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${format === 'story' ? 'story' : 'post'}_${athleteFileName}_${after.date}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast('Visuel téléchargé !', 'success')
    }, 'image/png')
  }

  const { w, h } = visualSize(format)

  return (
    <div className={styles.studio}>
      <aside className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelTitle}><i className="fas fa-hashtag" /> Créer un visuel</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer"><i className="fas fa-times" /></button>
        </div>

        <section>
          <h4>Ambiance</h4>
          <Seg value={ambiance} onChange={setAmbiance} options={[{ v: 'noir', label: 'Noir' }, { v: 'teinte', label: 'Teinté' }]} />
        </section>

        <section>
          <h4>Police</h4>
          <select className={styles.select} value={fontKey} onChange={(e) => setFontKey(e.target.value as typeof fontKey)}>
            {FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </section>

        <section>
          <h4>Format</h4>
          <Seg value={format} onChange={setFormat} options={[{ v: 'post', label: 'Post 4:5', sub: '1080 × 1350' }, { v: 'story', label: 'Story 9:16', sub: '1080 × 1920' }]} />
        </section>

        <section>
          <h4>Fond</h4>
          <Seg value={background} onChange={setBackground} options={[{ v: 'after', label: 'Photo « après »' }, { v: 'before', label: 'Photo « avant »' }, { v: 'none', label: 'Aucun' }]} />
        </section>

        <section>
          <h4>Contenu</h4>
          <Toggle label="Prénom en titre" checked={showName} onChange={setShowName} />
          {showName && <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Prénom" />}
          <Toggle label="Logo du coach" checked={showLogo} onChange={setShowLogo} />
          <Toggle label="Dates sous les photos" checked={showDates} onChange={setShowDates} />
          <Toggle label="Poids sur les photos" checked={showWeight} onChange={setShowWeight} disabled={!hasWeights} />
          <Toggle label="Calque perso (profil)" checked={useLayout} onChange={setUseLayout} disabled={!layoutUrl || format === 'story'} />
          <p className={styles.hint}><i className="fas fa-palette" /> Le logo vient de ta photo de profil, le calque de Profil → Layout Instagram. Le cadrage reprend le zoom choisi dans le comparateur.</p>
        </section>

        <button type="button" className={styles.download} onClick={download} disabled={!options}>
          <i className="fas fa-down-to-bracket" /> Télécharger le PNG
        </button>
      </aside>

      <div className={styles.previewWrap}>
        {loadError ? (
          <div className={styles.error}>Impossible de charger les photos : {loadError}</div>
        ) : !imgs ? (
          <div className={styles.loading}><i className="fas fa-spinner fa-spin" /> Préparation de l&apos;aperçu…</div>
        ) : null}
        <canvas ref={canvasRef} className={styles.preview} style={{ aspectRatio: `${w} / ${h}`, display: imgs ? 'block' : 'none' }} />
        {imgs && <span className={styles.previewMeta}>Aperçu · PNG {w} × {h}</span>}
      </div>
    </div>
  )
}
