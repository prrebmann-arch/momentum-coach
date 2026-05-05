'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

export interface SupplementTemplateItem {
  nom: string
  marque?: string | null
  lien_achat?: string | null
  dosage: string
  unite?: string | null
  frequence?: string | null
  intervalle_jours?: number | null
  moment_prise?: string | null
  concentration_mg_ml?: number | null
  notes?: string | null
}

export interface SupplementTemplate {
  id: string
  nom: string
  description?: string | null
  category?: string | null
  type: 'complement' | 'supplementation'
  items: SupplementTemplateItem[]
  created_at?: string
}

type SubTab = 'complement' | 'supplementation'

interface Props {
  templates: SupplementTemplate[]
  onRefresh: () => void
  onEdit: (id: string) => void
  onCreate: (type: SubTab) => void
}

const TYPE_LABELS: Record<SubTab, string> = {
  complement: 'Complement',
  supplementation: 'Supplementation',
}

const TYPE_ICONS: Record<SubTab, string> = {
  complement: 'fas fa-pills',
  supplementation: 'fas fa-flask',
}

export default function SupplementTemplatesList({ templates, onRefresh, onEdit, onCreate }: Props) {
  const supabase = createClient()
  const { toast } = useToast()

  const [subTab, setSubTab] = useState<SubTab>('complement')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    const byType = templates.filter((t) => t.type === subTab)
    const q = search.toLowerCase()
    return q ? byType.filter((t) => t.nom?.toLowerCase().includes(q)) : byType
  }, [templates, subTab, search])

  const groups = useMemo(() => {
    const g: Record<string, SupplementTemplate[]> = {}
    filtered.forEach((t) => {
      const cat = t.category || 'Sans categorie'
      if (!g[cat]) g[cat] = []
      g[cat].push(t)
    })
    return g
  }, [filtered])

  const catNames = useMemo(() => {
    return Object.keys(groups).sort((a, b) => {
      if (a === 'Sans categorie') return 1
      if (b === 'Sans categorie') return -1
      return a.localeCompare(b)
    })
  }, [groups])

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce template ?')) return
    const { error } = await supabase.from('supplement_templates').delete().eq('id', id)
    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    toast('Template supprime')
    onRefresh()
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div className="athlete-tabs" style={{ marginBottom: 16 }}>
        <button className={`athlete-tab-btn${subTab === 'complement' ? ' active' : ''}`} onClick={() => setSubTab('complement')}>
          <i className="fas fa-pills" /> Complements
        </button>
        <button className={`athlete-tab-btn${subTab === 'supplementation' ? ' active' : ''}`} onClick={() => setSubTab('supplementation')}>
          <i className="fas fa-flask" /> Supplementation
        </button>
      </div>

      {/* Search + create */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            style={{ width: '100%', padding: '8px 12px 8px 34px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>
        <Button variant="red" onClick={() => onCreate(subTab)}>
          <i className="fas fa-plus" /> Nouveau template
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={TYPE_ICONS[subTab]}
          message={search ? 'Aucun resultat' : `Aucun template ${TYPE_LABELS[subTab].toLowerCase()}`}
          action={!search ? <Button variant="red" onClick={() => onCreate(subTab)}><i className="fas fa-plus" /> Creer un template</Button> : undefined}
        />
      ) : (
        catNames.map((cat) => {
          const items = groups[cat]
          const isCollapsed = collapsed[cat]
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div
                onClick={() => toggleCategory(cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', userSelect: 'none',
                  marginBottom: isCollapsed ? 0 : 8,
                }}
              >
                <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'down'}`} style={{ fontSize: 10, color: 'var(--text3)', width: 12 }} />
                <i className={`fas fa-folder${isCollapsed ? '' : '-open'}`} style={{ color: 'var(--primary)', fontSize: 13 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{cat}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{items.length}</span>
              </div>
              {!isCollapsed && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 8 }}>
                  {items.map((t) => {
                    const itemCount = Array.isArray(t.items) ? t.items.length : 0
                    return (
                      <div key={t.id} className="card" style={{ margin: 0, cursor: 'pointer' }} onClick={() => onEdit(t.id)}>
                        <div className="card-header">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="card-title" style={{ fontSize: 14 }}>{t.nom}</div>
                            <div style={{ color: 'var(--text2)', fontSize: 11, marginTop: 3 }}>
                              {itemCount} {itemCount > 1 ? 'compléments' : 'complément'}
                              {t.description ? ` · ${t.description}` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                            <Button variant="outline" size="sm" onClick={() => onEdit(t.id)}>
                              <i className="fas fa-pen" />
                            </Button>
                            <Button variant="outline" size="sm" className="btn-danger" onClick={() => handleDelete(t.id)}>
                              <i className="fas fa-trash" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
