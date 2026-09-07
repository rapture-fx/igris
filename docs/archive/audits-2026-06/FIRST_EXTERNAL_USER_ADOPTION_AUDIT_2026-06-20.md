# First External User Adoption Audit

Date: 2026-06-20
Priority: P0
Scope: brand-new external developer from public docs to first successful action run

## Verdict

The current public adoption path does not meet the 5 minute success criterion.

A brand-new user cannot reliably install Igris and run `demo.echo` today because
the public installer cannot download the CLI artifact, the hosted API and
console hosts were not reachable from the audit network, and the docs do not
provide a complete non-circular path from account creation to the first tenant
API key.

The self-contained local demo UX is viable once a binary already exists:
`igris demo --recover-prove` completed locally in 0.12s and produced a local
execution story plus redacted evidence JSON. That does not rescue the public
onboarding path because the installer failed before a new user could reach that
command.

## Audit Method

Started from the public entrypoints:

- `README.md`
- `https://igrisinertial.com/install`
- `https://docs.igrisinertial.com/docs/install`
- `https://docs.igrisinertial.com/docs/quickstart`
- `web/apps/web-docs-hub/content/docs/first-agent-onboarding.mdx`
- `web/apps/web-docs-hub/content/docs/first-cloud-integration.mdx`
- `web/apps/web-docs-hub/content/docs/api-reference/authentication.mdx`
- `web/apps/web-docs-hub/content/docs/trial-billing.mdx`

No internal database knowledge, architecture shortcuts, or existing local
credentials were used for the external path.

## Time To First Action

| Path | Result | Time |
|---|---:|---:|
| Public installer in clean `HOME` | Failed before CLI install | 34.05s |
| First action through public `demo.echo` | Not reached | Not achieved |
| Local existing debug binary `igris demo --recover-prove` | Completed demo evidence only | 0.12s |
| Authenticated starter Action Pack `demo.echo` | Not reached | Not achieved |

Public installer command tested:

```bash
HOME="$(mktemp -d)" IGRIS_RUN_DEMO=true \
  bash -c 'curl -fsSL https://igrisinertial.com/install | bash'
```

Failure observed:

- GitHub primary artifact URL returned `404`.
- Hosted fallback distribution endpoint timed out.
- Installer exited with: `could not download Igris for macos-x86_64`.

## Ranked Blockers

### P0. Public CLI install is broken

The install script defaults to `IGRIS_VERSION=v1.6.0` and tries:

```text
https://github.com/Igris-inertial/system/releases/download/v1.6.0/igris-macos-x86_64.tar.gz
```

Observed result: `404`.

Fallback:

```text
https://overture.igrisinertial.com/v1/runtime/install?platform=macos-amd64
```

Observed result: connection timeout.

Impact: a new user cannot install the CLI, so the advertised zero-dependency
first-run path fails before any Igris command executes.

Concrete fix:

- Publish the release assets for all documented platforms, including
  `macos-x86_64`, `macos-arm64`, `linux-x86_64`, and `linux-arm64`, or update the
  installer to use the actual asset names.
- Publish matching `.sha256` files or change the docs to stop implying checksum
  verification is available for the release.
- Add a launch check that runs the public installer from a clean `HOME` on every
  supported platform before marking a release live.

### P0. Hosted API and console are unreachable from the cold path

Observed from the audit network:

- `https://console.igrisinertial.com` timed out.
- `https://app.igrisinertial.com` did not resolve.
- `https://overture.igrisinertial.com/v1/health` timed out.
- `https://overture.igrisinertial.com/healthz` timed out.
- `https://api.igrisinertial.com/v1/health` timed out.
- `https://overture.igrisinertial.com/v1/action-packs` timed out.

Impact: account creation, API-key validation, starter Action Pack install, agent
registration, run inspection, proof inspection, Evidence Memory, and Execution
Intelligence are all unavailable from the external path.

Concrete fix:

- Make one canonical public API host reachable and document only that host.
- Add public health endpoints with a stable documented path.
- Add synthetic monitoring for installer, docs, console, API health, action pack
  list, and starter pack install.

### P0. Account creation and first API key flow is incomplete and circular

`First Agent Onboarding` tells users to export:

```bash
export IGRIS_API_KEY="igris_..."
```

but does not tell a new user how to create the account or obtain the first key.

`First Hosted Integration` says "Create a tenant API key" and links to trial,
billing, and authentication docs. The API-key reference documents
`POST /v1/account/api-key`, but that endpoint itself requires session or API key
auth. That is not enough for a brand-new user starting from zero.

Impact: even if the API were reachable, a new user would likely abandon before
starter pack install because the source of `IGRIS_API_KEY` is unclear.

Concrete fix:

- Add a single "Create account and API key" section before any `IGRIS_API_KEY`
  export.
- Link directly to the console signup URL.
- Show the exact console path to generate a first agent/app API key.
- Clarify whether `POST /v1/account/api-key` can be called with a browser
  session cookie for the first key and how a CLI user obtains that session.

### P0. Documented CLI commands do not match the available local binary

Docs use:

```bash
igris templates list
igris packs install starter
igris agents register ...
igris runs inspect ...
```

The local available `igris-runtime/target/debug/igris` binary help did not list
`templates`, `packs`, `agents`, or `runs`, and `igris templates list` returned:

```text
error: unrecognized subcommand
```

The current source does define those commands, so this is likely a stale binary
or release packaging risk rather than a source-code absence.

Impact: if the published binary matches the stale binary, the first-agent docs
are unusable.

Concrete fix:

- Rebuild and publish the CLI from the current source.
- Add a release smoke test that verifies every command used in public docs:
  `doctor`, `demo --recover-prove`, `templates list`, `templates install`,
  `templates verify`, `auth login`, `agents register`, `packs list`,
  `packs install`, `actions run`, `runs inspect`, and `mcp serve`.

### P1. API host naming is inconsistent

Docs use `https://overture.igrisinertial.com`. The CLI source default is
`https://api.igrisinertial.com`. Rails settings also surface
`https://api.igrisinertial.com` as a default public API URL.

Impact: users will copy commands that require `--api-url` or env overrides. Any
missed flag sends them to a different host, making auth and network failures
harder to debug.

Concrete fix:

- Pick one canonical public API base URL.
- Make CLI defaults, console settings, docs, install script, troubleshooting,
  and API reference use the same host.
- Keep redirects if needed, but do not require users to know both names.

### P1. `First Agent Onboarding` tells users to run a repo script

The page says:

```bash
./scripts/igris_doctor.sh
```

This contradicts the no-repo external onboarding premise. A user who installed
only the CLI will not have `./scripts/igris_doctor.sh`.

Impact: brand-new users hit a missing file error during readiness checks.

Concrete fix:

- Replace the repo script with `igris doctor` for external onboarding.
- Keep `./scripts/igris_doctor.sh` only in contributor or launch-dry-run docs.

### P1. Quickstart and agent path measure different "first actions"

`Install` and `Quick Start` advertise `igris demo --recover-prove`, which is
self-contained demo evidence. The mission asks for starter Action Pack install,
agent registration, `demo.echo`, run inspection, proof, Evidence Memory, and
Execution Intelligence.

Impact: a user can think they completed onboarding after the local demo, but
they still have not created an account, authenticated, installed the starter
Action Pack, registered an agent, or run a tenant-scoped action.

Concrete fix:

- Split the docs into two clearly named flows:
  - "Local demo, no account required"
  - "First tenant action, account required"
- Make the 5 minute promise apply to the tenant action flow, not the local demo.

### P2. `RUN_ID` is introduced without a capture command

`First Agent Onboarding` runs `demo.echo`, then says:

```bash
igris runs inspect "$RUN_ID" --api-url "$IGRIS_API_URL"
```

The preceding CLI command does not show how to capture `RUN_ID`.

Impact: a successful run can still lead to inspection failure for shell users.

Concrete fix:

- Add `--json` output to the CLI or document the exact copy/paste step.
- Prefer: `RUN_ID="$(igris actions run ... --json | jq -r .run_id)"` if JSON
  output exists. If not, add JSON output before documenting this pattern.

### P2. Proof, Evidence Memory, and Execution Intelligence inspection are not
one clear first-run workflow

The docs explain proof and receipts generally, but the first-agent path stops at
`igris runs inspect`. It does not tell a user where to find Evidence Memory or
Execution Intelligence for the first `demo.echo` run.

Impact: the user cannot understand the differentiated product value without
engineering assistance.

Concrete fix:

- Add post-run commands or console paths:
  - inspect run
  - inspect proof/receipt state
  - inspect Evidence Memory
  - inspect Execution Intelligence
- Use one stable sample `demo.echo` run throughout the sequence.

### P3. Public API examples include placeholder secret printing patterns

The `POST /v1/account/api-key` JavaScript and Go examples print the raw response.
The page says the secret is returned once, but the examples still normalize
printing it to stdout.

Impact: users may leak their first tenant API key into logs or terminal history.

Concrete fix:

- Change examples to say "store in your secret manager" and avoid `console.log`
  or `fmt.Println` for the raw key.
- If examples must show output handling, print only the key prefix.

## Missing Documentation Report

Required missing docs for the first external user path:

- Exact signup URL and account creation sequence.
- Exact first API key generation path in the console.
- Exact supported public API host.
- Exact public health check command.
- One command sequence for `demo.echo` that includes install, auth, starter pack,
  agent registration, run, run inspection, proof inspection, Evidence Memory,
  and Execution Intelligence.
- CLI output examples for every command in that sequence.
- How to capture `RUN_ID`.
- What `proof_status` values mean on the starter `mock_demo` path.
- What recovery means for `demo.fail_once` versus the self-contained demo.
- How MCP users verify `list_actions`, `call_action`, `get_run`, and
  `get_run_evidence` without reading source.

## CLI Usability Report

What worked when a binary already existed:

- `igris demo --recover-prove` completed quickly.
- Output did not print private keys, tokens, raw callback bodies, database
  credentials, or environment secrets.
- The local evidence JSON and `file://` story give users something concrete to
  inspect immediately.

What failed or confused:

- Public install could not fetch the binary.
- The local binary available in the repo did not expose the documented
  first-agent commands.
- `igris doctor` output tells users to run `igris demo`, but the docs say
  `igris demo --recover-prove`.
- `igris doctor` does not validate the hosted account/API-key path.
- Missing `--json` examples make run inspection awkward.

## Authentication Usability Report

Authentication is the weakest part of the adoption journey.

Problems:

- No complete zero-to-key sequence.
- `IGRIS_API_KEY="igris_..."` appears before the user knows where it comes from.
- API-key creation endpoint appears to require an existing credential or session,
  but CLI/session mechanics are not documented for first-key creation.
- Console was unreachable during the audit, so browser session creation could
  not be validated.
- API host names differ across docs and CLI defaults.

Security notes:

- The CLI missing-key error did not print secret material.
- Installer output did not print secrets.
- The public API key examples should avoid printing raw newly-created keys.

## Places A User Could Abandon

1. Installer fails with release `404`.
2. Fallback installer endpoint times out.
3. Console signup URL times out or cannot be found.
4. User cannot obtain the first `IGRIS_API_KEY`.
5. User runs `./scripts/igris_doctor.sh` from outside a repo checkout.
6. User runs documented `igris templates list` against a binary that lacks it.
7. User copies commands with `overture.igrisinertial.com` but CLI defaults to
   `api.igrisinertial.com`.
8. User gets a run response but cannot capture `RUN_ID`.
9. User sees `proof_status` but cannot connect it to receipts, recovery,
   Evidence Memory, or Execution Intelligence.

## Recommended Fixes

### Quick Wins: Less Than 1 Day

- Publish or correct CLI release assets for the installer.
- Restore hosted fallback distribution endpoint reachability.
- Pick and document one canonical API host.
- Add one docs page called "First tenant action in 5 minutes".
- Replace `./scripts/igris_doctor.sh` with `igris doctor` in external docs.
- Add a direct signup/API-key section before `IGRIS_API_KEY` appears.
- Add a release smoke script that runs the public installer in a clean `HOME`.
- Add a docs-command smoke test for all commands copied in the first-agent page.

### Medium Fixes: Less Than 1 Week

- Add `igris onboarding` or `igris init codex --starter` that runs:
  account/key check, template install, starter pack install, agent registration,
  `demo.echo`, idempotency replay check, run inspect, and proof/evidence inspect.
- Add JSON output mode for `actions run`, `runs inspect`, proof, and evidence
  commands.
- Add public synthetic monitoring for docs, installer, release artifacts,
  console, API health, action packs, and starter action run.
- Add a first-run console checklist that starts on an empty tenant and ends at
  the first inspected run.
- Add explicit Evidence Memory and Execution Intelligence docs to the first-run
  flow.

### Major Product Gaps

- No verified external account-to-first-key path.
- No verified under-5-minute hosted `demo.echo` path.
- No single onboarding command that combines CLI, auth, Action Pack, agent
  registry, action run, proof, recovery, evidence memory, and execution
  intelligence.
- No public launch gate proving release artifacts, API, console, docs, and CLI
  docs are all in sync.

## Success Criteria Status

| Criterion | Status |
|---|---|
| New user can install Igris and run `demo.echo` within 5 minutes | FAIL |
| New user can understand proof, recovery, and execution history unaided | FAIL |
| All blockers documented with concrete fixes | PASS for this audit |

## Files Intentionally Not Touched

No product code, API code, migrations, console views, installer logic, or CLI
source were changed in this audit. This file records adoption findings only.
