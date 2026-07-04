# Igris-Routed Development Dogfood Contract

This dogfood loop proves that an agent can edit files normally while risky or
externally visible engineering actions are routed through Igris:

request -> policy -> approval when required -> dispatch -> proof/receipt ->
console review.

This is local dogfood only. It must not deploy, access production databases, use
production secrets, or route raw file editing through Igris.

## Execution Model

The actions are registered as Igris `webhook` actions that point at the local
development gateway in `scripts/dogfood_routed_dev_gateway.js`.

The gateway:

- binds to `127.0.0.1` only;
- requires `X-Igris-Dogfood-Secret`, injected by Overture from
  `IGRIS_DOGFOOD_DEV_GATEWAY_SECRET`;
- accepts only `repo.run_tests`, `repo.push_branch`, and `repo.open_pr`;
- never evaluates arbitrary shell commands;
- redacts command output and records only digests, byte counts, exit code,
  duration, branch, commit SHA, dirty/clean status, remote name, base branch,
  and dry-run state;
- returns non-2xx for refused actions so Igris records a failed run.

The shared-secret header is configured through action metadata:

- `local_auth_header_name`: `X-Igris-Dogfood-Secret`
- `local_auth_secret_env`: `IGRIS_DOGFOOD_DEV_GATEWAY_SECRET`

Overture only injects this metadata-defined header for loopback `http` webhook
targets. The header is handled by the existing input-ref protection path before
persistence, so API responses and console pages see only encrypted-ref metadata.

## Action: `repo.run_tests`

Purpose: run the fixed local dogfood test command for this gateway.

Fixed command: `node scripts/dogfood_routed_dev_gateway.js self-test`.

Approval policy: allowed without human approval because the command is fixed,
local, and has no external side effect.

Allowed environment: local worktree only, with the gateway bound to loopback.
The command inherits the local process environment but does not print env values.

Result metadata: action name, branch, commit SHA, dirty/clean status, command
label, exit code, duration, output digest, and output byte count.

Receipt/proof fields: Igris records signed runtime receipt/proof plus safe HTTP
status/digest evidence. Raw command output is not persisted by Igris.

Failure behavior: non-zero test exit returns a failed gateway result. Igris must
show the run as failed, not completed.

Must not expose: raw command logs, `.env` content, tokens, private keys, raw
diffs, production URLs, or credentialed remote URLs.

## Action: `repo.push_branch`

Purpose: push the current non-main development branch after human approval, or
dry-run that push for local dogfood.

Approval policy: human approval required.

Current branch only: the gateway reads `git branch --show-current` and only
targets `HEAD:<current-branch>`.

Refusals:

- refuses `main` and `master`;
- refuses detached HEAD;
- refuses force push;
- refuses a dirty working tree unless the request is explicitly dry-run and
  includes `allow_dirty_dry_run: true`;
- refuses missing or invalid remote names.

Default mode: `dry_run: true`. Real push requires both `dry_run: false` and
`IGRIS_DOGFOOD_ALLOW_REAL_PUSH=true`.

Result metadata: action name, branch, commit SHA, dirty/clean status, remote
name, target ref, dry-run state, duration, and command output digest/byte count
only for real pushes.

Receipt/proof fields: Igris records signed runtime receipt/proof plus safe HTTP
status/digest evidence. The action response body is redacted by the runtime.

Failure behavior: any refusal returns non-2xx and the Igris run must end failed.
Rejecting the approval-required run must never dispatch the gateway request.

Must not expose: credentialed remote URLs, GitHub tokens, raw push logs, raw
diffs, `.env` content, private keys, or production deploy credentials.

## Action: `repo.open_pr`

Purpose: open a PR from the current branch to `main`, or dry-run that PR request
for local dogfood.

Approval policy: human approval required.

Base branch: must be `main`.

Default mode: `dry_run: true`. Real GitHub PR creation is intentionally disabled
in this gateway until a separate reviewed contract adds token handling and PR
deduplication. A request with `dry_run: false` returns non-2xx.

Result metadata: action name, head branch, base branch, commit SHA,
dirty/clean status, dry-run state, title digest, and duration.

Receipt/proof fields: Igris records signed runtime receipt/proof plus safe HTTP
status/digest evidence. No raw request body or GitHub token is recorded.

Failure behavior: unsupported base branches, main/master, detached HEAD, or real
mode requests fail safely and must not appear successful.

Must not expose: GitHub tokens, full PR body, raw diffs, raw command logs,
private paths, `.env` content, private keys, or credentialed remote URLs.
