# Durable Execution Recovery

Runtime checkpoints are stored as WAL-backed checkpoint payloads with a digest,
runtime ID, committed step watermark, and WAL entries. Overture reconstructs a
cumulative checkpoint for recovery and validates task IDs, entry IDs, and
watermarks before resume.

Checkpoint callbacks are accepted only after the runtime callback envelope is
validated in strict mode. The envelope binds the exact checkpoint body digest to
tenant ID, task ID, runtime ID, callback type, timestamp, nonce, and Ed25519
signature. Stale, replayed, wrong-runtime, malformed, and body-tampered
checkpoint callbacks are rejected before checkpoint persistence.

In the Rust runtime path, checkpoint callbacks are sent live when Overture
dispatches callback configuration to the runtime. Completion and failure
callbacks use the same signed envelope mechanism. The synchronous submit
response remains in place for execution artifact and receipt persistence.

Recovery events are persisted for runtime failure detection, checkpoint
selection, handoff allow/deny, redispatch, skip, and failure. These events are
operator-readable and safe to expose.

Irreversible or non-replayable actions are manual-only on recovery. The
coordinator records a skipped replay event and fails safely rather than
redispatching without approval.

Production-ready: same-runtime and clean-host recovery for resumable tasks with
valid cumulative checkpoints, with signed checkpoint callback authorization and
auditable rejected callback attempts.

Experimental: compatible-runtime resume across heterogeneous runtimes.
