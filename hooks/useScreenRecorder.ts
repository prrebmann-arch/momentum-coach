'use client'

import { useCallback, useRef, useState } from 'react'

export interface ScreenRecorderState {
  isRecording: boolean
  seconds: number
  errorMessage: string | null
}

export interface StartRecordingOptions {
  withWebcam: boolean
}

export interface RecorderResult {
  blob: Blob
  durationS: number
  width: number
  height: number
  mimeType: string
  ext: 'mp4' | 'webm'
}

const PREFERRED_MIMES: Array<{ mimeType: string; ext: 'mp4' | 'webm' }> = [
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
]

const VIDEO_BITS_PER_SECOND = 1_200_000  // 1.2 Mbps — see spec §3.1
const HARD_CAP_SECONDS = 15 * 60

function pickMimeType() {
  for (const c of PREFERRED_MIMES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c
    }
  }
  return null
}

export function useScreenRecorder() {
  const [state, setState] = useState<ScreenRecorderState>({ isRecording: false, seconds: 0, errorMessage: null })

  const recorderRef = useRef<MediaRecorder | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const camStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const compositorStopRef = useRef<(() => void) | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const secondsRef = useRef<number>(0)
  const dimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
  const mimeRef = useRef<{ mimeType: string; ext: 'mp4' | 'webm' } | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (compositorStopRef.current) { compositorStopRef.current(); compositorStopRef.current = null }
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    camStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null
    camStreamRef.current = null
    micStreamRef.current = null
    recorderRef.current = null
  }, [])

  const startRecording = useCallback(async (opts: StartRecordingOptions) => {
    setState({ isRecording: false, seconds: 0, errorMessage: null })
    secondsRef.current = 0

    const mime = pickMimeType()
    if (!mime) {
      setState({ isRecording: false, seconds: 0, errorMessage: "Ton navigateur ne supporte pas l'enregistrement vidéo. Utilise Chrome ou Safari récent." })
      throw new Error('No supported MIME type')
    }
    mimeRef.current = mime

    let screenStream: MediaStream
    let micStream: MediaStream
    let camStream: MediaStream | null = null

    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
    } catch (err) {
      setState({ isRecording: false, seconds: 0, errorMessage: "Tu as refusé le partage d'écran." })
      throw err
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      screenStream.getTracks().forEach(t => t.stop())
      setState({ isRecording: false, seconds: 0, errorMessage: 'Accès au micro refusé.' })
      throw err
    }

    if (opts.withWebcam) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320 } })
      } catch (err) {
        screenStream.getTracks().forEach(t => t.stop())
        micStream.getTracks().forEach(t => t.stop())
        setState({ isRecording: false, seconds: 0, errorMessage: 'Accès à la webcam refusé.' })
        throw err
      }
    }

    screenStreamRef.current = screenStream
    micStreamRef.current = micStream
    camStreamRef.current = camStream

    // Build the output stream
    let outputVideoStream: MediaStream
    if (camStream) {
      try {
        const composited = await import('./../components/recorder/CanvasCompositor').then(m => m.startCompositing(screenStream, camStream!))
        compositorStopRef.current = composited.stop
        outputVideoStream = composited.stream
        dimensionsRef.current = { width: composited.canvas.width, height: composited.canvas.height }
      } catch (err) {
        screenStream.getTracks().forEach(t => t.stop())
        micStream.getTracks().forEach(t => t.stop())
        camStream.getTracks().forEach(t => t.stop())
        setState({ isRecording: false, seconds: 0, errorMessage: 'Erreur composition webcam' })
        throw err
      }
    } else {
      outputVideoStream = screenStream
      const settings = screenStream.getVideoTracks()[0]?.getSettings()
      dimensionsRef.current = { width: settings?.width ?? 1920, height: settings?.height ?? 1080 }
    }

    // Combine output video + mic audio into a single stream for MediaRecorder
    const combined = new MediaStream([
      ...outputVideoStream.getVideoTracks(),
      ...micStream.getAudioTracks(),
    ])

    chunksRef.current = []

    const recorder = new MediaRecorder(combined, {
      mimeType: mime.mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    })
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    // Auto-stop at hard cap; sync duration via secondsRef
    timerRef.current = setInterval(() => {
      secondsRef.current = secondsRef.current + 1
      const secs = secondsRef.current
      setState(s => ({ ...s, seconds: secs }))
      if (secs >= HARD_CAP_SECONDS && recorder.state === 'recording') {
        recorder.stop()
      }
    }, 1000)

    // If user stops sharing screen via browser UI, treat as stop
    screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (recorder.state === 'recording') recorder.stop()
    })

    recorder.start(1000) // chunk every 1s
    setState({ isRecording: true, seconds: 0, errorMessage: null })
  }, [])

  const stopRecording = useCallback((): Promise<RecorderResult> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current
      if (!recorder) { reject(new Error('No active recording')); return }

      const finalize = () => {
        const mime = mimeRef.current!
        const blob = new Blob(chunksRef.current, { type: mime.mimeType.split(';')[0] })
        const result: RecorderResult = {
          blob,
          durationS: secondsRef.current,
          width: dimensionsRef.current.width,
          height: dimensionsRef.current.height,
          mimeType: mime.mimeType.split(';')[0],
          ext: mime.ext,
        }
        cleanup()
        setState({ isRecording: false, seconds: 0, errorMessage: null })
        resolve(result)
      }

      // Always wait for the stop event to ensure final chunk is flushed
      recorder.addEventListener('stop', finalize, { once: true })
      if (recorder.state !== 'inactive') {
        recorder.stop()
      }
    })
  }, [cleanup])

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') recorder.stop()
    chunksRef.current = []
    cleanup()
    setState({ isRecording: false, seconds: 0, errorMessage: null })
  }, [cleanup])

  return {
    isRecording: state.isRecording,
    seconds: state.seconds,
    errorMessage: state.errorMessage,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
