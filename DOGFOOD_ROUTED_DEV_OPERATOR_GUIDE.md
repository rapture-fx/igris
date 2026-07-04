# Igris-Routed Development — Operator Guide

Internal guide for running and reviewing the local routed-development dogfood
loop added in PR #60. The normative contract is
`DOGFOOD_IGRIS_ROUTED_DEVELOPMENT.md`; this guide is the practical "how do I
run and review it" companion.

**This is local dogfood only.** It does not deploy, does not touch production
databases or secrets, and cannot create real GitHub PRs.

## 1. Purpose

Routed development proves Igris on our own work. A coding agent keeps editing
files normally — nothing about local editing changes. But engineering actions
that are risky or externally visible (running the sanctioned test command,
pushing a branch, opening a PR) are *requested through Igris* instead of
executed directly, so they get:

- policy evaluation (approval required where configured),
- a human review step in the console,
- a signed receipt/proof trail,
- honest failure recording (a refused action is a failed run, never a quiet
  success).

The problem it solves: before this, an agent's `git push` or test run was
invisible to governance. Now the risky subset of agent activity is observable,
gated, and provable — using the exact same action/approval/receipt machinery
customers use.

## 2. Supported actions

| Action | Approval | Default mode | What it does |
|---|---|---|---|
| `repo.run_tests` | not required | always real (safe) | Runs the fixed command `node scripts/dogfood_routed_dev_gateway.js self-test`. No arbitrary command input exists. |
| `repo.push_branch` | required | dry-run | Would push `HEAD:<current-branch>` to a named remote. Refuses main/master, detached HEAD, force, dirty tree (unless `dry_run` + `allow_dirty_dry_run: true`), unknown remotes. |
| `repo.open_pr` | required | dry-run only | Would open a PR from the current branch to `main`. Real creation is disabled entirely. |

## 3. Safety model

- **Loopback-only gateway.** `scripts/dogfood_routed_dev_gateway.js` binds
  `127.0.0.1` and additionally rejects any non-loopback peer address.
- **Fixed actions only.** Three endpoints, each mapped to fixed code. There is
  no "run this command" input anywhere; git is invoked via `execFileSync`
  argv (no shell).
- **Shared-secret local auth.** Requests need the `X-Igris-Dogfood-Secret`
  header. Overture injects it at dispatch time from the
  `IGRIS_DOGFOOD_DEV_GATEWAY_SECRET` env var. Injection is allowed only for
  `webhook` actions targeting loopback `http` URLs; the secret is never stored
  in action rows (the header rides the encrypted input-ref path before
  persistence) and never appears in API responses, receipts, or console pages.
- **No production secrets.** The gateway secret is a throwaway local random
  value. Nothing here reads Neon, Azure, Polar, or Resend credentials.
- **No raw logs/diffs persisted.** Results carry digests, byte counts, exit
  codes, durations, branch/commit/dirty state — never raw output.
- **External effects are default-off.** Push is dry-run unless
  `IGRIS_DOGFOOD_ALLOW_REAL_PUSH=true` *and* the request says
  `dry_run: false`. Real PR creation is unconditionally refused.
- **Refusals are failures.** Every refusal returns non-2xx, so Igris records a
  failed run with a signed violation receipt — a refused push can never look
  successful.

## 4. How to run locally

Required services: local Postgres with Igris migrations, Overture (Go API),
one local runtime, the routed-dev gateway. The smoke script provisions and
tears down all of them for you — that is the recommended way to run the loop.

**Check out a non-main branch first.** The gateway reads the worktree's
current branch and refuses `main`/`master` for push/PR — even dry-run — so
the smoke's approved-push step fails (correctly, with a signed failed run) if
you run it while on `main`.

```sh
# one-time per machine session: local Postgres + migrations
make igris-local-up

# full loop, self-contained (builds Overture, starts runtime + gateway,
# registers the three actions, exercises approve/reject, checks for leaks)
make dogfood-routed-dev-smoke

# same, plus boots the rails console and asserts the runs render there
IGRIS_SMOKE_CONSOLE_PORT=3101 make dogfood-routed-dev-smoke-console
```

Ports used: Overture `8081`, gateway `18096`, console `3100` (override with
`IGRIS_SMOKE_CONSOLE_PORT`). The smoke fails fast if a port is taken.

To run the gateway by hand (for an interactive session instead of the smoke):

```sh
# 20+ char random local secret — never reuse a real credential
export IGRIS_DOGFOOD_DEV_GATEWAY_SECRET="$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))')"

node scripts/dogfood_routed_dev_gateway.js serve 18096 /path/to/your/worktree
```

Overture must be started with the same `IGRIS_DOGFOOD_DEV_GATEWAY_SECRET` in
its environment, and the actions registered as `webhook` actions pointing at
`http://127.0.0.1:18096/repo/...` with target metadata:

```json
{
  "local_auth_header_name": "X-Igris-Dogfood-Secret",
  "local_auth_secret_env": "IGRIS_DOGFOOD_DEV_GATEWAY_SECRET"
}
```

(See the `register_action` helper in `scripts/dogfood_routed_dev_smoke.sh` for
the exact registration payloads, including policy presets — `Safe automation`
for run_tests, `Human-gated` for push/PR.)

Sanity check the gateway alone at any time:

```sh
node scripts/dogfood_routed_dev_gateway.js self-test
```

## 5. How to review in the console

Approval-required runs appear under **Runs**; a run waiting on you has status
`approval_required`. Open the run detail (`/runs/<run-id>`) and use the
approval panel.

Inspect before deciding:

- **Action name** — `repo.push_branch` or `repo.open_pr`.
- **Request summary** — the scrubbed `metadata.request_summary` the requester
  supplied (e.g. "dry-run push current branch to origin"). This is your
  approver context; raw input is never shown.
- **Policy preset / irreversible flag** — push and PR register as
  `Human-gated` + irreversible.

Approve or reject in the panel, or via API:

```sh
curl -X POST $API/v1/actions/runs/<run-id>/approve
curl -X POST $API/v1/actions/runs/<run-id>/reject -d '{"reason":"..."}'
```

Semantics you can rely on (the smoke asserts all of these):

- **Reject never dispatches** — the gateway never sees the request.
- **Approve dispatches exactly once** — a second approve returns 409.
- **Proof/receipt**: a completed run carries a signed runtime receipt
  (receipt hash visible on the run detail). That is the tamper-evident record
  that the action ran, when, and with what safe result metadata.
- **Dry-run vs real**: the run's result evidence carries the gateway's safe
  metadata — `dry_run: true` with `would_push`/`would_open_pr` means nothing
  external happened. A real push (only possible with the env gate set) records
  `dry_run: false` plus the output digest of the actual `git push`.

## 6. What agents are allowed to do

- Edit files in the worktree normally — routed development does not intercept
  file editing.
- Request `repo.run_tests` (auto-approved, fixed command).
- Request `repo.push_branch` with `dry_run: true` (goes to human approval).
- Request `repo.open_pr` with `dry_run: true` (goes to human approval).

## 7. What agents are not allowed to do

- Run production migrations directly (or through this gateway — there is no
  such action).
- Deploy to Azure directly.
- Access Neon production databases directly.
- Push to `main`/`master` — the gateway refuses even in dry-run.
- Execute arbitrary shell through Igris — no action accepts a command string.
- Create real GitHub PRs — disabled until a separate reviewed contract adds
  token handling and deduplication.

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Smoke fails at step 9 with `approved dry-run push did not complete` | You are on `main`/`master`. The gateway refuses those branches (`refusing to operate on main/master`, HTTP 409). Check out a working branch and rerun. |
| Gateway exits with `IGRIS_DOGFOOD_DEV_GATEWAY_SECRET must be set...` | Export a 20+ char random secret before `serve` (see §4). |
| Gateway returns 401 | Header missing/wrong, or Overture was started without the same secret in its env. Both processes must share the value. |
| Smoke fails with a port-in-use message | Something is listening on 8081/18096/3100. Free the port or set `IGRIS_SMOKE_CONSOLE_PORT` for the console. |
| Console cannot connect / login fails | The console needs `OVERTURE_API_BASE_URL` + `OVERTURE_API_KEY` pointing at the local Overture, and ruby ≥ 3.0 (rbenv 3.2.2 on dev machines). The `--with-console` smoke wires this automatically. |
| Run stays `approval_required` | That is the design — nothing dispatches until a human approves. Approve in the console or via the API; the run then completes within seconds. |
| Rejected action "did not dispatch" | Correct behavior, not a bug. Verify via the gateway's `/events` counter if needed: the count for that action must not increase on reject. |
| Refused action shows as failed run | Also correct: dirty-tree, force-push, main-branch, or real-mode refusals return non-2xx, and Igris records a failed run with the refusal reason — refusals must never look successful. |
| `local webhook auth secret env is not configured` on action run | Overture's process env lacks the env var named in the action's `local_auth_secret_env` metadata. |

## 9. Current limitations

- Real branch push is default-off (`IGRIS_DOGFOOD_ALLOW_REAL_PUSH=true` +
  explicit `dry_run: false` required) and should stay off outside deliberate
  experiments.
- Real GitHub PR creation is disabled entirely — dry-run only.
- Local dogfood only: loopback gateway, throwaway secrets, ephemeral local
  stack. This is **not** production release infrastructure and must not be
  pointed at production systems.
- `repo.run_tests` runs one fixed command; there is deliberately no way to
  route arbitrary test commands yet.
