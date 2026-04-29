'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { notifyAthlete } from '@/lib/push'
import { getPageCache, setPageCache } from '@/lib/utils'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'
import StartRecordingModal from '@/components/recorder/StartRecordingModal'
import RetourVideoPlayer from '@/components/videos/RetourVideoPlayer'

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function RetoursPage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const cacheKey = `athlete_${params.id}_retours`
  const [cached] = useState(() => getPageCache<any[]>(cacheKey))

  const [loading, setLoading] = useState(!cached)
  const [retours, setRetours] = useState<any[]>(cached ?? [])
  const [showModal, setShowModal] = useState(false)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [formLoom, setFormLoom] = useState('')
  const [formTitre, setFormTitre] = useState('')
  const [formComment, setFormComment] = useState('')
  const [saving, setSaving] = useState(false)

  const loadRetours = useCallback(async () => {
    if (!retours.length) setLoading(true)
    try {
      const { data } = await supabase
        .from('bilan_retours')
        .select('id, athlete_id, coach_id, loom_url, titre, commentaire, type, created_at, video_path, thumbnail_path, duration_s, archived_at, audio_url')
        .eq('athlete_id', params.id)
        .order('created_at', { ascending: false })
        .limit(100)
      const result = data || []
      setRetours(result)
      setPageCache(cacheKey, result)
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.id) loadRetours()
  }, [params.id, loadRetours])

  useRefetchOnResume(loadRetours, loading)

  async function submitRetour() {
    if (!formLoom.trim()) { toast("L'URL Loom est obligatoire", 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('bilan_retours').insert({
      athlete_id: params.id,
      coach_id: user?.id,
      loom_url: formLoom.trim(),
      titre: formTitre.trim() || 'Retour bilan',
      commentaire: formComment.trim() || null,
    })
    setSaving(false)
    if (error) { toast('Erreur lors de l\'envoi', 'error'); return }

    // Notify athlete (DB + push)
    const { data: ath } = await supabase.from('athletes').select('user_id').eq('id', params.id).single()
    if (ath?.user_id) {
      await notifyAthlete(
        ath.user_id, 'retour', 'Nouveau retour video',
        `Votre coach vous a envoye un retour : ${formTitre.trim() || 'Retour bilan'}`,
        { loom_url: formLoom.trim(), titre: formTitre.trim() || 'Retour bilan' },
      )
    }

    toast('Retour video envoye !', 'success')
    setShowModal(false)
    setFormLoom('')
    setFormTitre('')
    setFormComment('')
    loadRetours()
  }

  async function deleteRetour(id: string) {
    if (!confirm('Supprimer ce retour video ?')) return
    // Delete DB row FIRST so failures don't leave orphan storage entries
    const target = retours.find(r => r.id === id)
    const { error } = await supabase.from('bilan_retours').delete().eq('id', id)
    if (error) { toast('Erreur lors de la suppression', 'error'); return }
    // Then best-effort cleanup of storage files (RLS allows coach to delete own files)
    if (target?.video_path) {
      const paths = [target.video_path, target.thumbnail_path].filter(Boolean) as string[]
      if (paths.length) {
        try { await supabase.storage.from('coach-video').remove(paths) }
        catch (e) { console.warn('storage cleanup failed (non-fatal):', e) }
      }
    }
    toast('Retour supprime', 'success')
    loadRetours()
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Retours video envoyes</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-red" onClick={() => setShowRecordModal(true)}>
            <i className="fas fa-circle" /> Enregistrer un retour
          </button>
          <button className="btn btn-outline" onClick={() => setShowModal(true)}>
            <i className="fas fa-link" /> Lien Loom
          </button>
        </div>
      </div>

      {retours.length === 0 ? (
        <EmptyState icon="fas fa-video" message="Aucun retour video envoye" />
      ) : (
        retours.map((r) => {
          const date = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          return (
            <div key={r.id} className={styles.retourCard}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                <div className={styles.retourIcon}>
                  <i className={`fas ${r.video_path ? 'fa-video' : r.audio_url ? 'fa-microphone' : r.loom_url ? 'fa-link' : 'fa-comment'}`} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.titre || 'Retour bilan'}</div>
                  {r.commentaire && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{r.commentaire}</div>}

                  {r.video_path && (
                    <div style={{ marginTop: 10 }}>
                      <RetourVideoPlayer retourId={r.id} archived={!!r.archived_at} />
                    </div>
                  )}
                  {r.audio_url && !r.video_path && (
                    <div style={{ marginTop: 6 }}>
                      <audio controls src={r.audio_url} style={{ height: 28, maxWidth: 250 }} />
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{date}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {r.loom_url && !r.video_path && (
                  <a href={r.loom_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    <i className="fas fa-external-link-alt" /> Voir
                  </a>
                )}
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteRetour(r.id)}>
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>
          )
        })
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Envoyer un retour video">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Titre</label>
            <input type="text" className="form-control" value={formTitre} onChange={(e) => setFormTitre(e.target.value)} placeholder="Retour bilan" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>URL Loom *</label>
            <input type="url" className="form-control" value={formLoom} onChange={(e) => setFormLoom(e.target.value)} placeholder="https://www.loom.com/share/..." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Commentaire</label>
            <textarea className="form-control" rows={3} value={formComment} onChange={(e) => setFormComment(e.target.value)} placeholder="Optionnel" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-red" onClick={submitRetour} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
            </button>
          </div>
        </div>
      </Modal>

      <StartRecordingModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        athleteId={params.id}
      />
    </div>
  )
}
