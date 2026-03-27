# AUDIT SECURITE — Suivi des corrections

> Date: 2026-03-27
> Regle d'or: ZERO fonctionnalite cassee

---

## PHASE 0 — Fondation

- [x] **T0.1** Creer `api/_auth.js` — helper auth (verifyAuth, verifyCoach, verifyCronSecret)
- [x] **T0.2** Creer `api/_cors.js` — helper CORS (origins autorisees)
- [x] **T0.3** Ajouter `authFetch()` dans `js/config.js` + MAJ 15 appels fetch dans le frontend
- [x] **T0.4** Ajouter JWT dans `mobile-athlete-build/src/api/subscription.js`

## PHASE 1 — Auth sur tous les endpoints API

- [x] **T1.1** `api/stripe.js` — auth JWT + verification coachId/athleteId + CORS
- [x] **T1.2** `api/ig-messages.js` — verifyCoach(user_id) + CORS
- [x] **T1.3** `api/ig-auth.js` — verifyAuth + CORS
- [x] **T1.4** `api/fb-page-auth.js` — verifyAuth + CORS
- [x] **T1.5** `api/ig-sync-reels.js` — verifyCoach(user_id) + CORS
- [x] **T1.6** `api/ig-sync-stories.js` — verifyCronSecret (GET) + verifyCoach (POST) + CORS
- [x] **T1.7** `api/ig-sync-profile.js` — verifyAuth + CORS
- [x] **T1.8** `api/ig-publish.js` — verifyAuth + CORS
- [x] **T1.9** `api/ig-webhook.js` — suppression token hardcode fallback

## PHASE 2 — Webhook Stripe

- [x] **T2.1** Fix signature bypass — verification par cle webhook du coach via account_id
- [x] **T2.2** Protection replay — check event.id dans stripe_audit_log avant traitement

## PHASE 3 — Validation paiements

- [x] **T3.1** Validation montants serveur dans createCheckout + createPaymentSheet (amount > 0, <= 100k, currency valide)

## PHASE 4 — Cron protege

- [x] **T4.1** `api/stripe-cron.js` — verifyCronSecret obligatoire

## PHASE 5 — Push API

- [x] **T5.1** `api/push.js` — crypto.timingSafeEqual + secret obligatoire

## PHASE 6 — Security headers

- [x] **T6.1** `vercel.json` — X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy

## PHASE 7 — RLS Supabase

- [x] **T7.1** Creer `sql/rls_security_fixes.sql`
  - [x] Fix exercices (condition=true → coach_id = auth.uid())
  - [x] Fix aliments_db (auth.role() → coach_id = auth.uid())
  - [x] Ajout WITH CHECK sur 15 tables
  - [x] Securisation RPC admin_stripe_overview + coach_payment_stats
  - [x] Ajout colonne stripe_webhook_secret
- [ ] **T7.2** Executer le SQL dans Supabase (A FAIRE MANUELLEMENT)

## PHASE 8 — Chiffrement cles Stripe

- [x] **T8.1** Creer `api/_crypto.js` — AES-256-GCM encrypt/decrypt
- [x] **T8.2** MAJ `saveStripeKey` — chiffrement avant upsert
- [x] **T8.3** MAJ `getCoachStripe` + 4 autres usages — dechiffrement apres lecture
- [ ] **T8.4** Script migration cles existantes (A FAIRE APRES config STRIPE_ENCRYPTION_KEY)

## PHASE 9 — Mobile

- [x] **T9.1** Filtre serveur realtime messages (`filter: receiver_id=eq.${userId}`)
- [x] **T9.2** Wrapper console.log dans `__DEV__` — 11 logs wraps dans 7 fichiers
- [x] **T9.3** Remplacer SELECT * par colonnes explicites — 23 queries dans 10 fichiers (athletes.js, tracking.js, bilan.js skips volontaires car donnees dynamiques)

---

## Variables d'environnement a ajouter (Vercel)

| Variable | Description | Commande |
|----------|-------------|----------|
| `CRON_SECRET` | Secret pour proteger les crons | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STRIPE_ENCRYPTION_KEY` | Cle AES-256 pour chiffrer les cles Stripe | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SUPABASE_ANON_KEY` | Cle anon (probablement deja presente) | Dashboard Supabase |
| Verifier `PUSH_SECRET` | Doit etre present | Dashboard Vercel |

## Actions manuelles requises

1. **Executer `sql/rls_security_fixes.sql`** dans Supabase SQL Editor
2. **Ajouter les env vars** dans Vercel Dashboard
3. **Deployer** via `npx vercel --prod`
4. **Tester** le happy path (connexion coach, operations Stripe, messages IG, cron)
5. **Rotater la service_role key** Supabase si elle a ete exposee dans git

---

## AUDIT 2 — Corrections post-deploy (2026-03-27)

### Problemes trouves et corriges

- [x] **decrypt() sans guard STRIPE_ENCRYPTION_KEY** — 4 endroits dans stripe.js crashaient si env var absente. Fix: ajout `process.env.STRIPE_ENCRYPTION_KEY ? decrypt(...) : plaintext`
- [x] **err.message leake au client** — 2 endroits dans stripe.js (saveStripeKey, importSubscriptions). Fix: messages generiques
- [x] **Console.log sans __DEV__** — 9 logs restants dans OnboardingScreen.js, useOnboarding.js, SubscriptionScreen.js. Fix: wraps `if (__DEV__)`

### Verifie OK (pas de probleme)

- [x] Frontend: authFetch fonctionne correctement, headers mergent bien, script order OK
- [x] Webhooks (stripe-webhook.js, ig-webhook.js): pas d'auth JWT ajoutee (correct)
- [x] Crons: verifyCronSecret fonctionne avec le format Bearer
- [x] CORS: preflight OPTIONS gere correctement avant les auth checks
- [x] connect-complete: verifyCoach lit req.query en plus de req.body (OK pour GET)
- [x] push.js: headers X-Push-Secret mergent correctement avec authFetch

### Failles restantes (non critiques)

- [ ] Console.log dans api/ig-auth.js et api/fb-page-auth.js (logs de debug token exchange) — LOW priority, serveur uniquement
- [ ] Console.log dans api/ig-messages.js — LOW priority, serveur uniquement
