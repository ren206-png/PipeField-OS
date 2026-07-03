-- Add certification columns to welders table if they don't exist
alter table welders add column if not exists cert_number text;
alter table welders add column if not exists cert_expiry_date date;
alter table welders add column if not exists cert_type text; -- e.g. 'CWB', 'AWS D1.1', 'ASME IX'
alter table welders add column if not exists cert_processes text[]; -- e.g. ARRAY['SMAW','GTAW']
alter table welders add column if not exists cert_positions text[]; -- e.g. ARRAY['1G','2G','6G']
alter table welders add column if not exists cert_notes text;

-- Welder certifications history table
create table if not exists welder_certifications (
  id uuid primary key default gen_random_uuid(),
  welder_id uuid not null references welders(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  cert_type text not null,
  cert_number text,
  cert_processes text[],
  cert_positions text[],
  issued_date date,
  expiry_date date not null,
  issued_by text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on welder_certifications(welder_id);
create index on welder_certifications(expiry_date);
create index on welder_certifications(organization_id);
alter table welder_certifications enable row level security;
create policy "org members can manage welder certs"
  on welder_certifications for all using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );
