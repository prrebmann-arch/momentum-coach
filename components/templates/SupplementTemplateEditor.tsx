'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Button from '@/components/ui/Button'
import type { SupplementTemplate, SupplementTemplateItem } from './SupplementTemplatesList'

const FREQ_OPTIONS = [
  '1x/jour', '2x/jour', '3x/jour',
  'tous les 2 jours', 'tous les 3 jours',
  '2x/semaine', '3x/semaine', '1x/semaine', 'au besoin',
]

const UNITE_OPTIONS = ['mg', 'g', 'ml', 'caps', 'gelules', 'cuillere', 'UI']

const MOMENT_PRESETS = [
  '', 'a_jeun', 'pre_training', 'intra_training', 'post_training', 'coucher',
  'R1_avant', 'R1_pendant', 'R1_apres',
  'R2_avant', 'R2_pendant', 'R2_apres',
  'R3_avant', 'R3_pendant', 'R3_apres',
  'R4_avant', 'R4_pendant', 'R4_apres',
  'R5_avant', 'R5_pendant', 'R5_apres',
]

const FREQ_INTERVAL: Record<string, number> = {
  '1x/jour': 1, '2x/jour': 1, '3x/jour': 1,
  'tous les 2 jours': 2, 'tous les 3 jours': 3,
  '2x/semaine': 3.5, '3x/semaine': 2.333, '1x/semaine': 7, 'au besoin': 0,
}

function emptyItem(): SupplementTemplateItem {
  return {
    nom: '', marque: '', lien_achat: '',
    dosage: '', unite: 'mg', frequence: '1x/jour',
    intervalle_jours: 1, moment_prise: '',
    concentration_mg_ml: null, notes: '',
  }
}

interface Props {
  template: SupplementTemplate | null
  type: 'complement' | 'supplementation'
  existingCategories: string[]
  onSaved: () => void
  onCancel: () => void
}

export default function SupplementTemplateEditor({ template, type, existingCategories, onSaved, onCancel }: Props) {
  const supabase = createClient()
  const { user } = useAuth()
  const { toast } = useToast()

  const [nom, setNom] = useState(template?.nom || '')
  const [description, setDescription] = useState(template?.description || '')
  const [category, setCategory] = useState(template?.category || '')
  const [items, setItems] = useState<SupplementTemplateItem[]>(
    template && Array.isArray(template.items) && template.items.length > 0
      ? template.items
      : [emptyItem()]
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (template) {
      setNom(template.nom || '')
      setDescription(template.description || '')
      setCategory(template.category || '')
      setItems(Array.isArray(template.items) && template.items.length > 0 ? template.items : [emptyItem()])
    }
  }, [template])

  function updateItem(i: number, patch: Partial<SupplementTemplateItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(i: number) {
    setItems((prev) => prev.length === 1 ? [emptyItem()] : prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (!user?.id) return
    if (!nom.trim()) { toast('Nom du template obligatoire', 'error'); return }
    const cleanItems = items
      .filter((it) => it.nom.trim() && it.dosage.trim())
      .map((it) => ({
        nom: it.nom.trim(),
        marque: it.marque?.trim() || null,
        lien_achat: it.lien_achat?.trim() || null,
        dosage: it.dosage.trim(),
        unite: it.unite || 'mg',
        frequence: it.frequence || '1x/jour',
        intervalle_jours: it.intervalle_jours ?? FREQ_INTERVAL[it.frequence || '1x/jour'] ?? 1,
        moment_prise: it.moment_prise?.trim() || null,
        concentration_mg_ml: it.concentration_mg_ml ?? null,
        notes: it.notes?.trim() || null,
      }))

    if (cleanItems.length === 0) { toast('Au moins un complément avec nom + dosage', 'error'); return }

    setSaving(true)
    try {
      if (template?.id) {
        const { error } = await supabase
          .from('supplement_templates')
          .update({
            nom: nom.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            type,
            items: cleanItems,
            updated_at: new Date().toISOString(),
          })
          .eq('id', template.id)
        if (error) { toast('Erreur: ' + error.message, 'error'); return }
        toast('Template mis à jour', 'success')
      } else {
        const { error } = await supabase.from('supplement_templates').insert({
          coach_id: user.id,
          nom: nom.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          type,
          items: cleanItems,
        })
        if (error) { toast('Erreur: ' + error.message, 'error'); return }
        toast('Template créé', 'success')
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>
          {template ? 'Modifier' : 'Nouveau'} template {type === 'complement' ? 'complément' : 'supplémentation'}
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button variant="red" onClick={save} disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      {/* Header fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Nom du template *</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex: Pack performance"
            style={{ width: '100%', padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Catégorie</label>
          <input
            type="text"
            list="supplement-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ex: Sèche, Masse…"
            style={{ width: '100%', padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
          />
          <datalist id="supplement-categories">
            {existingCategories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Description (interne)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes pour toi…"
            style={{ width: '100%', padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>
      </div>

      {/* Items */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, color: 'var(--text)', fontSize: 14 }}>Compléments ({items.length})</h4>
        <Button variant="outline" size="sm" onClick={addItem}>
          <i className="fas fa-plus" /> Ajouter
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>#{i + 1}</span>
              <Button variant="outline" size="sm" className="btn-danger" onClick={() => removeItem(i)}>
                <i className="fas fa-trash" />
              </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={it.nom}
                onChange={(e) => updateItem(i, { nom: e.target.value })}
                placeholder="Nom *"
                style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
              />
              <input
                type="text"
                value={it.marque || ''}
                onChange={(e) => updateItem(i, { marque: e.target.value })}
                placeholder="Marque"
                style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={it.dosage}
                onChange={(e) => updateItem(i, { dosage: e.target.value })}
                placeholder="Dosage *"
                style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
              />
              <select
                value={it.unite || 'mg'}
                onChange={(e) => updateItem(i, { unite: e.target.value })}
                style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
              >
                {UNITE_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <select
                value={it.frequence || '1x/jour'}
                onChange={(e) => {
                  const f = e.target.value
                  updateItem(i, { frequence: f, intervalle_jours: FREQ_INTERVAL[f] ?? 1 })
                }}
                style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
              >
                {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select
                value={it.moment_prise || ''}
                onChange={(e) => updateItem(i, { moment_prise: e.target.value })}
                style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
              >
                {MOMENT_PRESETS.map((m) => <option key={m} value={m}>{m || '— moment —'}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
              <input
                type="text"
                value={it.lien_achat || ''}
                onChange={(e) => updateItem(i, { lien_achat: e.target.value })}
                placeholder="Lien d'achat"
                style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
              />
              <input
                type="text"
                value={it.notes || ''}
                onChange={(e) => updateItem(i, { notes: e.target.value })}
                placeholder="Notes"
                style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
