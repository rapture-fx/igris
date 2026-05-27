'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTasks } from '@/hooks/useTasks';
import { useActionDrafts } from '@/hooks/useActionDrafts';
import { buildActions, buildDraftActions, endpointForAction } from '@/lib/actions';
import { getRelativeTime, truncateText } from '@/utils/helpers';

function CopyButton({ text, onCopy }: { text: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        onCopy?.();
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
    <div className="grid gap-3 py-2" style={{ gridTemplateColumns: '120px 1fr' }}>
      <span className="text-[12px] text-[#7a7a72]">{label}</span>
      <div className="text-[12.5px] text-[#d3d2c8]">{value}</div>
    </div>
  );
}

function snippets(actionName: string, targetUrl: string, method: string) {
  const endpoint = endpointForAction(actionName);
  const curl = `curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer $IGRIS_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"action":"${actionName}","runtime_target":"http_request","input":{"url":"${targetUrl || 'https://example.com/webhook'}","method":"${method || 'POST'}","body":{}}}'`;
  const ts = `await fetch('${endpoint}', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.IGRIS_API_KEY}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: '${actionName}',
    runtime_target: 'http_request',
    input: {
      url: '${targetUrl || 'https://example.com/webhook'}',
      method: '${method || 'POST'}',
      body: input
    }
  })
})`;
  return { endpoint, curl, ts };
}

function ActionDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data, isLoading: loading } = useTasks({ limit: 100 });
  const { drafts, markEndpointCopied } = useActionDrafts();
  const tasks = useMemo(() => data?.tasks ?? [], [data?.tasks]);
  const runActions = useMemo(() => buildActions(tasks), [tasks]);
  const actions = useMemo(() => {
    const names = new Set(runActions.map((action) => action.name));
    return [...buildDraftActions(drafts, names), ...runActions];
  }, [drafts, runActions]);
  const action = actions.find((item) => item.id === params.id);
  const tab = searchParams?.get('tab') || 'overview';
  const hrefForTab = (next: string) => `/actions/${params.id}?tab=${next}`;
  const targetUrl = action?.draft?.targetUrl || (action?.target.startsWith('http') ? action.target : '');
  const method = action?.draft?.method || 'POST';
  const code = snippets(action?.name ?? 'send_email', targetUrl, method);

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[980px] px-8 py-10">
          <Link href="/actions" className="mb-4 inline-flex text-[11.5px] text-[#7a7a72] hover:text-[#d3d2c8]">← Actions</Link>
          {loading ? (
            <div className="text-[12px] text-[#7a7a72]">Loading action...</div>
          ) : !action ? (
            <div className="rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015] p-8 text-center text-[12px] text-[#7a7a72]">Action not found. Create an action draft or run an action first.</div>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[15px] text-[#f0efe8]" style={{ letterSpacing: '-0.01em' }}>
                    {action.name}
                    {action.source === 'draft' && <span className="ml-2 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[#7a7a72]">draft</span>}
                  </h1>
                  <p className="mt-0.5 text-[12px] text-[#7a7a72]">{action.target}</p>
                </div>
                <Link href="/actions/new?step=run" className="inline-flex h-7 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 hover:bg-emerald-500/[0.16]">Run test</Link>
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
                    <Field label="Last run" value={action.lastRun ? <Link className="hover:text-[#f0efe8]" href={`/runs/${encodeURIComponent(action.lastRun.task_id)}`}>{action.lastRun.status.replace(/_/g, ' ')} · {getRelativeTime(action.lastRun.created_at)}</Link> : 'No run yet'} />
                    <Field label="Target" value={truncateText(action.target, 96)} />
                    <Field label="Policy" value={action.policy} />
                    <Field label="Replay" value={action.replayBehavior} />
                    <Field label="Proof" value={action.proofStatus} />
                  </>
                )}
                {tab === 'endpoint' && (
                  <div className="space-y-4">
                    <Field label="What this replaces" value={<code>await {action.name}(input)</code>} />
                    <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                      <code className="flex-1 break-all text-[12px] text-[#d3d2c8]">POST {code.endpoint}</code>
                      <CopyButton text={code.endpoint} onCopy={() => action.draft && markEndpointCopied(action.draft.id)} />
                    </div>
                    <div className="rounded-md border border-white/[0.06] bg-[#090908] p-3">
                      <div className="mb-2 flex items-center justify-between"><span className="text-[11px] text-[#7a7a72]">curl</span><CopyButton text={code.curl} /></div>
                      <pre className="overflow-x-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#c8c7be]">{code.curl}</pre>
                    </div>
                    <div className="rounded-md border border-white/[0.06] bg-[#090908] p-3">
                      <div className="mb-2 flex items-center justify-between"><span className="text-[11px] text-[#7a7a72]">TypeScript fetch</span><CopyButton text={code.ts} /></div>
                      <pre className="overflow-x-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#c8c7be]">{code.ts}</pre>
                    </div>
                    <p className="text-[11.5px] text-[#7a7a72]">Backend TODO: add name-scoped `POST /v1/actions/:name/run`. Current supported endpoint accepts the action name in the request body.</p>
                  </div>
                )}
                {tab === 'target' && (
                  <>
                    <Field label="Type" value={action.draft?.targetType?.replace(/_/g, ' ') || 'From last run'} />
                    <Field label="Target" value={action.target || 'Not configured'} />
                    <Field label="Runtime" value={action.lastRun?.runtime_id || (action.draft?.targetType === 'local_runtime' ? 'Local runtime required' : 'Not required')} />
                  </>
                )}
                {tab === 'policy' && (
                  <>
                    <Field label="Preset" value={action.draft?.policyPreset || action.policy} />
                    <Field label="Replay" value={action.replayBehavior} />
                    <Field label="Approval" value={action.draft?.approvalRequired ? 'Required' : action.lastRun?.policy?.human_gated ? 'Required' : 'Not required'} />
                  </>
                )}
                {tab === 'secrets' && (
                  <div className="space-y-2 text-[12px] text-[#8a8a82]">
                    <p>Action-specific secrets are not backed by an action registry yet.</p>
                    <Link href="/settings/keys" className="inline-flex h-7 items-center rounded-md border border-white/[0.06] bg-white/[0.04] px-2.5 text-[11.5px] text-[#c8c7be] hover:bg-white/[0.06]">Open global API keys</Link>
                  </div>
                )}
                {tab === 'runs' && (
                  <div className="space-y-1">
                    {action.runs.length === 0 ? (
                      <div className="py-4 text-[12px] text-[#7a7a72]">No run yet. Run a test action to inspect policy, recovery, and proof.</div>
                    ) : action.runs.map((run) => (
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
