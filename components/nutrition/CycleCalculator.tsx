'use client'
import styles from '@/styles/nutrition.module.css'

export type DayMacro = {
  mealType: string
  label: string
  calories: number
  proteines: number
  glucides: number
  lipides: number
}

export function CycleCalculator({
  days,
  counts,
  onChange,
  readOnly = false,
}: {
  days: DayMacro[]
  counts: Record<string, number>
  onChange: (counts: Record<string, number>) => void
  readOnly?: boolean
}) {
  const totalDays = days.reduce((s, d) => s + (counts[d.mealType] || 0), 0)
  const set = (mealType: string, v: string) => {
    const n = Math.max(0, Math.min(31, parseInt(v || '0', 10) || 0))
    onChange({ ...counts, [mealType]: n })
  }
  const avg = (key: 'calories' | 'proteines' | 'glucides' | 'lipides') => {
    if (totalDays === 0) return 0
    const sum = days.reduce((s, d) => s + d[key] * (counts[d.mealType] || 0), 0)
    return Math.round(sum / totalDays)
  }

  return (
    <div className={styles.cycleCalc}>
      <div className={styles.cycleCalcTitle}>Moyenne sur le cycle</div>
      <div className={styles.cycleCalcRows}>
        {days.map((d) => (
          <div key={d.mealType} className={styles.cycleCalcRow}>
            <span className={styles.cycleCalcLabel}>{d.label}</span>
            <input
              type="number"
              min={0}
              max={31}
              className={styles.cycleCalcInput}
              value={counts[d.mealType] ? String(counts[d.mealType]) : ''}
              placeholder="0"
              disabled={readOnly}
              onChange={(e) => set(d.mealType, e.target.value)}
            />
            <span className={styles.cycleCalcUnit}>×/cycle</span>
          </div>
        ))}
      </div>
      <div className={styles.cycleCalcCycleLen}>Cycle : {totalDays} jour{totalDays > 1 ? 's' : ''}</div>
      {totalDays === 0 ? (
        <div className={styles.cycleCalcEmpty}>Réglez la répartition pour voir les moyennes.</div>
      ) : (
        <div className={styles.cycleCalcResults}>
          <div className={styles.cycleCalcResult}><b>{avg('calories')}</b><span>kcal moy.</span></div>
          <div className={styles.cycleCalcResult}><b>{avg('proteines')}g</b><span>Prot. moy.</span></div>
          <div className={styles.cycleCalcResult}><b>{avg('glucides')}g</b><span>Gluc. moy.</span></div>
          <div className={styles.cycleCalcResult}><b>{avg('lipides')}g</b><span>Lip. moy.</span></div>
        </div>
      )}
    </div>
  )
}
