# Cloud development

The repository includes a dev container for GitHub Codespaces, VS Code Dev
Containers, and compatible cloud-development systems. It removes dependence on
the original maintainer's laptop paths and installs the toolchains used by the
current repository:

- Python 3.11 and `uv` (the SDK supports Python 3.10 through 3.13);
- Go 1.24;
- Rust 1.75;
- Node 20.19.5 and pnpm 8.15.0; and
- Docker/Compose for disposable local services.

Open the repository in the container and wait for
`.devcontainer/post-create.sh` to finish. The setup does not read or create
product credentials.

## Fast checks

From the repository root:

```bash
git diff --check
make sdk-python-test
GOCACHE=/tmp/igris-gocache go test ./igris-overture/api \
  -run 'TestHandleAction|TestBuildActionRunRequest' -count=1 -timeout=180s
cargo test --manifest-path igris-runtime/Cargo.toml --workspace
```

The full Rust workspace is large. For a focused Runtime callback check use:

```bash
cargo test --manifest-path igris-runtime/crates/igris-server/Cargo.toml \
  runtime_callback --features agent-platform
```

## Documentation checks

Install web dependencies once:

```bash
cd web
pnpm install --frozen-lockfile
pnpm --filter @igris/web-docs-hub docs:generate
pnpm --filter @igris/web-docs-hub validate
```

Run the landing checks from the same `web` workspace:

```bash
pnpm --filter @igris-inertial/web-landing lint
pnpm --filter @igris-inertial/web-landing build
```

## Fast proof gate

The fast proof gate requires PostgreSQL 16. Start the repository's disposable
local stack or provide a disposable PostgreSQL URL, then run:

```bash
make igris-local-up
scripts/ci_proof_gate.sh fast
```

The local stack applies migrations only to its explicitly configured local
database. Do not point it at shared, staging, or production databases. The
GitHub Actions proof gate is the clean-host reference and provisions its own
PostgreSQL 16 service.

## Required tools outside the dev container

Developers who do not use the container need:

- Git;
- Python 3.10 or newer plus `uv`;
- Go 1.24;
- Rust 1.75 or newer;
- Node 20.19.5 plus pnpm 8.15.0;
- PostgreSQL 16 client tools; and
- Docker/Compose only when using the containerized local stack.

Ruby 3.2.2 is additionally required for Rails Console development. It is not
required for PRD/docs checks or core Python SDK tests and is intentionally not
installed in the minimal container.

## Configuration and secrets

Copy `.env.example` to an untracked local file only when a test needs runtime
configuration. Never commit populated environment files.

Hosted-alpha deployment and live integration may require these secret names:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `BETTER_AUTH_SECRET`
- `RESEND_API_KEY`
- `IGRIS_API_KEY_HMAC_SECRET`
- `IGRIS_EXECUTION_INPUT_REF_KEYS`
- `IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION`
- `IGRIS_DB_WRITE_GATEWAY_URL`
- `RUNTIME_CALLBACK_PRIVATE_KEY`
- `RUNTIME_CALLBACK_PUBLIC_KEY`

This list documents names, not values. Use the deployment platform's secret
store. See `docs/AZURE_DEPLOY_RUNBOOK.md` and `docs/LIVE_MODE_BRINGUP.md` for
operator-only deployment configuration.

## Path policy

Scripts and docs must use repository-relative paths, `$PWD`, or documented
environment variables. Do not add `/Users/...`, a maintainer home directory,
or a local worktree path to production code, tests, or onboarding.
