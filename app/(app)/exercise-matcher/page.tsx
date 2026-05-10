'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

type ExoLib = { id: string; nom: string; muscle_principal: string | null; youtube_url: string | null }
type ProgramSession = { id: string; nom: string | null; exercices: string | unknown[] }
type Program = { id: string; nom: string; athlete_id: string; workout_sessions: ProgramSession[] }
type Athlete = { id: string; prenom: string; nom: string }

type ExoInProg = {
  programId: string
  programName: string
  athleteId: string
  athleteLabel: string
  sessionId: string
  sessionName: string
  exoIndex: number
  rawNom: string
  currentExerciceId: string | null
  candidateIds: string[]
  selectedId: string | null
  status: 'ok' | 'auto' | 'ambiguous' | 'unmatched'
  // exo entry kept opaque (we re-parse from session at apply-time to avoid drift)
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalize(s: string): string {
  return stripAccents((s || '').toLowerCase())
    .replace(/[^a-z0-9\s+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstToken(name: string): string {
  // Split on common separators: " ou ", " / ", "(", "+", " - "
  const lower = name.toLowerCase()
  const splitRe = /\s+ou\s+|\s*\/\s*|\s*\(|\s*\+\s*|\s+-\s+/
  const head = lower.split(splitRe)[0] || lower
  return normalize(head)
}

function parseExos(raw: string | unknown[]): Record<string, unknown>[] {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>[]) || []
  } catch {
    return []
  }
}

function findCandidates(exoName: string, lib: ExoLib[], libIndex: { byNorm: Map<string, ExoLib[]> }): string[] {
  const normFull = normalize(exoName)
  // 1. Exact normalized match
  const exact = libIndex.byNorm.get(normFull) || []
  if (exact.length > 0) return exact.map((e) => e.id)

  // 2. First-token match
  const head = firstToken(exoName)
  if (head && head !== normFull) {
    const headExact = libIndex.byNorm.get(head) || []
    if (headExact.length > 0) return headExact.map((e) => e.id)
  }

  // 3. Substring containment: lib.nom is contained in exoName, or vice versa
  const contains = lib.filter((e) => {
    const en = normalize(e.nom)
    if (!en) return false
    return normFull.includes(en) || (en.length >= 6 && en.includes(normFull))
  })
  return contains.map((e) => e.id)
}

export default function ExerciseMatcherPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [exoLib, setExoLib] = useState<ExoLib[]>([])
  const [items, setItems] = useState<ExoInProg[]>([])
  const [filter, setFilter] = useState<'all' | 'unmatched' | 'ambiguous' | 'auto' | 'ok'>('unmatched')
  const [search, setSearch] = useState('')

  const libById = useMemo(() => {
    const m = new Map<string, ExoLib>()
    exoLib.forEach((e) => m.set(e.id, e))
    return m
  }, [exoLib])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      // 1. Coach's exercice library
      const { data: libData, error: libErr } = await supabase
        .from('exercices')
        .select('id, nom, muscle_principal, youtube_url')
        .or(`coach_id.eq.${user.id},coach_id.is.null`)
        .order('nom')
        .limit(2000)
      if (libErr) {
        toast(`Erreur lib: ${libErr.message}`, 'error')
        return
      }
      const lib = (libData || []) as ExoLib[]
      setExoLib(lib)

      // Build normalized index for fast lookup
      const byNorm = new Map<string, ExoLib[]>()
      lib.forEach((e) => {
        const k = normalize(e.nom)
        if (!k) return
        const arr = byNorm.get(k) || []
        arr.push(e)
        byNorm.set(k, arr)
      })
      const libIndex = { byNorm }

      // 2. Coach's athletes
      const { data: athData } = await supabase
        .from('athletes')
        .select('id, prenom, nom')
        .eq('coach_id', user.id)
        .limit(500)
      const athletes = (athData || []) as Athlete[]
      const athById = new Map<string, Athlete>()
      athletes.forEach((a) => athById.set(a.id, a))

      // 3. All workout_programs of coach's athletes (with sessions)
      const athleteIds = athletes.map((a) => a.id)
      if (athleteIds.length === 0) {
        setItems([])
        return
      }
      const { data: progData, error: progErr } = await supabase
        .from('workout_programs')
        .select('id, nom, athlete_id, workout_sessions(id, nom, exercices)')
        .in('athlete_id', athleteIds)
        .limit(1000)
      if (progErr) {
        toast(`Erreur progs: ${progErr.message}`, 'error')
        return
      }
      const progs = (progData || []) as Program[]

      // 4. Walk through every exercise in every session
      const out: ExoInProg[] = []
      progs.forEach((p) => {
        const ath = athById.get(p.athlete_id)
        const athleteLabel = ath ? `${ath.prenom} ${ath.nom}` : '?'
        ;(p.workout_sessions || []).forEach((s) => {
          const exos = parseExos(s.exercices)
          exos.forEach((ex, idx) => {
            const nom = String(ex.nom || '')
            if (!nom) return
            const currentId = ex.exercice_id ? String(ex.exercice_id) : null

            // Already linked AND points to existing lib entry → OK
            if (currentId && libById.get(currentId)) {
              // skip — fully OK
              out.push({
                programId: p.id, programName: p.nom, athleteId: p.athlete_id, athleteLabel,
                sessionId: s.id, sessionName: s.nom || 'Séance',
                exoIndex: idx, rawNom: nom,
                currentExerciceId: currentId,
                candidateIds: [currentId], selectedId: currentId,
                status: 'ok',
              })
              return
            }

            // Need to match — but first re-check: use the index built from the JUST-loaded lib
            const cands = findCandidates(nom, lib, libIndex)
            const status: ExoInProg['status'] =
              cands.length === 0 ? 'unmatched' :
              cands.length === 1 ? 'auto' : 'ambiguous'
            out.push({
              programId: p.id, programName: p.nom, athleteId: p.athlete_id, athleteLabel,
              sessionId: s.id, sessionName: s.nom || 'Séance',
              exoIndex: idx, rawNom: nom,
              currentExerciceId: currentId,
              candidateIds: cands,
              selectedId: cands.length === 1 ? cands[0] : null,
              status,
            })
          })
        })
      })

      setItems(out)
    } finally {
      setLoading(false)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const s = { total: 0, ok: 0, auto: 0, ambiguous: 0, unmatched: 0 }
    items.forEach((it) => { s.total++; s[it.status]++ })
    return s
  }, [items])

  const visible = useMemo(() => {
    let v = items
    if (filter !== 'all') v = v.filter((i) => i.status === filter)
    const q = normalize(search)
    if (q) {
      v = v.filter((i) =>
        normalize(i.rawNom).includes(q) ||
        normalize(i.athleteLabel).includes(q) ||
        normalize(i.programName).includes(q),
      )
    }
    return v
  }, [items, filter, search])

  const setSelected = (key: string, id: string | null) => {
    setItems((prev) => prev.map((it) => {
      const k = `${it.sessionId}-${it.exoIndex}`
      return k === key ? { ...it, selectedId: id } : it
    }))
  }

  const apply = async () => {
    // Group changes per session to do one UPDATE per session
    const toApply = items.filter((it) =>
      it.selectedId && it.selectedId !== it.currentExerciceId
    )
    if (toApply.length === 0) {
      toast('Aucun changement à appliquer')
      return
    }
    if (!confirm(`Appliquer ${toApply.length} match(s) ? Les programmes seront mis à jour.`)) return

    setApplying(true)
    try {
      // Group by sessionId
      const bySession = new Map<string, ExoInProg[]>()
      toApply.forEach((it) => {
        const arr = bySession.get(it.sessionId) || []
        arr.push(it)
        bySession.set(it.sessionId, arr)
      })

      let okCount = 0
      let errCount = 0
      const errors: string[] = []

      for (const [sessionId, changes] of bySession) {
        // Re-fetch the session to avoid stomping concurrent edits
        const { data: sess, error: sErr } = await supabase
          .from('workout_sessions')
          .select('exercices')
          .eq('id', sessionId)
          .single()
        if (sErr || !sess) {
          errCount += changes.length
          errors.push(`session ${sessionId}: ${sErr?.message || 'introuvable'}`)
          continue
        }
        const exos = parseExos(sess.exercices)
        let dirty = false
        changes.forEach((ch) => {
          const ex = exos[ch.exoIndex]
          if (!ex) return
          if (String(ex.nom || '') !== ch.rawNom) {
            // name drifted — skip to be safe
            errors.push(`drift: ${ch.athleteLabel} / ${ch.programName} / ${ch.sessionName} / "${ch.rawNom}" — l'exo a changé, skip`)
            errCount++
            return
          }
          ex.exercice_id = ch.selectedId
          dirty = true
          okCount++
        })
        if (dirty) {
          // exercices column is TEXT (stringified JSON) — see ProgramEditor.tsx:448
          const { error: uErr } = await supabase
            .from('workout_sessions')
            .update({ exercices: JSON.stringify(exos) })
            .eq('id', sessionId)
          if (uErr) {
            errCount += changes.length
            okCount -= changes.length
            errors.push(`update ${sessionId}: ${uErr.message}`)
          }
        }
      }
      if (errCount === 0) {
        toast(`${okCount} match(s) appliqué(s) ✓`, 'success')
      } else {
        console.error('[ExerciseMatcher] errors:', errors)
        toast(`${okCount} OK, ${errCount} échec(s) — voir console`, 'error')
      }
      await load()
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: 'var(--primary)' }} />
        <div style={{ marginTop: 12, color: 'var(--text2)' }}>Scan en cours...</div>
      </div>
    )
  }

  const pendingChanges = items.filter((it) => it.selectedId && it.selectedId !== it.currentExerciceId).length

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Exercise Matcher</h1>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>
            Linke les exos des programmes athlète à ta lib (vidéos). Ne touche ni aux templates ni à la lib.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={load} disabled={applying}>
            <i className="fa-solid fa-arrows-rotate" /> Rescan
          </button>
          <button className="btn btn-red btn-sm" onClick={apply} disabled={applying || pendingChanges === 0}>
            {applying ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Application...</>
            ) : (
              <><i className="fa-solid fa-check" /> Appliquer {pendingChanges > 0 ? `(${pendingChanges})` : ''}</>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard label="Total" value={stats.total} color="var(--text)" />
        <StatCard label="Déjà OK" value={stats.ok} color="var(--success)" active={filter === 'ok'} onClick={() => setFilter('ok')} />
        <StatCard label="Auto" value={stats.auto} color="#3b82f6" active={filter === 'auto'} onClick={() => setFilter('auto')} />
        <StatCard label="Ambigus" value={stats.ambiguous} color="#f59e0b" active={filter === 'ambiguous'} onClick={() => setFilter('ambiguous')} />
        <StatCard label="Non matchés" value={stats.unmatched} color="var(--danger)" active={filter === 'unmatched'} onClick={() => setFilter('unmatched')} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${filter === 'all' ? 'btn-red' : 'btn-outline'}`}
          onClick={() => setFilter('all')}
        >
          Tout
        </button>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (exo / athlète / programme)"
          style={{
            flex: 1, minWidth: 220, padding: '8px 12px',
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13,
          }}
        />
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>{visible.length} affichés</span>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible.map((it) => {
          const key = `${it.sessionId}-${it.exoIndex}`
          const selected = it.selectedId ? libById.get(it.selectedId) : null
          return (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(160px, 1fr) minmax(180px, 1fr) minmax(220px, 2fr)',
                gap: 12, alignItems: 'center',
                padding: '10px 14px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg2)',
              }}
            >
              {/* Athlete + program */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>{it.athleteLabel}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.programName} · {it.sessionName}
                </div>
              </div>

              {/* Exo name + status */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StatusBadge status={it.status} />
                  <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.rawNom}</span>
                </div>
              </div>

              {/* Match selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  value={it.selectedId || ''}
                  onChange={(e) => setSelected(key, e.target.value || null)}
                  style={{
                    flex: 1, padding: '6px 10px',
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13,
                  }}
                >
                  <option value="">— Ne pas linker —</option>
                  {/* Candidate(s) first */}
                  {it.candidateIds.length > 0 && (
                    <optgroup label="Suggestions">
                      {it.candidateIds.map((id) => {
                        const e = libById.get(id)
                        if (!e) return null
                        return <option key={id} value={id}>{e.nom}{e.muscle_principal ? ` · ${e.muscle_principal}` : ''}{e.youtube_url ? ' 🎥' : ''}</option>
                      })}
                    </optgroup>
                  )}
                  <optgroup label="Toute la lib">
                    {exoLib.map((e) => (
                      <option key={e.id} value={e.id}>{e.nom}{e.muscle_principal ? ` · ${e.muscle_principal}` : ''}{e.youtube_url ? ' 🎥' : ''}</option>
                    ))}
                  </optgroup>
                </select>
                {selected?.youtube_url && (
                  <a
                    href={selected.youtube_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Aperçu vidéo"
                    style={{ color: 'var(--primary)', fontSize: 14 }}
                  >
                    <i className="fa-brands fa-youtube" />
                  </a>
                )}
              </div>
            </div>
          )
        })}
        {visible.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
            <i className="fa-solid fa-circle-check fa-2x" style={{ marginBottom: 8, color: 'var(--success)' }} />
            <div>Rien à afficher avec ce filtre.</div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color, active, onClick }: { label: string; value: number; color: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        padding: '10px 12px', borderRadius: 10,
        border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? `${color}22` : 'var(--bg2)',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left', transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </button>
  )
}

function StatusBadge({ status }: { status: ExoInProg['status'] }) {
  const map = {
    ok: { label: 'OK', bg: 'var(--success)' },
    auto: { label: 'AUTO', bg: '#3b82f6' },
    ambiguous: { label: 'AMB.', bg: '#f59e0b' },
    unmatched: { label: 'X', bg: 'var(--danger)' },
  } as const
  const m = map[status]
  return (
    <span style={{
      background: m.bg, color: '#fff',
      fontSize: 9, fontWeight: 700, padding: '2px 6px',
      borderRadius: 4, letterSpacing: '0.04em', flexShrink: 0,
    }}>{m.label}</span>
  )
}
