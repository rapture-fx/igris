# Execution Policy Model

Igris records an action policy decision before runtime dispatch. A decision
contains tenant, task, agent, runtime, action name, risk level, replay class,
irreversibility, decision outcome, policy version, and operator-readable reason.

Supported outcomes are `allowed`, `denied`, and `approval_required`. Supported
replay classes are `retryable` and `non_retryable`. Irreversible and
human-gated actions are explicitly marked and are not automatically replayed.

The existing capability-envelope flow remains in force. The action policy layer
adds a task/action ledger around that capability decision so operators can trace
requested action -> policy decision -> dispatch or gate.

Production-ready: default-deny capability enforcement, signed permission
envelopes, persisted action decisions, denied dispatch blocking.

Experimental: rich tenant-authored action policy rules beyond the conservative
built-in classifier.
