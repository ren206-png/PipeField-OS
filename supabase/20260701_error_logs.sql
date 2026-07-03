create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  message text not null,
  stack text,
  url text,
  component text,
  severity text default 'error',
  user_id uuid,
  created_at timestamptz default now()
);
create index if not exists error_logs_org_idx on error_logs(organization_id);
create index if not exists error_logs_created_idx on error_logs(created_at desc);
