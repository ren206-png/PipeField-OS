create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  role text not null,
  signer_name text not null,
  signer_title text,
  signature_data text not null,
  signed_at timestamptz not null default now(),
  signed_by uuid references auth.users(id)
);
create index on signatures(record_type, record_id);
alter table signatures enable row level security;
create policy "org members can manage signatures"
  on signatures for all using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );
