# AI Action Execution Threat Model

This document covers the Overture task coordinator, runtime task dispatch,
WAL/checkpoint recovery, signed receipts, and operator task views.

## Assumptions

- Model output and tool requests are untrusted input.
- Runtime-submitted checkpoints, receipts, boundaries, and capability claims can
  be wrong or malicious until validated by Overture.
- Runtimes may crash, repeat requests, or be compromised.
- Secrets must never be embedded in checkpoints, receipts, WAL summaries, proof
  exports, or console payloads.

## Risks and Controls

- Malicious prompt/tool use: every task is classified into action decisions
  before dispatch. Denied decisions block runtime execution.
- Privilege escalation: capability policy remains default-deny and signed
  permission envelopes bind tenant, task, runtime, and capability decisions.
- Replay attacks: task idempotency keys and recovery dispatch keys separate
  first dispatch from resume. Runtime callback nonces reject replayed
  checkpoint, complete, and failed callbacks. Irreversible/non-replayable tasks
  are not automatically replayed.
- Forged runtime callbacks: checkpoint, complete, and failed callbacks require
  signed envelopes that bind tenant ID, task ID, runtime ID, callback type,
  exact body digest, timestamp, and nonce to a registered Ed25519 runtime key.
- Stale or wrong-runtime callbacks: callback timestamps must be fresh and the
  envelope runtime ID must match the assigned task runtime unless future handoff
  policy explicitly allows otherwise.
- Forged receipts: runtime receipts are verified server-side against registered
  Ed25519 public keys before lineage persistence.
- Tampered checkpoints: checkpoint task IDs, WAL entry task IDs, stable entry
  IDs, and committed-step watermarks are validated before persistence/recovery.
- Duplicate execution: committed WAL steps are deduplicated by entry ID and
  cumulative recovery rejects conflicting duplicate committed steps.
- Unsafe retry of irreversible actions: irreversible action decisions force
  manual recovery review instead of automatic redispatch.
- Leaking secrets: API summaries expose hashes, booleans, IDs, and operator
  reasons only. Raw resume tokens and credentials are not returned.
- Compromised runtime: runtime capability declarations and boundaries are
  persisted as evidence, not trusted as authorization.
- Cross-runtime resume abuse: handoff attempts are recorded and blocked unless
  checkpoint portability and action replay safety allow it.
- Callback rejection observability: rejected runtime callback attempts are
  persisted as safe boundary/security evidence with reason and body digest, not
  raw callback bodies or secrets.

## Current Gaps

Multi-runtime portability is guarded but still experimental. Compatibility is
based on conservative runtime identity and policy metadata, not a complete
portable execution VM. Operators should treat compatible-runtime resume as
eligible for controlled rollout, not universal migration.

The Rust runtime now has an outbound callback sender for checkpoint, complete,
and failed lifecycle callbacks when callback configuration is provided by
Overture. The synchronous submit response still returns execution artifacts and
receipts for compatibility with the existing durable task path.
