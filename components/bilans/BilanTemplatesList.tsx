'use client'

import styles from '@/styles/bilan-templates.module.css'

export interface BilanTemplate {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  quotidien_count?: number
  complet_count?: number
  athlete_count?: number
}

interface Props {
  templates: BilanTemplate[]
  onEdit: (id: string) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export default function BilanTemplatesList({ templates, onEdit, onCreate, onDuplicate, onDelete }: Props) {
  return (
    <div>
      <div className={styles.listHeader}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </div>
        <button className="btn btn-red" onClick={onCreate}>
          <i className="fa-solid fa-plus" />
          Nouveau template bilan
        </button>
      </div>

      {templates.length === 0 ? (
        <div className={styles.emptyState}>
          <i className="fa-solid fa-clipboard-list" style={{ fontSize: 32, color: 'var(--text3)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Aucun template bilan</p>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Créez votre premier template pour personnaliser les check-ins athlètes</p>
          <button className="btn btn-red" style={{ marginTop: 12 }} onClick={onCreate}>
            <i className="fa-solid fa-plus" />
            Créer un template
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {templates.map((t) => (
            <div key={t.id} className={styles.templateCard}>
              <div className={styles.templateCardHeader}>
                <div className={styles.templateIcon}>
                  <i className="fa-solid fa-clipboard-list" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.templateName}>{t.name}</div>
                  {t.description && (
                    <div className={styles.templateDesc}>{t.description}</div>
                  )}
                </div>
              </div>

              <div className={styles.templateMeta}>
                <span className={styles.metaBadge}>
                  <i className="fa-solid fa-sun" />
                  {t.quotidien_count ?? 0} quotidien
                </span>
                <span className={styles.metaBadge}>
                  <i className="fa-solid fa-calendar-week" />
                  {t.complet_count ?? 0} complet
                </span>
                {(t.athlete_count ?? 0) > 0 && (
                  <span className={styles.metaBadgeAthletes}>
                    <i className="fa-solid fa-users" />
                    {t.athlete_count} athlète{(t.athlete_count ?? 0) > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className={styles.templateActions}>
                <button className="btn btn-outline btn-sm" onClick={() => onEdit(t.id)}>
                  <i className="fa-solid fa-pen" />
                  Modifier
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => onDuplicate(t.id)}>
                  <i className="fa-solid fa-copy" />
                  Dupliquer
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ color: 'var(--danger)', marginLeft: 'auto' }}
                  onClick={() => onDelete(t.id)}
                >
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
