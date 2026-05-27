'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTasks, type Task } from '@/hooks/useTasks';
import { useGovernanceRuntimes } from '@/hooks/useGovernance';
import { useActions } from '@/hooks/useActions';
import { getRelativeTime } from '@/utils/helpers';

const BEFORE_CODE = 'await sendEmail(input)';
const AFTER_CODE = `await fetch('https://api.igrisinertial.com/v1/actions/send_email/run', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.IGRIS_API_KEY}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ input })
})`;

function proofStatus(task?: Task): string {
  if (!task?.proof) return 'Proof unavailable';
  if (task.proof.verified || task.proof.status === 'verified') return 'Proof verified';
  if (task.proof.verified === false || task.proof.status === 'mismatch') return 'Proof failed';
  if (task.proof.status === 'present') return 'Receipt present';
  return 'Proof unavailable';
}

function actionName(task: Task): string {
  return task.policy?.action_name || task.task_type || task.task_id;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="inline-flex h-7 items-center rounded-md border border-white/[0.06] bg-white/[0.04] px-2.5 text-[11px] text-[#c8c7be] hover:bg-white/[0.06]"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

function StackDiagram() {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_auto_1.1fr_auto_1fr] md:items-center">
      {['Agent/App', 'Igris Action Endpoint', 'Tool/API/Workflow'].map((label) => (
        <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-4 py-3">
          <div className="text-[12.5px] text-[#e8e7df]">{label}</div>
          <div className="mt-1 text-[11px] text-[#7a7a72]">
            {label === 'Agent/App' ? 'Your product or agent' : label === 'Igris Action Endpoint' ? 'Policy, recovery, proof' : 'Real side effect'}
          </div>
        </div>
      )).flatMap((node, index) => index < 2 ? [node, <span key={`arrow-${index}`} className="hidden text-[#6a6a62] md:block">-&gt;</span>] : [node])}
    </div>
  );
}

function SetupStep({
  step,
  title,
  description,
  cta,
  status,
  href,
}: {
  step: number;
  title: string;
  description: string;
  cta: string;
  status: string;
  href: string;
}) {
  const locked = status.startsWith('Locked');
  const complete = status === 'Complete' || status === 'Copied' || status === 'Ready';
  return (
    <div className="grid gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 md:grid-cols-[34px_1fr_auto] md:items-center">
      <span className={'flex h-7 w-7 items-center justify-center rounded-full border text-[11px] ' + (complete ? 'border-emerald-500/25 text-emerald-300' : 'border-white/[0.08] text-[#8a8a82]')}>
        {step}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[12.5px] text-[#e8e7df]">{title}</h3>
          <span className={'rounded px-1.5 py-0.5 text-[10.5px] ' + (complete ? 'bg-emerald-500/[0.10] text-emerald-300' : locked ? 'bg-white/[0.035] text-[#6a6a62]' : 'bg-amber-400/[0.08] text-amber-300')}>
            {status}
          </span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#7a7a72]">{description}</p>
      </div>
      <Link
        href={href}
        aria-disabled={locked}
        className={'inline-flex h-7 items-center justify-center rounded-md px-2.5 text-[11.5px] ' + (locked ? 'pointer-events-none border border-white/[0.04] text-[#5a5a52]' : 'border border-white/[0.06] bg-white/[0.04] text-[#c8c7be] hover:bg-white/[0.06]')}
      >
        {cta}
      </Link>
    </div>
  );
}

function StatusRow({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' | 'neutral' }) {
  const dot = tone === 'ok' ? 'bg-emerald-400' : tone === 'warn' ? 'bg-amber-400' : tone === 'bad' ? 'bg-rose-500' : 'bg-[#3a3a32]';
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-white/[0.06] bg-white/[0.018] px-3 py-2">
      <span className="flex items-center gap-2 text-[12px] text-[#c8c7be]"><span className={'h-1.5 w-1.5 rounded-full ' + dot} />{label}</span>
      <span className="text-right text-[11.5px] text-[#8a8a82]">{value}</span>
    </div>
  );
}

function HomeInner() {
  const { data: taskData, isLoading: tasksLoading } = useTasks({ limit: 60 });
  const { data: runtimeData, isLoading: runtimesLoading } = useGovernanceRuntimes({ limit: 1 });
  const { data: actionData, isLoading: actionsLoading } = useActions();
  const tasks = useMemo(() => taskData?.tasks ?? [], [taskData?.tasks]);
  const actions = useMemo(() => actionData?.actions ?? [], [actionData?.actions]);
  const lastRun = tasks[0];
  const firstAction = actions[0];
  const firstActionCreated = actions.length > 0;
  const targetConnected = Boolean(firstAction && (firstAction.target_type === 'mock_demo' || firstAction.target_url || firstAction.target_type === 'local_runtime'));
  const endpointReady = firstActionCreated && targetConnected;
  const runtimeConnected = (runtimeData?.items ?? []).some((r) => Boolean(r.last_seen));
  const proof = proofStatus(lastRun);
  const loading = tasksLoading || runtimesLoading || actionsLoading;

  const steps = [
    ['Create an action', 'Define the action your agent is allowed to request, such as send_email, create_ticket, update_record, or fulfill_order.', 'Create action', firstActionCreated ? 'Complete' : 'Not started', '/actions/new'],
    ['Connect a target', 'Choose where the action goes: hosted webhook/API, mocked demo target, or local runtime for private systems.', 'Add target', firstActionCreated ? (targetConnected ? 'Complete' : 'Not started') : 'Locked until action exists', '/actions/new?step=target'],
    ['Add secret or header', 'Store the API key or header Igris needs to call the target. For private systems, secrets can stay with the runtime.', 'Add secret', !targetConnected ? 'Locked until target exists' : firstAction?.target_type === 'mock_demo' ? 'Optional for mock target' : (firstAction?.secret_refs?.length ? 'Complete' : 'Not configured'), firstAction ? `/actions/${firstAction.id}?tab=secrets` : '/actions/new'],
    ['Choose policy', 'Decide how this action should behave: auto-allow, human-gated, non-replayable, or blocked.', 'Choose policy', firstAction?.policy_preset ? 'Complete' : 'Not started', '/actions/new?step=policy'],
    ['Copy the endpoint', 'Use this endpoint where your agent would normally call the tool directly.', 'Copy endpoint', !endpointReady ? 'Locked until action ready' : 'Ready', firstAction ? `/actions/${firstAction.id}?tab=endpoint` : '/actions/new'],
    ['Run a test', 'Send a test request through Igris and inspect policy, recovery, and proof.', 'Run test action', !endpointReady ? 'Locked until endpoint ready' : lastRun ? 'Complete' : 'Ready', '/actions/new?step=run'],
  ] as const;

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1120px] px-8 py-10">
          <section className="mb-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h1 className="text-[20px] text-[#f0efe8]" style={{ letterSpacing: '-0.01em' }}>Set up Igris for agent actions</h1>
                <p className="mt-2 text-[13px] leading-relaxed text-[#8a8a82]">
                  Igris sits between your AI agent and the actions it wants to perform. Create an action, get an endpoint, and route agent actions through Igris so each run can be controlled, recovered, and verified.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/actions/new" className="inline-flex h-8 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 hover:bg-emerald-500/[0.16]">Create your first action</Link>
                <a href="#integration-preview" className="inline-flex h-8 items-center rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-[11.5px] text-[#c8c7be] hover:bg-white/[0.06]">View example integration</a>
              </div>
            </div>
            <StackDiagram />
          </section>

          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] text-[#d3d2c8]">Guided setup</h2>
                <span className="text-[11px] text-[#6a6a62]">create action -&gt; get endpoint -&gt; inspect run</span>
              </div>
              <div className="space-y-2">
                {steps.map((item, index) => (
                  <SetupStep key={item[0]} step={index + 1} title={item[0]} description={item[1]} cta={item[2]} status={item[3]} href={item[4]} />
                ))}
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015] p-4">
                <h2 className="mb-3 text-[13px] text-[#d3d2c8]">Actionable status</h2>
                {loading ? (
                  <div className="text-[11.5px] text-[#6a6a62]">Loading status...</div>
                ) : (
                  <div className="space-y-2">
                    <StatusRow label="First action" value={firstActionCreated ? 'Configured' : 'No action created yet'} tone={firstActionCreated ? 'ok' : 'warn'} />
                    <StatusRow label="Target connected" value={targetConnected ? 'Configured' : 'Not configured'} tone={targetConnected ? 'ok' : 'warn'} />
                    <StatusRow label="Endpoint ready" value={endpointReady ? 'Ready to copy' : 'Not ready'} tone={endpointReady ? 'ok' : 'warn'} />
                    <StatusRow label="Last test run" value={lastRun ? `${actionName(lastRun)}: ${lastRun.status.replace(/_/g, ' ')} ${getRelativeTime(lastRun.created_at)}` : 'No run yet'} tone={lastRun?.status === 'failed' ? 'bad' : lastRun ? 'ok' : 'neutral'} />
                    <StatusRow label="Proof status" value={lastRun ? proof : 'Proof unavailable'} tone={proof === 'Proof verified' ? 'ok' : proof === 'Proof failed' ? 'bad' : 'warn'} />
                    {firstAction?.target_type === 'local_runtime' && <StatusRow label="Runtime status" value={runtimeConnected ? 'Connected' : 'Runtime disconnected'} tone={runtimeConnected ? 'ok' : 'bad'} />}
                  </div>
                )}
              </section>
            </aside>
          </div>

          <section id="integration-preview" className="mt-6 rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] text-[#d3d2c8]">Example integration</h2>
              <CopyButton text={AFTER_CODE} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-white/[0.06] bg-[#090908] p-3">
                <div className="mb-2 text-[11px] text-[#7a7a72]">Before Igris</div>
                <pre className="text-[11.5px] text-[#c8c7be]">{BEFORE_CODE}</pre>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-[#090908] p-3">
                <div className="mb-2 text-[11px] text-[#7a7a72]">With Igris</div>
                <pre className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#c8c7be]">{AFTER_CODE}</pre>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex-1" /></DashboardLayout>}>
      <HomeInner />
    </Suspense>
  );
}
