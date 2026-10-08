// Rendu canvas du visuel Instagram avant/après (studio « Créer un visuel »).
// Une seule fonction sert à l'aperçu ET à l'export → ce qu'on voit est ce qu'on
// télécharge. Les photos sont recadrées au ratio 3:4 de leur cadre (jamais
// étirées) à partir du zoom/déplacement choisi dans le comparateur.

export type VisualFormat = 'post' | 'story'
export type VisualAmbiance = 'noir' | 'teinte'
export type VisualBackground = 'after' | 'before' | 'none'

export interface Crop { sx: number; sy: number; sw: number; sh: number }

export interface VisualPhoto {
  img: HTMLImageElement
  crop: Crop
  date: string
  weight?: number | null
}

export interface VisualOptions {
  format: VisualFormat
  ambiance: VisualAmbiance
  fontFamily: string
  fontWeight: number
  background: VisualBackground
  showName: boolean
  showLogo: boolean
  showDates: boolean
  showWeight: boolean
  name: string
  logoImg: HTMLImageElement | null
  brandName: string
  layoutImg: HTMLImageElement | null
  before: VisualPhoto
  after: VisualPhoto
}

export const FRAME_RATIO = 4 / 3 // hauteur / largeur des cadres photo (3:4)
const ACCENT = '#B30808'
const ACCENT_LIGHT = '#ff3b3b'

export function visualSize(format: VisualFormat) {
  return format === 'story' ? { w: 1080, h: 1920 } : { w: 1080, h: 1350 }
}

/** Zone visible d'une image affichée en object-fit: cover dans une cellule (cw×ch)
 *  transformée par react-zoom-pan-pinch : translate(posX, posY) scale(scale). */
export function computeCoverCrop(
  iw: number, ih: number, cw: number, ch: number,
  scale: number, posX: number, posY: number,
): Crop {
  const s0 = Math.max(cw / iw, ch / ih)
  const baseX = (cw - iw * s0) / 2
  const baseY = (ch - ih * s0) / 2
  return {
    sx: (-posX / scale - baseX) / s0,
    sy: (-posY / scale - baseY) / s0,
    sw: cw / (s0 * scale),
    sh: ch / (s0 * scale),
  }
}

/** Recadrage centré par défaut au ratio du cadre (si la cellule n'est pas mesurable). */
export function centerCrop(iw: number, ih: number): Crop {
  const target = 1 / FRAME_RATIO // largeur / hauteur
  if (iw / ih > target) {
    const sw = ih * target
    return { sx: (iw - sw) / 2, sy: 0, sw, sh: ih }
  }
  const sh = iw / target
  return { sx: 0, sy: (ih - sh) / 2, sw: iw, sh }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Dessine la zone `crop` de l'image dans (dx,dy,dw,dh), parties hors image en noir.
function drawCrop(ctx: CanvasRenderingContext2D, img: HTMLImageElement, c: Crop, dx: number, dy: number, dw: number, dh: number) {
  ctx.fillStyle = '#000'
  ctx.fillRect(dx, dy, dw, dh)
  const x1 = Math.max(0, c.sx), y1 = Math.max(0, c.sy)
  const x2 = Math.min(img.naturalWidth, c.sx + c.sw), y2 = Math.min(img.naturalHeight, c.sy + c.sh)
  if (x2 <= x1 || y2 <= y1) return
  ctx.drawImage(
    img, x1, y1, x2 - x1, y2 - y1,
    dx + ((x1 - c.sx) / c.sw) * dw, dy + ((y1 - c.sy) / c.sh) * dh,
    ((x2 - x1) / c.sw) * dw, ((y2 - y1) / c.sh) * dh,
  )
}

// Flou portable (ctx.filter n'existe pas partout) : réduction puis agrandissement lissé.
function drawBlurredCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const small = document.createElement('canvas')
  small.width = Math.max(1, Math.round(w / 24))
  small.height = Math.max(1, Math.round(h / 24))
  const sctx = small.getContext('2d')!
  const s = Math.max(small.width / img.naturalWidth, small.height / img.naturalHeight)
  const iw = img.naturalWidth * s, ih = img.naturalHeight * s
  sctx.drawImage(img, (small.width - iw) / 2, (small.height - ih) / 2, iw, ih)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, w, h)
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}

function formatWeight(w: number) {
  return `${String(Math.round(w * 10) / 10).replace('.', ',')} kg`
}

function fitFontSize(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, maxW: number) {
  let px = start
  ctx.font = font(px)
  while (px > 40 && ctx.measureText(text).width > maxW) {
    px -= 6
    ctx.font = font(px)
  }
  return px
}

export function renderVisual(canvas: HTMLCanvasElement, o: VisualOptions) {
  const { w: W, h: H } = visualSize(o.format)
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const font = (px: number, weight = o.fontWeight) => `${weight} ${px}px ${o.fontFamily}`

  // ── Fond
  const bgPhoto = o.background === 'after' ? o.after.img : o.background === 'before' ? o.before.img : null
  if (bgPhoto) {
    drawBlurredCover(ctx, bgPhoto, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.62)'
    ctx.fillRect(0, 0, W, H)
  } else {
    ctx.fillStyle = '#0b0b0c'
    ctx.fillRect(0, 0, W, H)
  }
  if (o.ambiance === 'teinte') {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(179,8,8,0.55)')
    g.addColorStop(0.55, 'rgba(179,8,8,0.12)')
    g.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  } else {
    const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.45, H * 0.8)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, W, H)
  }

  // ── Mise en page verticale (composition centrée)
  const pad = 64, gap = 28
  const frameW = (W - pad * 2 - gap) / 2
  const frameH = frameW * FRAME_RATIO
  const name = o.name.trim().toUpperCase()
  let namePx = 0
  if (o.showName && name) namePx = fitFontSize(ctx, name, (px) => font(px), o.format === 'story' ? 190 : 160, W - pad * 2)
  // Hauteur RÉELLE du texte (les polices condensées type Anton dépassent 1em).
  let nameH = 0
  if (namePx) {
    ctx.font = font(namePx)
    ctx.textBaseline = 'alphabetic'
    const m = ctx.measureText(name)
    nameH = (m.actualBoundingBoxAscent || namePx * 0.8) + (m.actualBoundingBoxDescent || 0)
  }
  const nameBlock = namePx ? nameH + 48 : 0
  const datesBlock = o.showDates ? 78 : 0
  const logoBlock = o.showLogo ? 140 : 0
  const total = nameBlock + frameH + datesBlock + logoBlock
  let y = Math.max(pad, (H - total) / 2)

  if (namePx) {
    ctx.font = font(namePx)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const m = ctx.measureText(name)
    const baseline = y + (m.actualBoundingBoxAscent || namePx * 0.8)
    if (o.ambiance === 'noir') {
      const g = ctx.createLinearGradient(0, y, 0, y + nameH)
      g.addColorStop(0, ACCENT_LIGHT)
      g.addColorStop(1, ACCENT)
      ctx.fillStyle = g
    } else {
      ctx.fillStyle = '#ffffff'
    }
    // Ombre nette (pas de shadowBlur : il donnait un halo flou autour du texte).
    const fill = ctx.fillStyle
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillText(name, W / 2 + 4, baseline + 5)
    ctx.fillStyle = fill
    ctx.fillText(name, W / 2, baseline)
    y += nameBlock
  }

  // ── Cadres photo
  const frames: [VisualPhoto, string, boolean][] = [[o.before, 'AVANT', false], [o.after, 'APRÈS', true]]
  frames.forEach(([p, tag, isAfter], i) => {
    const x = pad + i * (frameW + gap)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 12
    roundRect(ctx, x, y, frameW, frameH, 20)
    ctx.fillStyle = '#000'
    ctx.fill()
    ctx.restore()

    ctx.save()
    roundRect(ctx, x, y, frameW, frameH, 20)
    ctx.clip()
    drawCrop(ctx, p.img, p.crop, x, y, frameW, frameH)

    // Pastille AVANT / APRÈS
    ctx.font = font(26, 800)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const tw = ctx.measureText(tag).width + 32
    roundRect(ctx, x + 18, y + 18, tw, 46, 23)
    ctx.fillStyle = isAfter ? ACCENT : 'rgba(0,0,0,0.6)'
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(tag, x + 34, y + 42)

    // Poids sur la photo
    if (o.showWeight && p.weight != null) {
      const wt = formatWeight(p.weight)
      ctx.font = font(30, 800)
      const ww = ctx.measureText(wt).width + 36
      roundRect(ctx, x + frameW - ww - 18, y + frameH - 66, ww, 48, 24)
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(wt, x + frameW - ww, y + frameH - 42)
    }
    ctx.restore()

    // Bordure
    roundRect(ctx, x, y, frameW, frameH, 20)
    ctx.lineWidth = isAfter ? 5 : 3
    ctx.strokeStyle = isAfter ? ACCENT_LIGHT : 'rgba(255,255,255,0.55)'
    ctx.stroke()

    // Date sous la photo
    if (o.showDates) {
      ctx.font = font(32, 800)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#fff'
      ctx.fillText(formatDate(p.date), x + frameW / 2, y + frameH + 26)
    }
  })
  y += frameH + datesBlock

  // ── Logo / marque du coach
  if (o.showLogo) {
    const r = 44
    const label = o.brandName.trim()
    ctx.font = font(34, 800)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const tw = label ? ctx.measureText(label).width : 0
    const groupW = (o.logoImg ? r * 2 : 0) + (o.logoImg && label ? 22 : 0) + tw
    let gx = (W - groupW) / 2
    const cy = y + 48 + r
    if (o.logoImg) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(gx + r, cy, r, 0, Math.PI * 2)
      ctx.clip()
      const s = Math.max((r * 2) / o.logoImg.naturalWidth, (r * 2) / o.logoImg.naturalHeight)
      const lw = o.logoImg.naturalWidth * s, lh = o.logoImg.naturalHeight * s
      ctx.drawImage(o.logoImg, gx + r - lw / 2, cy - lh / 2, lw, lh)
      ctx.restore()
      gx += r * 2 + 22
    }
    if (label) {
      ctx.fillStyle = '#fff'
      ctx.fillText(label, gx, cy)
    }
  }

  // ── Calque perso (profil → Layout Instagram), conçu en 1080×1350
  if (o.layoutImg && o.format === 'post') ctx.drawImage(o.layoutImg, 0, 0, W, H)
}
