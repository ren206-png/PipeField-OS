-- ============================================================
-- Fix: projects table schema corrections
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Make project_number nullable (it was NOT NULL which broke the form)
ALTER TABLE public.projects
  ALTER COLUMN project_number DROP NOT NULL;

-- 2. Drop the unique constraint on project_number so blank is allowed
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_organization_id_project_number_key;

-- 3. Fix the status check — add 'completed' and 'cancelled' values
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('planning','active','on_hold','completed','complete','cancelled','archived'));
