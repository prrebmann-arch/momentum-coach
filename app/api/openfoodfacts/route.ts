import { verifyAuth, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 10

// Relai serveur pour Open Food Facts — leur nouvel endpoint de recherche
// (search.openfoodfacts.org) ne renvoie pas de header
// Access-Control-Allow-Origin, donc un fetch direct depuis le navigateur est
// bloqué par CORS (confirmé via curl : preflight OPTIONS répond sans
// access-control-allow-origin). Pas de souci depuis l'app mobile (React
// Native ne applique pas CORS), d'où "ça marche sur tel mais pas web".
// Requête serveur→serveur ici, aucun CORS entre deux backends.
export async function GET(request: Request) {
  try {
    await verifyAuth(request)
  } catch (err) {
    return authErrorResponse(err)
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return Response.json({ hits: [] })

  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=20&langs=fr&fields=product_name,nutriments,brands,code`
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!resp.ok) return Response.json({ error: `OFF HTTP ${resp.status}` }, { status: 502 })
    const data = await resp.json()
    return Response.json(data)
  } catch (e) {
    console.error('[openfoodfacts] fetch failed:', e)
    return Response.json({ error: 'OFF fetch failed' }, { status: 502 })
  }
}
