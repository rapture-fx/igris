'use client';

/**
 * Runtimes — minimal infrastructure context for the execution workspace.
 *
 * Shows runtime id/label, trust state, last seen, recent executions, recent
 * failures. Each row links to the runtime detail page. No fleet-management
 * widgets. Real data from `useGovernanceRuntimes()`; missing values render
 * as "Not available".
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useGovernanceRuntimes } from '@/hooks/useGovernance';
import { runtimeTrustLabel } from '@/lib/governance';
import { getRelativeTime, truncateText } from '@/utils/helpers';

function trustDot(state?: string): string {
  const label = runtimeTrustLabel(state);
  if (label.tone === 'success') return 'bg-emerald-400';
  if (label.tone === 'warning') return 'bg-amber-400';
  if (label.tone === 'danger') return 'bg-rose-500';
  return 'bg-[#3a3a32]';
}

export default function RuntimesPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useGovernanceRuntimes({ limit: 200 });
  const runtimes = data?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return runtimes;
    return runtimes.filter((r) =>
      [r.runtime_id, r.runtime_label, r.trust_state].some((v) => (v || '').toLowerCase().includes(q)),
    );
  }, [runtimes, search]);

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1040px] px-8 py-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-[15px] text-[#f0efe8]" style={{ letterSpacing: '-0.01em' }}>
                Runtimes
              </h1>
              <p className="text-[12px] text-[#7a7a72] mt-0.5">
                Runtime context for the executions you're inspecting.
              </p>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search runtimes…"
              className="h-7 px-2.5 text-[11.5px] rounded-md bg-white/[0.04] border border-white/[0.06] text-[#e8e7df] placeholder:text-[#5a5a52] outline-none focus:border-white/[0.12] w-56"
            />
          </div>

          <div
            className="rounded-lg border-[0.5px] border-white/[0.06] overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.015)', boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.03)' }}
          >
            <div
              className="grid items-center gap-3 px-4 py-2 border-b border-white/[0.05] text-[10.5px] text-[#7a7a72]"
              style={{ gridTemplateColumns: '1fr 110px 110px 100px 110px' }}
            >
              <span>Runtime</span>
              <span>Trust</span>
              <span className="text-right tabular-nums">Active / recent</span>
              <span className="text-right tabular-nums">Failures</span>
              <span className="text-right">Last seen</span>
            </div>

            {isLoading ? (
              <div className="px-4 py-6 text-[11.5px] text-[#6a6a62]">Loading runtimes…</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-[11.5px] text-[#6a6a62]">No runtimes available.</div>
            ) : (
              filtered.map((r) => {
                const trust = runtimeTrustLabel(r.trust_state);
                return (
                  <Link
                    key={r.runtime_id}
                    href={`/runtimes/${encodeURIComponent(r.runtime_id)}`}
                    className="grid items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.025] transition-colors"
                    style={{ gridTemplateColumns: '1fr 110px 110px 100px 110px' }}
                  >
                    <div className="min-w-0">
                      <div className="text-[12.5px] text-[#e8e7df] truncate" style={{ letterSpacing: '-0.005em' }}>
                        {truncateText(r.runtime_label || r.runtime_id, 36)}
                      </div>
                      <div className="text-[10.5px] text-[#6a6a62] truncate">
                        {truncateText(r.runtime_id, 40)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={'block w-1.5 h-1.5 rounded-full ' + trustDot(r.trust_state)} />
                      <span className="text-[11px] text-[#c8c7be]">{trust.label}</span>
                    </div>
                    <span className="text-[11px] text-[#c8c7be] tabular-nums text-right">
                      {r.active_execution_count} / {r.recent_execution_count}
                    </span>
                    <span className="text-[11px] tabular-nums text-right">
                      <span className={r.failed_verification_count > 0 ? 'text-rose-400/80' : 'text-[#6a6a62]'}>
                        {r.failed_verification_count}
                      </span>
                    </span>
                    <span className="text-[10.5px] text-[#7a7a72] text-right">
                      {r.last_seen ? getRelativeTime(r.last_seen) : 'Not available'}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
