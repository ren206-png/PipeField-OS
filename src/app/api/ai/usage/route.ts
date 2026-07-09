import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req);
  if (authError) return authError;
  if (!caller?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 });

  const supabase = createAdminClient();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from('ai_invocations')
    .select('capability, tokens_used, latency_ms, invoked_at')
    .eq('organization_id', caller.organization_id)
    .gte('invoked_at', since.toISOString())
    .order('invoked_at', { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  // Aggregate in memory by capability
  const capabilityMap = new Map<
    string,
    { invocations: number; tokens_used: number; latency_sum: number; last_used: string }
  >();

  for (const row of rows) {
    const cap = row.capability as string;
    const existing = capabilityMap.get(cap);
    if (existing) {
      existing.invocations += 1;
      existing.tokens_used += row.tokens_used ?? 0;
      existing.latency_sum += row.latency_ms ?? 0;
      if (row.invoked_at > existing.last_used) {
        existing.last_used = row.invoked_at;
      }
    } else {
      capabilityMap.set(cap, {
        invocations: 1,
        tokens_used: row.tokens_used ?? 0,
        latency_sum: row.latency_ms ?? 0,
        last_used: row.invoked_at,
      });
    }
  }

  const usage = Array.from(capabilityMap.entries())
    .map(([capability, agg]) => ({
      capability,
      invocations: agg.invocations,
      tokens_used: agg.tokens_used,
      avg_latency_ms: agg.invocations > 0 ? Math.round(agg.latency_sum / agg.invocations) : 0,
      last_used: agg.last_used,
    }))
    .sort((a, b) => b.invocations - a.invocations);

  const total_invocations = rows.length;
  const total_tokens = rows.reduce((sum, r) => sum + (r.tokens_used ?? 0), 0);

  return NextResponse.json({
    usage,
    total_invocations,
    total_tokens,
    period_days: 30,
  });
}
