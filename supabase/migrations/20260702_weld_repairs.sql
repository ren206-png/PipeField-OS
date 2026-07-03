create table if not exists weld_repairs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  weld_id           uuid not null references welds(id) on delete cascade,
  repair_number     integer not null default 1, -- 1st repair, 2nd repair, etc.
  failure_mode      text,                        -- crack, porosity, undercut, incomplete fusion, etc.
  repair_method     text,                        -- grind-and-weld, back-gouge, etc.
  authorized_by     text,                        -- name of QC engineer who authorized
  repair_welder_stamp text,                      -- welder who did the repair
  repair_welder_name  text,
  repair_date       date,
  re_inspection_type text,                       -- RT, UT, MT, PT
  re_inspection_result text,                     -- pass, fail, pending
  re_inspection_date date,
  notes             text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists weld_repairs_weld_idx on weld_repairs(weld_id);
create index if not exists weld_repairs_org_idx  on weld_repairs(organization_id);
