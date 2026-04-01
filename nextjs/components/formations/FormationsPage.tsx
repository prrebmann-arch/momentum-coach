'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/formations.module.css'
import type { Athlete } from '@/lib/types'

// ── Types ──
interface Formation {
  id: string
  title: string
  description?: string
  video_count: number
  visibility: 'all' | 'selected'
  coach_id: string
  created_at: string
}

interface FormationVideo {
  id: string
  formation_id: string
  title: string
  video_url: string
  position: number
}

interface FormationMember {
  athlete_id: string
  athletes?: Athlete
}

interface VideoProgress {
  user_id: string
  video_id: string
  watched: boolean
}

// ── Helpers ──
function getEmbedUrl(url: string): string | null {
  if (!url) return null
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  if (m) return `https://www.youtube.com/embed/${m[1]}`
  m = url.match(/vimeo\.com\/(\d+)/)
  if (m) return `https://player.vimeo.com/video/${m[1]}`
  m = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
  if (m) return `https://www.loom.com/embed/${m[1]}`
  return null
}

export default function FormationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [formations, setFormations] = useState<Formation[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})

  // Detail view
  const [currentFormation, setCurrentFormation] = useState<Formation | null>(null)
  const [videos, setVideos] = useState<FormationVideo[]>([])
  const [members, setMembers] = useState<FormationMember[]>([])
  const [progressAthletes, setProgressAthletes] = useState<Athlete[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, Set<string>>>({})

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createVis, setCreateVis] = useState<'all' | 'selected'>('all')
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set())

  // Members modal
  const [showMembers, setShowMembers] = useState(false)
  const [membersVis, setMembersVis] = useState<'all' | 'selected'>('all')
  const [memberSelection, setMemberSelection] = useState<Set<string>>(new Set())

  // Add video modal
  const [showAddVideo, setShowAddVideo] = useState(false)
  const [videoTitle, setVideoTitle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  const loadFormations = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [fRes, mRes] = await Promise.all([
      supabase.from('formations').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
      supabase.from('formation_members').select('formation_id, athlete_id'),
    ])
    setFormations((fRes.data || []) as Formation[])
    const counts: Record<string, number> = {}
    ;(mRes.data || []).forEach((m: { formation_id: string }) => {
      counts[m.formation_id] = (counts[m.formation_id] || 0) + 1
    })
    setMemberCounts(counts)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => { loadFormations() }, [loadFormations])

  async function viewFormation(formationId: string) {
    if (!user) return
    setLoading(true)
    const [fRes, vRes, mRes, progRes] = await Promise.all([
      supabase.from('formations').select('*').eq('id', formationId).single(),
      supabase.from('formation_videos').select('*').eq('formation_id', formationId).order('position'),
      supabase.from('formation_members').select('athlete_id, athletes(id, prenom, nom, email, user_id)').eq('formation_id', formationId),
      supabase.from('formation_video_progress').select('user_id, video_id, watched'),
    ])

    if (fRes.error) { toast('Erreur chargement', 'error'); setLoading(false); return }

    const formation = fRes.data as Formation
    const vids = (vRes.data || []) as FormationVideo[]
    const fMembers = (mRes.data || []) as unknown as FormationMember[]

    setCurrentFormation(formation)
    setVideos(vids)
    setMembers(fMembers)

    // Progress
    const videoIds = new Set(vids.map(v => v.id))
    const formationProgress = ((progRes.data || []) as VideoProgress[]).filter(p => videoIds.has(p.video_id))

    let pAthletes: Athlete[] = []
    if (formation.visibility === 'selected') {
      pAthletes = fMembers.map(m => m.athletes).filter(Boolean) as Athlete[]
    } else {
      const { data: allA } = await supabase.from('athletes').select('id, prenom, nom, email, user_id').eq('coach_id', user.id).order('prenom')
      pAthletes = (allA || []) as Athlete[]
    }
    setProgressAthletes(pAthletes)

    const pMap: Record<string, Set<string>> = {}
    formationProgress.forEach(p => {
      if (p.watched) {
        if (!pMap[p.user_id]) pMap[p.user_id] = new Set()
        pMap[p.user_id].add(p.video_id)
      }
    })
    setProgressMap(pMap)
    setLoading(false)
  }

  function goBack() {
    setCurrentFormation(null)
    setVideos([])
    setMembers([])
    loadFormations()
  }

  async function openCreateModal() {
    if (!user) return
    const { data } = await supabase.from('athletes').select('id, prenom, nom, email').eq('coach_id', user.id).order('prenom')
    setAthletes((data || []) as Athlete[])
    setCreateTitle(''); setCreateDesc(''); setCreateVis('all'); setSelectedAthletes(new Set())
    setShowCreate(true)
  }

  async function submitCreate() {
    if (!user) return
    const title = createTitle.trim()
    if (!title) { toast('Le nom est obligatoire', 'error'); return }
    if (createVis === 'selected' && selectedAthletes.size === 0) { toast('Selectionnez au moins un athlete', 'error'); return }

    const { data: formation, error } = await supabase.from('formations').insert({
      coach_id: user.id, title, description: createDesc.trim(), video_count: 0, visibility: createVis,
    }).select().single()

    if (error) { toast('Erreur: ' + error.message, 'error'); return }

    if (createVis === 'selected' && selectedAthletes.size > 0) {
      const rows = Array.from(selectedAthletes).map(aid => ({ formation_id: (formation as Formation).id, athlete_id: aid }))
      await supabase.from('formation_members').insert(rows)
    }

    setShowCreate(false)
    toast('Formation creee !', 'success')
    loadFormations()
  }

  async function deleteFormation(id: string, title: string) {
    if (!confirm(`Supprimer la formation "${title}" et toutes ses videos ?`)) return
    const { data: vids } = await supabase.from('formation_videos').select('id').eq('formation_id', id)
    const videoIds = (vids || []).map((v: { id: string }) => v.id)
    if (videoIds.length) await supabase.from('formation_video_progress').delete().in('video_id', videoIds)
    await supabase.from('formation_videos').delete().eq('formation_id', id)
    await supabase.from('formations').delete().eq('id', id)
    toast('Formation supprimee', 'success')
    loadFormations()
  }

  // ── Members modal ──
  async function openMembersModal() {
    if (!user || !currentFormation) return
    const [aRes, mRes] = await Promise.all([
      supabase.from('athletes').select('id, prenom, nom, email').eq('coach_id', user.id).order('prenom'),
      supabase.from('formation_members').select('athlete_id').eq('formation_id', currentFormation.id),
    ])
    setAthletes((aRes.data || []) as Athlete[])
    const currentIds = new Set((mRes.data || []).map((m: { athlete_id: string }) => m.athlete_id))
    setMemberSelection(currentIds)
    setMembersVis(currentFormation.visibility)
    setShowMembers(true)
  }

  async function saveMembers() {
    if (!currentFormation) return
    if (membersVis === 'selected' && memberSelection.size === 0) { toast('Selectionnez au moins un athlete', 'error'); return }

    await supabase.from('formations').update({ visibility: membersVis }).eq('id', currentFormation.id)
    await supabase.from('formation_members').delete().eq('formation_id', currentFormation.id)

    if (membersVis === 'selected' && memberSelection.size > 0) {
      const rows = Array.from(memberSelection).map(aid => ({ formation_id: currentFormation.id, athlete_id: aid }))
      await supabase.from('formation_members').insert(rows)
    }

    setShowMembers(false)
    toast('Membres mis a jour', 'success')
    viewFormation(currentFormation.id)
  }

  // ── Videos ──
  async function addVideo() {
    if (!currentFormation) return
    const title = videoTitle.trim()
    const url = videoUrl.trim()
    if (!title || !url) { toast('Titre et URL requis', 'error'); return }

    const { data: existing } = await supabase.from('formation_videos')
      .select('position').eq('formation_id', currentFormation.id)
      .order('position', { ascending: false }).limit(1)

    const nextPos = existing?.length ? (existing[0] as { position: number }).position + 1 : 0

    const { error } = await supabase.from('formation_videos').insert({
      formation_id: currentFormation.id, title, video_url: url, position: nextPos,
    })
    if (error) { toast('Erreur: ' + error.message, 'error'); return }

    await supabase.from('formations').update({ video_count: nextPos + 1 }).eq('id', currentFormation.id)
    setShowAddVideo(false)
    setVideoTitle(''); setVideoUrl('')
    viewFormation(currentFormation.id)
  }

  async function deleteVideo(videoId: string) {
    if (!currentFormation) return
    if (!confirm('Supprimer cette video ?')) return
    await supabase.from('formation_video_progress').delete().eq('video_id', videoId)
    await supabase.from('formation_videos').delete().eq('id', videoId)
    const { data: remaining } = await supabase.from('formation_videos').select('id').eq('formation_id', currentFormation.id)
    await supabase.from('formations').update({ video_count: (remaining || []).length }).eq('id', currentFormation.id)
    viewFormation(currentFormation.id)
  }

  async function moveVideo(videoId: string, currentPos: number, direction: 'up' | 'down') {
    if (!currentFormation) return
    const newPos = direction === 'up' ? currentPos - 1 : currentPos + 1
    const { data: target } = await supabase.from('formation_videos')
      .select('id').eq('formation_id', currentFormation.id).eq('position', newPos).single()
    if (!target) return
    await Promise.all([
      supabase.from('formation_videos').update({ position: newPos }).eq('id', videoId),
      supabase.from('formation_videos').update({ position: currentPos }).eq('id', (target as { id: string }).id),
    ])
    viewFormation(currentFormation.id)
  }

  if (loading) return <Skeleton />

  // ── Detail View ──
  if (currentFormation) {
    const audienceLabel = currentFormation.visibility === 'selected'
      ? `${members.length} athlete${members.length > 1 ? 's' : ''} selectionne${members.length > 1 ? 's' : ''}`
      : 'Tous les athletes'

    return (
      <>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button variant="outline" onClick={goBack}><i className="fas fa-arrow-left" /> Retour</Button>
            <h1 className="page-title">{currentFormation.title}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={openMembersModal}><i className="fas fa-users" /> Membres</Button>
            <Button variant="red" onClick={() => { setVideoTitle(''); setVideoUrl(''); setShowAddVideo(true) }}>
              <i className="fas fa-plus" /> Ajouter une video
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {currentFormation.description && <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>{currentFormation.description}</p>}
          <span style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', padding: '4px 10px', borderRadius: 20 }}>
            <i className={`fas ${currentFormation.visibility === 'selected' ? 'fa-user-check' : 'fa-users'}`} /> {audienceLabel}
          </span>
        </div>

        {/* Progress */}
        {videos.length > 0 && progressAthletes.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>
              <i className="fas fa-chart-bar" style={{ marginRight: 6, color: 'var(--primary)' }} /> Progression des athletes
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 8 }}>
              {progressAthletes.map(a => {
                const userId = a.user_id || a.id
                const watchedCount = progressMap[userId]?.size || 0
                const totalVideos = videos.length
                const pctVal = Math.round((watchedCount / totalVideos) * 100)
                const barColor = pctVal === 100 ? 'var(--success)' : 'var(--primary)'
                return (
                  <div key={a.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.prenom} {a.nom}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{watchedCount}/{totalVideos}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pctVal}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Videos */}
        {!videos.length ? (
          <EmptyState icon="fas fa-video" message="Aucune video dans cette formation" />
        ) : (
          <div className={styles.fmVideos}>
            {videos.map((v, i) => {
              const embedUrl = getEmbedUrl(v.video_url)
              return (
                <div key={v.id} className={styles.fmVideoCard}>
                  <div className={styles.fmVideoNum}>{i + 1}</div>
                  <div className={styles.fmVideoPreview}>
                    {embedUrl ? (
                      <iframe src={embedUrl} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    ) : (
                      <a href={v.video_url} target="_blank" rel="noopener noreferrer" className={styles.fmVideoLink}>
                        <i className="fas fa-external-link-alt" /> Ouvrir la video
                      </a>
                    )}
                  </div>
                  <div className={styles.fmVideoInfo}>
                    <div className={styles.fmVideoTitle}>{v.title}</div>
                  </div>
                  <div className={styles.fmVideoActions}>
                    <button onClick={() => moveVideo(v.id, v.position, 'up')} title="Monter" disabled={i === 0}><i className="fas fa-chevron-up" /></button>
                    <button onClick={() => moveVideo(v.id, v.position, 'down')} title="Descendre" disabled={i === videos.length - 1}><i className="fas fa-chevron-down" /></button>
                    <button onClick={() => deleteVideo(v.id)} title="Supprimer" style={{ color: 'var(--danger)' }}><i className="fas fa-trash" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add Video Modal */}
        <Modal isOpen={showAddVideo} onClose={() => setShowAddVideo(false)} title="Ajouter une video">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0' }}>
            <input type="text" className="field-input" placeholder="Titre de la video" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} />
            <input type="text" className="field-input" placeholder="Lien de la video (YouTube, Vimeo, Loom...)" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="outline" onClick={() => setShowAddVideo(false)}>Annuler</Button>
              <Button variant="red" onClick={addVideo}><i className="fas fa-plus" style={{ marginRight: 4 }} /> Ajouter</Button>
            </div>
          </div>
        </Modal>

        {/* Members Modal */}
        <Modal isOpen={showMembers} onClose={() => setShowMembers(false)} title={`Membres -- ${currentFormation.title}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
            <div>
              <label className="field-label">Acces</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  className={`btn btn-outline ${membersVis === 'all' ? 'active' : ''}`}
                  style={membersVis === 'all' ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : undefined}
                  onClick={() => setMembersVis('all')}
                >
                  <i className="fas fa-users" /> Tous les athletes
                </button>
                <button
                  className={`btn btn-outline ${membersVis === 'selected' ? 'active' : ''}`}
                  style={membersVis === 'selected' ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : undefined}
                  onClick={() => setMembersVis('selected')}
                >
                  <i className="fas fa-user-check" /> Selection
                </button>
              </div>
            </div>
            {membersVis === 'selected' && (
              <div>
                <label className="field-label">Athletes</label>
                <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginTop: 4 }}>
                  {athletes.length ? athletes.map(a => (
                    <label key={a.id} className={styles.fmAthleteRow}>
                      <input
                        type="checkbox" checked={memberSelection.has(a.id)}
                        onChange={e => {
                          setMemberSelection(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(a.id); else next.delete(a.id)
                            return next
                          })
                        }}
                      />
                      <span style={{ fontSize: 14, color: 'var(--text)' }}>{a.prenom} {a.nom}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>{a.email}</span>
                    </label>
                  )) : <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Aucun athlete</div>}
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  const allChecked = athletes.every(a => memberSelection.has(a.id))
                  setMemberSelection(allChecked ? new Set() : new Set(athletes.map(a => a.id)))
                }} style={{ marginTop: 8, fontSize: 12 }}>
                  <i className="fas fa-check-double" /> Tout selectionner / deselectionner
                </Button>
              </div>
            )}
            <Button variant="red" onClick={saveMembers} style={{ marginTop: 8 }}>
              <i className="fas fa-check" /> Enregistrer
            </Button>
          </div>
        </Modal>
      </>
    )
  }

  // ── Grid View ──
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Formation</h1>
        <Button variant="red" onClick={openCreateModal}><i className="fas fa-plus" /> Nouvelle formation</Button>
      </div>

      {!formations.length ? (
        <EmptyState
          icon="fas fa-graduation-cap"
          message="Aucune formation creee"
          action={<Button variant="red" onClick={openCreateModal}><i className="fas fa-plus" /> Nouvelle formation</Button>}
        />
      ) : (
        <div className={styles.fmGrid}>
          {formations.map(f => {
            const audienceLabel = f.visibility === 'selected'
              ? `${memberCounts[f.id] || 0} athlete${(memberCounts[f.id] || 0) > 1 ? 's' : ''}`
              : 'Tous les athletes'
            return (
              <div key={f.id} className={styles.fmCard} onClick={() => viewFormation(f.id)}>
                <div className={styles.fmCardIcon}><i className="fas fa-play-circle" /></div>
                <div className={styles.fmCardBody}>
                  <div className={styles.fmCardTitle}>{f.title}</div>
                  {f.description && <div className={styles.fmCardDesc}>{f.description}</div>}
                  <div className={styles.fmCardMeta}>
                    <span>{f.video_count || 0} video{(f.video_count || 0) > 1 ? 's' : ''}</span>
                    <span><i className={`fas ${f.visibility === 'selected' ? 'fa-user-check' : 'fa-users'}`} /> {audienceLabel}</span>
                  </div>
                </div>
                <button
                  className={styles.fmCardDel}
                  onClick={e => { e.stopPropagation(); deleteFormation(f.id, f.title) }}
                  title="Supprimer"
                >
                  <i className="fas fa-trash" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Formation Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle formation">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
          <div>
            <label className="field-label">Nom de la formation *</label>
            <input type="text" className="field-input" placeholder="Ex: Programme debutant" value={createTitle} onChange={e => setCreateTitle(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea className="field-input" rows={2} placeholder="Optionnel" value={createDesc} onChange={e => setCreateDesc(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Acces</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                className="btn btn-outline"
                style={createVis === 'all' ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : undefined}
                onClick={() => setCreateVis('all')}
              >
                <i className="fas fa-users" /> Tous les athletes
              </button>
              <button
                className="btn btn-outline"
                style={createVis === 'selected' ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : undefined}
                onClick={() => setCreateVis('selected')}
              >
                <i className="fas fa-user-check" /> Selection
              </button>
            </div>
          </div>
          {createVis === 'selected' && (
            <div>
              <label className="field-label">Athletes</label>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginTop: 4 }}>
                {athletes.length ? athletes.map(a => (
                  <label key={a.id} className={styles.fmAthleteRow}>
                    <input
                      type="checkbox" checked={selectedAthletes.has(a.id)}
                      onChange={e => {
                        setSelectedAthletes(prev => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(a.id); else next.delete(a.id)
                          return next
                        })
                      }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--text)' }}>{a.prenom} {a.nom}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>{a.email}</span>
                  </label>
                )) : <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Aucun athlete</div>}
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                const allChecked = athletes.every(a => selectedAthletes.has(a.id))
                setSelectedAthletes(allChecked ? new Set() : new Set(athletes.map(a => a.id)))
              }} style={{ marginTop: 8, fontSize: 12 }}>
                <i className="fas fa-check-double" /> Tout selectionner / deselectionner
              </Button>
            </div>
          )}
          <Button variant="red" onClick={submitCreate} style={{ marginTop: 8 }}>
            <i className="fas fa-check" /> Creer la formation
          </Button>
        </div>
      </Modal>
    </>
  )
}
