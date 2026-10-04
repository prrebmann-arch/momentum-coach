// Lecture (sans validation) du token d'accès depuis le cookie de session
// @supabase/ssr : `sb-<ref>-auth-token` ou découpé en `.0`, `.1`…, valeur
// recollée puis préfixée `base64-` (base64url d'un JSON de session).
// Le token retourné n'est PAS vérifié : passer par `supabase.auth.getUser(token)`.
const SESSION_COOKIE_RE = /^sb-[a-z0-9]+-auth-token(\.0)?$/;
const BASE64_PREFIX = 'base64-';

export function accessTokenFromCookies(cookies: { name: string; value: string }[]): string | null {
  const jar = new Map(cookies.map((c) => [c.name, c.value]));
  const first = [...jar.keys()].find((k) => SESSION_COOKIE_RE.test(k));
  if (!first) return null;
  const base = first.replace(/\.0$/, '');
  let raw = jar.get(base) ?? '';
  if (!raw) for (let i = 0; jar.has(`${base}.${i}`); i++) raw += jar.get(`${base}.${i}`);
  try {
    const json = raw.startsWith(BASE64_PREFIX)
      ? Buffer.from(raw.slice(BASE64_PREFIX.length), 'base64url').toString('utf8')
      : raw;
    const token = (JSON.parse(json) as { access_token?: unknown }).access_token;
    return typeof token === 'string' ? token : null;
  } catch {
    return null;
  }
}
