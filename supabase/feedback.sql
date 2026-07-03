-- ============================================================
-- Feedback & Ratings
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  category        TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('general','bug','feature','ux','performance','other')),
  comment         TEXT,
  page_url        TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anyone in the org can submit feedback
CREATE POLICY "feedback_insert" ON public.feedback FOR INSERT
  WITH CHECK (true);

-- Only admins can read all feedback
CREATE POLICY "feedback_select" ON public.feedback FOR SELECT
  USING (organization_id = public.get_my_org_id());

-- Indexes
CREATE INDEX IF NOT EXISTS feedback_org_idx    ON public.feedback(organization_id);
CREATE INDEX IF NOT EXISTS feedback_rating_idx ON public.feedback(rating);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback(created_at DESC);

NOTIFY pgrst, 'reload schema';