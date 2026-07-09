-- ============================================================
-- INTELLIGENCE ENGINE FOUNDATION — Phase 1
-- Date: 2026-07-08
-- Safe to re-run (idempotent).
--
-- 1. P0-FIX-1  Add 'field_pro' to subscription_tier constraint
-- 2. AI invocations audit log table (org-scoped, RLS-protected)
-- ============================================================

-- ── 1. P0-FIX-1: Add field_pro to subscription_tier constraint ──
-- The CHECK constraint on organizations.subscription_tier did not include
-- 'field_pro', causing Stripe webhook failures for field_pro subscribers.
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_subscription_tier_check
  CHECK (subscription_tier IN (
    'free_trial',
    'starter',
    'professional',
    'enterprise',
    'field_pro'
  ));

-- ── 2. AI Invocations Audit Log ──────────────────────────────────
-- Central audit trail for every Intelligence Engine invocation.
-- Part of the existing audit system (same org-scoping + RLS pattern
-- as audit_logs). Separate table because the schema differs from
-- INSERT/UPDATE/DELETE audit rows.
--
-- Rule: do NOT log raw prompt content containing customer data.
-- Only metadata (capability, model, token counts, latency, status).
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_invocations (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  capability       text        NOT NULL,
  model            text        NOT NULL,
  tokens_used      integer     NOT NULL DEFAULT 0,
  latency_ms       integer     NOT NULL DEFAULT 0,
  flag_state       jsonb       NOT NULL DEFAULT '{}',
  status           text        NOT NULL DEFAULT 'success'
                               CHECK (status IN ('success','error','rate_limited','tier_blocked')),
  error_message    text,
  invoked_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_invocations_org_date
  ON public.ai_invocations(organization_id, invoked_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_invocations_capability
  ON public.ai_invocations(capability);

-- RLS — mirrors the audit_logs policy pattern
ALTER TABLE public.ai_invocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_invocations_org_read"   ON public.ai_invocations;
DROP POLICY IF EXISTS "ai_invocations_org_insert"  ON public.ai_invocations;

-- Org members can read their own org's invocation log
CREATE POLICY "ai_invocations_org_read" ON public.ai_invocations
  FOR SELECT USING (organization_id = public.get_my_org_id());

-- Any org member can insert (engine writes on behalf of the user)
CREATE POLICY "ai_invocations_org_insert" ON public.ai_invocations
  FOR INSERT WITH CHECK (organization_id = public.get_my_org_id());
