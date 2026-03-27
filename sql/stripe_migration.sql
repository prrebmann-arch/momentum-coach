-- ============================================================
-- STRIPE MIGRATION — AthleteFlow
-- Date: 2026-03-26
-- Description: Tables pour Stripe Connect + SaaS + paiements
-- ============================================================

-- 1. COACH PROFILES
-- Profil coach avec config Stripe Connect + SaaS
CREATE TABLE IF NOT EXISTS coach_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  -- Stripe Connect (pour recevoir l'argent des athlètes)
  stripe_account_id TEXT,
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_charges_enabled BOOLEAN DEFAULT FALSE,
  -- Stripe Customer (pour payer le SaaS à Pierre)
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  has_payment_method BOOLEAN DEFAULT FALSE,
  -- Plan SaaS
  plan TEXT DEFAULT 'athlete' CHECK (plan IN ('athlete', 'business')),
  trial_ends_at TIMESTAMPTZ,
  trial_duration_days INTEGER DEFAULT 14,
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_at TIMESTAMPTZ,
  blocked_reason TEXT,
  -- Préférences
  allow_prorata BOOLEAN DEFAULT FALSE,
  currency TEXT DEFAULT 'eur',
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coach_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_read_own_profile" ON coach_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "coach_update_own_profile" ON coach_profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "coach_insert_own_profile" ON coach_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
-- Service role peut tout faire (pour les webhooks + CRON)

-- Trigger auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER coach_profiles_updated_at
  BEFORE UPDATE ON coach_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 2. ATHLETE PAYMENT PLANS
-- Config de paiement par athlète (montant, fréquence, engagement)
CREATE TABLE IF NOT EXISTS athlete_payment_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  athlete_id UUID NOT NULL,
  -- Type
  is_free BOOLEAN DEFAULT FALSE,
  -- Montant
  amount INTEGER NOT NULL DEFAULT 0,          -- en centimes (16000 = 160€)
  currency TEXT DEFAULT 'eur',
  -- Fréquence
  frequency TEXT DEFAULT 'month' CHECK (frequency IN ('once', 'day', 'week', 'month')),
  frequency_interval INTEGER DEFAULT 1,        -- tous les X jours/semaines/mois
  -- Durée
  is_unlimited BOOLEAN DEFAULT TRUE,
  total_payments INTEGER,                      -- NULL si illimité
  payments_completed INTEGER DEFAULT 0,
  -- Engagement
  engagement_months INTEGER DEFAULT 0,         -- 0 = sans engagement
  engagement_start TIMESTAMPTZ,
  engagement_end TIMESTAMPTZ,                  -- calculé auto
  -- Stripe
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  stripe_customer_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'active', 'past_due', 'canceled', 'completed', 'free')),
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, athlete_id)
);

ALTER TABLE athlete_payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_all_own_plans" ON athlete_payment_plans
  FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "athlete_read_own_plan" ON athlete_payment_plans
  FOR SELECT USING (athlete_id IN (
    SELECT id FROM athletes WHERE user_id = auth.uid()
  ));

CREATE TRIGGER athlete_payment_plans_updated_at
  BEFORE UPDATE ON athlete_payment_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 3. STRIPE CUSTOMERS (athlètes abonnés chez un coach)
CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT,
  coach_stripe_account_id TEXT,               -- compte Connect du coach
  coach_id UUID NOT NULL,
  athlete_id UUID NOT NULL,
  -- Status
  subscription_status TEXT DEFAULT 'active',
  monthly_amount INTEGER,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_all_own_customers" ON stripe_customers
  FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "athlete_read_own_sub" ON stripe_customers
  FOR SELECT USING (athlete_id IN (
    SELECT id FROM athletes WHERE user_id = auth.uid()
  ));

CREATE TRIGGER stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 4. PAYMENT HISTORY
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_customer_id TEXT,
  coach_id UUID,
  athlete_id UUID,
  amount INTEGER NOT NULL,                     -- en centimes
  currency TEXT DEFAULT 'eur',
  status TEXT NOT NULL,                        -- 'succeeded' | 'failed'
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  is_platform_payment BOOLEAN DEFAULT FALSE,   -- true = coach paie Pierre
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_read_own_payments" ON payment_history
  FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY "athlete_read_own_payments" ON payment_history
  FOR SELECT USING (athlete_id IN (
    SELECT id FROM athletes WHERE user_id = auth.uid()
  ));


-- 5. ATHLETE ACTIVITY LOG (pour le prorata journalier)
CREATE TABLE IF NOT EXISTS athlete_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  athlete_id UUID NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('added', 'removed')),
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE athlete_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_all_own_activity" ON athlete_activity_log
  FOR ALL USING (coach_id = auth.uid());


-- 6. PLATFORM INVOICES (facturation SaaS coach → Pierre)
CREATE TABLE IF NOT EXISTS platform_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  -- Période
  month INTEGER NOT NULL,                      -- 1-12
  year INTEGER NOT NULL,
  -- Calcul
  athlete_count INTEGER DEFAULT 0,
  athlete_days_detail JSONB,                   -- [{athlete_id, name, days, cost}, ...]
  athlete_total INTEGER DEFAULT 0,             -- en centimes
  business_fee INTEGER DEFAULT 0,              -- 6000 si business, 0 sinon
  total_amount INTEGER NOT NULL,               -- athlete_total + business_fee
  -- Paiement
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'retry_1', 'retry_2', 'retry_3', 'blocked')),
  paid_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, month, year)                -- IDEMPOTENCY : impossible de facturer 2x
);

ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_read_own_invoices" ON platform_invoices
  FOR SELECT USING (coach_id = auth.uid());


-- 7. CANCELLATION REQUESTS
CREATE TABLE IF NOT EXISTS cancellation_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL,
  coach_id UUID NOT NULL,
  payment_plan_id UUID REFERENCES athlete_payment_plans(id),
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused', 'blocked_engaged')),
  -- Engagement info
  was_engaged BOOLEAN DEFAULT FALSE,
  engagement_end_date TIMESTAMPTZ,
  -- Coach response
  coach_response_at TIMESTAMPTZ,
  coach_note TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_all_own_requests" ON cancellation_requests
  FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "athlete_read_own_requests" ON cancellation_requests
  FOR SELECT USING (athlete_id IN (
    SELECT id FROM athletes WHERE user_id = auth.uid()
  ));
CREATE POLICY "athlete_create_request" ON cancellation_requests
  FOR INSERT WITH CHECK (athlete_id IN (
    SELECT id FROM athletes WHERE user_id = auth.uid()
  ));


-- 8. STRIPE AUDIT LOG (sécurité)
CREATE TABLE IF NOT EXISTS stripe_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,                        -- 'checkout_created', 'webhook_received', 'invoice_created', etc.
  actor_id UUID,                               -- coach ou system
  actor_type TEXT DEFAULT 'system',            -- 'coach', 'athlete', 'system', 'cron'
  target_id UUID,                              -- athlete ou coach cible
  stripe_event_id TEXT,
  amount INTEGER,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pas de RLS — accessible uniquement via service_role
-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON stripe_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON stripe_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON stripe_audit_log(created_at DESC);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_coach_profiles_user ON coach_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_profiles_stripe_account ON coach_profiles(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_coach_profiles_stripe_customer ON coach_profiles(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_payment_plans_coach ON athlete_payment_plans(coach_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_athlete ON athlete_payment_plans(athlete_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON athlete_payment_plans(payment_status);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_coach ON stripe_customers(coach_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_athlete ON stripe_customers(athlete_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_sub ON stripe_customers(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_payment_history_coach ON payment_history(coach_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_athlete ON payment_history(athlete_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_created ON payment_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_coach ON athlete_activity_log(coach_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_athlete ON athlete_activity_log(athlete_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_date ON athlete_activity_log(event_date);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_coach ON platform_invoices(coach_id);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_status ON platform_invoices(status);

CREATE INDEX IF NOT EXISTS idx_cancellation_coach ON cancellation_requests(coach_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_athlete ON cancellation_requests(athlete_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_status ON cancellation_requests(status);


-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Admin: vue globale des paiements plateforme
CREATE OR REPLACE FUNCTION admin_stripe_overview()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_coaches', (SELECT COUNT(*) FROM coach_profiles),
    'coaches_with_connect', (SELECT COUNT(*) FROM coach_profiles WHERE stripe_onboarding_complete = true),
    'coaches_with_payment', (SELECT COUNT(*) FROM coach_profiles WHERE has_payment_method = true),
    'coaches_blocked', (SELECT COUNT(*) FROM coach_profiles WHERE is_blocked = true),
    'total_athletes_paying', (SELECT COUNT(*) FROM athlete_payment_plans WHERE payment_status = 'active' AND is_free = false),
    'total_athletes_free', (SELECT COUNT(*) FROM athlete_payment_plans WHERE is_free = true),
    'platform_mrr', (
      SELECT COALESCE(SUM(total_amount), 0) FROM platform_invoices
      WHERE status = 'paid'
      AND month = EXTRACT(MONTH FROM NOW())::int
      AND year = EXTRACT(YEAR FROM NOW())::int
    ),
    'platform_total_revenue', (
      SELECT COALESCE(SUM(total_amount), 0) FROM platform_invoices WHERE status = 'paid'
    ),
    'pending_invoices', (SELECT COUNT(*) FROM platform_invoices WHERE status IN ('failed', 'retry_1', 'retry_2', 'retry_3')),
    'pending_cancellations', (SELECT COUNT(*) FROM cancellation_requests WHERE status = 'pending'),
    'coaches', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM (
        SELECT
          cp.user_id,
          cp.display_name,
          cp.email,
          cp.plan,
          cp.stripe_onboarding_complete,
          cp.has_payment_method,
          cp.is_blocked,
          cp.trial_ends_at,
          cp.created_at,
          (SELECT COUNT(*) FROM athlete_payment_plans ap WHERE ap.coach_id = cp.user_id) as athlete_count,
          (SELECT COALESCE(SUM(pi.total_amount), 0) FROM platform_invoices pi WHERE pi.coach_id = cp.user_id AND pi.status = 'paid') as total_paid
        FROM coach_profiles cp
        ORDER BY cp.created_at DESC
      ) c
    ),
    'recent_invoices', (
      SELECT COALESCE(json_agg(row_to_json(i)), '[]'::json) FROM (
        SELECT
          pi.*,
          cp.display_name as coach_name,
          cp.email as coach_email
        FROM platform_invoices pi
        JOIN coach_profiles cp ON cp.user_id = pi.coach_id
        ORDER BY pi.created_at DESC
        LIMIT 50
      ) i
    )
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Coach: ses stats paiement
CREATE OR REPLACE FUNCTION coach_payment_stats(p_coach_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'active_subscriptions', (
      SELECT COUNT(*) FROM athlete_payment_plans
      WHERE coach_id = p_coach_id AND payment_status = 'active'
    ),
    'free_athletes', (
      SELECT COUNT(*) FROM athlete_payment_plans
      WHERE coach_id = p_coach_id AND is_free = true
    ),
    'monthly_revenue', (
      SELECT COALESCE(SUM(amount), 0) FROM athlete_payment_plans
      WHERE coach_id = p_coach_id AND payment_status = 'active' AND is_free = false
      AND frequency = 'month' AND frequency_interval = 1
    ),
    'total_received', (
      SELECT COALESCE(SUM(amount), 0) FROM payment_history
      WHERE coach_id = p_coach_id AND status = 'succeeded' AND is_platform_payment = false
    ),
    'pending_cancellations', (
      SELECT COUNT(*) FROM cancellation_requests
      WHERE coach_id = p_coach_id AND status = 'pending'
    )
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
