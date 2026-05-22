'use client';

/**
 * PolicyDecisionCard — shows the action policy decision recorded *before*
 * runtime dispatch: outcome, operator reason, risk, replay class, irreversible
 * and human-gated flags, policy version, and the action digest.
 */

import { ShieldCheck } from 'lucide-react';
import type { Task } from '@/hooks/useTasks';
import { KeyValueGrid } from '@/components/execution/shared';
import {
  PolicyBadge,
  ReplayClassBadge,
  RiskBadge,
  GovernanceBadge,
} from './GovernanceBadge';

export function PolicyDecisionCard({ policy }: { policy?: Task['policy'] }) {
  if (!policy || !policy.decision) {
    return (
      <CardShell>
        <p className="text-xs text-muted-foreground">
          No policy decision was recorded for this task. Policy evaluation runs before
          runtime dispatch — absence means the task predates execution governance or has
          not yet been classified.
        </p>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <PolicyBadge decision={policy.decision} />
        <RiskBadge risk={policy.risk_level} />
        <ReplayClassBadge replayClass={policy.replay_class} />
        {policy.irreversible && <GovernanceBadge label="Irreversible" tone="danger" />}
        {policy.human_gated && <GovernanceBadge label="Human-gated" tone="warning" />}
      </div>

      {policy.reason && (
        <p className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-foreground">
          {policy.reason}
        </p>
      )}

      <KeyValueGrid
        rows={[
          { label: 'Decision', value: policy.decision },
          { label: 'Action', value: policy.action_name ?? '—' },
          { label: 'Risk level', value: policy.risk_level ?? '—' },
          { label: 'Replay class', value: policy.replay_class ?? '—' },
          { label: 'Irreversible', value: policy.irreversible ? 'Yes' : 'No' },
          {
            label: 'Human gate',
            value: policy.human_gated ? 'Required' : 'Not required',
          },
          { label: 'Policy version', value: policy.policy_version ?? '—' },
          {
            label: 'Decision ID',
            value: policy.decision_id ?? '—',
            mono: Boolean(policy.decision_id),
            copyable: policy.decision_id,
          },
          {
            label: 'Action digest',
            value: policy.action_digest ?? '—',
            mono: Boolean(policy.action_digest),
            copyable: policy.action_digest,
          },
        ]}
      />

      {policy.policy_version?.includes('builtin') && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Decided by the built-in execution governance classifier. Rich tenant-authored
          policy rules are experimental and not in force here.
        </p>
      )}
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        Policy decision
      </div>
      {children}
    </div>
  );
}
