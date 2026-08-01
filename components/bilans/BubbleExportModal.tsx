'use client'

// Export d'un commentaire de bilan en bulle de message (PNG), pour Instagram.
// Aperçu live + réglages (couleur, forme, taille, largeur, fond), export canvas
// natif (aucune dépendance externe). Réglages mémorisés en localStorage.
import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'

type BubbleColor = 'white' | 'ios' | 'dark'
type BubbleShape = 'imsg' | 'wa'
type ExportBg = 'transparent' | 'white' | 'black'

interface Settings {
  color: BubbleColor
  shape: BubbleShape
  size: number
  maxWidth: number
  bg: ExportBg
}

const DEFAULTS: Settings = { color: 'white', shape: 'imsg', size: 16, maxWidth: 300, bg: 'transparent' }
const STORAGE_KEY = 'prc-bubble-export'

const COLORS: Record<BubbleColor, { fill: string; text: string; label: string }> = {
  white: { fill: '#ffffff', text: '#111111', label: 'Blanche' },
  ios:   { fill: '#e9e9eb', text: '#000000', label: 'Gris iOS' },
  dark:  { fill: '#262d31', text: '#ececec', label: 'Sombre' },
}

// Rayons des coins selon la forme
function radii(shape: BubbleShape) {
  return shape === 'imsg'
    ? { tl: 20, tr: 20, br: 20, bl: 5 }
    : { tl: 2, tr: 9, br: 9, bl: 9 }
}

// Word-wrap manuel : découpe le texte en lignes tenant dans maxTextWidth.
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxTextWidth: number): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxTextWidth && line) { out.push(line); line = w }
      else line = test
    }
    out.push(line)
  }
  return out.length ? out : ['']
}

// Dessine la bulle sur un canvas et retourne le canvas. scale = netteté.
function drawBubble(text: string, s: Settings, scale: number): HTMLCanvasElement {
  const pad = 16
  const font = `${s.size}px -apple-system, "Segoe UI", Roboto, sans-serif`
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  const lines = wrapLines(measure, text, s.maxWidth - pad * 2)
  const lineH = s.size * 1.45
  const textW = Math.min(s.maxWidth - pad * 2, Math.max(1, ...lines.map((l) => measure.measureText(l).width)))
  const bw = textW + pad * 2
  const bh = lines.length * lineH + pad * 2

  const c = document.createElement('canvas')
  c.width = Math.ceil(bw * scale)
  c.height = Math.ceil(bh * scale)
  const ctx = c.getContext('2d')!
  ctx.scale(scale, scale)

  // Fond de l'image (si non transparent)
  if (s.bg !== 'transparent') {
    ctx.fillStyle = s.bg === 'white' ? '#ffffff' : '#000000'
    ctx.fillRect(0, 0, bw, bh)
  }

  // Forme de la bulle
  const r = radii(s.shape)
  ctx.beginPath()
  ctx.moveTo(r.tl, 0)
  ctx.lineTo(bw - r.tr, 0); ctx.arcTo(bw, 0, bw, r.tr, r.tr)
  ctx.lineTo(bw, bh - r.br); ctx.arcTo(bw, bh, bw - r.br, bh, r.br)
  ctx.lineTo(r.bl, bh); ctx.arcTo(0, bh, 0, bh - r.bl, r.bl)
  ctx.lineTo(0, r.tl); ctx.arcTo(0, 0, r.tl, 0, r.tl)
  ctx.closePath()
  ctx.fillStyle = COLORS[s.color].fill
  ctx.fill()

  // Texte
  ctx.fillStyle = COLORS[s.color].text
  ctx.font = font
  ctx.textBaseline = 'top'
  lines.forEach((l, i) => ctx.fillText(l, pad, pad + i * lineH + (lineH - s.size) / 2))

  return c
}

export default function BubbleExportModal({ text, onClose }: { text: string; onClose: () => void }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const previewRef = useRef<HTMLDivElement>(null)

  // Charger les réglages mémorisés (post-hydration only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) })
    } catch { /* ignore */ }
  }, [])

  const update = (partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
  }

  // Aperçu live : redessine à l'échelle 1 dans le DOM
  useEffect(() => {
    const host = previewRef.current
    if (!host) return
    host.replaceChildren() // vide le conteneur sans innerHTML
    const canvas = drawBubble(text, settings, 1)
    canvas.style.maxWidth = '100%'
    host.appendChild(canvas)
  }, [text, settings])

  function download() {
    const canvas = drawBubble(text, settings, 3)
    const a = document.createElement('a')
    a.download = 'retour.png'
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

  const btn = (active: boolean) => `btn btn-sm ${active ? 'btn-red' : 'btn-outline'}`

  return (
    <Modal isOpen onClose={onClose} title="Exporter le retour">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 4 }}>
        {/* Aperçu sur damier (pour voir la transparence) */}
        <div style={{
          borderRadius: 10, padding: 20, display: 'flex', justifyContent: 'center', overflow: 'auto',
          backgroundImage: 'linear-gradient(45deg,#3a3f47 25%,transparent 25%),linear-gradient(-45deg,#3a3f47 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#3a3f47 75%),linear-gradient(-45deg,transparent 75%,#3a3f47 75%)',
          backgroundSize: '16px 16px', backgroundPosition: '0 0,0 8px,8px -8px,-8px 0', backgroundColor: '#2a2e35',
        }}>
          <div ref={previewRef} />
        </div>

        {/* Couleur */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Couleur</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(Object.keys(COLORS) as BubbleColor[]).map((c) => (
              <button key={c} className={btn(settings.color === c)} onClick={() => update({ color: c })}>{COLORS[c].label}</button>
            ))}
          </div>
        </div>

        {/* Forme */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Forme</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={btn(settings.shape === 'imsg')} onClick={() => update({ shape: 'imsg' })}>iMessage</button>
            <button className={btn(settings.shape === 'wa')} onClick={() => update({ shape: 'wa' })}>WhatsApp</button>
          </div>
        </div>

        {/* Fond de l'image */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Fond de l&apos;image</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={btn(settings.bg === 'transparent')} onClick={() => update({ bg: 'transparent' })}>Transparent</button>
            <button className={btn(settings.bg === 'white')} onClick={() => update({ bg: 'white' })}>Blanc</button>
            <button className={btn(settings.bg === 'black')} onClick={() => update({ bg: 'black' })}>Noir</button>
          </div>
        </div>

        {/* Sliders */}
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>
            Taille texte : {settings.size}px
            <input type="range" min={13} max={22} value={settings.size} onChange={(e) => update({ size: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--primary)' }} />
          </label>
          <label style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>
            Largeur : {settings.maxWidth}px
            <input type="range" min={220} max={360} value={settings.maxWidth} onChange={(e) => update({ maxWidth: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--primary)' }} />
          </label>
        </div>

        <button className="btn btn-red" onClick={download}>
          <i className="fas fa-download" style={{ marginRight: 6 }} /> Télécharger le PNG
        </button>
      </div>
    </Modal>
  )
}
