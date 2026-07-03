-- ============================================================
-- Add Stripe billing columns to organizations
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMPTZ;

-- Index for webhook lookups by customer ID
CREATE INDEX IF NOT EXISTS orgs_stripe_customer_idx
  ON public.organizations(stripe_customer_id);

NOTIFY pgrst, 'reload schema';
