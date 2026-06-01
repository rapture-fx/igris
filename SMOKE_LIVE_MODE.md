# Live-Mode Smoke Tests

Run these manually after a live deploy or rollback. They do not deploy, mutate
Azure resources, or require secrets to be written into files.

Use the Azure Container Apps default URLs until custom domains are bound:

```bash
export API_BASE="https://<api-default-fqdn>"
export CONSOLE_BASE="https://<console-default-fqdn>"
export OVERTURE_API_KEY="<agent-or-console-service-key>"
export ADMIN_USERNAME="<admin-username>"
export ADMIN_PASSWORD="<admin-password>"
```

Never paste raw keys into issue comments, docs, terminal transcripts, or commits.

## 1. Core Live Smoke

```bash
scripts/smoke/live-mode-smoke.sh
```

Checks:

- API `GET /healthz` and `GET /readyz`.
- `GET /v1/actions` returns `401` without a key.
- `GET /v1/actions` returns `200` with a key.
- `POST /v1/actions` creates or reuses `smoke_check` without printing secrets.
- Console `GET /up` returns `200`.
- Console `/actions` challenges without Basic auth and does not show the demo
  chip when credentials are provided.

## 2. Action Endpoint Smoke

```bash
scripts/smoke/action-endpoint-smoke.sh
```

Checks:

- Creates a unique temporary `mock_demo` action.
- Calls `POST /v1/actions/<name>/run` with the API key.
- Extracts `task_id` from the response.
- Verifies the run through `GET /v1/tasks/<task_id>` and
  `GET /v1/actions/runs/<task_id>`.

The script does not delete the temporary action or run. Archive the action from
the console after QA if you want to remove test data.

## 3. Runtime Key Smoke

Read-only metadata check:

```bash
scripts/smoke/runtime-key-smoke.sh
```

Optional key creation check:

```bash
CREATE_RUNTIME_KEY=1 scripts/smoke/runtime-key-smoke.sh
```

The creation response includes the raw key once, but the script redacts it and
prints only the safe prefix. For copy-once validation, prefer the browser flow
on `/runtimes`.

## Expected Result

Each script exits `0` only when all required checks pass. Skips are explicit and
mean the needed optional env var was not provided.

## Manual Cleanup

Do not auto-delete live smoke records during readiness testing. Cleanup is a
manual founder decision:

- Archive temporary smoke actions from the console.
- Revoke any runtime key created only for smoke testing.
- Revoke any agent/app key created only for smoke testing.
