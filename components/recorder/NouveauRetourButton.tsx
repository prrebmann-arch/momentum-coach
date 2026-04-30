'use client'

import { useState } from 'react'
import { useRecorder } from '@/contexts/RecorderContext'
import Modal from '@/components/ui/Modal'
import NouveauRetourPanel from './NouveauRetourPanel'

interface Props {
  athleteId: string
  onCreated?: () => void
  buttonClassName?: string
  label?: string
  /** Controlled open state — when provided, the trigger button is hidden and
   *  the modal opens/closes based on this prop. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Thin trigger-button wrapper around `NouveauRetourPanel` that opens it
 * inside a Modal. The panel is the single source of truth for the retour
 * creation form (texte/vocal + écran/Loom + selfie portrait); this component
 * just handles the open/close flow.
 */
export default function NouveauRetourButton({
  athleteId,
  onCreated,
  buttonClassName,
  label,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const { isRecording, isProcessing, isUploading } = useRecorder()

  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v)
    onOpenChange?.(v)
  }

  const recordingBusy = isRecording || isProcessing || isUploading

  return (
    <>
      {!isControlled && (
        <button
          className={buttonClassName ?? 'btn btn-red'}
          onClick={() => setOpen(true)}
          disabled={recordingBusy}
          title={recordingBusy ? 'Un enregistrement est déjà en cours' : undefined}
        >
          <i className="fas fa-video" /> {label ?? 'Nouveau retour'}
        </button>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Nouveau retour">
        <div style={{ padding: 0, minHeight: 480 }}>
          <NouveauRetourPanel
            athleteId={athleteId}
            active={open}
            onCreated={onCreated}
            onAfter={() => setOpen(false)}
          />
        </div>
      </Modal>
    </>
  )
}
