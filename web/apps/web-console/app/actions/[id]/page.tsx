'use client';

/**
 * Action detail — one action page that answers: how does my agent call this,
 * and where does it run? Layout mirrors the execution-detail page: top bar,
 * status strip, body with Section/DefRow blocks, bottom bar.
 *
 * Tabs (Overview/Endpoint/Target/Policy/Secrets/Runs) are routed via
 * `?tab=…` and rendered as anchor-nav-style buttons.
 */

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTasks, type Task } from '@/hooks/useTasks';
import { useAction, useRunAction, type ActionDefinition } from '@/hooks/useActions';
import {
  endpointForAction,
  proofForTask,
  replayForActionDefinition,
  targetForActionDefinition,
} from '@/lib/actions';
import { useToast } from '@/components/ui/use-toast';
import { getRelativeTime, truncateText } from '@/utils/helpers';

type Tone = 'ok' | 'warn' | 'bad' | 'muted';

function tonePill(tone: Tone): { dot: string; text: string } {
  switch (tone) {
    case 'ok':    return { dot: 'bg-emerald-400', text: 'text-emerald-300' };
    case 'warn':  return { dot: 'bg-amber-400',   text: 'text-amber-300'   };
    case 'bad':   return { dot: 'bg-rose-500',    text: 'text-rose-400'    };
    case 'muted': return { dot: 'bg-[#3a3a32]',   text: 'text-[#a8a89e]'   };
  }
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="ic-chip">{children}</span>;
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const c = tonePill(tone);
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--ig-bg-chip)] border border-[var(--ig-border)]">
      <span className={'block w-1.5 h-1.5 rounded-full ' + c.dot} />
      <span className="text-[10.5px] text-[#7a7a72] tracking-[0.02em]">{label}</span>
      <span className={'text-[11.5px] ' + c.text} style={{ letterSpacing: '-0.005em' }}>{value}</span>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="mt-6 scroll-mt-16">
      <div className="text-[12.5px] text-[#c8c7be] mb-2" style={{ letterSpacing: '-0.005em' }}>
        {title}
      </div>
      <div
        className="rounded-lg border-[0.5px] border-[var(--ig-border)] px-4 py-3"
        style={{ background: 'var(--ig-bg-surface)' }}
      >
        {children}
      </div>
    </div>
  );
}

function DefRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 py-1.5" style={{ gridTemplateColumns: '110px 1fr' }}>
      <span className="text-[12px] text-[#8a8a82]">{label}</span>
      <div className="text-[12.5px] text-[#d3d2c8] flex items-center gap-1.5 flex-wrap">{value}</div>
    </div>
  );
}

const NotAvail = () => <span className="text-[#6a6a62]">Not available</span>;

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
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] bg-[var(--ig-bg-chip)] text-[var(--ig-text-body)] border border-[var(--ig-border)] hover:bg-[var(--ig-bg-surface)]"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M4 16V6a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Minimal token colors tuned to the surrounding palette.
const HL = {
  keyword: '#c4b5fd',  // method, await, const
  string:  '#a7d3a0',  // string literals
  number:  '#d3b07f',
  comment: '#6a6a62',
  prop:    '#9ec1d6',  // object keys / headers
  fn:      '#e8c987',  // function names
  flag:    '#d3a0a0',  // curl flags like -X, -H
  variable:'#d3d2c8',
  punct:   '#7a7a72',
} as const;

function highlightCurl(src: string): string {
  let out = escapeHtml(src);
  // Strings (single or double quoted)
  out = out.replace(/('[^']*'|"[^"]*")/g, `<span style="color:${HL.string}">$1</span>`);
  // curl keyword at start
  out = out.replace(/^(\s*)(curl)\b/, `$1<span style="color:${HL.keyword}">$2</span>`);
  // Flags like -X, -H, --data
  out = out.replace(/(^|\s)(-{1,2}[A-Za-z][\w-]*)/g, `$1<span style="color:${HL.flag}">$2</span>`);
  // HTTP verbs
  out = out.replace(/\b(POST|GET|PUT|DELETE|PATCH)\b/g, `<span style="color:${HL.fn}">$1</span>`);
  // Env vars like $IGRIS_API_KEY
  out = out.replace(/(\$[A-Z_][A-Z0-9_]*)/g, `<span style="color:${HL.variable}">$1</span>`);
  // Line-continuation backslashes
  out = out.replace(/(\\)$/gm, `<span style="color:${HL.punct}">$1</span>`);
  return out;
}

function highlightTs(src: string): string {
  let out = escapeHtml(src);
  // Template literals first (so inner ${} can be styled)
  out = out.replace(/`([^`]*)`/g, (_m, body) => {
    const inner = body.replace(/(\$\{[^}]+\})/g, `<span style="color:${HL.variable}">$1</span>`);
    return `<span style="color:${HL.string}">\`${inner}\`</span>`;
  });
  // Single/double-quoted strings
  out = out.replace(/('[^']*'|"[^"]*")/g, `<span style="color:${HL.string}">$1</span>`);
  // Keywords
  out = out.replace(/\b(await|async|const|let|var|return|new|function|if|else|true|false|null|undefined)\b/g,
    `<span style="color:${HL.keyword}">$1</span>`);
  // Built-in / function calls: fetch, JSON.stringify
  out = out.replace(/\b(fetch|JSON|stringify|process)\b/g, `<span style="color:${HL.fn}">$1</span>`);
  // Object keys (word followed by colon, not in a string already)
  out = out.replace(/(^|[\s,{])([A-Za-z_][\w-]*)(\s*:)/g,
    `$1<span style="color:${HL.prop}">$2</span>$3`);
  // 'Content-Type' style header keys already covered by string rule
  return out;
}

function CodeBlock({ html }: { html: string }) {
  return (
    <pre
      className="overflow-x-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#c8c7be]"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
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

function targetLabel(t: ActionDefinition['target_type']): string {
  if (t === 'mock_demo')      return 'Mock demo';
  if (t === 'webhook')        return 'Hosted webhook';
  if (t === 'api')            return 'Hosted API';
  if (t === 'local_runtime')  return 'Local runtime';
  return t;
}

function setupPill(action: ActionDefinition): { value: string; tone: Tone } {
  if (action.target_type === 'mock_demo') return { value: 'Ready', tone: 'ok' };
  if ((action.target_type === 'webhook' || action.target_type === 'api') && !action.target_url) {
    return { value: 'Needs target', tone: 'warn' };
  }
  if (action.target_type === 'local_runtime') return { value: 'Needs runtime', tone: 'warn' };
  return { value: 'Ready', tone: 'ok' };
}

function policyPill(action: ActionDefinition): { value: string; tone: Tone } {
  if (action.approval_required) return { value: 'Human-gated', tone: 'warn' };
  if (action.irreversible)      return { value: 'Non-replayable', tone: 'warn' };
  if (action.replay_class === 'read_only') return { value: 'Read-only', tone: 'ok' };
  return { value: 'Auto-allow', tone: 'ok' };
}

function lastRunPill(run?: Task): { value: string; tone: Tone } {
  if (!run) return { value: 'No runs yet', tone: 'muted' };
  switch (run.status) {
    case 'completed':         return { value: 'Completed',         tone: 'ok' };
    case 'failed':            return { value: 'Failed',            tone: 'bad' };
    case 'approval_required': return { value: 'Approval required', tone: 'warn' };
    case 'recovering':        return { value: 'Recovering',        tone: 'warn' };
    case 'canceled':          return { value: 'Canceled',          tone: 'muted' };
    default:                  return { value: 'Running',           tone: 'ok' };
  }
}

function proofPill(run?: Task): { value: string; tone: Tone } {
  if (!run) return { value: 'No run yet', tone: 'muted' };
  const status = proofForTask(run);
  if (status === 'Proof verified') return { value: status, tone: 'ok' };
  if (status === 'Proof failed')   return { value: 'Failed verification', tone: 'bad' };
  if (status === 'Proof unavailable') return { value: status, tone: 'muted' };
  return { value: status, tone: 'warn' };
}

const TABS: Array<{ id: string; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'endpoint', label: 'Endpoint' },
  { id: 'target',   label: 'Target' },
  { id: 'policy',   label: 'Policy' },
  { id: 'secrets',  label: 'Secrets' },
  { id: 'runs',     label: 'Runs' },
];

function ActionDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { data: action, isLoading: actionLoading } = useAction(params.id);
  const { data: taskData, isLoading: tasksLoading } = useTasks({ limit: 100 });
  const runMutation = useRunAction(action?.name ?? '');
  const [startedRunId, setStartedRunId] = useState<string | null>(null);

  const tasks = useMemo(() => taskData?.tasks ?? [], [taskData?.tasks]);
  const runs = useMemo(
    () => tasks.filter((task) => task.policy?.action_name === action?.name || task.task_type === action?.name),
    [tasks, action?.name],
  );
  const tab = searchParams?.get('tab') || 'overview';
  const hrefForTab = (next: string) => `/actions/${params.id}?tab=${next}`;
  const code = snippets(action?.name ?? 'send_email');
  const target = action ? targetForActionDefinition(action) : '';
  const lastRun = runs[0];
  const loading = actionLoading || tasksLoading;

  const setup = action ? setupPill(action) : { value: 'Loading', tone: 'muted' as Tone };
  const canRunTest = action ? (setup.tone === 'ok' || action.target_type === 'mock_demo') : false;

  const runTest = () => {
    if (!action) return;
    runMutation.mutate({
      input: { demo: true, source: 'console_run_test' },
      metadata: { source: 'console_action_detail' },
    }, {
      onSuccess: (result) => {
        const id = result.run_id || result.task_id || null;
        setStartedRunId(id);
        toast({
          title: 'Test run started',
          description: id
            ? 'Open the run to inspect policy, recovery, and proof.'
            : 'The action request was accepted.',
        });
      },
      onError: (error: Error) => {
        toast({ variant: 'destructive', title: 'Test run failed to start', description: error.message });
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-0 h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 h-11 px-5 border-b border-[var(--ig-border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/actions"
              className="text-[11.5px] text-[#7a7a72] hover:text-[#d3d2c8]"
              title="Back to actions"
            >
              ←
            </Link>
            <span
              className="text-[13px] font-medium text-[#f0efe8] truncate"
              style={{ letterSpacing: '-0.01em' }}
            >
              {loading ? 'Loading action…' : action ? action.name : 'Action not found'}
            </span>
            {action && <Chip>{targetLabel(action.target_type)}</Chip>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {startedRunId && (
              <Link
                href={`/execution/tasks/${encodeURIComponent(startedRunId)}`}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] bg-[var(--ig-bg-chip)] text-[var(--ig-text-body)] border border-[var(--ig-border)] hover:bg-[var(--ig-bg-surface)]"
              >
                Open run →
              </Link>
            )}
            <button
              type="button"
              onClick={runTest}
              disabled={!canRunTest || runMutation.isPending}
              title={!canRunTest ? 'Run test action is enabled when the action is ready or uses mock demo' : undefined}
              className={
                'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] transition-colors ' +
                (!canRunTest || runMutation.isPending
                  ? 'opacity-50 cursor-not-allowed bg-[var(--ig-bg-chip)] text-[var(--ig-text-body)] border border-[var(--ig-border)]'
                  : 'bg-emerald-500/[0.12] text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/[0.16]')
              }
            >
              {runMutation.isPending ? 'Starting…' : 'Run test action'}
            </button>
          </div>
        </div>

        {/* Status strip */}
        {action && (
          <div
            className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-[var(--ig-border-soft)]"
            style={{ background: 'var(--ig-bg-surface)' }}
          >
            <StatusPill label="Setup" {...setup} />
            <StatusPill label="Target" value={targetLabel(action.target_type)} tone="muted" />
            <StatusPill label="Policy" {...policyPill(action)} />
            <StatusPill label="Last run" {...lastRunPill(lastRun)} />
            <StatusPill label="Proof" {...proofPill(lastRun)} />
          </div>
        )}

        {/* Tab nav */}
        {action && (
          <div className="flex items-center gap-0.5 px-5 py-2 border-b border-[var(--ig-border-soft)]">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={hrefForTab(t.id)}
                className={
                  'px-2.5 h-7 inline-flex items-center text-[11.5px] rounded transition-colors ' +
                  (tab === t.id
                    ? 'text-[#f0efe8] bg-[var(--ig-rail-active-bg)]'
                    : 'text-[#7a7a72] hover:text-[#e8e7df]')
                }
              >
                {t.label}
              </Link>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="ic-scroll flex-1 overflow-y-auto px-7 pt-6 pb-2">
          {loading ? (
            <div className="text-[12px] text-[#7a7a72]">Loading action…</div>
          ) : !action ? (
            <div className="rounded-lg border-[0.5px] border-[var(--ig-border)] p-8 text-center text-[12px] text-[#7a7a72]" style={{ background: 'var(--ig-bg-surface)' }}>
              Action not found. Create a persisted action first.
            </div>
          ) : (
            <>
              {tab === 'overview' && (
                <>
                  <p className="text-[13px] text-[#c8c7be] leading-relaxed max-w-[60ch]">
                    This is the endpoint your agent calls. This action runs through Igris before
                    touching the target. Policy and proof are recorded for every run.
                  </p>

                  <Section title="Setup">
                    <DefRow label="Status" value={
                      <Chip><span className={tonePill(setup.tone).text}>{setup.value}</span></Chip>
                    } />
                    <DefRow label="Target" value={
                      <>
                        <Chip>{targetLabel(action.target_type)}</Chip>
                        <span className="text-[#a8a89e]">{truncateText(target, 60)}</span>
                      </>
                    } />
                    <DefRow label="Policy" value={
                      <Chip><span className={tonePill(policyPill(action).tone).text}>{policyPill(action).value}</span></Chip>
                    } />
                    <DefRow label="Replay" value={<span className="text-[#a8a89e]">{replayForActionDefinition(action)}</span>} />
                  </Section>

                  <Section title="Last run">
                    {lastRun ? (
                      <>
                        <DefRow label="Status" value={
                          <Chip><span className={tonePill(lastRunPill(lastRun).tone).text}>{lastRunPill(lastRun).value}</span></Chip>
                        } />
                        <DefRow label="When" value={<span className="text-[#a8a89e]">{getRelativeTime(lastRun.created_at)}</span>} />
                        <DefRow label="Proof" value={
                          <Chip><span className={tonePill(proofPill(lastRun).tone).text}>{proofPill(lastRun).value}</span></Chip>
                        } />
                        <DefRow label="Open" value={
                          <Link
                            href={`/execution/tasks/${encodeURIComponent(lastRun.task_id)}`}
                            className="text-[#c8c7be] hover:text-[#f0efe8] underline-offset-2 hover:underline"
                          >
                            Inspect run →
                          </Link>
                        } />
                      </>
                    ) : (
                      <div className="py-2 text-[12px] text-[#7a7a72]">
                        No runs yet. Proof is unavailable until a run produces signed evidence.
                      </div>
                    )}
                  </Section>
                </>
              )}

              {tab === 'endpoint' && (
                <>
                  <p className="text-[13px] text-[#c8c7be] leading-relaxed max-w-[60ch]">
                    This is the endpoint your agent calls. Igris loads policy and target,
                    then runs the action.
                  </p>

                  <Section title="Endpoint">
                    <div className="flex items-center gap-2 rounded-md border border-[var(--ig-border)] bg-[var(--ig-bg-chip)] px-3 py-2 mb-2">
                      <span className="text-[10.5px] text-emerald-300 tracking-[0.02em] flex-shrink-0">POST</span>
                      <code className="flex-1 break-all text-[12px] text-[#d3d2c8]" style={{ fontFamily: 'inherit' }}>
                        {code.endpoint}
                      </code>
                      <CopyButton text={code.endpoint} />
                    </div>
                    <DefRow label="Replaces" value={<Chip>await {action.name}(input)</Chip>} />
                  </Section>

                  <Section title="curl">
                    <div className="flex items-center justify-end mb-2">
                      <CopyButton text={code.curl} />
                    </div>
                    <CodeBlock html={highlightCurl(code.curl)} />
                  </Section>

                  <Section title="TypeScript fetch">
                    <div className="flex items-center justify-end mb-2">
                      <CopyButton text={code.ts} />
                    </div>
                    <CodeBlock html={highlightTs(code.ts)} />
                  </Section>
                </>
              )}

              {tab === 'target' && (
                <Section title="Target">
                  <DefRow label="Type" value={<Chip>{targetLabel(action.target_type)}</Chip>} />
                  <DefRow label="Address" value={target ? <span className="text-[#d3d2c8] break-all">{target}</span> : <NotAvail />} />
                  <DefRow label="Method" value={<Chip>{action.method || 'POST'}</Chip>} />
                  <DefRow label="Notes" value={
                    <span className="text-[#a8a89e]">
                      {action.target_type === 'mock_demo' && 'Mock demo target runs without external credentials. Useful for first-time setup.'}
                      {action.target_type === 'local_runtime' && 'Use a local runtime when the action needs private/local access.'}
                      {(action.target_type === 'webhook' || action.target_type === 'api') && 'Hosted target is called from Igris with the configured method.'}
                    </span>
                  } />
                </Section>
              )}

              {tab === 'policy' && (
                <Section title="Policy">
                  <DefRow label="Behavior" value={
                    <Chip><span className={tonePill(policyPill(action).tone).text}>{policyPill(action).value}</span></Chip>
                  } />
                  <DefRow label="Preset" value={<Chip>{action.policy_preset}</Chip>} />
                  <DefRow label="Replay" value={<span className="text-[#a8a89e]">{replayForActionDefinition(action)}</span>} />
                  <DefRow label="Approval" value={
                    action.approval_required
                      ? <Chip><span className="text-amber-300">Required</span></Chip>
                      : <span className="text-[#a8a89e]">Not required</span>
                  } />
                  <DefRow label="Irreversible" value={
                    action.irreversible
                      ? <span className="text-[#a8a89e]">Replay blocked after failure</span>
                      : <span className="text-[#a8a89e]">Replay allowed by policy</span>
                  } />
                </Section>
              )}

              {tab === 'secrets' && (
                <Section title="Secrets">
                  <DefRow label="Configured" value={
                    action.secret_refs.length > 0
                      ? <Chip>{action.secret_refs.length} reference{action.secret_refs.length === 1 ? '' : 's'}</Chip>
                      : action.target_type === 'mock_demo'
                        ? <span className="text-[#a8a89e]">Not required for mock demo</span>
                        : <span className="text-[#a8a89e]">Not configured</span>
                  } />
                  <DefRow label="Values" value={<span className="text-[#7a7a72]">Secret values are never shown in the console.</span>} />
                  <DefRow label="Manage" value={
                    <Link
                      href="/settings/keys"
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] bg-[var(--ig-bg-chip)] text-[var(--ig-text-body)] border border-[var(--ig-border)] hover:bg-[var(--ig-bg-surface)]"
                    >
                      Open global API keys →
                    </Link>
                  } />
                </Section>
              )}

              {tab === 'runs' && (
                <Section title={`Runs (${runs.length})`}>
                  {runs.length === 0 ? (
                    <div className="py-2 text-[12px] text-[#7a7a72]">
                      No runs yet. Run a test action to produce policy, recovery, and proof.
                    </div>
                  ) : (
                    <div className="-mx-2">
                      {runs.map((run) => {
                        const pill = lastRunPill(run);
                        const c = tonePill(pill.tone);
                        return (
                          <Link
                            key={run.task_id}
                            href={`/execution/tasks/${encodeURIComponent(run.task_id)}`}
                            className="grid items-center gap-3 px-2 py-2 rounded hover:bg-[var(--ig-bg-chip)] transition-colors"
                            style={{ gridTemplateColumns: '14px 110px 1fr auto' }}
                          >
                            <span className={'block w-1.5 h-1.5 rounded-full ' + c.dot} />
                            <span className={'text-[11.5px] ' + c.text}>{pill.value}</span>
                            <span className="text-[12px] text-[#c8c7be] truncate">{truncateText(run.task_id, 36)}</span>
                            <span className="text-[10.5px] text-[#7a7a72] tabular-nums">{getRelativeTime(run.created_at)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </Section>
              )}
            </>
          )}
        </div>

        {/* Bottom bar */}
        {action && (
          <div className="border-t border-[var(--ig-border)]">
            <div className="flex items-center gap-3 px-5 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#d3d2c8]">
                <span className={'inline-block w-1.5 h-1.5 rounded-full ' + (setup.tone === 'ok' ? 'bg-emerald-500' : 'bg-amber-400')} />
                <span>{action.name}</span>
              </span>
              <span className="text-[#3a3a32]">·</span>
              <span className="text-[11.5px] text-[#a8a89e]">{targetLabel(action.target_type)}</span>
              <span className="text-[#3a3a32]">·</span>
              <span className="text-[11.5px] text-[#a8a89e]">{policyPill(action).value}</span>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-[11.5px] text-[#7a7a72]">{runs.length} run{runs.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
        )}
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
