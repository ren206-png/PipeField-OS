'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { Activity, Zap, Clock } from 'lucide-react';

interface UsageItem {
  capability: string;
  invocations: number;
  tokens_used: number;
  avg_latency_ms: number;
  last_used: string;
}

interface AiUsageData {
  usage: UsageItem[];
  total_invocations: number;
  total_tokens: number;
  period_days: number;
}

function formatCapability(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="h-20 rounded-lg bg-surface-700" />
        <div className="h-20 rounded-lg bg-surface-700" />
      </div>
      <div className="h-48 rounded-lg bg-surface-700" />
    </div>
  );
}

export function AiUsageWidget() {
  const { data, isLoading, isError } = useQuery<AiUsageData>({
    queryKey: ['ai-usage'],
    queryFn: async () => {
      const res = await apiFetch('/api/ai/usage');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<AiUsageData>;
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl bg-surface-800 p-6">
        <h2 className="mb-4 text-lg font-semibold text-surface-300">AI Usage — Last 30 Days</h2>
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl bg-surface-800 p-6">
        <h2 className="mb-4 text-lg font-semibold text-surface-300">AI Usage — Last 30 Days</h2>
        <p className="text-sm text-red-400">Failed to load usage data. Please try again.</p>
      </div>
    );
  }

  const activeUsage = data.usage.filter((item) => item.invocations > 0);

  return (
    <div className="rounded-xl bg-surface-800 p-6">
      <h2 className="mb-4 text-lg font-semibold text-surface-300">
        AI Usage — Last {data.period_days} Days
      </h2>

      {/* Stat Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 rounded-lg bg-surface-700 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-400/10">
            <Activity className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <p className="text-xs text-surface-400">Total Invocations</p>
            <p className="text-xl font-bold text-surface-100">
              {formatNumber(data.total_invocations)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-surface-700 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-400/10">
            <Zap className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <p className="text-xs text-surface-400">Total Tokens Used</p>
            <p className="text-xl font-bold text-surface-100">
              {formatNumber(data.total_tokens)}
            </p>
          </div>
        </div>
      </div>

      {/* Capability Table / Empty State */}
      {activeUsage.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg bg-surface-700 py-10 text-center">
          <Activity className="mb-3 h-8 w-8 text-surface-500" />
          <p className="text-sm text-surface-400">
            No AI activity yet — start by asking a question or running Welding Guidance
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700 bg-surface-750">
                <th className="px-4 py-3 text-left font-medium text-surface-400">Capability</th>
                <th className="px-4 py-3 text-right font-medium text-surface-400">Invocations</th>
                <th className="px-4 py-3 text-right font-medium text-surface-400">Tokens Used</th>
                <th className="px-4 py-3 text-right font-medium text-surface-400">
                  <span className="flex items-center justify-end gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Last Used
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {activeUsage.map((item) => (
                <tr key={item.capability} className="hover:bg-surface-750 transition-colors">
                  <td className="px-4 py-3 font-medium text-surface-200">
                    {formatCapability(item.capability)}
                  </td>
                  <td className="px-4 py-3 text-right text-surface-300">
                    <span className="inline-flex items-center justify-end gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                      {item.invocations.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-surface-300">
                    {formatNumber(item.tokens_used)}
                  </td>
                  <td className="px-4 py-3 text-right text-surface-400">
                    {formatDate(item.last_used)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
