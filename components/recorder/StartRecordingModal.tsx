'use client'

import { useState } from 'react'
import { useRecorder } from '@/contexts/RecorderContext'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'

interface Props {
  isOpen: boolean
  onClose: () => void
  athleteId: string
}

export default function StartRecordingModal({ isOpen, onClose, athleteId }: Props) {
  const { startRecording } = useRecorder()
  const { toast } = useToast()
  const [withWebcam, setWithWebcam] = useState(false)
  const [starting, setStarting] = useState(false)

  async function handleStart() {
    setStarting(true)
    try {
      await startRecording({ withWebcam, athleteId })
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur démarrage enregistrement'
      toast(msg, 'error')
    } finally {
      setStarting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer un retour vidéo">
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
          Tu vas choisir l'écran à partager (écran entier, fenêtre ou onglet) au prochain dialogue du navigateur.
          Le micro sera activé automatiquement.
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={withWebcam}
            onChange={(e) => setWithWebcam(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          Inclure ma webcam (bulle en bas à gauche)
        </label>

        <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
          Durée maximum : 15 minutes. Tu peux naviguer librement dans COACH pendant l'enregistrement.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-outline" onClick={onClose} disabled={starting}>Annuler</button>
          <button className="btn btn-red" onClick={handleStart} disabled={starting}>
            {starting ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-circle" /> Démarrer</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}
