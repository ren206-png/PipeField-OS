-- ============================================================
-- Migration 016 — Field Pro Plan
-- Run in Supabase Dashboard → SQL Editor → New query
--
-- What this does:
--   1. Adds 'field_pro' to the subscription_tier CHECK constraint
--   2. Adds seat_limit column (nullable = no limit; 1 = field_pro cap)
--   3. Adds a CHECK constraint: field_pro orgs may not exceed 1 active seat
--   4. Adds a trigger that enforces the seat cap at the DB layer on
--      every INSERT or UPDATE to user_profiles
-- ============================================================

-- ── 1. Extend subscription_tier CHECK constraint ────────────────
-- Postgres does not support ALTER CONSTRAINT — we drop and recreate.

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_subscription_tier_check
    CHECK (subscription_tier IN (
      'free_trial',
      'field_pro',
      'starter',
      'professional',
      'enterprise'
    ));

-- ── 2. Add seat_limit column ─────────────────────────────────────
-- NULL  = no hard cap (all existing plans)
-- 1     = field_pro hard cap

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS seat_limit INTEGER DEFAULT NULL;

-- Set seat_limit = 1 for any existing field_pro orgs (defensive; none exist yet)
UPDATE public.organizations
  SET seat_limit = 1
  WHERE subscription_tier = 'field_pro';

-- ── 3. DB-level function: enforce seat cap ───────────────────────
-- Called by the trigger below. Counts active user_profiles for the
-- org and compares against seat_limit. Raises an exception if exceeded.

CREATE OR REPLACE FUNCTION public.enforce_org_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_seat_limit   INTEGER;
  v_active_seats INTEGER;
BEGIN
  -- Only enforce on INSERT of a new active member, or UPDATE that
  -- activates a previously inactive member.
  IF (TG_OP = 'INSERT' AND NEW.is_active = TRUE)
  OR (TG_OP = 'UPDATE' AND NEW.is_active = TRUE AND (OLD.is_active = FALSE OR OLD.is_active IS NULL))
  THEN
    SELECT seat_limit
      INTO v_seat_limit
      FROM public.organizations
      WHERE id = NEW.organization_id;

    -- NULL seat_limit means no cap — allow immediately
    IF v_seat_limit IS NULL THEN
      RETURN NEW;
    END IF;

    -- Count currently active seats (excluding the row being inserted/updated)
    SELECT COUNT(*)
      INTO v_active_seats
      FROM public.user_profiles
      WHERE organization_id = NEW.organization_id
        AND is_active = TRUE
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_active_seats >= v_seat_limit THEN
      RAISE EXCEPTION
        'Seat limit reached: this organization allows a maximum of % active seat(s). '
        'Upgrade to a team plan to add more members.',
        v_seat_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 4. Attach trigger to user_profiles ──────────────────────────

DROP TRIGGER IF EXISTS trg_enforce_seat_limit ON public.user_profiles;

CREATE TRIGGER trg_enforce_seat_limit
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_org_seat_limit();

-- ── 5. Reload PostgREST schema cache ────────────────────────────
NOTIFY pgrst, 'reload schema';
