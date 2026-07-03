-- ============================================================
-- Client Share Links — public shareable portal URLs
-- ============================================================
create table if not exists client_share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade, -- null = all projects
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  label text not null, -- e.g. "Acme Corp — Project Alpha"
  expires_at timestamptz, -- null = never expires
  password_hash text, -- null = no password
  views integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table client_share_links enable row level security;

create index if not exists client_share_links_token_idx on client_share_links(token);

create policy "org members can manage their links"
  on client_share_links for all using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );

create policy "public can read share links by token"
  on client_share_links for select using (true);
