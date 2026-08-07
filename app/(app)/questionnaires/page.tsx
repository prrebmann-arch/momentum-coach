'use client'

import dynamic from 'next/dynamic'

const QuestionnairesOverview = dynamic(() => import('@/components/questionnaires/QuestionnairesOverview'), { ssr: false })

export default function QuestionnairesPage() {
  return <QuestionnairesOverview />
}
