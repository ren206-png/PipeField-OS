-- ============================================================
-- Weld Photos
-- Stores metadata for photos attached to weld records.
-- Actual files live in Supabase Storage.
--
-- STORAGE SETUP (manual step):
--   Create a bucket named "weld-photos" in the Supabase Dashboard
--   (Storage → New Bucket).
--   Recommended settings:
--     • Public bucket: true  (so public URLs work without signed URLs)
--     • File size limit: 10485760  (10 MB)
--     • Allowed MIME types: image/jpeg, image/png, image/webp, image/heic
-- ============================================================

create table if not exists weld_photos (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  weld_id         uuid        not null references welds(id) on delete cascade,
  storage_path    text        not null, -- path in Supabase Storage bucket "weld-photos"
  file_name       text        not null,
  file_size       integer,
  uploaded_by     uuid        references auth.users(id),
  caption         text,
  created_at      timestamptz not null default now()
);

create index on weld_photos(weld_id);
create index on weld_photos(organization_id);

alter table weld_photos enable row level security;

create policy "org members can manage weld photos"
  on weld_photos for all using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );
