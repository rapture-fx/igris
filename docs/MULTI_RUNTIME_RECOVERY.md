# Multi-Runtime Recovery

Checkpoint portability is modeled as `same_runtime_only`,
`compatible_runtime`, or `any_runtime`. Overture records every handoff attempt
with source runtime, target runtime, decision, reason, checkpoint digest, and
portability mode.

Unsafe migration is blocked when the task is non-resumable, irreversible,
non-replayable, missing a valid checkpoint, or marked `same_runtime_only` and
the target differs.

Production-ready: audit ledger and conservative blocking.

Experimental: broad provider/runtime portability. Compatibility currently
requires explicit policy evidence and should be treated as a controlled feature.
