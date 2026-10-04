import AthleteDetailShell from './AthleteDetailShell'

// Les pages athlète sont 100 % client (données chargées dans le navigateur) :
// le HTML/RSC rendu côté serveur est identique quel que soit l'id. Sans
// generateStaticParams, Next les rendait à la demande via une fonction
// serverless à CHAQUE chargement et changement d'onglet (~200 ms, ~1,2 s à
// froid). [] = ISR : chaque chemin est rendu au 1er accès puis servi depuis
// le cache CDN, et les <Link> peuvent le précharger entièrement.
export function generateStaticParams() {
  return []
}

export default function AthleteDetailLayout({ children }: { children: React.ReactNode }) {
  return <AthleteDetailShell>{children}</AthleteDetailShell>
}
