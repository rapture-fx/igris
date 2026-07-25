# Hosted Alpha remote operations

Status: operator guide; no cloud mutation authorized

## Supported remote path

Use GitHub Codespaces or an approved short-lived managed VM with the committed dev container. It provides Python 3.11/uv, Go 1.24, Rust 1.75, Node 20.19.5/pnpm 8.15.0, Docker/Compose, PostgreSQL client tools, and a temporary Go cache. It uses repository-relative paths and does not create or read product credentials.

```bash
git clone https://github.com/Igris-inertial/system.git
cd system
git diff --check
make sdk-python-test
GOCACHE=/tmp/igris-gocache go test ./igris-overture/api \
  -run 'TestHandleAction|TestBuildActionRunRequest' -count=1 -timeout=180s
cd web && pnpm install --frozen-lockfile
pnpm --filter @igris/web-docs-hub docs:generate
pnpm --filter @igris/web-docs-hub validate
```

Full Rust workspace, Docker proof-gate, and disposable-Postgres suites need network, cache/disk, Docker, and a disposable database. They must never point to a hosted database. Rails work requires Ruby 3.2.2 and is not needed for environment-contract review.

## Identity and secrets

Remote agents use personal GitHub access with least privilege. Deployments use protected GitHub Environments and GitHub OIDC into Azure; a shell never receives Azure client secrets. Azure discovery uses an approved read-only/time-bounded role; Neon, Cloudflare, and Resend use distinct scoped service accounts. Never copy a laptop credential, `.env`, database URL, API key, or SSH key into Codespaces, chat, Git, CI output, or artifacts.

Names an operator may validate, never values: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_CONTAINERAPPS_ENV`, `DATABASE_URL`, `DATABASE_URL_DIRECT`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `IGRIS_EXECUTION_INPUT_REF_KEYS`, and `IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION`.

## Safe discovery and review

Install provider CLIs only in the ephemeral remote environment and authenticate solely with the approved read-only identity. Record names, region, lifecycle, tags, and non-secret configuration references in the private release record; redact subscription, tenant, project, and private-host identifiers from repository documents. Never use create/update/delete/restart, secret-read, migration, DNS, email, or publication commands during discovery.

This audit has GitHub repository read access only. Azure and Neon CLIs/identities, Cloudflare account access, and Resend access are unavailable; a local Azure profile has zero subscriptions and is not usable evidence of access. Provider inventory must remain explicitly blocked rather than inferred from source. GitHub shows only title-case `Preview` and `Production`, both with no protection rules and administrator bypass enabled, while all Azure deployment workflows require lower-case `staging` and `production`. The approved model is lower-case `preview`/`staging`/`production`: `preview` is disposable web-preview scope only, protected `staging` is the sole Hosted Alpha deployment environment, and `production` is reserved/inactive. Do not rename, replace, copy values from, or delete the legacy environments in place.

Use GitHub metadata only to reconcile names. The legacy `Production` Azure variables and GHCR secrets need newly owner-attested lower-case `staging` replacements; no current value may be copied. Repository-level `DOCS_SYNC_TOKEN`, `PROD_*`, `TAILSCALE_AUTHKEY`, and `VPS_SSH_KEY` are blocked from reuse until their owners, consumers, and rotation state are attested. See the environment contract for the complete no-value inventory.

- Work from a clean dedicated worktree; never clean another checkout.
- Require commit SHA and immutable image digest in review records.
- Use only job-scoped/local Postgres in tests; migration owner alone uses `DATABASE_URL_DIRECT` after approval.
- Treat target allowlists and rotation as reviewed releases, never shell edits.
- Capture only redacted evidence: SHA, digest, environment, status, timestamp, and check URL.
