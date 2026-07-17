-- PC-1: Standardize RLS helper naming
-- schema.sql defines get_my_org_id(). Newer migrations call my_org_id().
-- These aliases make both work without breaking existing migrations.

CREATE OR REPLACE FUNCTION public.my_org_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.get_my_org_id();
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.get_my_role() = 'platform_admin';
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.get_my_role() IN ('admin', 'platform_admin');
$$;
