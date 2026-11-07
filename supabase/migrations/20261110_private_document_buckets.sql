-- ============================================================
-- SEC-008: knowledge documents and weld photos are no longer served from
-- public bucket URLs. Apply AFTER the app deploy that ships
-- /api/knowledge/sources/[id]/file and signed weld-photo URLs.
--
-- 1. Point existing knowledge sources at the access-checked download route.
-- 2. Make both buckets private, so old public links stop working.
-- ============================================================

update public.knowledge_sources
set public_url = '/api/knowledge/sources/' || id || '/file'
where public_url is distinct from '/api/knowledge/sources/' || id || '/file';

update storage.buckets
set public = false
where id in ('knowledge-docs', 'weld-photos');

-- Verification (SQL editor):
--   select id, public from storage.buckets where id in ('knowledge-docs', 'weld-photos');
--     → both public = false
