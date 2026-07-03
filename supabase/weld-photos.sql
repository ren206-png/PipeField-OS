-- ============================================================
-- PipeField OS — Weld Photos Table + Supabase Storage
-- Run this in your Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- Weld Photos table — one row per uploaded photo
create table if not exists public.weld_photos (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  weld_id         uuid not null references public.welds(id) on delete cascade,
  storage_path    text not null,   -- path inside the storage bucket
  public_url      text not null,   -- full public URL
  file_name       text not null,
  file_size       integer,         -- bytes
  caption         text,
  uploaded_by     uuid not null references public.user_profiles(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_weld_photos_weld on public.weld_photos(weld_id);

alter table public.weld_photos enable row level security;

create policy "weld_photos_org_isolation" on public.weld_photos
  for all using (organization_id = public.get_my_org_id());

-- ============================================================
-- Supabase Storage — create the weld-photos bucket
-- Run this in Supabase SQL Editor
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'weld-photos',
  'weld-photos',
  true,
  10485760,  -- 10 MB max per file
  array['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
on conflict (id) do nothing;

-- Allow authenticated org members to upload photos
create policy "org_members_upload_weld_photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'weld-photos');

-- Allow authenticated org members to view photos
create policy "org_members_view_weld_photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'weld-photos');

-- Allow uploaders to delete their own photos
create policy "uploaders_delete_weld_photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'weld-photos');
