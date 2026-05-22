'use client';

/**
 * ProofVerificationCard — the proof state for one task. A receipt only becomes
 * proof once Overture validates its hash and signature against a registered
 * runtime key. This card shows that verification summary: status, hash
 * validity, signature match, runtime key presence, chain-link validity, and the
 * tamper-detection reason — never logs, which are supporting evidence only.
 */

import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import type { Task } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { KeyValueGrid } from '@/components/execution/shared';
import { formatDateTime } from '@/utils/helpers';
import { ProofBadge } from './GovernanceBadge';

function CheckRow({ label, value }: { label: string; value?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {value === undefined ? (
        <span className="text-[11px] text-muted-foreground/60">Not available</span>
      ) : value ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Pass
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
          <XCircle className="h-3.5 w-3.5" />
          Fail
        </span>
      )}
    </div>
  );
}

export function ProofVerificationCard({
  task,
  onVerify,
  verifying = false,
}: {
  task: Task;
  onVerify?: () => void;
  verifying?: boolean;
}) {
  const proof = task.proof;
  const hasReceipt = Boolean(task.execution_receipt);
  const effectiveStatus =
    proof?.verified === false ? 'failed_verification' : proof?.status;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Proof verification
        </div>
        <ProofBadge status={effectiveStatus} />
      </div>

      {!hasReceipt && !proof?.status ? (
        <p className="text-xs text-muted-foreground">
          No execution receipt has been recorded. Proof verification needs a
          runtime-signed receipt before it can run.
        </p>
      ) : (
        <>
          {proof?.verification_reason && (
            <p className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-foreground">
              {proof.verification_reason}
            </p>
          )}

          <div className="rounded-md border border-gray-200 px-3 py-1.5">
            <CheckRow label="Hash valid" value={proof?.hash_valid} />
            <CheckRow label="Signature matches" value={proof?.signature_matches} />
            <CheckRow label="Runtime key registered" value={proof?.runtime_key_found} />
            <CheckRow label="Chain link valid" value={proof?.chain_link_valid} />
          </div>

          <div className="mt-3">
            <KeyValueGrid
              rows={[
                {
                  label: 'Expected hash',
                  value: proof?.expected_hash ?? '—',
                  mono: Boolean(proof?.expected_hash),
                  copyable: proof?.expected_hash,
                },
                {
                  label: 'Stored hash',
                  value: proof?.stored_hash ?? '—',
                  mono: Boolean(proof?.stored_hash),
                  copyable: proof?.stored_hash,
                },
                {
                  label: 'Signature present',
                  value: proof?.signature ? 'Yes' : 'No',
                },
                {
                  label: 'Execution ID',
                  value: proof?.execution_id ?? '—',
                  mono: Boolean(proof?.execution_id),
                  copyable: proof?.execution_id,
                },
                {
                  label: 'Verified at',
                  value: proof?.verified_at
                    ? formatDateTime(proof.verified_at)
                    : proof?.checked_at
                      ? `Checked ${formatDateTime(proof.checked_at)}`
                      : 'Not yet verified',
                },
              ]}
            />
          </div>

          {onVerify && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={!hasReceipt || verifying}
                onClick={onVerify}
              >
                {verifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                {verifying ? 'Verifying…' : 'Verify receipt'}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Re-checks the stored receipt hash and signature against the runtime key.
              </span>
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Logs are supporting evidence, not proof. A receipt is proof only after its
            hash and signature validate against a registered runtime key.
          </p>
        </>
      )}
    </div>
  );
}
