-- ============================================================
-- PipeField OS — Phase 8 Migrations
-- Run once in Supabase SQL Editor
-- ============================================================

-- ── 1. Welders table ─────────────────────────────────────────
-- Tracks certified welders separate from system users.
-- A welder may not have a login; they just have a stamp + certs.

create table if not exists public.welders (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  full_name        text not null,
  stamp            text not null,           -- e.g. "RK-42"
  email            text,
  phone            text,
  process          text[],                  -- ["SMAW","GTAW","FCAW"]
  position         text[],                  -- ["1G","2G","6G"]
  certification_no text,
  cert_expiry      date,
  is_active        boolean not null default true,
  notes            text,
  created_by       uuid references public.user_profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(organization_id, stamp)
);

alter table public.welders enable row level security;

create policy "welders_select" on public.welders for select
  using (organization_id = public.get_my_org_id());
create policy "welders_insert" on public.welders for insert
  with check (organization_id = public.get_my_org_id());
create policy "welders_update" on public.welders for update
  using (organization_id = public.get_my_org_id());
create policy "welders_delete" on public.welders for delete
  using (organization_id = public.get_my_org_id());

create index if not exists welders_org_idx  on public.welders(organization_id);
create index if not exists welders_stamp_idx on public.welders(organization_id, stamp);

-- ── 2. NDE Inspections table ─────────────────────────────────
-- Non-Destructive Examination results linked to welds.
-- Supports RT, UT, PT, MT, VT inspection types.

create table if not exists public.nde_inspections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  weld_id          uuid not null references public.welds(id) on delete cascade,
  project_id       uuid not null references public.projects(id) on delete cascade,
  inspection_type  text not null check (inspection_type in ('RT','UT','PT','MT','VT','PMI','HT')),
  result           text not null check (result in ('pending','pass','fail','repair','retest')),
  inspector_name   text,
  inspection_date  date,
  report_number    text,
  film_location    text,       -- RT: where film/image is stored
  acceptance_code  text,       -- e.g. "ASME B31.3 Para 341"
  defect_type      text,       -- if fail: "porosity","crack","undercut", etc.
  defect_location  text,       -- e.g. "6 o'clock, 10mm from root"
  repair_weld_id   uuid references public.welds(id),  -- links to the repair weld
  notes            text,
  created_by       uuid references public.user_profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.nde_inspections enable row level security;

create policy "nde_select" on public.nde_inspections for select
  using (organization_id = public.get_my_org_id());
create policy "nde_insert" on public.nde_inspections for insert
  with check (organization_id = public.get_my_org_id());
create policy "nde_update" on public.nde_inspections for update
  using (organization_id = public.get_my_org_id());
create policy "nde_delete" on public.nde_inspections for delete
  using (organization_id = public.get_my_org_id());

create index if not exists nde_org_idx   on public.nde_inspections(organization_id);
create index if not exists nde_weld_idx  on public.nde_inspections(weld_id);
create index if not exists nde_proj_idx  on public.nde_inspections(project_id);

-- ── 3. Done ──────────────────────────────────────────────────
