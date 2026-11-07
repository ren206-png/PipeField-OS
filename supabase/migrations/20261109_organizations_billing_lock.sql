-- ============================================================
-- SEC-007: billing and ownership columns on organizations are server-only
--
-- organizations_update lets org admins update their org row with no column
-- restriction, so an admin could set subscription_tier = 'enterprise' (or
-- clear a past-due status) directly through the Supabase REST API and skip
-- Stripe. These columns are written only by server routes (service role:
-- Stripe webhook, billing routes, signup) and platform admins.
--
-- Uses to_jsonb() so columns missing on an older schema are simply skipped.
-- Org admins can still edit name, logo, address and other settings.
-- ============================================================

create or replace function public.guard_organization_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  col text;
  locked text[] := array[
    'subscription_tier', 'subscription_status', 'plan',
    'stripe_customer_id', 'stripe_subscription_id',
    'trial_ends_at', 'grace_period_ends_at', 'seat_limit',
    'owner_user_id'
  ];
begin
  -- Server-side writes (service role / migrations / SQL editor) are trusted.
  if auth.uid() is null then
    return new;
  end if;
  if public.is_platform_admin() then
    return new;
  end if;

  foreach col in array locked loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception '% can only be changed through billing', col using errcode = '42501';
    end if;
  end loop;

  return new;
end
$$;

revoke all on function public.guard_organization_billing_columns() from public;

drop trigger if exists trg_guard_organization_billing_columns on public.organizations;
create trigger trg_guard_organization_billing_columns
  before update on public.organizations
  for each row execute function public.guard_organization_billing_columns();

-- ------------------------------------------------------------
-- Verification (SQL editor):
--   select tgname from pg_trigger where tgname = 'trg_guard_organization_billing_columns';
--     → 1 row
-- ------------------------------------------------------------
