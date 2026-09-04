'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { searchCiqual } from '@/lib/ciqual'
import styles from '@/styles/nutrition.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Aliment {
  id?: string
  nom: string
  calories: number
  proteines: number
  glucides: number
  lipides: number
  coach_id?: string
  source?: 'local' | 'openfoodfacts' | 'ciqual'
}

interface FoodSearchProps {
  /** Called when user clicks an aliment to add it */
  onSelect: (aliment: Aliment) => void
  /** Refresh trigger — increment to reload local DB */
  refreshKey?: number
  /** Called after an OFF/Ciqual aliment is imported into aliments_db, so the
   *  caller can invalidate its own aliments cache (MealEditor.calcFoodMacros
   *  reads from a module-level cache that ignores this component's refreshKey —
   *  without this, macros for a just-imported aliment resolve to 0 until the
   *  next full page reload). */
  onImported?: () => void
}

type Source = 'local' | 'off' | 'both'

export default function FoodSearch({ onSelect, refreshKey, onImported }: FoodSearchProps) {
  const supabase = createClient()
  const { user, accessToken } = useAuth()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [source, setSource] = useState<Source>('both')
  const [localAliments, setLocalAliments] = useState<Aliment[]>([])
  const [offResults, setOffResults] = useState<Aliment[]>([])
  const [offLoading, setOffLoading] = useState(false)
  const [offError, setOffError] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const offTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ciqual (ANSES) — base locale, instantanée, aucune API. Toujours interrogée
  // dès 2 caractères (indépendante du toggle Ma base / OFF / Les deux).
  const ciqualResults: Aliment[] = query.length >= 2 ? searchCiqual(query).slice(0, 30) : []

  // Load local aliments
  const loadLocal = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('aliments_db')
      .select('id, nom, calories, proteines, glucides, lipides, coach_id')
      .order('nom', { ascending: true })
      .limit(1000)
    setLocalAliments((data || []).map((a: any) => ({ ...a, source: 'local' as const })))
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadLocal() }, [loadLocal, refreshKey])

  // OFF search with debounce
  useEffect(() => {
    if ((source === 'off' || source === 'both') && query.length >= 2) {
      if (offTimerRef.current) clearTimeout(offTimerRef.current)
      setOffLoading(true)
      setOffError(false)
      offTimerRef.current = setTimeout(async () => {
        try {
          // Relai serveur (voir app/api/openfoodfacts/route.ts) — l'API OFF
          // ne renvoie pas Access-Control-Allow-Origin, un fetch direct
          // depuis le navigateur est bloqué par CORS (marche sur mobile RN
          // qui n'applique pas CORS, d'où l'écart web/app).
          const url = `/api/openfoodfacts?q=${encodeURIComponent(query)}`
          const resp = await fetch(url, {
            headers: {
              Accept: 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
          })
          if (!resp.ok) throw new Error(`OFF HTTP ${resp.status}`)
          const data = await resp.json()
          if (data.error) throw new Error(data.error)
          const results: Aliment[] = (data.hits || [])
            .filter((p: any) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
            .map((p: any) => {
              const brand = Array.isArray(p.brands) ? p.brands[0] : (p.brands || '')
              // Valeurs pour 100g ici (affichage + cohérent avec Ciqual) — la
              // conversion vers le format "par gramme" attendu par
              // aliments_db se fait dans importToLocal, pas ici.
              return {
                nom: p.product_name + (brand ? ` — ${brand}` : ''),
                calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
                proteines: Math.round(p.nutriments['proteins_100g'] || 0),
                glucides: Math.round(p.nutriments['carbohydrates_100g'] || 0),
                lipides: Math.round(p.nutriments['fat_100g'] || 0),
                source: 'openfoodfacts' as const,
              }
            })
          setOffResults(results)
        } catch (e) {
          // Ne plus avaler l'erreur en silence : afficher un message (l'API OFF
          // tombe régulièrement, et le user croyait "ça ne cherche que ma base").
          console.warn('[FoodSearch] Open Food Facts fetch échoué:', e)
          setOffResults([])
          setOffError(true)
        }
        setOffLoading(false)
      }, 300)
    } else {
      setOffResults([])
      setOffLoading(false)
      setOffError(false)
    }
    return () => { if (offTimerRef.current) clearTimeout(offTimerRef.current) }
  }, [query, source, accessToken])

  // Filter local results
  const q = query.toLowerCase()
  const maxLocal = source === 'both' ? 20 : 40
  const filteredLocal = q
    ? localAliments.filter((a) => a.nom.toLowerCase().includes(q)).slice(0, maxLocal)
    : localAliments.slice(0, maxLocal)

  // Quick add aliment
  async function handleQuickAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const nom = (fd.get('nom') as string)?.trim()
    if (!nom) { toast('Nom obligatoire', 'error'); return }
    const calories = parseFloat(fd.get('calories') as string) || 0
    const proteines = parseFloat(fd.get('proteines') as string) || 0
    const glucides = parseFloat(fd.get('glucides') as string) || 0
    const lipides = parseFloat(fd.get('lipides') as string) || 0

    const { error } = await supabase.from('aliments_db').insert({
      nom, calories, proteines, glucides, lipides, coach_id: user!.id,
    })
    if (error) { toast('Erreur: ' + error.message, 'error'); return }
    toast('Aliment ajoute !', 'success')
    setShowQuickAdd(false)
    loadLocal()
  }

  // Import un aliment OFF/Ciqual dans aliments_db AVANT de l'ajouter au repas.
  // MealEditor.calcFoodMacros résout les macros par nom via un cache qui ne lit
  // que aliments_db — un aliment jamais importé (ou importé mais avec un cache
  // pas rafraîchi) retombe sur le fallback kcal:0/p:0/g:0/l:0 à la sauvegarde.
  // Silencieux (pas de confirm() bloquant) : appelé automatiquement au clic, pas
  // en action explicite "importer".
  //
  // aliments_db stocke les valeurs PAR GRAMME (calcFoodMacros fait
  // a.calories * qte_en_grammes), alors que `a` ici est en valeurs pour 100g
  // (OFF et Ciqual, cohérent avec l'affichage "236 kcal / 100g"). Diviser par
  // 100 seulement à l'écriture DB — stocker le résultat arrondi de la ligne
  // FoodSearch (ex 1g de protéines/100g) écrasait les faibles valeurs à 0.
  async function importToLocal(a: Aliment) {
    const per_g = {
      calories: a.calories / 100,
      proteines: a.proteines / 100,
      glucides: a.glucides / 100,
      lipides: a.lipides / 100,
    }
    const { data: existing } = await supabase
      .from('aliments_db')
      .select('id, nom')
      .eq('coach_id', user!.id)
      .ilike('nom', a.nom)
      .limit(1)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase.from('aliments_db').update(per_g).eq('id', existing.id)
      if (error) { toast('Erreur: ' + error.message, 'error'); return }
    } else {
      const { error } = await supabase.from('aliments_db').insert({
        nom: a.nom, ...per_g, coach_id: user!.id,
      })
      if (error) { toast('Erreur: ' + error.message, 'error'); return }
    }
    loadLocal()
    onImported?.()
  }

  return (
    <div className={styles.foodLibrary}>
      <div className={styles.foodLibraryHeader}>
        <i className="fa-solid fa-apple-whole" style={{ color: 'var(--text3)' }} />
        <span className={styles.foodLibraryTitle}>Bibliotheque d&apos;aliments</span>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          title="Ajouter un aliment"
          style={{ marginLeft: 'auto', padding: '4px 8px' }}
        >
          <i className="fa-solid fa-plus" />
        </button>
      </div>

      {/* Source toggle */}
      <div className={styles.sourceToggle}>
        {(['local', 'off', 'both'] as Source[]).map((s) => (
          <button
            key={s}
            className={`${styles.srcBtn} ${source === s ? styles.srcBtnActive : ''}`}
            onClick={() => setSource(s)}
          >
            <i className={`fa-solid ${s === 'local' ? 'fa-database' : s === 'off' ? 'fa-globe' : 'fa-layer-group'}`} style={{ marginRight: 4 }} />
            {s === 'local' ? 'Ma base' : s === 'off' ? 'OFF' : 'Les deux'}
          </button>
        ))}
      </div>

      {/* Quick add form */}
      {showQuickAdd && (
        <form onSubmit={handleQuickAdd} className={styles.quickAdd}>
          <input name="nom" placeholder="Nom de l'aliment" className={styles.qaInput} required />
          <div className={styles.qaRow}>
            <input name="calories" type="number" placeholder="kcal" className={`${styles.qaInput} ${styles.qaSm}`} step="any" />
            <input name="proteines" type="number" placeholder="P (g)" className={`${styles.qaInput} ${styles.qaSm}`} step="any" />
            <input name="glucides" type="number" placeholder="G (g)" className={`${styles.qaInput} ${styles.qaSm}`} step="any" />
            <input name="lipides" type="number" placeholder="L (g)" className={`${styles.qaInput} ${styles.qaSm}`} step="any" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" className="btn btn-red btn-sm" style={{ flex: 1 }}>
              <i className="fa-solid fa-plus" /> Ajouter
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowQuickAdd(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Search input */}
      <div className={styles.foodLibrarySearch}>
        <i className="fa-solid fa-magnifying-glass" />
        <input
          type="text"
          placeholder="Rechercher un aliment..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Results */}
      <div className={styles.foodLibraryResults}>
        {/* Local */}
        {(source === 'local' || source === 'both') && (
          <>
            {source === 'both' && filteredLocal.length > 0 && (
              <div className={styles.foodLibraryResultsTitle}>Ma base ({filteredLocal.length})</div>
            )}
            {filteredLocal.map((a, i) => (
              <div key={a.id || `local-${i}`} className={styles.libItem} onClick={() => onSelect(a)}>
                <div className={styles.libIcon}>
                  <i className="fa-solid fa-apple-whole" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.libName}>
                    {a.nom}
                    {source === 'both' && <span className={styles.srcBadgeLocal} style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>Local</span>}
                  </div>
                  <div className={styles.libMacros}>
                    {a.calories} kcal / P{a.proteines}g G{a.glucides}g L{a.lipides}g
                  </div>
                </div>
              </div>
            ))}
            {q && filteredLocal.length === 0 && source === 'local' && (
              <div style={{ padding: 12, textAlign: 'center', color: 'var(--text3)', fontSize: 11 }}>Aucun resultat</div>
            )}
          </>
        )}

        {/* OFF */}
        {(source === 'off' || source === 'both') && (
          <>
            {source === 'both' && offResults.length > 0 && (
              <div style={{ margin: '12px 0', textAlign: 'center', fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
                -- Open Food Facts --
              </div>
            )}
            {offLoading && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />
                Recherche Open Food Facts...
              </div>
            )}
            {!offLoading && offResults.map((a, i) => (
              <div key={`off-${i}`} className={styles.libItem} onClick={() => { importToLocal(a); onSelect(a) }}>
                <div className={styles.libIcon} style={{ background: 'rgba(52,152,219,0.12)', color: '#3498db' }}>
                  <i className="fa-solid fa-globe" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.libName}>
                    {a.nom}
                    <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700, background: 'rgba(52,152,219,0.15)', color: '#3498db' }}>OFF</span>
                  </div>
                  <div className={styles.libMacros}>
                    {a.calories} kcal / P{a.proteines}g G{a.glucides}g L{a.lipides}g
                  </div>
                </div>
              </div>
            ))}
            {!offLoading && source === 'off' && q.length < 2 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                Tapez au moins 2 caracteres
              </div>
            )}
            {!offLoading && offError && q.length >= 2 && (
              <div style={{ padding: 12, textAlign: 'center', color: '#e67e22', fontSize: 11 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />
                Open Food Facts indisponible pour le moment
              </div>
            )}
            {!offLoading && !offError && q.length >= 2 && offResults.length === 0 && (source === 'off') && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Aucun resultat OFF</div>
            )}
          </>
        )}

        {/* Ciqual (ANSES) — base locale, toujours affichée dès 2 caractères */}
        {ciqualResults.length > 0 && (
          <>
            <div style={{ margin: '12px 0', textAlign: 'center', fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
              -- Ciqual (ANSES) --
            </div>
            {ciqualResults.map((a, i) => (
              <div key={`ciqual-${i}`} className={styles.libItem} onClick={() => { importToLocal(a); onSelect(a) }}>
                <div className={styles.libIcon} style={{ background: 'rgba(155,89,182,0.12)', color: '#9b59b6' }}>
                  <i className="fa-solid fa-leaf" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.libName}>
                    {a.nom}
                    <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700, background: 'rgba(155,89,182,0.15)', color: '#9b59b6' }}>Ciqual</span>
                  </div>
                  <div className={styles.libMacros}>
                    {a.calories} kcal / P{a.proteines}g G{a.glucides}g L{a.lipides}g
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
