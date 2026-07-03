create table if not exists wps_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  wps_number      text not null,
  revision        text not null default '0',
  process         text not null,
  base_metal_p_numbers text,
  filler_material text,
  thickness_min_in numeric(6,3),
  thickness_max_in numeric(6,3),
  position        text,
  pwht_required   boolean default false,
  notes           text,
  is_active       boolean default true,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create unique index if not exists wps_records_org_number_rev
  on wps_records(organization_id, wps_number, revision);

create index if not exists wps_records_org_idx
  on wps_records(organization_id);

alter table welds add column if not exists wps_id uuid references wps_records(id) on delete set null;
create index if not exists welds_wps_idx on welds(wps_id);
