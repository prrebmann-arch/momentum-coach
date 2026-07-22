'use client'

// Librairie de compléments : catalogue global du coach (table supplements,
// type 'complement', dédupliqué par nom). Chaque carré est draggable vers le
// board ; le dosage/unité inline sont embarqués dans le drag data.
import { useCallback, useEffect, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { ComplementAssignment } from '@/lib/complement'
import styles from './complement.module.css'

export interface CatalogItem {
  supplementId: string
  nom: string
  marque: string | null
  lien_achat: string | null
}

export interface LibraryDragData {
  kind: 'library'
  supplementId: string
  nom: string
  dosage: string
  unite: string
}

const UNITS = ['mg', 'g', 'ml', 'caps', 'gelules', 'cuillere', 'UI']

function LibraryCard({ item, defaults, onInfo }: {
  item: CatalogItem
  defaults: { dosage: string; unite: string }
  onInfo: (item: CatalogItem) => void
}) {
  const [dosage, setDosage] = useState(defaults.dosage)
  const [unite, setUnite] = useState(defaults.unite)
  const data: LibraryDragData = { kind: 'library', supplementId: item.supplementId, nom: item.nom, dosage, unite }
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `lib-${item.supplementId}`, data })

  return (
    <div ref={setNodeRef} className={styles.card} onDoubleClick={() => onInfo(item)} {...listeners} {...attributes}>
      <div className={styles.cardName}>{item.nom}</div>
      <div className={styles.cardDosageRow}>
        <input
          className={styles.cardDosageInput}
          value={dosage}
          placeholder="Dose"
          onChange={(e) => setDosage(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <select
          className={styles.cardUnitSelect}
          value={unite}
          onChange={(e) => setUnite(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      {item.marque && <div className={styles.cardBrand}>{item.marque}</div>}
      <button
        type="button"
        className={styles.cardInfoBtn}
        title="Détails"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onInfo(item)}
      >
        <i className="fas fa-circle-info" />
      </button>
    </div>
  )
}

export default function ComplementLibrary({ coachId, assignments, onCatalogChanged }: {
  coachId: string
  assignments: ComplementAssignment[]
  onCatalogChanged?: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [showNew, setShowNew] = useState(false)
  const [info, setInfo] = useState<CatalogItem | null>(null)
  const [newNom, setNewNom] = useState('')
  const [newMarque, setNewMarque] = useState('')
  const [newLien, setNewLien] = useState('')
  const [saving, setSaving] = useState(false)

  const loadCatalog = useCallback(async () => {
    const { data, error } = await supabase
      .from('supplements')
      .select('id, nom, marque, lien_achat, created_at')
      .eq('coach_id', coachId)
      .eq('type', 'complement')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) { console.error('[complement] catalog error:', error); return }
    const seen = new Set<string>()
    const items: CatalogItem[] = []
    for (const s of (data || []) as { id: string; nom: string; marque: string | null; lien_achat: string | null }[]) {
      const key = (s.nom || '').toLowerCase().trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      items.push({ supplementId: s.id, nom: s.nom, marque: s.marque, lien_achat: s.lien_achat })
    }
    items.sort((a, b) => a.nom.localeCompare(b.nom))
    setCatalog(items)
  }, [coachId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadCatalog() }, [loadCatalog])

  // Dernier dosage utilisé pour un nom de complément (pré-remplissage du carré)
  function defaultsFor(nom: string): { dosage: string; unite: string } {
    const match = assignments.find((a) => (a.supplements?.nom || '').toLowerCase().trim() === nom.toLowerCase().trim())
    return { dosage: match?.dosage || '', unite: match?.unite || 'mg' }
  }

  async function createComplement() {
    if (!newNom.trim()) { toast('Nom obligatoire', 'error'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('supplements').insert({
        coach_id: coachId, type: 'complement',
        nom: newNom.trim(), marque: newMarque.trim() || null, lien_achat: newLien.trim() || null,
      })
      if (error) { console.error('[complement] create error:', error); toast(`Erreur: ${error.message}`, 'error'); return }
      toast('Complément ajouté au catalogue', 'success')
      setShowNew(false); setNewNom(''); setNewMarque(''); setNewLien('')
      loadCatalog(); onCatalogChanged?.()
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.library}>
      <div className={styles.libraryTitle}><i className="fas fa-pills" /> Librairie</div>
      <div className={styles.libraryGrid}>
        {catalog.map((item) => (
          <LibraryCard key={item.supplementId} item={item} defaults={defaultsFor(item.nom)} onInfo={setInfo} />
        ))}
        <div className={`${styles.card} ${styles.cardNew}`} onClick={() => setShowNew(true)}>
          <i className="fas fa-plus" /> Nouveau
        </div>
      </div>

      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Nouveau complément">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="form-control" placeholder="Nom *" value={newNom} onChange={(e) => setNewNom(e.target.value)} />
          <input className="form-control" placeholder="Marque" value={newMarque} onChange={(e) => setNewMarque(e.target.value)} />
          <input className="form-control" placeholder="Lien d'achat" value={newLien} onChange={(e) => setNewLien(e.target.value)} />
          <button className="btn btn-red" disabled={saving} onClick={createComplement}>
            {saving ? 'Ajout…' : 'Ajouter au catalogue'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!info} onClose={() => setInfo(null)} title={info?.nom || ''}>
        {info && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div><strong>Marque :</strong> {info.marque || '—'}</div>
            <div>
              <strong>Lien d&apos;achat :</strong>{' '}
              {info.lien_achat
                ? <a href={info.lien_achat} target="_blank" rel="noopener noreferrer">{info.lien_achat}</a>
                : '—'}
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 12 }}>
              Glisse le carré sur un moment de la journée pour l&apos;assigner.
              Dosage et unité se règlent directement sur le carré.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
