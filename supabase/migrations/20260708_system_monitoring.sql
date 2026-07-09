-- system_alerts: written by the monitoring cron, read by the admin UI
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type    text        NOT NULL,
  severity      text        NOT NULL CHECK (severity IN ('info','warning','critical')),
  capability    text,
  title         text        NOT NULL,
  body          text        NOT NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  auto_resolved boolean     NOT NULL DEFAULT false,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON public.system_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_type    ON public.system_alerts(alert_type, created_at DESC);

-- capability_overrides: self-healing disables written by cron, checked by intelligence engine
CREATE TABLE IF NOT EXISTS public.capability_overrides (
  capability      text        PRIMARY KEY,
  disabled        boolean     NOT NULL DEFAULT false,
  disabled_reason text,
  disabled_at     timestamptz,
  auto_disabled   boolean     NOT NULL DEFAULT false,
  re_enabled_at   timestamptz
);

-- Helper SQL function for anomaly detection
CREATE OR REPLACE FUNCTION public.get_ai_error_rate(
  p_capability    text,
  p_window_start  timestamptz,
  p_window_end    timestamptz
) RETURNS TABLE (total bigint, errors bigint, error_rate numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE status = 'error')::bigint AS errors,
    CASE WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(COUNT(*) FILTER (WHERE status = 'error')::numeric / COUNT(*)::numeric * 100, 2)
    END AS error_rate
  FROM public.ai_invocations
  WHERE capability = p_capability
    AND invoked_at BETWEEN p_window_start AND p_window_end;
$$;
