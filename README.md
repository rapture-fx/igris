# Igris Inertial

Igris is the trust layer between AI agents and the actions they perform.

Keep your LLM stack. Route risky actions through Igris.

The product model is:

1. Agent reasons in your app
2. Your app calls `igris.runAction()` instead of the tool directly
3. Igris governs, executes, records, recovers, and verifies the action

Igris does not replace OpenAI, Anthropic, your agent framework, or your application code. It sits between your app and the tools, APIs, files, databases, and workflows your agent can affect.

```text
Before:  app/agent -> createIssue() -> GitHub/API/database
After:   app/agent -> igris.runAction("github.create_issue", input) -> Igris -> GitHub/API/database
```

Igris applies execution boundaries, records execution events, produces signed records, and returns task IDs, run IDs, proof status, and console links for actions that need governance and post-run inspection.

## First Integration Path

Install the TypeScript SDK and change the action/tool execution line:

```bash
npm install @igris-inertial/sdk
```

```ts
import { IgrisClient } from '@igris-inertial/sdk';

const igris = new IgrisClient({
  apiKey: process.env.IGRIS_API_KEY,
  baseUrl: process.env.IGRIS_BASE_URL,
});

await igris.runAction('github.create_issue', {
  method: 'POST',
  url: 'http://localhost:8787/issues',
  body: { repo, title, body },
}, { runtimeTarget: 'http_request' });

const safeTool = igris.wrapTool('db.update_customer', updateCustomer, {
  runtimeTarget: 'database_write',
});
```

Action manifests make the available actions explicit:

```json
{
  "actions": [
    {
      "name": "github.create_issue",
      "description": "Create a GitHub issue.",
      "risk": "medium",
      "replay_class": "non_retryable",
      "irreversible": true,
      "requires_approval": false,
      "required_secrets": ["GITHUB_TOKEN"],
      "runtime_target": "http_request"
    }
  ]
}
```

See [examples/node-action-wrapper](./examples/node-action-wrapper) for the before/after integration.

The HTTP contract behind the SDK is:

- `POST /v1/actions/run`
- `GET /v1/actions/runs/:id`

Responses include `task_id`, `run_id`, `execution_id` when available, `status`, `proof_status`, `result` when available, and `console_url` when configured. Secrets and raw proof internals are not returned.

## Deployment Modes

Igris can run in different execution surfaces without changing the product story:

- Hosted: provider-backed execution through the control plane
- Local: execution closer to where work happens
- Hybrid: hosted coordination with local execution where needed

These are deployment modes of one system, not separate products.

## Proof Status

The current public docs distinguish between:

- Proven locally
- Source-confirmed
- Technical preview
- In development / not yet proven

Use [Proof Status](./web/apps/web-docs-hub/content/docs/proof-status.mdx) and [First Verified Run](./web/apps/web-docs-hub/content/docs/first-verified-run.mdx) as the source of truth for what is demonstrated today.

Areas such as real-provider proof, local fallback, checkpoint recovery, fleet failover, robotics, ROS2, and multimodal execution should be treated according to those labels rather than assumed production-ready.

## Start Here

- Quick install: `curl -fsSL https://igrisinertial.com/install | bash`
- Docs app: [web/apps/web-docs-hub](./web/apps/web-docs-hub)
- Docs overview: [web/apps/web-docs-hub/content/docs/index.mdx](./web/apps/web-docs-hub/content/docs/index.mdx)
- Quick start: [web/apps/web-docs-hub/content/docs/quickstart.mdx](./web/apps/web-docs-hub/content/docs/quickstart.mdx)
- First verified run: [web/apps/web-docs-hub/content/docs/first-verified-run.mdx](./web/apps/web-docs-hub/content/docs/first-verified-run.mdx)
- Request -> Execute -> Verify: [web/apps/web-docs-hub/content/docs/request-execute-verify.mdx](./web/apps/web-docs-hub/content/docs/request-execute-verify.mdx)
- Verification: [web/apps/web-docs-hub/content/docs/verification.mdx](./web/apps/web-docs-hub/content/docs/verification.mdx)

## Quick Install

The public first-run path installs the Igris CLI into `~/.igris/bin`:

```bash
curl -fsSL https://igrisinertial.com/install | bash
```

The first product path does not require local Postgres, Docker, Homebrew Postgres,
or a cloned repository. Start with the SDK/action path:

After install:

```bash
igris init
igris runtime start
igris actions register ./igris.actions.json
igris actions list
igris doctor
igris version
```

The installer does not use `sudo`, does not silently edit shell profiles, and
prints PATH instructions if `~/.igris/bin` is not already available.

## Advanced Local Validation

To validate the core product promise on a developer machine, run the local proof
loop:

```bash
make run-recover-prove-local-provision
```

The command provisions or reuses local Postgres, applies the Overture migrations,
runs setup checks, and executes the live Run / Recover / Prove demo without
`--skip-live`. It can use an existing `DATABASE_URL`/`POSTGRES_URL`, Homebrew
Postgres on macOS, or Docker Compose when Docker is already installed. Docker is
optional, not a gate for the local proof loop.

A successful run shows that Igris can run a deterministic local agent action,
recover by blocking an irreversible failed action from automatic replay, and
prove the run through signed runtime evidence and verification endpoints
returning HTTP `200`.

Expected successful output includes:

- `live action path: real`
- `signed callback mode: live-server-backed`
- `failure/recovery mode: live-server-backed`
- `receipt verify HTTP status: 200`
- `task verify HTTP status: 200`

This is a local developer proof, not a production guarantee. It does not claim
host hardening, broad fleet failover, or real-provider production readiness.
Use [Run, Recover, Prove Locally](./docs/RUN_RECOVER_PROVE_LOCAL.md) for the
full runbook, Homebrew/manual Postgres setup, optional Docker lifecycle
commands, and troubleshooting.

External tester path:

1. Open [External Tester Checklist](./docs/EXTERNAL_TESTER_CHECKLIST.md).
2. Run `make run-recover-prove-local-provision`.
3. Share the checklist feedback answers and only redacted output.

Use [Replay Safety Demo](./docs/REPLAY_SAFETY_DEMO.md) for the recovery
scenario and [Receipt and Proof Spec v0.1](./docs/specs/IGRIS_RECEIPT_PROOF_SPEC_V0_1.md)
for the proof model.

## Repository Layout

- `igris-overture/`: control-plane and API implementation
- `igris-runtime/`: runtime implementation for local execution surfaces
- `web/apps/web-docs-hub/`: public documentation site
- `web/apps/web-landing/`: marketing and product website
- `web/apps/rails-console/`: **active console** — Rails app for actions, runs, runtimes, settings (served at `app.igrisinertial.com` / `console.igrisinertial.com`). See `web/apps/rails-console/README.md`.
- `rust-core/`: lower-level runtime and routing support code where applicable

## Architecture Context

Internal component names still exist in the codebase, but they are implementation details:

- the control plane coordinates hosted and hybrid execution workflows
- the runtime executes work in local environments
- the docs, landing site, and console explain and operate the same unified execution system

For the current architecture explanation, start with [Architecture](./web/apps/web-docs-hub/content/docs/architecture.mdx) instead of older multi-product descriptions.

## Validation

The docs app already includes validation and build checks:

```bash
pnpm --filter @igris/web-docs-hub lint
pnpm --filter @igris/web-docs-hub exec tsc --noEmit
pnpm --filter @igris/web-docs-hub build
```

## License

See the repository license and product-specific terms where applicable.

eval "$(rbenv init -)"
ruby --version   # should now show 3.2.2
bin/rails server
