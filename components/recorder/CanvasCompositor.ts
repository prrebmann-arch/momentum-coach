export interface CompositingResult {
  canvas: HTMLCanvasElement
  stream: MediaStream
  animFrameId: number
}

const BUBBLE_RADIUS = 90       // 180×180 webcam bubble
const BUBBLE_INSET = 16
const BUBBLE_BORDER = 4
const FPS = 30

export async function startCompositing(
  screenStream: MediaStream,
  camStream: MediaStream
): Promise<CompositingResult> {
  const screenVideo = document.createElement('video')
  screenVideo.srcObject = screenStream
  screenVideo.muted = true
  screenVideo.playsInline = true
  await screenVideo.play()

  const camVideo = document.createElement('video')
  camVideo.srcObject = camStream
  camVideo.muted = true
  camVideo.playsInline = true
  await camVideo.play()

  const canvas = document.createElement('canvas')
  // Wait for screen video metadata before sizing canvas
  if (screenVideo.videoWidth === 0) {
    await new Promise<void>(r => {
      screenVideo.onloadedmetadata = () => r()
    })
  }
  canvas.width = screenVideo.videoWidth
  canvas.height = screenVideo.videoHeight

  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 2d context unavailable')

  let animFrameId = 0
  const draw = () => {
    if (screenVideo.readyState >= 2) {
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)

      if (camVideo.readyState >= 2) {
        const cx = BUBBLE_INSET + BUBBLE_RADIUS
        const cy = canvas.height - BUBBLE_INSET - BUBBLE_RADIUS

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, BUBBLE_RADIUS, 0, Math.PI * 2)
        ctx.clip()

        // Draw cam centered & cropped to fill the bubble (cover behavior)
        const camAR = camVideo.videoWidth / camVideo.videoHeight
        let drawW = BUBBLE_RADIUS * 2
        let drawH = BUBBLE_RADIUS * 2
        if (camAR > 1) drawW = drawH * camAR
        else drawH = drawW / camAR
        ctx.drawImage(camVideo, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
        ctx.restore()

        ctx.beginPath()
        ctx.arc(cx, cy, BUBBLE_RADIUS, 0, Math.PI * 2)
        ctx.lineWidth = BUBBLE_BORDER
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
      }
    }
    animFrameId = requestAnimationFrame(draw)
  }
  draw()

  const stream = canvas.captureStream(FPS)

  return { canvas, stream, animFrameId }
}
