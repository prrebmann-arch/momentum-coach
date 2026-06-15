'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import FormGroup from '@/components/ui/FormGroup'
import { todayIso, type OnboardingTemplate } from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'

interface ApplyTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  templates: OnboardingTemplate[]
  /** When true, warns that existing steps will be replaced/appended. */
  hasExistingSteps?: boolean
  onApply: (templateId: string, startDate: string, mode: 'replace' | 'append') => void
}

export default function ApplyTemplateModal({
  isOpen,
  onClose,
  templates,
  hasExistingSteps = false,
  onApply,
}: ApplyTemplateModalProps) {
  const [templateId, setTemplateId] = useState('')
  const [startDate, setStartDate] = useState(todayIso())
  const [mode, setMode] = useState<'replace' | 'append'>('replace')

  useEffect(() => {
    if (!isOpen) return
    setStartDate(todayIso())
    setMode('replace')
    // Pre-select the default template if available
    const def = templates.find((t) => t.is_default)
    setTemplateId(def?.id ?? templates[0]?.id ?? '')
  }, [isOpen, templates])

  const handleApply = () => {
    if (!templateId) return
    onApply(templateId, startDate, mode)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Appliquer un template" size="md">
      <div className={styles.modalForm}>
        {templates.length === 0 ? (
          <div className={styles.emptyHint}>
            Aucun template disponible. Crée-en un dans /templates → Onboarding.
          </div>
        ) : (
          <>
            <FormGroup label="Template" htmlFor="apply-template">
              <select
                id="apply-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_default ? '(par défaut)' : ''} — {t.steps.length} points
                  </option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Date de démarrage (J0)" htmlFor="apply-start">
              <input
                id="apply-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormGroup>

            {hasExistingSteps && (
              <FormGroup label="Mode d'application" htmlFor="apply-mode">
                <select
                  id="apply-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'replace' | 'append')}
                >
                  <option value="replace">Remplacer les points existants</option>
                  <option value="append">Ajouter aux points existants</option>
                </select>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {mode === 'replace'
                    ? 'Tous les points actuels (sauf ceux marqués faits) seront supprimés.'
                    : 'Les nouveaux points seront ajoutés en plus des existants.'}
                </span>
              </FormGroup>
            )}
          </>
        )}
      </div>

      <div className={styles.modalActions}>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-red"
          onClick={handleApply}
          disabled={!templateId}
        >
          Appliquer
        </button>
      </div>
    </Modal>
  )
}
