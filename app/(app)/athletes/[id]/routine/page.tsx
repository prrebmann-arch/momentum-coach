'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

type RoutineItem = {
  id: string
  athlete_id: string
  coach_id: string | null
  title: string
  emoji: string | null
  display_order: number
  active: boolean
  created_by: 'coach' | 'athlete'
  created_at: string
}

type RoutineLog = { id: string; routine_item_id: string; athlete_id: string; date: string }
type DailyAction = { id: string; athlete_id: string; date: string; text: string; emoji: string | null; completed: boolean; created_at: string }

function todayStr() { return new Date().toISOString().slice(0, 10) }
function daysAgoStr(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

export default function RoutinePage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RoutineItem[]>([])
  const [logs, setLogs] = useState<RoutineLog[]>([])
  const [todayActions, setTodayActions] = useState<DailyAction[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RoutineItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formEmoji, setFormEmoji] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [itemsRes, logsRes, actionsRes] = await Promise.all([
        supabase.from('routine_items')
          .select('id, athlete_id, coach_id, title, emoji, display_order, active, created_by, created_at')
          .eq('athlete_id', params.id).eq('active', true),
        supabase.from('routine_logs')
          .select('id, routine_item_id, athlete_id, date')
          .eq('athlete_id', params.id)
          .gte('date', daysAgoStr(6)).lte('date', todayStr()),
        supabase.from('daily_actions')
          .select('id, athlete_id, date, text, emoji, completed, created_at')
          .eq('athlete_id', params.id).eq('date', todayStr())
          .order('display_order', { ascending: true }),
      ])
      if (itemsRes.error) { console.error('[routine] items error:', itemsRes.error); toast(`Erreur: ${itemsRes.error.message}`, 'error') }
      if (logsRes.error) console.error('[routine] logs error:', logsRes.error)
      if (actionsRes.error) console.error('[routine] actions error:', actionsRes.error)
      setItems((itemsRes.data || []) as RoutineItem[])
      setLogs((logsRes.data || []) as RoutineLog[])
      setTodayActions((actionsRes.data || []) as DailyAction[])
    } finally {
      setLoading(false)
    }
  }, [params.id, supabase, toast])

  useEffect(() => { loadData() }, [loadData])

  const habits = useMemo(
    () => [...items].sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at)),
    [items]
  )

  const engagement = useMemo(() => {
    if (items.length === 0) return null
    const totalCells = items.length * 7
    const pct = Math.round((logs.length / totalCells) * 100)
    return Math.min(100, Math.max(0, pct))
  }, [items, logs])

  const openAdd = () => { setEditing(null); setFormTitle(''); setFormEmoji(''); setModalOpen(true) }
  const openEdit = (item: RoutineItem) => { setEditing(item); setFormTitle(item.title); setFormEmoji(item.emoji || ''); setModalOpen(true) }

  const handleSave = async () => {
    if (!formTitle.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('routine_items').update({
          title: formTitle.trim(),
          emoji: formEmoji.trim() || null,
        }).eq('id', editing.id)
        if (error) throw error
      } else {
        const payload = {
          athlete_id: params.id,
          coach_id: user?.id,
          title: formTitle.trim(),
          emoji: formEmoji.trim() || null,
          display_order: habits.length,
          created_by: 'coach' as const,
        }
        const { error } = await supabase.from('routine_items').insert(payload)
        if (error) throw error
      }
      setModalOpen(false)
      await loadData()
      toast('Habitude enregistrée', 'success')
    } catch (e: any) {
      console.error('[routine] save error:', e)
      toast(`Erreur: ${e.message || e}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: RoutineItem) => {
    if (!confirm(`Supprimer « ${item.title} » ?`)) return
    try {
      const { error } = await supabase.from('routine_items').update({ active: false }).eq('id', item.id)
      if (error) throw error
      await loadData()
    } catch (e: any) {
      toast(`Erreur: ${e.message || e}`, 'error')
    }
  }

  const moveItem = async (item: RoutineItem, dir: 'up' | 'down') => {
    const idx = habits.findIndex((i) => i.id === item.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= habits.length) return
    const other = habits[swapIdx]
    try {
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('routine_items').update({ display_order: other.display_order }).eq('id', item.id),
        supabase.from('routine_items').update({ display_order: item.display_order }).eq('id', other.id),
      ])
      if (e1 || e2) throw e1 || e2
      await loadData()
    } catch (e: any) {
      toast(`Erreur: ${e.message || e}`, 'error')
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}><Skeleton width="100%" height={120} /></div>
  }

  return (
    <div className={styles.tabContent} style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>☀️ Routine &amp; habitudes</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>
            Habitudes récurrentes que l'athlète coche chaque jour. Les "3 actions du jour" sont définies par l'athlète lui-même.
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          <i className="fas fa-plus" style={{ marginRight: 6 }} />
          Nouvelle habitude
        </button>
      </div>

      {engagement !== null && (
        <div style={{ padding: 14, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, letterSpacing: 0.5 }}>ENGAGEMENT 7 DERNIERS JOURS</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{engagement}% complété</div>
          </div>
          <div style={{ flex: 2, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${engagement}%`, height: '100%', background: engagement > 70 ? '#22c55e' : engagement > 40 ? '#f59e0b' : '#ef4444' }} />
          </div>
        </div>
      )}

      {/* Today's 3 actions (read-only for coach) */}
      {todayActions.length > 0 && (
        <div style={{ padding: 14, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, letterSpacing: 0.5, marginBottom: 10 }}>
            ⭐ 3 ACTIONS DU JOUR (définies par l'athlète)
          </div>
          {todayActions.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <span style={{ fontSize: 14, color: a.completed ? '#22c55e' : 'var(--text3)' }}>
                <i className={`fas ${a.completed ? 'fa-check-circle' : 'fa-circle'}`} />
              </span>
              {a.emoji && <span>{a.emoji}</span>}
              <span style={{ textDecoration: a.completed ? 'line-through' : 'none', color: a.completed ? 'var(--text3)' : 'var(--text)' }}>
                {a.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon="fas fa-sun"
          message="Aucune habitude définie. Crée la routine de ton athlète — il verra les tâches dans son app dès demain matin."
        />
      ) : (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.8, marginBottom: 10 }}>
            HABITUDES
          </div>
          {habits.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              index={i}
              total={habits.length}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item)}
              onMove={moveItem}
            />
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier l\u2019habitude' : 'Nouvelle habitude'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--text2)' }}>
            Titre
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Ex: Boire 500ml d'eau"
              style={{ marginTop: 6, width: '100%', padding: 10, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}
              autoFocus
            />
          </label>
          <label style={{ fontSize: 13, color: 'var(--text2)' }}>
            Emoji (optionnel)
            <input
              type="text"
              value={formEmoji}
              onChange={(e) => setFormEmoji(e.target.value)}
              placeholder="💧"
              maxLength={4}
              style={{ marginTop: 6, width: 80, padding: 10, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 20, textAlign: 'center' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => setModalOpen(false)}
              style={{ flex: 1, padding: 10, background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving || !formTitle.trim()}
              style={{ flex: 1, padding: 10, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: saving || !formTitle.trim() ? 'not-allowed' : 'pointer', opacity: saving || !formTitle.trim() ? 0.5 : 1 }}>
              {saving ? '...' : editing ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ItemRow({ item, index, total, onEdit, onDelete, onMove }: {
  item: RoutineItem; index: number; total: number
  onEdit: () => void; onDelete: () => void
  onMove: (item: RoutineItem, dir: 'up' | 'down') => void
}) {
  const isAthlete = item.created_by === 'athlete'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button onClick={() => onMove(item, 'up')} disabled={index === 0}
          style={{ background: 'none', border: 'none', color: index === 0 ? 'var(--bg3)' : 'var(--text2)', cursor: index === 0 ? 'default' : 'pointer', padding: 2 }}
          title="Monter"><i className="fas fa-chevron-up" style={{ fontSize: 10 }} /></button>
        <button onClick={() => onMove(item, 'down')} disabled={index === total - 1}
          style={{ background: 'none', border: 'none', color: index === total - 1 ? 'var(--bg3)' : 'var(--text2)', cursor: index === total - 1 ? 'default' : 'pointer', padding: 2 }}
          title="Descendre"><i className="fas fa-chevron-down" style={{ fontSize: 10 }} /></button>
      </div>
      {item.emoji && <span style={{ fontSize: 18 }}>{item.emoji}</span>}
      <span style={{ flex: 1, fontSize: 14 }}>{item.title}</span>
      {isAthlete && (
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(155, 89, 182, 0.15)', color: '#9b59b6', fontWeight: 600 }}>
          ajouté par l'athlète
        </span>
      )}
      <button onClick={onEdit} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 6 }} title="Modifier">
        <i className="fas fa-pen" style={{ fontSize: 12 }} />
      </button>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6 }} title="Supprimer">
        <i className="fas fa-trash" style={{ fontSize: 12 }} />
      </button>
    </div>
  )
}
