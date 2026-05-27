'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTasks } from '@/hooks/useTasks';
import { useAction, useRunAction } from '@/hooks/useActions';
import { endpointForAction, proofForTask, replayForActionDefinition, targetForActionDefinition } from '@/lib/actions';
import { useToast } from '@/components/ui/use-toast';
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

function snippets(actionName: string) {
  const endpoint = endpointForAction(actionName);
  const curl = `curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer $IGRIS_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"input":{"demo":true}}'`;
  const ts = `await fetch('${endpoint}', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.IGRIS_API_KEY}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ input })
})`;
  return { endpoint, curl, ts };
}

function ActionDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { data: action, isLoading: actionLoading } = useAction(params.id);
  const { data: taskData, isLoading: tasksLoading } = useTasks({ limit: 100 });
  const runMutation = useRunAction(action?.name ?? '');
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  const tasks = useMemo(() => taskData?.tasks ?? [], [taskData?.tasks]);
  const runs = useMemo(() => tasks.filter((task) => task.policy?.action_name === action?.name || task.task_type === action?.name), [tasks, action?.name]);
  const tab = searchParams?.get('tab') || 'overview';
  const hrefForTab = (next: string) => `/actions/${params.id}?tab=${next}`;
  const code = snippets(action?.name ?? 'send_email');
  const target = action ? targetForActionDefinition(action) : '';
  const lastRun = runs[0];
  const loading = actionLoading || tasksLoading;

  const runTest = () => {
    if (!action) return;
    runMutation.mutate({
      input: { demo: true, source: 'console_run_test' },
      metadata: { source: 'console_action_detail' },
    }, {
      onSuccess: (result) => {
        const id = result.run_id || result.task_id;
        setStartedRunId(id ?? null);
        toast({ title: 'Test run started', description: id ? 'Open the run to inspect policy, recovery, and proof.' : 'The action request was accepted.' });
      },
      onError: (error: Error) => {
        toast({ variant: 'destructive', title: 'Test run failed to start', description: error.message });
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[980px] px-8 py-10">
          <Link href="/actions" className="mb-4 inline-flex text-[11.5px] text-[#7a7a72] hover:text-[#d3d2c8]">← Actions</Link>
          {loading ? (
            <div className="text-[12px] text-[#7a7a72]">Loading action...</div>
          ) : !action ? (
            <div className="rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015] p-8 text-center text-[12px] text-[#7a7a72]">Action not found. Create a persisted action first.</div>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[15px] text-[#f0efe8]" style={{ letterSpacing: '-0.01em' }}>
                    {action.name}
                  </h1>
                  <p className="mt-0.5 text-[12px] text-[#7a7a72]">{target}</p>
                </div>
                <div className="flex items-center gap-2">
                  {startedRunId ? <Link href={`/runs/${encodeURIComponent(startedRunId)}`} className="inline-flex h-7 items-center rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-[11.5px] text-[#c8c7be] hover:bg-white/[0.06]">Open run</Link> : null}
                  {action.target_type === 'mock_demo' ? (
                    <button type="button" onClick={runTest} disabled={runMutation.isPending} className="inline-flex h-7 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 hover:bg-emerald-500/[0.16] disabled:opacity-50">
                      {runMutation.isPending ? 'Starting...' : 'Run test action'}
                    </button>
                  ) : null}
                </div>
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
                    <Field label="Last run" value={lastRun ? <Link className="hover:text-[#f0efe8]" href={`/runs/${encodeURIComponent(lastRun.task_id)}`}>{lastRun.status.replace(/_/g, ' ')} · {getRelativeTime(lastRun.created_at)}</Link> : 'No run yet'} />
                    <Field label="Target" value={truncateText(target, 96)} />
                    <Field label="Policy" value={action.policy_preset} />
                    <Field label="Replay" value={replayForActionDefinition(action)} />
                    <Field label="Proof" value={lastRun ? proofForTask(lastRun) : 'Proof unavailable'} />
                  </>
                )}
                {tab === 'endpoint' && (
                  <div className="space-y-4">
                    <Field label="What this replaces" value={<code>await {action.name}(input)</code>} />
                    <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                      <code className="flex-1 break-all text-[12px] text-[#d3d2c8]">POST {code.endpoint}</code>
                      <CopyButton text={code.endpoint} />
                    </div>
                    <div className="rounded-md border border-white/[0.06] bg-[#090908] p-3">
                      <div className="mb-2 flex items-center justify-between"><span className="text-[11px] text-[#7a7a72]">curl</span><CopyButton text={code.curl} /></div>
                      <pre className="overflow-x-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#c8c7be]">{code.curl}</pre>
                    </div>
                    <div className="rounded-md border border-white/[0.06] bg-[#090908] p-3">
                      <div className="mb-2 flex items-center justify-between"><span className="text-[11px] text-[#7a7a72]">TypeScript fetch</span><CopyButton text={code.ts} /></div>
                      <pre className="overflow-x-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#c8c7be]">{code.ts}</pre>
                    </div>
                    <p className="text-[11.5px] text-[#7a7a72]">The agent calls this endpoint instead of calling the target directly. Igris loads this action's target and policy before creating the durable run.</p>
                  </div>
                )}
                {tab === 'target' && (
                  <>
                    <Field label="Type" value={action.target_type.replace(/_/g, ' ')} />
                    <Field label="Target" value={target || 'Not configured'} />
                    <Field label="Method" value={action.method || 'POST'} />
                    <Field label="Secret status" value={action.secret_refs.length > 0 ? `${action.secret_refs.length} secret reference${action.secret_refs.length === 1 ? '' : 's'} configured` : action.target_type === 'mock_demo' ? 'Not required for mock demo' : 'Needs secret if target requires auth'} />
                  </>
                )}
                {tab === 'policy' && (
                  <>
                    <Field label="Preset" value={action.policy_preset} />
                    <Field label="Replay" value={replayForActionDefinition(action)} />
                    <Field label="Approval" value={action.approval_required ? 'Required' : 'Not required'} />
                    <Field label="Irreversible" value={action.irreversible ? 'Replay blocked after failure' : 'Replay allowed by policy'} />
                  </>
                )}
                {tab === 'secrets' && (
                  <div className="space-y-2 text-[12px] text-[#8a8a82]">
                    <p>{action.secret_refs.length > 0 ? 'This action has secret references. Secret values are not exposed in the console.' : 'No action-specific secret reference configured.'}</p>
                    <Link href="/settings/keys" className="inline-flex h-7 items-center rounded-md border border-white/[0.06] bg-white/[0.04] px-2.5 text-[11.5px] text-[#c8c7be] hover:bg-white/[0.06]">Open global API keys</Link>
                  </div>
                )}
                {tab === 'runs' && (
                  <div className="space-y-1">
                    {runs.length === 0 ? (
                      <div className="py-4 text-[12px] text-[#7a7a72]">No run yet. Run a test action to inspect policy, recovery, and proof.</div>
                    ) : runs.map((run) => (
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
