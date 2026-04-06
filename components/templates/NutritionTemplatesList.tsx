'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

interface NutritionTemplate {
  id: string
  nom: string
  category?: string | null
  template_type?: string
  calories_objectif?: number
  proteines?: number
  glucides?: number
  lipides?: number
  meals_data?: unknown
  created_at?: string
}

interface Props {
  templates: NutritionTemplate[]
  onRefresh: () => void
  /** Edit via MealEditor — delegates to parent */
  onEdit?: (id: string) => void
  /** Create via MealEditor — delegates to parent */
  onCreate?: () => void
  /** Delete — delegates to parent */
  onDelete?: (id: string) => void
}

function mealCount(t: NutritionTemplate): number {
  try {
    const md = typeof t.meals_data === 'string' ? JSON.parse(t.meals_data) : (t.meals_data || [])
    if (Array.isArray(md)) return md.length
  } catch { /* ignore */ }
  return 0
}

export default function NutritionTemplatesList({ templates, onRefresh, onEdit, onCreate, onDelete }: Props) {
  const supabase = createClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q ? templates.filter((t) => t.nom?.toLowerCase().includes(q)) : templates
  }, [templates, search])

  const groups = useMemo(() => {
    const g: Record<string, NutritionTemplate[]> = {}
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

  const handleDelete = async (id: string) => {
    if (onDelete) {
      onDelete(id)
      return
    }
    if (!confirm('Supprimer ce template ?')) return
    const { error } = await supabase.from('nutrition_templates').delete().eq('id', id)
    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    toast('Template supprime')
    onRefresh()
  }

  return (
    <div>
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
        <Button variant="red" onClick={onCreate}>
          <i className="fas fa-plus" /> Nouveau template
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="fas fa-utensils"
          message={search ? 'Aucun resultat' : 'Aucun template nutrition'}
          action={!search && onCreate ? <Button variant="red" onClick={onCreate}><i className="fas fa-plus" /> Creer un template</Button> : undefined}
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
                    const mc = mealCount(t)
                    const subtitle = `${t.calories_objectif || 0} kcal · P:${t.proteines || 0}g G:${t.glucides || 0}g L:${t.lipides || 0}g${mc ? ` · ${mc} repas` : ''}`
                    return (
                      <div key={t.id} className="card" style={{ margin: 0, cursor: onEdit ? 'pointer' : undefined }} onClick={() => onEdit?.(t.id)}>
                        <div className="card-header">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="card-title" style={{ fontSize: 14 }}>{t.nom}</div>
                            <div style={{ color: 'var(--text2)', fontSize: 11, marginTop: 3 }}>{subtitle}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                            <Button variant="outline" size="sm" onClick={() => onEdit?.(t.id)}>
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
