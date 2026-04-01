'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { DEFAULT_STEPS_GOAL, DEFAULT_WATER_GOAL } from '@/lib/constants'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

const OBJECTIF_LABELS: Record<string, string> = {
  perte_de_poids: 'Perte de poids',
  prise_de_masse: 'Prise de masse',
  maintenance: 'Maintenance',
  recomposition: 'Recomposition',
  performance: 'Performance',
}

const ACCESS_LABELS: Record<string, string> = {
  training_only: 'Training uniquement',
  nutrition_only: 'Diete uniquement',
  full: 'Complet',
}

export default function InfosPage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [athlete, setAthlete] = useState<any>(null)
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})

  const loadAthlete = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('athletes').select('*').eq('id', params.id).single()
    setAthlete(data)
    setLoading(false)
  }, [params.id, supabase])

  useEffect(() => {
    if (params.id) loadAthlete()
  }, [params.id, loadAthlete])

  if (loading) return <Skeleton height={400} borderRadius={16} />
  if (!athlete) return <div className="empty-state"><p>Athlete introuvable</p></div>

  const a = athlete

  function startEdit(card: string) {
    const data: Record<string, any> = {}
    if (card === 'personal') {
      data.prenom = a.prenom || ''
      data.nom = a.nom || ''
      data.email = a.email || ''
      data.telephone = a.telephone || ''
      data.date_naissance = a.date_naissance || ''
      data.genre = a.genre || ''
      data.objectif = a.objectif || ''
      data.pas_journalier = a.pas_journalier || DEFAULT_STEPS_GOAL
      data.water_goal_ml = a.water_goal_ml || DEFAULT_WATER_GOAL
      data.access_mode = a.access_mode || 'full'
    } else if (card === 'health') {
      data.blessures = a.blessures || ''
      data.allergies = a.allergies || ''
      data.medicaments = a.medicaments || ''
      data.notes_sante = a.notes_sante || ''
    }
    setFormData(data)
    setEditingCard(card)
  }

  async function saveEdit(card: string) {
    const { error } = await supabase.from('athletes').update(formData).eq('id', a.id)
    if (error) { toast('Erreur lors de la sauvegarde', 'error'); return }
    toast('Informations sauvegardees', 'success')
    setEditingCard(null)
    loadAthlete()
  }

  function updateField(key: string, val: any) {
    setFormData((prev) => ({ ...prev, [key]: val }))
  }

  function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}><i className={`fas ${icon}`} style={{ width: 16, color: 'var(--text3)' }} />{label}</span>
        <span className={styles.infoValue}>{value || '\u2014'}</span>
      </div>
    )
  }

  function EditField({ label, field, type = 'text', options }: { label: string; field: string; type?: string; options?: { value: string; label: string }[] }) {
    if (options) {
      return (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{label}</label>
          <select className="form-control" value={formData[field] || ''} onChange={(e) => updateField(field, e.target.value)}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )
    }
    return (
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{label}</label>
        {type === 'textarea' ? (
          <textarea className="form-control" rows={3} value={formData[field] || ''} onChange={(e) => updateField(field, e.target.value)} />
        ) : (
          <input type={type} className="form-control" value={formData[field] || ''} onChange={(e) => updateField(field, type === 'number' ? Number(e.target.value) : e.target.value)} />
        )}
      </div>
    )
  }

  // -- Avatar --
  const initials = (a.prenom?.charAt(0) || '') + (a.nom?.charAt(0) || '')

  return (
    <div>
      {/* Avatar + Name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, padding: 28, background: 'var(--bg2)', border: '1px solid var(--glass-border)', borderRadius: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,var(--primary),#d41a1a)' }} />
        {a.avatar_url ? (
          <img src={a.avatar_url} alt="" style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'cover', border: '3px solid var(--border)' }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg,var(--bg3),var(--bg4))', border: '3px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'var(--text2)' }}>{initials}</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{a.prenom} {a.nom}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>{a.email || ''}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {a.objectif && <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(179,8,8,0.1)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 6 }}>{OBJECTIF_LABELS[a.objectif] || a.objectif}</span>}
            {a.poids_actuel && <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--tint-medium, rgba(255,255,255,0.06))', color: 'var(--text2)', padding: '3px 10px', borderRadius: 6 }}>{a.poids_actuel} kg</span>}
          </div>
        </div>
      </div>

      <div className={styles.infoGrid}>
        {/* Personal info card */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <span className={styles.infoCardTitle}><i className="fas fa-user" style={{ marginRight: 6 }} />INFORMATIONS PERSONNELLES</span>
            <button className="btn btn-outline btn-sm" onClick={() => editingCard === 'personal' ? setEditingCard(null) : startEdit('personal')}>
              <i className={`fas ${editingCard === 'personal' ? 'fa-times' : 'fa-pen'}`} />
            </button>
          </div>
          {editingCard === 'personal' ? (
            <div>
              <EditField label="Prenom" field="prenom" />
              <EditField label="Nom" field="nom" />
              <EditField label="Email" field="email" type="email" />
              <EditField label="Telephone" field="telephone" />
              <EditField label="Date de naissance" field="date_naissance" type="date" />
              <EditField label="Genre" field="genre" options={[{ value: '', label: '\u2014' }, { value: 'homme', label: 'Homme' }, { value: 'femme', label: 'Femme' }]} />
              <EditField label="Objectif" field="objectif" options={[{ value: '', label: '\u2014' }, ...Object.entries(OBJECTIF_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
              <EditField label="Objectif pas/jour" field="pas_journalier" type="number" />
              <EditField label="Objectif eau (ml/jour)" field="water_goal_ml" type="number" />
              <EditField label="Mode d'acces" field="access_mode" options={[{ value: 'full', label: 'Complet' }, { value: 'training_only', label: 'Training uniquement' }, { value: 'nutrition_only', label: 'Diete uniquement' }]} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-red btn-sm" onClick={() => saveEdit('personal')}><i className="fas fa-save" /> Sauvegarder</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingCard(null)}>Annuler</button>
              </div>
            </div>
          ) : (
            <div>
              <InfoRow icon="fa-id-card" label="Prenom" value={a.prenom} />
              <InfoRow icon="fa-id-card" label="Nom" value={a.nom} />
              <InfoRow icon="fa-envelope" label="Email" value={a.email} />
              <InfoRow icon="fa-phone" label="Telephone" value={a.telephone || ''} />
              <InfoRow icon="fa-calendar" label="Date de naissance" value={a.date_naissance ? new Date(a.date_naissance + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''} />
              <InfoRow icon="fa-venus-mars" label="Genre" value={a.genre || ''} />
              <InfoRow icon="fa-bullseye" label="Objectif" value={OBJECTIF_LABELS[a.objectif] || a.objectif || ''} />
              <InfoRow icon="fa-shoe-prints" label="Objectif pas" value={`${(a.pas_journalier || DEFAULT_STEPS_GOAL).toLocaleString('fr-FR')} pas/jour`} />
              <InfoRow icon="fa-tint" label="Objectif eau" value={`${(a.water_goal_ml || DEFAULT_WATER_GOAL).toLocaleString('fr-FR')} ml/jour`} />
              <InfoRow icon="fa-lock" label="Mode d'acces" value={ACCESS_LABELS[a.access_mode] || 'Complet'} />
            </div>
          )}
        </div>

        {/* Health card */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <span className={styles.infoCardTitle}><i className="fas fa-heartbeat" style={{ marginRight: 6 }} />SANTE</span>
            <button className="btn btn-outline btn-sm" onClick={() => editingCard === 'health' ? setEditingCard(null) : startEdit('health')}>
              <i className={`fas ${editingCard === 'health' ? 'fa-times' : 'fa-pen'}`} />
            </button>
          </div>
          {editingCard === 'health' ? (
            <div>
              <EditField label="Blessures / Limitations" field="blessures" type="textarea" />
              <EditField label="Allergies alimentaires" field="allergies" type="textarea" />
              <EditField label="Medicaments" field="medicaments" type="textarea" />
              <EditField label="Notes sante" field="notes_sante" type="textarea" />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-red btn-sm" onClick={() => saveEdit('health')}><i className="fas fa-save" /> Sauvegarder</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingCard(null)}>Annuler</button>
              </div>
            </div>
          ) : (
            <div>
              <InfoRow icon="fa-band-aid" label="Blessures / Limitations" value={a.blessures || ''} />
              <InfoRow icon="fa-allergies" label="Allergies alimentaires" value={a.allergies || ''} />
              <InfoRow icon="fa-pills" label="Medicaments" value={a.medicaments || ''} />
              <InfoRow icon="fa-notes-medical" label="Notes sante" value={a.notes_sante || ''} />
            </div>
          )}
        </div>
      </div>

      {/* Delete athlete */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={async () => {
          if (!confirm(`Supprimer ${a.prenom} ${a.nom} ?`)) return
          const { error } = await supabase.from('athletes').delete().eq('id', a.id)
          if (error) { toast('Erreur lors de la suppression', 'error'); return }
          toast('Athlete supprime', 'success')
          window.location.href = '/athletes'
        }}>
          <i className="fas fa-trash" /> Supprimer l&apos;athlete
        </button>
      </div>
    </div>
  )
}
