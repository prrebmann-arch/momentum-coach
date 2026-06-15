'use client'

import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import type { OnboardingTemplate } from '@/lib/onboarding'
import styles from '@/styles/onboarding.module.css'

interface Props {
  templates: OnboardingTemplate[]
  loading: boolean
  onRefresh: () => void
  onEdit: (id: string) => void
  onCreate: () => void
}

export default function OnboardingTemplatesList({
  templates,
  loading,
  onRefresh,
  onEdit,
  onCreate,
}: Props) {
  const { toast } = useToast()
  const supabase = createClient()
  // Note: auto-seeding the default "Premium" template now lives exclusively in the templates page
  // (via ensurePremiumTemplate) and in the athlete onboarding page. Centralizing it here would
  // race with the athlete page and double-insert.
  const seeding = false

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return
    const { error } = await supabase.from('onboarding_templates').delete().eq('id', id)
    if (error) {
      console.error('[onboarding templates] delete', error)
      toast(`Erreur: ${error.message}`, 'error')
      return
    }
    onRefresh()
  }

  if (loading || seeding) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton height={60} borderRadius={10} />
        <Skeleton height={60} borderRadius={10} />
        <Skeleton height={60} borderRadius={10} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {templates.length} template{templates.length > 1 ? 's' : ''}
        </div>
        <button className="btn btn-red" onClick={onCreate}>
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
          Nouveau template
        </button>
      </div>

      {templates.length === 0 ? (
        <EmptyState icon="fa-solid fa-flag-checkered" message="Aucun template" />
      ) : (
        templates.map((t) => (
          <div key={t.id} className={styles.tplCard}>
            <div>
              <div className={styles.tplName}>
                {t.name}
                {t.is_default && (
                  <span
                    style={{
                      fontSize: 10,
                      background: 'rgba(239,68,68,0.12)',
                      color: '#ef4444',
                      padding: '2px 6px',
                      borderRadius: 6,
                      marginLeft: 8,
                      verticalAlign: 'middle',
                      fontWeight: 600,
                    }}
                  >
                    PAR DÉFAUT
                  </span>
                )}
              </div>
              <div className={styles.tplMeta}>
                {t.steps?.length || 0} points
                {t.description ? ` · ${t.description}` : ''}
              </div>
            </div>
            <div className={styles.tplActions}>
              <button className="btn btn-outline" onClick={() => onEdit(t.id)}>
                <i className="fa-solid fa-pen-to-square" />
              </button>
              <button className="btn btn-outline" onClick={() => handleDelete(t.id)}>
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
