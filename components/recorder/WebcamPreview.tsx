'use client'

import { useEffect, useRef } from 'react'
import { useRecorder } from '@/contexts/RecorderContext'
import styles from './RecordingPill.module.css'

export default function WebcamPreview() {
  const { isRecording, camStream } = useRecorder()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (camStream && v.srcObject !== camStream) {
      v.srcObject = camStream
      v.play().catch(() => {})
    }
    if (!camStream && v.srcObject) {
      v.srcObject = null
    }
  }, [camStream])

  if (!isRecording || !camStream) return null

  return (
    <div className={styles.camPreview} aria-label="Aperçu webcam">
      <video ref={videoRef} muted playsInline autoPlay />
    </div>
  )
}
