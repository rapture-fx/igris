# Durable Execution Recovery

Runtime checkpoints are stored as WAL-backed checkpoint payloads with a digest,
runtime ID, committed step watermark, and WAL entries. Overture reconstructs a
cumulative checkpoint for recovery and validates task IDs, entry IDs, and
watermarks before resume.

Recovery events are persisted for runtime failure detection, checkpoint
selection, handoff allow/deny, redispatch, skip, and failure. These events are
operator-readable and safe to expose.

Irreversible or non-replayable actions are manual-only on recovery. The
coordinator records a skipped replay event and fails safely rather than
redispatching without approval.

Production-ready: same-runtime and clean-host recovery for resumable tasks with
valid cumulative checkpoints.

Experimental: compatible-runtime resume across heterogeneous runtimes.
