/**
 * Execution story builder.
 *
 * Turns a real `Task` record (and its WAL steps) into an ordered, plain-English
 * narrative: requested action → policy decision → runtime boundary → dispatch →
 * checkpoints → failure/recovery → receipt → proof verification → trust state.
 *
 * Every node is derived from a persisted backend field. Nothing is synthesised:
 * if the backend did not record a step, the story simply does not show it. A
 * single trailing `pending` node may describe the expected-but-not-yet-reached
 * next step so operators understand where an execution currently stands.
 */

import type { Task, WalEntry } from '@/hooks/useTasks';
import type { Tone } from './governance';
import {
  handoffLabel,
  policyDecisionLabel,
  proofStateLabel,
} from './governance';

export type StoryGroup =
  | 'request'
  | 'policy'
  | 'boundary'
  | 'dispatch'
  | 'execution'
  | 'recovery'
  | 'proof';

export interface StoryNode {
  id: string;
  group: StoryGroup;
  title: string;
  detail?: string;
  timestamp?: string;
  tone: Tone;
  /** True when this node describes an expected step that has not happened yet. */
  pending?: boolean;
}

const GROUP_ORDER: Record<StoryGroup, number> = {
  request: 0,
  policy: 1,
  boundary: 2,
  dispatch: 3,
  execution: 4,
  recovery: 5,
  proof: 6,
};

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'canceled', 'cancelled']);

/** Build the ordered execution story for a task. */
export function buildExecutionStory(
  task: Task | null | undefined,
  steps?: WalEntry[] | null,
): StoryNode[] {
  if (!task) return [];

  const nodes: StoryNode[] = [];
  const push = (n: StoryNode) => nodes.push(n);

  // 1. Action requested.
  push({
    id: 'requested',
    group: 'request',
    title: 'Action requested',
    detail: task.policy?.action_name
      ? `Action: ${task.policy.action_name}`
      : task.task_type
        ? `Task type: ${task.task_type}`
        : 'Task accepted by the control plane.',
    timestamp: task.created_at,
    tone: 'neutral',
  });

  // 2 & 3. Policy evaluated, then the decision outcome.
  if (task.policy?.decision) {
    push({
      id: 'policy-evaluated',
      group: 'policy',
      title: 'Policy evaluated',
      detail: task.policy.policy_version
        ? `Evaluated against ${task.policy.policy_version}.`
        : 'Action classified before runtime dispatch.',
      timestamp: task.policy.created_at,
      tone: 'neutral',
    });
    const decision = policyDecisionLabel(task.policy.decision);
    push({
      id: 'policy-decision',
      group: 'policy',
      title: decision.label,
      detail: task.policy.reason,
      timestamp: task.policy.created_at,
      tone: decision.tone,
    });
  }

  // 4. Runtime boundary recorded.
  if (task.runtime_boundary) {
    const tools = Array.isArray(task.runtime_boundary.allowed_tools)
      ? task.runtime_boundary.allowed_tools.length
      : 0;
    push({
      id: 'boundary',
      group: 'boundary',
      title: 'Runtime boundary selected',
      detail: [
        task.runtime_boundary.environment_label &&
          `Environment: ${task.runtime_boundary.environment_label}`,
        `Network: ${task.runtime_boundary.network_scope ?? 'none'}`,
        tools > 0 ? `${tools} allowed tool${tools === 1 ? '' : 's'}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      timestamp: task.runtime_boundary.created_at,
      tone: 'neutral',
    });
  }

  // 5. Runtime dispatched.
  if (task.dispatched_at) {
    push({
      id: 'dispatched',
      group: 'dispatch',
      title: 'Runtime dispatched',
      detail: task.runtime_id
        ? `Dispatched to runtime ${task.runtime_id}.`
        : 'Dispatched to runtime.',
      timestamp: task.dispatched_at,
      tone: 'info',
    });
  }

  // 6. WAL steps committed.
  const stepCount = steps?.length ?? task.checkpoint_summary?.wal_entry_count ?? 0;
  if (stepCount > 0) {
    push({
      id: 'wal-steps',
      group: 'execution',
      title: 'Execution steps committed',
      detail: `${stepCount} durable WAL step${stepCount === 1 ? '' : 's'} committed.`,
      timestamp: task.dispatched_at,
      tone: 'neutral',
    });
  }

  // 7. Checkpoint created.
  if (task.checkpoint_summary || task.checkpoint_digest) {
    const lastStep =
      task.checkpoint_summary?.last_committed_step ?? task.last_step;
    push({
      id: 'checkpoint',
      group: 'execution',
      title: 'Checkpoint created',
      detail:
        lastStep !== undefined
          ? `Committed watermark at step ${lastStep}.`
          : 'WAL-backed checkpoint recorded.',
      timestamp: task.dispatched_at,
      tone: 'neutral',
    });
  }

  // 8. Failure detected.
  if (task.failure_reason || task.status === 'failed') {
    push({
      id: 'failure',
      group: 'recovery',
      title: 'Failure detected',
      detail: task.failure_reason || 'Execution did not complete successfully.',
      timestamp: task.completed_at,
      tone: 'danger',
    });
  }

  // 9. Recovery events — one node each, in recorded order.
  for (const [index, event] of (task.recovery?.events ?? []).entries()) {
    const blocked = event.replay_allowed === false;
    push({
      id: `recovery-${index}`,
      group: 'recovery',
      title: recoveryEventTitle(event.event_type, blocked),
      detail: [
        event.reason,
        event.target_runtime_id && `Target runtime: ${event.target_runtime_id}`,
        event.last_committed_step !== undefined &&
          `Resumed from step ${event.last_committed_step}`,
      ]
        .filter(Boolean)
        .join(' · '),
      timestamp: event.created_at,
      tone: blocked ? 'warning' : 'neutral',
    });
  }

  // 10. Runtime handoff.
  if (task.runtime_handoff?.decision) {
    const handoff = handoffLabel(task.runtime_handoff.decision);
    push({
      id: 'handoff',
      group: 'recovery',
      title: handoff.label,
      detail: [
        task.runtime_handoff.reason,
        task.runtime_handoff.source_runtime_id &&
          task.runtime_handoff.target_runtime_id &&
          `${task.runtime_handoff.source_runtime_id} → ${task.runtime_handoff.target_runtime_id}`,
      ]
        .filter(Boolean)
        .join(' · '),
      timestamp: task.runtime_handoff.created_at,
      tone: handoff.tone,
    });
  }

  // 11. Recovery skip reason (manual-only recovery, etc).
  if (task.recovery?.skip_reason) {
    push({
      id: 'recovery-skip',
      group: 'recovery',
      title: 'Manual recovery required',
      detail: task.recovery.skip_reason,
      timestamp: task.completed_at,
      tone: 'warning',
    });
  }

  // 12. Execution completed.
  if (task.completed_at && task.status !== 'failed') {
    push({
      id: 'completed',
      group: 'execution',
      title: 'Execution completed',
      detail: 'Task reached a terminal state.',
      timestamp: task.completed_at,
      tone: 'success',
    });
  }

  // 13. Receipt received.
  if (task.execution_receipt) {
    push({
      id: 'receipt',
      group: 'proof',
      title: 'Receipt received',
      detail: 'Runtime returned a signed execution receipt.',
      timestamp: task.proof?.checked_at,
      tone: 'neutral',
    });
  }

  // 14. Proof verification outcome.
  if (task.proof?.status) {
    const proof = proofStateLabel(
      task.proof.verified === false ? 'failed_verification' : task.proof.status,
    );
    if (task.proof.status !== 'pending' && task.proof.status !== 'missing') {
      push({
        id: 'proof',
        group: 'proof',
        title: `Proof ${proof.label.toLowerCase()}`,
        detail:
          task.proof.verification_reason ||
          (task.proof.chain_link_valid === false
            ? 'Receipt chain link did not validate.'
            : undefined),
        timestamp: task.proof.verified_at ?? task.proof.checked_at,
        tone: proof.tone,
      });
    }
  }

  // Trailing pending node — the expected next step, when not terminal.
  const pending = pendingNode(task);
  if (pending) push(pending);

  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => {
      const ga = GROUP_ORDER[a.node.group];
      const gb = GROUP_ORDER[b.node.group];
      if (ga !== gb) return ga - gb;
      const ta = a.node.timestamp ? Date.parse(a.node.timestamp) : NaN;
      const tb = b.node.timestamp ? Date.parse(b.node.timestamp) : NaN;
      if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
      return a.index - b.index;
    })
    .map(({ node }) => node);
}

function recoveryEventTitle(eventType?: string, blocked?: boolean): string {
  const normalised = String(eventType ?? '').toLowerCase();
  if (normalised.includes('skip')) return 'Replay skipped';
  if (normalised.includes('redispatch')) return 'Recovery redispatch';
  if (normalised.includes('handoff')) return blocked ? 'Handoff blocked' : 'Runtime handoff';
  if (normalised.includes('fail')) return 'Recovery failed';
  if (normalised.includes('detect')) return 'Failure detected';
  if (normalised.includes('checkpoint')) return 'Recovery checkpoint selected';
  if (!eventType) return 'Recovery event';
  return eventType.replace(/[_-]+/g, ' ');
}

function pendingNode(task: Task): StoryNode | null {
  if (TERMINAL_STATUSES.has(task.status)) {
    if (task.execution_receipt && !task.proof?.verified && task.proof?.status !== 'verified') {
      return {
        id: 'pending-verify',
        group: 'proof',
        title: 'Verification not yet run',
        detail: 'Run receipt verification to confirm the proof state.',
        tone: 'info',
        pending: true,
      };
    }
    return null;
  }
  if (task.status === 'approval_required') {
    return {
      id: 'pending-approval',
      group: 'policy',
      title: 'Waiting for approval',
      detail: 'Execution is paused until a human approves the action.',
      tone: 'warning',
      pending: true,
    };
  }
  if (task.status === 'recovering') {
    return {
      id: 'pending-recovery',
      group: 'recovery',
      title: 'Recovery in progress',
      detail: 'The control plane is recovering this task.',
      tone: 'warning',
      pending: true,
    };
  }
  return {
    id: 'pending-running',
    group: 'execution',
    title: 'Execution in progress',
    detail: 'Awaiting completion and a signed receipt.',
    tone: 'info',
    pending: true,
  };
}
