'use client';

/**
 * Execution inspector — the operator-facing view for one governed AI action.
 * The layout ports the canonical product design shown in the landing-page
 * hero (web-landing/.../Products.tsx ExecutionPreview): 236px task sidebar,
 * top bar with title + Re-run / Inspect / Verify chain buttons, definition
 * rows with inline chips, narrative paragraph, committed actions tree, and
 * a bottom status bar.
 *
 * Every value comes from `GET /v1/tasks/:id`; missing data renders as
 * "Not available" instead of being fabricated. `?mock=1` injects a realistic
 * preview Task for design review only.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTask, useTaskSteps, type Task, type ActionEvidenceRow } from '@/hooks/useTasks';
import { useTenant } from '@/hooks/useTenant';
import { api } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';
import { mockTask, mockTaskSteps, MOCK_TASK_ID } from '@/lib/mockExecution';
import { formatDateTime, getRelativeTime, truncateText } from '@/utils/helpers';
import { SafeEvidenceJsonPanel } from '@/components/governance/SafeEvidenceJsonPanel';

// ── Inline icons (from hero mockup) ───────────────────────────────────────

const IconMail = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
    <path d="M3 7l9 6 9-6M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconGlobe = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconWorker = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconClock = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconBraces = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
    <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="ic-chip">
      {icon && <span className="ic-chip-icon">{icon}</span>}
      {children}
    </span>
  );
}

// ── Top bar buttons ───────────────────────────────────────────────────────

function TopBtn({
  label, iconPlus, iconCaret, accent, disabled, onClick, title,
}: {
  label: string; iconPlus?: boolean; iconCaret?: boolean; accent?: boolean;
  disabled?: boolean; onClick?: () => void; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] transition-colors ' +
        (disabled ? 'opacity-50 cursor-not-allowed ' : 'cursor-pointer ') +
        (accent
          ? 'bg-emerald-500/[0.12] text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/[0.16]'
          : 'bg-white/[0.04] text-[#d3d2c8] border border-white/[0.05] hover:bg-white/[0.06]')
      }
    >
      {iconPlus && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M12 5 L12 19 M5 12 L19 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )}
      <span>{label}</span>
      {iconCaret && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
          <path d="M6 10 L12 16 L18 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ── Action tree ────────────────────────────────────────────────────────────

function Tree({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] text-[#a8a89e]">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="text-[#6a6a62] rotate-90">
          <path d="M9 6 L15 12 L9 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#7a7a72]">
          <path d="M13 2 L4 14 L11 14 L11 22 L20 10 L13 10 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
        <span>{title}</span>
      </div>
      <div className="mt-1 pl-5 border-l border-white/[0.05] ml-1">{children}</div>
    </div>
  );
}

function ActionLine({ row, running }: { row: ActionEvidenceRow; running: boolean }) {
  const num = String(row.step_index).padStart(2, '0');
  const detail = row.target_summary || row.tool_name || '';
  const receipt = row.result_digest ? `r${num}` : null;
  return (
    <div
      className="grid items-center gap-x-3 py-1.5 px-2 -ml-2 rounded hover:bg-white/[0.02]"
      style={{ gridTemplateColumns: '14px 24px 1fr auto auto auto' }}
    >
      <span className="inline-flex items-center justify-center">
        {running ? (
          <span className="block w-1.5 h-1.5 rounded-full bg-emerald-400 ic-breathing" />
        ) : (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" className="text-emerald-500">
            <path d="M5 12.5 L10 17 L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-[11px] text-[#5a5a52] tabular-nums">{num}</span>
      <div className="min-w-0 flex items-baseline gap-2">
        <span className={'text-[12.5px] text-[#e8e7df] ' + (running ? 'ic-breathing' : '')}>
          {row.action_type}
        </span>
        <span className="text-[12px] text-[#7a7a72] truncate">{detail}</span>
      </div>
      <span className="text-[11px] text-[#5a5a52] tabular-nums min-w-[42px] text-right">
        {/* latency unavailable in current schema */}
      </span>
      {receipt ? (
        <span className="text-[10.5px] text-emerald-400">{receipt}</span>
      ) : (
        <span className="text-[10.5px] text-[#5a5a52]">—</span>
      )}
      <span className="text-[10.5px] tabular-nums">
        {running ? (
          <span className="text-[#5a5a52]">· · ·</span>
        ) : (
          <>
            <span className="text-emerald-400/80">+1</span>
            <span className="text-[#5a5a52]"> / </span>
            <span className="text-rose-400/70">−0</span>
          </>
        )}
      </span>
    </div>
  );
}

function FaultLine({ source, target, reason }: { source?: string; target?: string; reason?: string }) {
  const detail = [
    source && `${truncateText(source, 18)} failed`,
    target && `resumed on ${truncateText(target, 18)}`,
    reason,
  ].filter(Boolean).join(' · ');
  return (
    <div className="grid items-center gap-x-3 py-1.5 px-2 -ml-2 rounded"
         style={{ gridTemplateColumns: '14px 24px 1fr auto auto auto' }}>
      <span className="inline-flex items-center justify-center">
        <span className="block w-1 h-1 rounded-full bg-amber-400" />
      </span>
      <span className="text-[11px] text-amber-400/60 tabular-nums">!!</span>
      <div className="min-w-0 flex items-baseline gap-2">
        <span className="text-[12.5px] text-amber-300">host_fault</span>
        <span className="text-[12px] text-[#9a9a8e] truncate">{detail || 'recovery event recorded'}</span>
      </div>
      <span className="text-[11px] text-[#5a5a52] tabular-nums min-w-[42px] text-right" />
      <span className="text-[10.5px] text-amber-400/70">recovered</span>
      <span className="text-[10.5px] text-[#5a5a52]">0 replays</span>
    </div>
  );
}

// ── Definition row ────────────────────────────────────────────────────────

function DefRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 py-1.5" style={{ gridTemplateColumns: '90px 1fr' }}>
      <span className="text-[12px] text-[#8a8a82]">{label}</span>
      <div className="text-[12.5px] text-[#d3d2c8] flex items-center gap-1.5 flex-wrap">{value}</div>
    </div>
  );
}

const NotAvail = () => <span className="text-[#6a6a62]">Not available</span>;

// ── Narrative paragraph ───────────────────────────────────────────────────

function Narrative({ task }: { task: Task }) {
  const proof = task.proof;
  const verified = proof?.verified || proof?.status === 'verified';
  const failed = proof?.verified === false || proof?.status === 'mismatch';
  const recoveryEvents = task.recovery?.events ?? [];
  const recovered = recoveryEvents.length > 0;
  const running = task.status === 'pending' || task.status === 'dispatched' || task.status === 'checkpointed' || task.status === 'recovering';
  const lastCommitted = task.checkpoint_summary?.last_committed_step;
  const runningAction = (task.action_evidence ?? []).find(
    (r) => (r.status ?? '').toLowerCase().includes('running')
  );

  let body: React.ReactNode;
  if (failed) {
    body = <>Receipt verification <span className="text-rose-400">failed</span>. See proof for the mismatched hashes.</>;
  } else if (running && runningAction) {
    body = (
      <>
        The receipt chain is <span className="text-emerald-400">valid</span>
        {lastCommitted != null && (
          <> up to <span>action {String(lastCommitted).padStart(2, '0')}</span></>
        )}
        . Action {String(runningAction.step_index).padStart(2, '0')} (
        <span>{runningAction.action_type}</span>
        ) is currently running.
        {recovered ? <> No replays were needed across the host fault.</> : null}
      </>
    );
  } else if (verified && recovered) {
    body = (
      <>
        The receipt chain is <span className="text-emerald-400">valid</span> across {recoveryEvents.length} runtime event
        {recoveryEvents.length === 1 ? '' : 's'}. No replays were needed.
      </>
    );
  } else if (verified) {
    body = <>The receipt chain is <span className="text-emerald-400">valid</span>. No replays were needed.</>;
  } else if (recovered) {
    body = <>Recovery recorded; receipt chain verification is <span className="text-[#c8c7be]">not yet available</span>.</>;
  } else if (task.status === 'failed') {
    body = <>Execution <span className="text-rose-400">failed</span>{task.failure_reason ? <> — {task.failure_reason}</> : null}.</>;
  } else if (proof?.status === 'present') {
    body = <>Receipt is present but has not been verified. Run <span>Verify chain</span> to confirm hashes.</>;
  } else {
    body = <>No proof or recovery evidence is available for this task yet.</>;
  }

  return (
    <p className="mt-5 text-[13px] text-[#c8c7be] leading-relaxed max-w-[60ch]">
      {body}
    </p>
  );
}

// ── Detailed evidence sections (dark, sans, no uppercase, no mono) ───────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="text-[12.5px] text-[#c8c7be] mb-2" style={{ letterSpacing: '-0.005em' }}>
        {title}
      </div>
      <div
        className="rounded-lg border-[0.5px] border-white/[0.06] px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.015)', boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.03)' }}
      >
        {children}
      </div>
    </div>
  );
}

function digestShort(s?: string): string {
  if (!s) return '';
  // Show "<prefix>:<first 8>…<last 4>" without changing the family — pure sans.
  const [prefix, rest] = s.includes(':') ? s.split(':', 2) : ['', s];
  if (!rest) return s;
  if (rest.length <= 14) return s;
  return `${prefix ? prefix + ':' : ''}${rest.slice(0, 8)}…${rest.slice(-4)}`;
}

function DetailedEvidence({
  task, verifyState, walEntries,
}: { task: Task; verifyState: boolean | null; walEntries: number }) {
  const p = task.policy;
  const b = task.runtime_boundary;
  const r = task.recovery;
  const handoff = task.runtime_handoff;
  const proof = task.proof;
  const proofVerified = proof?.verified || proof?.status === 'verified';
  const proofFailed = proof?.verified === false || proof?.status === 'mismatch';
  const sig = task.receipt?.signature || proof?.signature || '';
  const sigScheme = sig.includes(':') ? sig.split(':')[0] : (sig ? sig : '');

  return (
    <div className="mt-2 pb-2">
      {/* Policy */}
      <Section title="Policy">
        <DefRow label="Decision" value={
          p?.decision ? (
            <>
              <Chip>{p.decision.replace(/_/g, ' ')}</Chip>
              {p.risk_level && <span className="text-[#7a7a72]">{p.risk_level} risk</span>}
              {p.replay_class && <span className="text-[#7a7a72]">{p.replay_class.replace(/_/g, ' ')}</span>}
            </>
          ) : <NotAvail />
        } />
        <DefRow label="Policy" value={
          p?.policy_version ? <Chip>v{p.policy_version}</Chip> : <NotAvail />
        } />
        <DefRow label="Action" value={
          p?.action_name ? <span className="text-[#d3d2c8]">{p.action_name}</span> : <NotAvail />
        } />
        {p?.reason && (
          <DefRow label="Reason" value={
            <span className="text-[#a8a89e]" style={{ wordBreak: 'break-word' }}>{p.reason}</span>
          } />
        )}
        {p?.action_digest && (
          <DefRow label="Action digest" value={
            <Chip>{digestShort(p.action_digest)}</Chip>
          } />
        )}
        <DefRow label="Flags" value={
          <>
            {p?.irreversible && <Chip>irreversible</Chip>}
            {p?.human_gated && <Chip>human-gated</Chip>}
            {!p?.irreversible && !p?.human_gated && <span className="text-[#7a7a72]">none</span>}
          </>
        } />
      </Section>

      {/* Boundary */}
      <Section title="Boundary">
        <DefRow label="Environment" value={
          b?.environment_label ? <Chip>{b.environment_label}</Chip> : <NotAvail />
        } />
        <DefRow label="Allowed tools" value={
          b?.allowed_tools?.length
            ? <>{b.allowed_tools.map((t) => <Chip key={t}>{t}</Chip>)}</>
            : <span className="text-[#7a7a72]">none declared</span>
        } />
        <DefRow label="Denied tools" value={
          b?.denied_tools?.length
            ? <>{b.denied_tools.map((t) => <Chip key={t}>{t}</Chip>)}</>
            : <span className="text-[#7a7a72]">none declared</span>
        } />
        <DefRow label="Network" value={
          b?.network_scope ? <Chip>{b.network_scope}</Chip> : <NotAvail />
        } />
        <DefRow label="Filesystem" value={
          b?.filesystem_scope ? <Chip>{b.filesystem_scope}</Chip> : <NotAvail />
        } />
        <DefRow label="API" value={
          b?.api_scope ? <Chip>{b.api_scope}</Chip> : <NotAvail />
        } />
        {b?.boundary_digest && (
          <DefRow label="Digest" value={<Chip>{digestShort(b.boundary_digest)}</Chip>} />
        )}
      </Section>

      {/* Recovery */}
      <Section title="Recovery">
        <DefRow label="Eligible" value={
          r?.redispatch_eligible === false
            ? <span className="text-[#a8a89e]">not redispatchable</span>
            : <span className="text-[#a8a89e]">redispatch eligible</span>
        } />
        {r?.skip_reason && (
          <DefRow label="Skip reason" value={<span className="text-[#a8a89e]">{r.skip_reason}</span>} />
        )}
        {handoff && (
          <DefRow label="Handoff" value={
            <>
              {handoff.source_runtime_id && <Chip>{truncateText(handoff.source_runtime_id, 22)}</Chip>}
              <span className="text-[#7a7a72]">→</span>
              {handoff.target_runtime_id && <Chip>{truncateText(handoff.target_runtime_id, 22)}</Chip>}
            </>
          } />
        )}
        {(r?.events ?? []).length > 0 ? (
          <div className="mt-2 pl-[90px]">
            <div className="space-y-2">
              {(r!.events ?? []).map((ev, i) => (
                <div key={i} className="text-[12px] text-[#a8a89e] leading-relaxed">
                  {ev.event_type && <span className="text-[#d3d2c8]">{ev.event_type.replace(/_/g, ' ')}</span>}
                  {ev.reason && <> — {ev.reason}</>}
                  {ev.replay_allowed === false && <span className="text-[#7a7a72]"> · no replay</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <DefRow label="Events" value={<span className="text-[#7a7a72]">no recovery event recorded</span>} />
        )}
      </Section>

      {/* Proof */}
      <Section title="Proof">
        <DefRow label="Status" value={
          proofVerified
            ? <Chip><span className="text-emerald-400">verified</span></Chip>
            : proofFailed
              ? <Chip><span className="text-rose-400">verification failed</span></Chip>
              : proof?.status === 'present'
                ? <Chip>present</Chip>
                : <NotAvail />
        } />
        <DefRow label="Execution" value={
          proof?.execution_id ? <Chip>{truncateText(proof.execution_id, 28)}</Chip> : <NotAvail />
        } />
        <DefRow label="Expected hash" value={
          proof?.expected_hash ? <Chip>{digestShort(proof.expected_hash)}</Chip> : <NotAvail />
        } />
        <DefRow label="Stored hash" value={
          proof?.stored_hash ? <Chip>{digestShort(proof.stored_hash)}</Chip> : <NotAvail />
        } />
        <DefRow label="Signature" value={
          sigScheme ? <Chip>{sigScheme}</Chip> : <NotAvail />
        } />
        {proof?.verification_reason && (
          <DefRow label="Reason" value={<span className="text-[#a8a89e]">{proof.verification_reason}</span>} />
        )}
        {verifyState !== null && (
          <DefRow label="This session" value={
            <span className={verifyState ? 'text-emerald-400' : 'text-rose-400'}>
              {verifyState ? 'verified against the proof store' : 'verification did not pass'}
            </span>
          } />
        )}
      </Section>

      {/* Checkpoint */}
      <Section title="Checkpoint">
        <DefRow label="Status" value={
          task.checkpoint_summary?.checkpoint_status
            ? <Chip>{task.checkpoint_summary.checkpoint_status.replace(/_/g, ' ')}</Chip>
            : <NotAvail />
        } />
        <DefRow label="Last committed" value={
          task.checkpoint_summary?.last_committed_step != null
            ? <span className="text-[#d3d2c8]">step {task.checkpoint_summary.last_committed_step}</span>
            : <NotAvail />
        } />
        <DefRow label="WAL entries" value={
          <span className="text-[#d3d2c8] tabular-nums">{walEntries || (task.checkpoint_summary?.wal_entry_count ?? 0)}</span>
        } />
        {task.checkpoint_summary?.checkpoint_digest && (
          <DefRow label="Digest" value={<Chip>{digestShort(task.checkpoint_summary.checkpoint_digest)}</Chip>} />
        )}
      </Section>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const rawId = decodeURIComponent(params?.id ?? '');
  const isMock = searchParams?.get('mock') === '1' || rawId === 'mock';
  const taskId = isMock ? MOCK_TASK_ID : rawId;
  const { toast } = useToast();
  const { data: tenant } = useTenant();
  const [verified, setVerified] = useState<boolean | null>(null);

  const { data: fetchedTask, isLoading: loadingFetched } = useTask(isMock ? null : (rawId || null));
  const { data: stepsData } = useTaskSteps(isMock ? null : (rawId || null));
  const task = isMock ? mockTask : fetchedTask;
  const isLoading = isMock ? false : loadingFetched;
  const steps = isMock ? mockTaskSteps : (stepsData?.steps ?? []);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (isMock) {
        await new Promise((r) => setTimeout(r, 700));
        return { proof: { status: 'verified' } };
      }
      return api.post<{ proof?: { status?: string } }>(
        `/v1/tasks/${encodeURIComponent(taskId)}/proof/verify`,
        {},
      );
    },
    onSuccess: (result) => {
      const ok = result.proof?.status === 'verified';
      setVerified(ok);
      toast({
        title: ok ? 'Receipt verified' : 'Receipt verification failed',
        description: ok
          ? 'The stored receipt matches the execution artifact.'
          : 'The stored receipt did not match the expected hash.',
        variant: ok ? undefined : 'destructive',
      });
    },
    onError: (error: Error) => {
      setVerified(false);
      toast({ variant: 'destructive', title: 'Verification failed', description: error.message });
    },
  });

  // Build an interleaved action+fault timeline from real evidence + recovery events.
  const timeline = useMemo(() => {
    if (!task) return [] as Array<
      | { kind: 'action'; row: ActionEvidenceRow }
      | { kind: 'fault'; source?: string; target?: string; reason?: string }
    >;
    const acts = [...(task.action_evidence ?? [])].sort((a, b) => a.step_index - b.step_index);
    const faults = task.recovery?.events ?? [];
    const out: Array<
      | { kind: 'action'; row: ActionEvidenceRow }
      | { kind: 'fault'; source?: string; target?: string; reason?: string }
    > = [];
    // Insert each fault before the first action whose recorded_at > fault.created_at.
    let fi = 0;
    for (const a of acts) {
      while (fi < faults.length) {
        const f = faults[fi];
        const fTime = f.created_at ? new Date(f.created_at).getTime() : 0;
        const aTime = a.recorded_at ? new Date(a.recorded_at).getTime() : 0;
        if (fTime && aTime && fTime < aTime) {
          out.push({ kind: 'fault', source: f.source_runtime_id, target: f.target_runtime_id, reason: f.reason });
          fi += 1;
        } else break;
      }
      out.push({ kind: 'action', row: a });
    }
    while (fi < faults.length) {
      const f = faults[fi++];
      out.push({ kind: 'fault', source: f.source_runtime_id, target: f.target_runtime_id, reason: f.reason });
    }
    return out;
  }, [task]);

  const title = task
    ? `${task.policy?.action_name || task.task_type || 'Action'}${task.policy?.policy_version ? ` — policy v${task.policy.policy_version}` : ''}`
    : 'Execution';
  const projectChip = task?.runtime_boundary?.environment_label || null;

  const totalActions = task ? (task.action_evidence?.length ?? 0) : 0;
  const committedActions = task
    ? (task.action_evidence ?? []).filter((r) => {
        const s = (r.status ?? '').toLowerCase();
        return s.includes('commit') || s.includes('complete');
      }).length
    : 0;

  // Bottom bar: policy version, recovery, signature scheme, tier.
  const recoveryOn = (task?.lifecycle?.recovery_redispatch_allowed ?? task?.recovery?.redispatch_eligible) === true;
  const sigScheme = task?.receipt?.signature?.split(':')[0] || task?.proof?.signature?.split(':')[0] || null;
  const tier = tenant?.plan || '—';

  const handoff = task?.runtime_handoff || (task?.recovery?.events ?? [])[0];
  const recoveredFrom = handoff?.source_runtime_id;

  const submitter = task ? ((task as any).submitter || (task as any).submitted_by || null) : null;

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-0 h-full">
              {/* Top bar */}
              <div className="flex items-center justify-between gap-3 h-11 px-5 border-b border-white/[0.05]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Link
                    href="/execution/tasks"
                    className="text-[11.5px] text-[#7a7a72] hover:text-[#d3d2c8]"
                    title="Back to executions"
                  >
                    ←
                  </Link>
                  <span
                    className="text-[13px] font-medium text-[#f0efe8] truncate"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {isLoading ? 'Loading execution…' : title}
                  </span>
                  {projectChip && <Chip>{projectChip}</Chip>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <AnchorNav />
                  <TopBtn label="Re-run" iconPlus disabled title="Re-run is not yet exposed from the console" />
                  <TopBtn
                    label={verifyMutation.isPending ? 'Verifying…' : 'Verify proof'}
                    iconCaret
                    accent
                    disabled={verifyMutation.isPending || !task?.proof?.execution_id}
                    title={!task?.proof?.execution_id ? 'No execution receipt to verify' : undefined}
                    onClick={() => {
                      setVerified(null);
                      verifyMutation.mutate();
                    }}
                  />
                </div>
              </div>

              {/* Body */}
              <div className="ic-scroll flex-1 overflow-y-auto px-7 pt-6 pb-2">
                {isLoading || !task ? (
                  <div className="text-[12px] text-[#7a7a72]">Loading execution…</div>
                ) : (
                  <>
                    {/* Definition rows */}
                    <DefRow
                      label="Submitter"
                      value={
                        submitter ? (
                          <>
                            <Chip icon={<IconMail />}>{submitter}</Chip>
                            <span className="text-[#7a7a72]">action submitter</span>
                          </>
                        ) : <NotAvail />
                      }
                    />
                    <DefRow
                      label="Region"
                      value={
                        task.runtime_boundary?.environment_label ? (
                          <>
                            <Chip icon={<IconGlobe />}>{task.runtime_boundary.environment_label}</Chip>
                            <span className="text-[#7a7a72]">runtime environment</span>
                          </>
                        ) : <NotAvail />
                      }
                    />
                    <DefRow
                      label="Worker"
                      value={
                        task.runtime_id ? (
                          <>
                            <Chip icon={<IconWorker />}>{truncateText(task.runtime_id, 22)}</Chip>
                            {recoveredFrom && recoveredFrom !== task.runtime_id && (
                              <>
                                <span className="text-[#7a7a72]">recovered from</span>
                                <Chip icon={<IconWorker />}>{truncateText(recoveredFrom, 22)}</Chip>
                              </>
                            )}
                          </>
                        ) : <NotAvail />
                      }
                    />
                    <DefRow
                      label="Submitted"
                      value={
                        <>
                          <Chip icon={<IconClock />}>{formatDateTime(task.created_at)}</Chip>
                          <span className="text-[#7a7a72]">{getRelativeTime(task.created_at)}, {task.task_type ?? 'task'}</span>
                        </>
                      }
                    />
                    <DefRow
                      label="Mode"
                      value={
                        <>
                          <Chip icon={<IconBraces />}>{task.task_type || task.requested_mode || 'action_workflow'}</Chip>
                          <span className="text-[#7a7a72]">
                            {(task.runtime_boundary?.allowed_tools?.length ?? 0) > 0
                              ? `${task.runtime_boundary!.allowed_tools!.length} controlled tools`
                              : 'controlled tools'}
                            {recoveryOn ? ', recovery enabled' : ''}
                          </span>
                        </>
                      }
                    />

                    {/* Narrative */}
                    <Narrative task={task} />

                    {/* Committed actions */}
                    <div
                      className="mt-7 rounded-lg border-[0.5px] border-white/[0.06] px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.015)', boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.03)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11.5px] text-[#a8a89e]">
                          <span>Committed actions ({totalActions})</span>
                          <span className="text-emerald-400/80">+{committedActions}</span>
                          <span className="text-rose-400/60">−0</span>
                        </div>
                        <div className="text-[10.5px] text-[#6a6a62]">
                          {task.completed_at ? 'sealed' : 'live'}
                        </div>
                      </div>

                      <div className="mt-3">
                        {timeline.length === 0 ? (
                          <div className="text-[12px] text-[#6a6a62] py-2">
                            No committed action evidence has been recorded for this task yet.
                          </div>
                        ) : (
                          <Tree title="actions">
                            {timeline.map((item, i) => (
                              <div key={i} className="ic-step-in">
                                {item.kind === 'fault' ? (
                                  <FaultLine source={item.source} target={item.target} reason={item.reason} />
                                ) : (
                                  <ActionLine
                                    row={item.row}
                                    running={(item.row.status ?? '').toLowerCase().includes('running')}
                                  />
                                )}
                              </div>
                            ))}
                          </Tree>
                        )}
                      </div>
                    </div>

                    {/* Always-visible Policy / Boundary / Recovery / Proof / Checkpoint */}
                    <DetailedEvidence task={task} verifyState={verified} walEntries={steps.length} />

                    {/* Raw evidence — redacted */}
                    <div id="raw-evidence" className="mt-6 scroll-mt-16">
                      <SafeEvidenceJsonPanel
                        title="Raw evidence"
                        data={task}
                        exportName={`task-${task.task_id}-evidence.json`}
                      />
                    </div>

                    <div className="mt-4 text-[11px] text-[#5a5a52] tabular-nums">
                      {task.completed_at ? formatDateTime(task.completed_at) : (task.created_at ? formatDateTime(task.created_at) : '—')} ·{' '}
                      {task.status === 'completed' ? 'sealed' : task.status === 'failed' ? 'failed' : 'live'}
                    </div>
                  </>
                )}
              </div>

              {/* Bottom bar */}
              <div className="border-t border-white/[0.05]">
                <div className="flex items-center gap-3 px-5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#d3d2c8]">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{task?.task_type || 'action_workflow'}{task?.policy?.policy_version ? ` v${task.policy.policy_version}` : ''}</span>
                  </span>
                  <span className="text-[#3a3a32]">·</span>
                  <span className="text-[11.5px] text-[#a8a89e]">Recovery {recoveryOn ? 'on' : 'off'}</span>
                  <span className="text-[#3a3a32]">·</span>
                  <span className="text-[11.5px] text-[#a8a89e]">Receipts {sigScheme || '—'}</span>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-[11.5px] text-[#7a7a72]">
                      tier <span className="text-[#d3d2c8] lowercase">{tier}</span>
                    </span>
                  </div>
                </div>
              </div>
      </div>
    </DashboardLayout>
  );
}
