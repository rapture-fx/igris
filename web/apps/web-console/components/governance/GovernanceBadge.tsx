'use client';

/**
 * Tone-based status badges for the execution operations console.
 *
 * One visual vocabulary, used everywhere: a `Tone` maps to a fixed colour so
 * Allowed/Denied, Verified/Failed, Recovered/Interrupted always read the same
 * way. `GovernanceBadge` is the primitive; the named exports below wrap it for
 * each governance domain so call sites stay declarative.
 */

import { cn } from '@/utils/helpers';
import {
  handoffLabel,
  policyDecisionLabel,
  proofStateLabel,
  recoveryStateLabel,
  replayClassLabel,
  riskLabel,
  severityTone,
  type Tone,
} from '@/lib/governance';

// Mirrors the existing `StatusBadge` palette so governance badges read
// identically to the rest of the console.
const TONE_CLASSES: Record<Tone, { bg: string; text: string; border: string; dot: string }> = {
  success: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
  danger: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  warning: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  neutral: { bg: 'bg-gray-50', text: 'text-muted-foreground', border: 'border-gray-200', dot: 'bg-muted-foreground/60' },
};

export function GovernanceBadge({
  label,
  tone = 'neutral',
  showDot = true,
  className,
}: {
  label: string;
  tone?: Tone;
  showDot?: boolean;
  className?: string;
}) {
  const c = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
        c.bg,
        c.text,
        c.border,
        className,
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', c.dot)} />}
      {label}
    </span>
  );
}

// ── Domain-specific wrappers ────────────────────────────────────────────────

export function PolicyBadge({ decision, className }: { decision?: string | null; className?: string }) {
  const { label, tone } = policyDecisionLabel(decision);
  return <GovernanceBadge label={label} tone={tone} className={className} />;
}

export function RiskBadge({ risk, className }: { risk?: string | null; className?: string }) {
  const { label, tone } = riskLabel(risk);
  return <GovernanceBadge label={label} tone={tone} className={className} />;
}

export function ReplayClassBadge({ replayClass, className }: { replayClass?: string | null; className?: string }) {
  const { label, tone } = replayClassLabel(replayClass);
  return <GovernanceBadge label={label} tone={tone} className={className} />;
}

export function RecoveryBadge({ status, className }: { status?: string | null; className?: string }) {
  const { label, tone } = recoveryStateLabel(status);
  return <GovernanceBadge label={label} tone={tone} className={className} />;
}

export function ProofBadge({ status, className }: { status?: string | null; className?: string }) {
  const { label, tone } = proofStateLabel(status);
  return <GovernanceBadge label={label} tone={tone} className={className} />;
}

export function HandoffBadge({ decision, className }: { decision?: string | null; className?: string }) {
  const { label, tone } = handoffLabel(decision);
  return <GovernanceBadge label={label} tone={tone} className={className} />;
}

/** Severity badge for boundary / policy violations. */
export function ViolationSeverityBadge({
  severity,
  className,
}: {
  severity?: string | null;
  className?: string;
}) {
  const tone = severityTone(severity);
  const label = severity
    ? severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase()
    : 'Unknown';
  return <GovernanceBadge label={label} tone={tone} className={className} />;
}
