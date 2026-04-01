import { redirect } from 'next/navigation'

export default function AthleteDetailPage({ params }: { params: { id: string } }) {
  redirect(`/athletes/${params.id}/apercu`)
}
