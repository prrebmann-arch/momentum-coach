'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Q_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'text', label: 'Texte libre', icon: 'fa-align-left' },
  { value: 'choice', label: 'Choix multiples', icon: 'fa-list-ul' },
  { value: 'rating', label: 'Note (1-10)', icon: 'fa-star' },
  { value: 'yesno', label: 'Oui / Non', icon: 'fa-toggle-on' },
  { value: 'photo', label: 'Photo', icon: 'fa-image' },
]

export const PHOTO_POSITIONS = [
  { value: 'front', label: 'Face' },
  { value: 'side', label: 'Profil' },
  { value: 'back', label: 'Dos' },
  { value: 'other', label: 'Autre' },
]

export function isPhotoAnswer(answer: unknown): answer is string {
  if (typeof answer !== 'string' || !answer) return false
  // URL http(s) athlete-photos OU se terminant par une extension image (avec ou sans query)
  if (/^https?:\/\//.test(answer)) {
    return /athlete-photos/.test(answer) || /\.(jpe?g|png|webp)(\?.*)?$/i.test(answer)
  }
  // Path style {uuid}/{date}_{position}.jpg — pas d'espace, pas de retour ligne, finit par .ext
  return /^[\w-]+\/[\w._-]+\.(jpe?g|png|webp)$/i.test(answer)
}

export function PhotoAnswer({ pathOrUrl }: { pathOrUrl: string }) {
  const supabase = createClient()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (/^https?:\/\//.test(pathOrUrl)) {
      setUrl(pathOrUrl)
      return
    }
    ;(async () => {
      const { data } = await supabase.storage
        .from('athlete-photos')
        .createSignedUrl(pathOrUrl, 60 * 60)
      if (!cancelled) setUrl(data?.signedUrl ?? null)
    })()
    return () => { cancelled = true }
  }, [pathOrUrl, supabase])

  if (!url) {
    return <span style={{ color: 'var(--text3)', fontSize: 12 }}>Chargement…</span>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="Photo" style={{ maxWidth: 200, maxHeight: 280, borderRadius: 8, border: '1px solid var(--border)' }} />
    </a>
  )
}

// ── Question + answer row (used inside expanded assignment cards) ──
export function QuestionRow({
  index,
  question,
  typeIcon,
  answer,
  hasResponse,
}: {
  index: number
  question: any
  typeIcon: string
  answer: any | undefined
  hasResponse: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr',
        gap: 12,
        padding: '12px 14px',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'var(--bg3)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: 'var(--text2)',
          fontWeight: 800,
          fontSize: 13,
          position: 'relative',
        }}
        title={`Question #${index}`}
      >
        {index}
        <i
          className={`fa-solid ${typeIcon}`}
          style={{
            position: 'absolute',
            bottom: -6,
            right: -6,
            fontSize: 9,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            width: 16,
            height: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text2)',
          }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.4,
            marginBottom: hasResponse ? 8 : 0,
          }}
        >
          {question.label || '(sans label)'}
          {question.required && (
            <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 4, fontWeight: 700 }}>*</span>
          )}
        </div>
        {hasResponse && <AnswerCell question={question} answer={answer} />}
      </div>
    </div>
  )
}

export function AnswerCell({ question, answer }: { question: any; answer: any | undefined }) {
  if (!answer) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'rgba(148, 163, 184, 0.1)',
          color: 'var(--text2)',
          borderRadius: 8,
          fontSize: 12,
          fontStyle: 'italic',
        }}
      >
        <i className="fa-solid fa-minus" style={{ fontSize: 10 }} />
        Pas de réponse
      </div>
    )
  }

  const val = answer.answer

  if (question.type === 'photo' && isPhotoAnswer(val)) {
    return <PhotoAnswer pathOrUrl={val} />
  }

  if (question.type === 'yesno') {
    const isYes = !!val
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          background: isYes ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: isYes ? '#22c55e' : '#ef4444',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <i className={`fa-solid ${isYes ? 'fa-check' : 'fa-xmark'}`} />
        {isYes ? 'Oui' : 'Non'}
      </div>
    )
  }

  if (question.type === 'rating') {
    const num = typeof val === 'number' ? val : parseInt(String(val), 10) || 0
    const pct = Math.max(0, Math.min(100, (num / 10) * 100))
    const color = num >= 7 ? '#22c55e' : num >= 4 ? '#eab308' : '#ef4444'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1, minWidth: 48 }}>
          {num}
          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>/10</span>
        </span>
        <div
          style={{
            flex: 1,
            maxWidth: 200,
            height: 6,
            background: 'var(--bg3)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s ease' }} />
        </div>
      </div>
    )
  }

  if (question.type === 'choice') {
    const items = Array.isArray(val) ? val : [val]
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.filter(Boolean).map((it, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <i className="fa-solid fa-circle-check" style={{ fontSize: 9 }} />
            {String(it)}
          </span>
        ))}
      </div>
    )
  }

  // Default: text answer in a soft container
  return (
    <div
      style={{
        padding: '8px 12px',
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 13.5,
        color: 'var(--text)',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}
    >
      {String(val)}
    </div>
  )
}
