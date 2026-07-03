-- ============================================================
-- PipeField OS — PostgreSQL Database Schema
-- Run this in your Supabase SQL Editor to create all tables.
-- ============================================================

-- Enable UUID generation (built into Supabase)
create extension if not exists "uuid-ossp";

-- ============================================================
-- ORGANIZATIONS
-- One row per company (e.g. "ABC Mechanical")
-- ============================================================
create table if not exists public.organizations (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  slug                text not null unique,
  logo_url            text,
  subscription_tier   text not null default 'free_trial'
                        check (subscription_tier in ('free_trial','starter','professional','enterprise')),
  subscription_status text not null default 'trialing'
                        check (subscription_status in ('active','trialing','past_due','canceled','paused')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- USER PROFILES
-- Extends Supabase's built-in auth.users table.
-- auth.users holds the email/password login.
-- user_profiles holds role, organization, and field data.
-- ============================================================
create table if not exists public.user_profiles (
  id              uuid primary key default uuid_generate_v4(),
  auth_user_id    uuid not null unique references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,
  full_name       text not null,
  role            text not null default 'pipefitter'
                    check (role in (
                      'administrator','project_manager','foreman',
                      'qa_inspector','shop_fabricator','pipefitter','client_viewer'
                    )),
  avatar_url      text,
  phone           text,
  welder_stamp    text,               -- e.g. "RK-42"
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists public.projects (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  project_number  text not null,
  client_name     text,
  location        text,
  status          text not null default 'planning'
                    check (status in ('planning','active','on_hold','complete','archived')),
  start_date      date,
  end_date        date,
  description     text,
  created_by      uuid not null references public.user_profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, project_number)
);

-- ============================================================
-- SPOOLS
-- A spool = pre-fabricated pipe assembly
-- ============================================================
create table if not exists public.spools (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  spool_number    text not null,
  drawing_number  text,
  area            text,
  line_number     text,
  assigned_crew   text,
  status          text not null default 'in_design'
                    check (status in (
                      'in_design','released_for_fab','in_fab_shop',
                      'quality_review','shipped','in_transit',
                      'on_site_layout','installed','complete'
                    )),
  notes           text,
  created_by      uuid not null references public.user_profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, spool_number)
);

-- ============================================================
-- WELDS
-- Each individual weld joint
-- ============================================================
create table if not exists public.welds (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  spool_id        uuid references public.spools(id) on delete set null,
  weld_id_number  text not null,          -- Human readable, e.g. "W-0001"
  welder_stamp    text,                   -- Certification stamp e.g. "RK-42"
  welder_name     text,
  status          text not null default 'draft'
                    check (status in (
                      'draft','fit_up_approved','welded','visual_pass',
                      'xray_pending','failed','repaired','accepted'
                    )),
  weld_date       date,
  notes           text,
  created_by      uuid not null references public.user_profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, weld_id_number)
);

-- ============================================================
-- AUDIT LOGS
-- Immutable record of every change. Cannot be deleted.
-- ============================================================
create table if not exists public.audit_logs (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references public.organizations(id),
  table_name       text not null,
  record_id        uuid not null,
  action           text not null check (action in ('INSERT','UPDATE','DELETE')),
  previous_values  jsonb,
  new_values       jsonb,
  performed_by     uuid not null references public.user_profiles(id),
  performed_at     timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS (architecture — expand later)
-- ============================================================
create table if not exists public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.user_profiles(id) on delete cascade,
  type            text not null
                    check (type in (
                      'weld_status_change','failed_inspection',
                      'spool_movement','project_alert'
                    )),
  title           text not null,
  message         text not null,
  is_read         boolean not null default false,
  resource_type   text,
  resource_id     uuid,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- INDEXES — for fast lookups
-- ============================================================
create index if not exists idx_user_profiles_org      on public.user_profiles(organization_id);
create index if not exists idx_user_profiles_auth     on public.user_profiles(auth_user_id);
create index if not exists idx_projects_org           on public.projects(organization_id);
create index if not exists idx_spools_org             on public.spools(organization_id);
create index if not exists idx_spools_project         on public.spools(project_id);
create index if not exists idx_welds_org              on public.welds(organization_id);
create index if not exists idx_welds_project          on public.welds(project_id);
create index if not exists idx_welds_spool            on public.welds(spool_id);
create index if not exists idx_audit_logs_org         on public.audit_logs(organization_id);
create index if not exists idx_audit_logs_record      on public.audit_logs(table_name, record_id);
create index if not exists idx_notifications_user     on public.notifications(user_id, is_read);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- This is Supabase's data isolation layer.
-- Users can ONLY see data from their own organization.
-- ============================================================

alter table public.organizations    enable row level security;
alter table public.user_profiles    enable row level security;
alter table public.projects         enable row level security;
alter table public.spools           enable row level security;
alter table public.welds            enable row level security;
alter table public.audit_logs       enable row level security;
alter table public.notifications    enable row level security;

-- Helper function: get current user's organization_id
create or replace function public.get_my_org_id()
returns uuid
language sql
security definer
stable
as $$
  select organization_id
  from public.user_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- Helper function: get current user's role
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
as $$
  select role
  from public.user_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- Organizations: users can only see their own org
create policy "org_isolation" on public.organizations
  for all using (id = public.get_my_org_id());

-- User profiles: users can only see profiles in their org
create policy "profiles_org_isolation" on public.user_profiles
  for select using (organization_id = public.get_my_org_id());

create policy "profiles_self_update" on public.user_profiles
  for update using (auth_user_id = auth.uid());

create policy "profiles_admin_insert" on public.user_profiles
  for insert with check (
    organization_id = public.get_my_org_id()
    and public.get_my_role() in ('administrator','project_manager')
  );

-- Projects: org isolation
create policy "projects_org_isolation" on public.projects
  for all using (organization_id = public.get_my_org_id());

-- Spools: org isolation
create policy "spools_org_isolation" on public.spools
  for all using (organization_id = public.get_my_org_id());

-- Welds: org isolation
create policy "welds_org_isolation" on public.welds
  for all using (organization_id = public.get_my_org_id());

-- Audit logs: read-only for authorized roles
create policy "audit_read" on public.audit_logs
  for select using (
    organization_id = public.get_my_org_id()
    and public.get_my_role() in ('administrator','project_manager','qa_inspector')
  );

create policy "audit_insert" on public.audit_logs
  for insert with check (organization_id = public.get_my_org_id());

-- Notifications: users see only their own
create policy "notifications_own" on public.notifications
  for all using (
    organization_id = public.get_my_org_id()
    and user_id = (
      select id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
  );

-- ============================================================
-- AUTO-UPDATE updated_at TIMESTAMPS
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_organizations
  before update on public.organizations
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_user_profiles
  before update on public.user_profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_projects
  before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_spools
  before update on public.spools
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_welds
  before update on public.welds
  for each row execute function public.handle_updated_at();
