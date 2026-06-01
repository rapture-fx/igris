# Azure Deploy Runbook

This documents the current semi-manual workflow. It does not add automatic
deployment.

## Current Behavior

- GitHub Actions builds container images and pushes GHCR tags such as
  `sha-<short>`.
- Azure Container Apps do not auto-deploy from GitHub commits.
- A human chooses the GHCR image SHA and runs the Azure deployment script.
- Custom domains are not required for live QA; use default Azure URLs first.

## Deploy Rails-Only Changes

1. Confirm the change only affects the Rails console or docs needed by the
   console image.
2. Let GitHub Actions build and push `igris-console:sha-<short>`.
3. Set `CONSOLE_IMAGE` to that exact SHA tag.
4. Keep `OVERTURE_API_BASE_URL` pointed at the current live API URL.
5. Run the console deploy script in a separate approved deploy task:

   ```bash
   scripts/azure/03-deploy-console.sh
   ```

6. Run smoke tests immediately after the new revision is live.

## Deploy Go-Only Changes

1. Confirm the change affects only the Go API image.
2. Let GitHub Actions build and push `igris-api:sha-<short>`.
3. Set `API_IMAGE` to that exact SHA tag.
4. Run the API deploy script in a separate approved deploy task:

   ```bash
   scripts/azure/02-deploy-api.sh
   ```

5. Verify API health and readiness before testing the console.

## Migrations

Use the Neon direct URL for migrations, never the pooled runtime URL. Keep the
URL in a password manager or secret store, not in files.

Order:

1. Review SQL for destructive changes.
2. Snapshot/export if the change is not trivially reversible.
3. Apply migrations against the direct Neon URL.
4. Deploy the API image that expects the new schema.
5. Deploy the console image only if it depends on the new API/schema.
6. Run smoke tests.

## Smoke Test Timing

Run after every deploy and rollback:

```bash
scripts/smoke/live-mode-smoke.sh
scripts/smoke/action-endpoint-smoke.sh
scripts/smoke/runtime-key-smoke.sh
```

For runtime-key creation, prefer browser QA unless the task explicitly requires
scripted key creation.

## Rollback

Rollback is image-based:

1. Find the last known-good GHCR `sha-<short>` tag for the affected app.
2. Set `API_IMAGE` or `CONSOLE_IMAGE` to that previous SHA.
3. Run only the affected deploy script in a separate approved deploy task.
4. Run smoke tests against the default Azure URLs.
5. If a migration caused the failure, assess whether data rollback is possible
   before reverting application images.

## Do Not Add Yet

- No auto-deploy on commit.
- No custom-domain binding during readiness QA.
- No deployment from `latest` when a pinned SHA is available.
