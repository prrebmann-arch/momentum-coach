export interface CoachProfile {
  id: string
  user_id: string
  email: string
  display_name: string
  plan: 'athlete' | 'business' | 'free'
  trial_ends_at: string | null
  has_payment_method: boolean
  stripe_account_id?: string
  stripe_secret_key_encrypted?: string
  stripe_publishable_key?: string
  stripe_webhook_secret_encrypted?: string
}

export interface Athlete {
  id: string
  user_id: string | null
  coach_id: string
  first_name: string
  last_name: string
  email: string
  avatar_url?: string
  bilan_frequency: string
  bilan_interval?: number
  bilan_day?: number | number[]
  bilan_anchor_date?: string
  bilan_month_day?: number
  created_at: string
}

export interface User {
  id: string
  email: string
}
