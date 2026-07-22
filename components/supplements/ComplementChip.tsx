'use client'

// Puce d'un complément assigné, affichée dans une zone du board.
// Draggable (déplacement de zone), clic = édition, X = retrait (actif=false).
import { useDraggable } from '@dnd-kit/core'
import type { ComplementAssignment } from '@/lib/complement'
import styles from './complement.module.css'

export interface ChipDragData {
  kind: 'chip'
  assignmentId: string
  nom: string
  momentPrise: string | null
}

export default function ComplementChip({ assignment, onEdit, onRemove }: {
  assignment: ComplementAssignment
  onEdit: (a: ComplementAssignment) => void
  onRemove: (a: ComplementAssignment) => void
}) {
  const nom = assignment.supplements?.nom || 'Complément'
  const data: ChipDragData = {
    kind: 'chip',
    assignmentId: assignment.id,
    nom,
    momentPrise: assignment.moment_prise,
  }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `chip-${assignment.id}`, data })

  return (
    <span
      ref={setNodeRef}
      className={styles.chip}
      style={isDragging ? { opacity: 0.4 } : undefined}
      {...listeners}
      {...attributes}
    >
      <span onPointerDown={(e) => e.stopPropagation()} onClick={() => onEdit(assignment)} style={{ cursor: 'pointer' }}>
        {nom}
        {assignment.dosage && <span className={styles.chipDose}> {assignment.dosage}{assignment.unite || ''}</span>}
      </span>
      <button
        type="button"
        className={styles.chipX}
        title="Retirer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(assignment)}
      >
        <i className="fas fa-xmark" />
      </button>
    </span>
  )
}
