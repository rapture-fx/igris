'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTasks } from '@/hooks/useTasks';
import { buildActions } from '@/lib/actions';
import { getRelativeTime, truncateText } from '@/utils/helpers';

const BASE = 'https://api.igrisinertial.com';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="h-7 rounded-md border border-white/[0.06] bg-white/[0.04] px-2.5 text-[11px] text-[#c8c7be] hover:bg-white/[0.06]"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-3 py-2" style={{ gridTemplateColumns: '110px 1fr' }}>
      <span className="text-[12px] text-[#7a7a72]">{label}</span>
      <div className="text-[12.5px] text-[#d3d2c8]">{value}</div>
    </div>
  );
}

function ActionDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data, isLoading: loading } = useTasks({ limit: 100 });
  const tasks = useMemo(() => data?.tasks ?? [], [data?.tasks]);
  const actions = useMemo(() => buildActions(tasks), [tasks]);
  const action = actions.find((item) => item.id === params.id);
  const tab = searchParams?.get('tab') || 'overview';
  const hrefForTab = (next: string) => `/actions/${params.id}?tab=${next}`;
  const endpoint = `${BASE}/v1/actions/run`;
  const code = `await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer $IGRIS_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    action: "${action?.name ?? 'your_action'}",
    runtime_target: "http_request",
    input: { url: "https://api.example.com/action" }
  })
});`;
  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[960px] px-8 py-10">
          <Link href="/actions" className="mb-4 inline-flex text-[11.5px] text-[#7a7a72] hover:text-[#d3d2c8]">← Actions</Link>
          {loading ? (
            <div className="text-[12px] text-[#7a7a72]">Loading action...</div>
          ) : !action ? (
            <div className="rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015] p-8 text-center text-[12px] text-[#7a7a72]">Action not found in recent runs.</div>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[15px] text-[#f0efe8]" style={{ letterSpacing: '-0.01em' }}>{action.name}</h1>
                  <p className="mt-0.5 text-[12px] text-[#7a7a72]">{action.target}</p>
                </div>
                <Link href="/actions/new" className="inline-flex h-7 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 hover:bg-emerald-500/[0.16]">Run test</Link>
              </div>

              <div className="mb-4 flex flex-wrap gap-1">
                {['overview', 'endpoint', 'target', 'policy', 'secrets', 'runs'].map((item) => (
                  <Link key={item} href={hrefForTab(item)} className={'rounded-md px-3 py-1.5 text-[11.5px] capitalize ' + (tab === item ? 'bg-white/[0.08] text-[#f0efe8]' : 'text-[#8a8a82] hover:bg-white/[0.035]')}>
                    {item}
                  </Link>
                ))}
              </div>

              <section className="rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015] p-4">
                {tab === 'overview' && (
                  <>
                    <Field label="Last run" value={action.lastRun ? <Link className="hover:text-[#f0efe8]" href={`/runs/${encodeURIComponent(action.lastRun.task_id)}`}>{action.lastRun.status.replace(/_/g, ' ')} · {getRelativeTime(action.lastRun.created_at)}</Link> : 'Never'} />
                    <Field label="Target" value={truncateText(action.target, 96)} />
                    <Field label="Policy" value={action.policy} />
                    <Field label="Proof" value={action.proofStatus} />
                  </>
                )}
                {tab === 'endpoint' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                      <code className="flex-1 break-all text-[12px] text-[#d3d2c8]">{endpoint}</code>
                      <CopyButton text={endpoint} />
                    </div>
                    <div className="rounded-md border border-white/[0.06] bg-[#090908] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] text-[#7a7a72]">JavaScript</span>
                        <CopyButton text={code} />
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#c8c7be]">{code}</pre>
                    </div>
                  </div>
                )}
                {tab === 'target' && (
                  <>
                    <Field label="Target" value={action.target} />
                    <Field label="Runtime" value={action.lastRun?.runtime_id || 'Not available'} />
                    <Field label="Boundary" value={action.lastRun?.runtime_boundary?.environment_label || 'Not available'} />
                  </>
                )}
                {tab === 'policy' && (
                  <>
                    <Field label="Decision" value={action.lastRun?.policy?.decision?.replace(/_/g, ' ') || 'Not available'} />
                    <Field label="Risk" value={action.lastRun?.policy?.risk_level || 'Not available'} />
                    <Field label="Reason" value={action.lastRun?.policy?.reason || 'Not available'} />
                  </>
                )}
                {tab === 'secrets' && (
                  <div className="text-[12px] text-[#8a8a82]">Action-specific secrets are managed through Settings → API keys until a stored action definition is returned by the API.</div>
                )}
                {tab === 'runs' && (
                  <div className="space-y-1">
                    {action.runs.map((run) => (
                      <Link key={run.task_id} href={`/runs/${encodeURIComponent(run.task_id)}`} className="flex items-center justify-between rounded-md px-2 py-2 text-[12px] text-[#c8c7be] hover:bg-white/[0.025]">
                        <span>{run.status.replace(/_/g, ' ')}</span>
                        <span className="text-[#7a7a72]">{getRelativeTime(run.created_at)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ActionDetailPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex-1" /></DashboardLayout>}>
      <ActionDetailInner />
    </Suspense>
  );
}
