create table if not exists project_milestones (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  name            text not null,
  description     text,
  planned_date    date,
  actual_date     date,
  status          text not null default 'pending', -- pending, in_progress, complete, delayed
  sort_order      integer default 0,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists milestones_project_idx on project_milestones(project_id);
create index if not exists milestones_org_idx on project_milestones(organization_id);
