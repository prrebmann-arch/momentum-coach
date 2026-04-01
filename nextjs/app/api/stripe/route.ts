import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
}

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

function errorJson(message: string, status = 400) {
  return json({ error: message }, status)
}

// ---------- POST /api/stripe?action=... ----------
export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')
  const body = await req.json().catch(() => ({}))

  try {
    switch (action) {
      case 'coach-setup':
        return await handleCoachSetup(body)
      case 'connect-start':
        return await handleConnectStart(body)
      case 'connect-dashboard':
        return await handleConnectDashboard(body)
      case 'import-subscriptions':
        return await handleImportSubscriptions(body)
      default:
        return errorJson(`Unknown action: ${action}`)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return errorJson(message, 500)
  }
}

// ---------- GET /api/stripe?action=... ----------
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')

  try {
    switch (action) {
      case 'connect-complete': {
        const coachId = req.nextUrl.searchParams.get('coachId')
        if (!coachId) return errorJson('Missing coachId')
        return await handleConnectComplete(coachId)
      }
      default:
        return errorJson(`Unknown action: ${action}`)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return errorJson(message, 500)
  }
}

// ---- Handlers ----

async function handleCoachSetup(body: Record<string, string>) {
  const stripe = getStripe()
  const { coachId, email } = body
  if (!coachId || !email) return errorJson('Missing coachId or email')

  // Find or create Stripe customer
  const customers = await stripe.customers.list({ email, limit: 1 })
  let customer = customers.data[0]
  if (!customer) {
    customer = await stripe.customers.create({ email, metadata: { coachId } })
  }

  // Create SetupIntent
  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method_types: ['card'],
    metadata: { coachId },
  })

  return json({
    clientSecret: setupIntent.client_secret,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  })
}

async function handleConnectStart(body: Record<string, string>) {
  const stripe = getStripe()
  const { coachId, email } = body
  if (!coachId) return errorJson('Missing coachId')

  // Check if account already exists
  const { data: profile } = await getSupabaseAdmin()
    .from('coach_profiles')
    .select('stripe_account_id')
    .eq('user_id', coachId)
    .single()

  let accountId = profile?.stripe_account_id

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      metadata: { coachId },
    })
    accountId = account.id
    await getSupabaseAdmin()
      .from('coach_profiles')
      .update({ stripe_account_id: accountId })
      .eq('user_id', coachId)
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile?connect=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile?connect=complete`,
    type: 'account_onboarding',
  })

  return json({ url: accountLink.url })
}

async function handleConnectComplete(coachId: string) {
  const stripe = getStripe()
  const { data: profile } = await getSupabaseAdmin()
    .from('coach_profiles')
    .select('stripe_account_id')
    .eq('user_id', coachId)
    .single()

  if (!profile?.stripe_account_id) {
    return json({ connected: false })
  }

  const account = await stripe.accounts.retrieve(profile.stripe_account_id)

  if (account.details_submitted && account.charges_enabled) {
    await getSupabaseAdmin()
      .from('coach_profiles')
      .update({
        stripe_onboarding_complete: true,
        stripe_charges_enabled: true,
      })
      .eq('user_id', coachId)
    return json({ connected: true })
  }

  return json({ connected: false, details_submitted: account.details_submitted })
}

async function handleConnectDashboard(body: Record<string, string>) {
  const stripe = getStripe()
  const { coachId } = body
  if (!coachId) return errorJson('Missing coachId')

  const { data: profile } = await getSupabaseAdmin()
    .from('coach_profiles')
    .select('stripe_account_id')
    .eq('user_id', coachId)
    .single()

  if (!profile?.stripe_account_id) return errorJson('No Stripe account')

  const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id)
  return json({ url: loginLink.url })
}

async function handleImportSubscriptions(body: Record<string, string>) {
  const stripe = getStripe()
  const { coachId } = body
  if (!coachId) return errorJson('Missing coachId')

  const { data: profile } = await getSupabaseAdmin()
    .from('coach_profiles')
    .select('stripe_account_id')
    .eq('user_id', coachId)
    .single()

  if (!profile?.stripe_account_id) return errorJson('No Stripe account connected')

  const subscriptions = await stripe.subscriptions.list(
    { status: 'active', limit: 100 },
    { stripeAccount: profile.stripe_account_id },
  )

  const results = await Promise.all(
    subscriptions.data.map(async (sub) => {
      const customer = typeof sub.customer === 'string'
        ? await stripe.customers.retrieve(sub.customer, { expand: [] }, { stripeAccount: profile.stripe_account_id! })
        : sub.customer

      const item = sub.items.data[0]
      return {
        subscription_id: sub.id,
        customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        customer_email: 'email' in customer ? customer.email : null,
        customer_name: 'name' in customer ? customer.name : null,
        amount: item?.price?.unit_amount || 0,
        currency: item?.price?.currency || 'eur',
        interval: item?.price?.recurring?.interval || 'month',
        interval_count: item?.price?.recurring?.interval_count || 1,
        status: sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      }
    }),
  )

  return json({ subscriptions: results })
}
