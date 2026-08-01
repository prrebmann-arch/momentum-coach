'use client'

// Board Complément : timeline de la diète (zones de drop) + librairie.
// Drop librairie -> INSERT athlete_supplements ; drop puce -> UPDATE moment_prise.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import {
  buildZoneList, zoneToMoment, momentToZone,
  type ComplementAssignment, type DietMeal, type ZoneId,
} from '@/lib/complement'
import ComplementLibrary, { type LibraryDragData } from './ComplementLibrary'
import ComplementChip, { type ChipDragData } from './ComplementChip'
import styles from './complement.module.css'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function DropBand({ zoneId, label, children }: { zoneId: ZoneId; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId, data: { zoneId } })
  return (
    <div ref={setNodeRef} className={`${styles.zoneBand} ${isOver ? styles.zoneBandOver : ''}`}>
      {label && <span className={styles.zoneBandLabel}>{label}</span>}
      <span className={styles.zoneChips}>{children}</span>
    </div>
  )
}

export default function ComplementBoard({ athleteId, coachId, assignments, dietMeals, onChanged, onImportClick }: {
  athleteId: string
  coachId: string
  assignments: ComplementAssignment[]
  dietMeals: DietMeal[]
  onChanged: () => void
  onImportClick: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const [editing, setEditing] = useState<ComplementAssignment | null>(null)
  const [editDosage, setEditDosage] = useState('')
  const [editUnite, setEditUnite] = useState('mg')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const zones = useMemo(() => buildZoneList(dietMeals), [dietMeals])
  const mealCount = dietMeals.length

  // zoneId -> assignations ; legacy = moment non parsable -> « À replacer »
  const { byZone, legacy } = useMemo(() => {
    const map = new Map<ZoneId, ComplementAssignment[]>()
    const leg: ComplementAssignment[] = []
    for (const a of assignments) {
      const z = momentToZone(a.moment_prise, mealCount)
      if (z) { if (!map.has(z)) map.set(z, []); map.get(z)!.push(a) }
      else leg.push(a)
    }
    return { byZone: map, legacy: leg }
  }, [assignments, mealCount])

  // Groupes ordonnés pour le rendu (un bloc par group, ses bandes dedans)
  const groups = useMemo(() => {
    const out: { title: string; icon: string; zones: typeof zones }[] = []
    for (const z of zones) {
      const last = out[out.length - 1]
      if (last && last.title === z.group) last.zones.push(z)
      else out.push({ title: z.group, icon: z.icon, zones: [z] })
    }
    return out
  }, [zones])

  function handleDragStart(e: DragStartEvent) {
    const d = e.active.data.current as LibraryDragData | ChipDragData | undefined
    setDragLabel(d?.nom || null)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDragLabel(null)
    const over = e.over
    const d = e.active.data.current as LibraryDragData | ChipDragData | undefined
    if (!over || !d) return
    const moment = zoneToMoment(String(over.id))
    if (!moment) return

    if (d.kind === 'library') {
      const { error } = await supabase.from('athlete_supplements').insert({
        athlete_id: athleteId,
        supplement_id: d.supplementId,
        dosage: d.dosage.trim() || '',
        unite: d.unite,
        frequence: '1x/jour',
        intervalle_jours: 1,
        moment_prise: moment,
        actif: true,
        start_date: todayIso(),
      })
      if (error) { console.error('[complement] insert error:', error); toast(`Erreur: ${error.message}`, 'error'); return }
      onChanged()
    } else {
      if (d.momentPrise === moment) return
      const { error } = await supabase.from('athlete_supplements').update({ moment_prise: moment }).eq('id', d.assignmentId)
      if (error) { console.error('[complement] move error:', error); toast(`Erreur: ${error.message}`, 'error'); return }
      onChanged()
    }
  }

  function openEdit(a: ComplementAssignment) {
    setEditing(a)
    setEditDosage(a.dosage || '')
    setEditUnite(a.unite || 'mg')
    setEditNotes(a.notes || '')
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const { error } = await supabase.from('athlete_supplements')
        .update({ dosage: editDosage.trim(), unite: editUnite, notes: editNotes.trim() || null })
        .eq('id', editing.id)
      if (error) { console.error('[complement] edit error:', error); toast(`Erreur: ${error.message}`, 'error'); return }
      setEditing(null)
      onChanged()
    } finally { setSaving(false) }
  }

  async function removeAssignment(a: ComplementAssignment) {
    const { error } = await supabase.from('athlete_supplements')
      .update({ actif: false, end_date: todayIso() })
      .eq('id', a.id)
    if (error) { console.error('[complement] remove error:', error); toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Complément retiré', 'success')
    onChanged()
  }

  if (dietMeals.length === 0) {
    return (
      <EmptyState
        icon="fas fa-utensils"
        message="Mets d'abord une diète en place pour construire le protocole de compléments"
        action={
          <Link href={`/athletes/${athleteId}/nutrition`} className="btn btn-red btn-sm">
            Aller à la nutrition
          </Link>
        }
      />
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.board}>
        <div className={styles.timeline}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-outline btn-sm" onClick={onImportClick}>
              <i className="fas fa-file-import" style={{ marginRight: 6 }} /> Depuis un template
            </button>
          </div>
          {groups.map((g) => (
            <div key={g.title} className={styles.zoneGroup}>
              <div className={styles.zoneGroupTitle}><i className={g.icon} /> {g.title}</div>
              {g.zones.map((z) => (
                <DropBand key={z.id} zoneId={z.id} label={g.zones.length > 1 ? z.label : ''}>
                  {(byZone.get(z.id) || []).map((a) => (
                    <ComplementChip key={a.id} assignment={a} onEdit={openEdit} onRemove={removeAssignment} />
                  ))}
                </DropBand>
              ))}
            </div>
          ))}
          {legacy.length > 0 && (
            <div className={`${styles.zoneGroup} ${styles.legacySection}`}>
              <div className={styles.zoneGroupTitle}><i className="fas fa-clock" /> À replacer</div>
              <div className={styles.zoneChips}>
                {legacy.map((a) => (
                  <ComplementChip key={a.id} assignment={a} onEdit={openEdit} onRemove={removeAssignment} />
                ))}
              </div>
            </div>
          )}
        </div>

        <ComplementLibrary coachId={coachId} assignments={assignments} onCatalogChanged={onChanged} />
      </div>

      <DragOverlay>{dragLabel ? <div className={styles.dragOverlayCard}>{dragLabel}</div> : null}</DragOverlay>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.supplements?.nom || 'Complément'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-control" style={{ flex: 1 }} placeholder="Dosage" value={editDosage} onChange={(e) => setEditDosage(e.target.value)} />
            <select className="form-control" style={{ width: 90 }} value={editUnite} onChange={(e) => setEditUnite(e.target.value)}>
              {['mg', 'g', 'ml', 'caps', 'gelules', 'cuillere', 'UI'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <textarea className="form-control" placeholder="Notes" rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          <button className="btn btn-red" disabled={saving} onClick={saveEdit}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
        </div>
      </Modal>
    </DndContext>
  )
}
