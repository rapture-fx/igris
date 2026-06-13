# First External User Dry Run

Purpose: execute one real first-user flow end to end without mutating production
in this preparation task. Run this only during an approved launch dry run with a
fresh tenant and a disposable action target.

Required environment variables, names only:

- `IGRIS_API_BASE_URL`
- `IGRIS_CONSOLE_BASE_URL`
- `IGRIS_API_KEY`
- `IGRIS_MCP_CONFIG`
- `IGRIS_TEST_TENANT_EMAIL`
- `IGRIS_TEST_TENANT_NAME`
- `IGRIS_RUNTIME_INSTALL_VERSION`
- `IGRIS_RUNTIME_ENDPOINT`
- `IGRIS_RUNTIME_ID`
- `IGRIS_ACTION_NAME`
- `IGRIS_ACTION_TARGET_URL`
- `IGRIS_ACTION_IDEMPOTENCY_KEY`

## Preconditions

- Use a fresh external-user tenant, not an internal/shared tenant.
- Use a disposable hosted API or webhook target that can prove receipt without
  causing a real customer side effect.
- Use GitHub Releases as the runtime binary source of truth.
- Do not use Neon pooled connection strings for migration or schema checks.
- Do not paste API keys, runtime keys, tokens, or DSNs into tickets, logs, chat,
  screenshots, or final reports.
- Production Neon attestation has passed with read-only checks.
- Docs deployment for the actions-first onboarding path has completed.
- Runtime install checksum metadata is available for the selected release.
- Production console authentication is enabled and fails closed.
- `IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS` is unset or false in any staging or
  production-like environment.

## Local Dry Run

Run this before any external-user staging or production dry run:

```bash
make igris-doctor
make product-promise
```

Success signal: the doctor has no FAIL items, and the product-promise suite
passes without skipped stages unless the skip is explicitly recorded as local
machine setup debt.

Stop if:

- the doctor reports an invalid API key, unreachable API base URL, missing
  runtime checksum endpoint, or invalid runtime endpoint
- the product-promise suite reports "test selector matched no tests"
- unsigned runtime callbacks are enabled outside an explicit local-only test

## Staging Dry Run

Use a staging tenant and disposable action target. Do not use production Neon or
production customer data.

1. Export only the required env var names listed above.
2. Run `./scripts/igris_doctor.sh`.
3. Create the disposable tenant and API key.
4. Register a disposable hosted API or webhook action.
5. Run REST and MCP calls with fixed idempotency keys.
6. Inspect runs, evidence, and proof state in the staging console.
7. Exercise failure modes: invalid key, action not found, approval required,
   runtime unavailable, invalid runtime endpoint, and idempotent replay.

Stop if any check leaks secrets, crosses tenant boundaries, creates duplicate
side effects, or shows proof as signed when evidence is absent.

## Production Dry Run

Run this only after staging has passed and the production stop conditions are
cleared. Use a fresh external-user tenant and disposable target. Do not run this
from an automated CI job.

## Flow

1. Create or invite the fresh tenant.
   - Success signal: console opens for the tenant and shows no prior actions,
     runs, or runtime evidence.
   - Failure signal: console shows existing tenant data or mixed project state.

2. Create an API key for the tenant.
   - Success signal: the API accepts `Authorization: Bearer $IGRIS_API_KEY`.
   - Failure signal: unauthenticated requests return `401`, and invalid keys do
     not reveal whether a tenant exists.
   - Command shape:
     - `./scripts/igris_doctor.sh`

3. Install the runtime from GitHub Releases.
   - Command shape: `VERSION=$IGRIS_RUNTIME_INSTALL_VERSION bash igris-runtime/install.sh`
   - Success signal: `igris-runtime --version` reports the expected release.
   - Failure signal: checksum mismatch, unsupported platform, or binary missing
     from `PATH`.

4. Register the runtime.
   - Command shape: call the runtime registration flow for `/v1/runtime/register`
     or the current runtime CLI registration command using `$IGRIS_API_BASE_URL`
     and `$IGRIS_API_KEY`.
   - Success signal: Rails console Runtimes shows `$IGRIS_RUNTIME_ID` as healthy
     or active, routable when applicable, and scoped to the fresh tenant.
   - Failure signals:
     - `runtime_unavailable` if the runtime is registered but not reachable.
     - invalid runtime endpoint if the endpoint is malformed or unreachable.
     - tenant mismatch if runtime identity is not scoped to the fresh tenant.

5. Create one registered action.
   - Use a hosted API/webhook action first, then a local-runtime action if the
     hosted path succeeds.
   - Required fields: action name, target type, target URL or runtime target,
     policy preset, replay class, approval requirement, and secret reference
     names only.
   - Success signal: `/actions` and Rails console show the action as ready.
   - Failure signal: validation errors are explicit and no fake action appears.

6. Run the action through REST.
   - Command shape:
     - `POST $IGRIS_API_BASE_URL/v1/actions/$IGRIS_ACTION_NAME/run`
     - Include `Authorization: Bearer $IGRIS_API_KEY`.
     - Include `Idempotency-Key: $IGRIS_ACTION_IDEMPOTENCY_KEY`.
   - Success signal: response includes a real task/run identifier and does not
     echo raw secret values.
   - Idempotency signal: replaying the exact idempotency key returns the same
     logical task/run instead of creating a duplicate side effect.

7. Run the action through MCP `call_action`.
   - Use the registered action name and the same safe sample input.
   - Claude Code command shape: configure `igris mcp serve --api-url
     $IGRIS_API_BASE_URL` with `IGRIS_API_KEY` in the MCP server environment.
   - Success signal: MCP returns the same product-level result shape as REST,
     with a run/task identifier inspectable in Rails.
   - Failure signal: unknown action returns an explicit not-found/validation
     error, not a generic success.

8. Verify expected failure modes.
   - `approval_required`: create or select a human-gated action and confirm the
     run pauses without executing the side effect.
   - `runtime_unavailable`: stop the runtime or use a local-runtime action with
     no healthy runtime and confirm the run fails honestly.
   - invalid runtime endpoint: register or configure an invalid endpoint and
     confirm the error is explicit and tenant-scoped.
   - idempotent replay: repeat a REST call with the same idempotency key and
     confirm no duplicate side effect occurs.

9. Inspect run and evidence in Rails console.
   - Open the run detail.
   - Confirm status, routed target, policy, recovery state, proof state, and
     safe evidence rows are present.
   - Confirm raw request bodies, Authorization headers, cookies, tokens,
     passwords, and secret values are absent.

10. Inspect proof, receipt, and evidence.
    - Verify receipt/proof state is either `Proof verified`, `Proof pending`, or
      `Proof unavailable`; it must not be falsely marked signed.
    - If runtime evidence is expected, verify receipt hash/signature fields are
      present and tied to the correct tenant/run.
    - Confirm evidence remains visible after page refresh and API refetch.

## Stop Conditions

- Neon production attestation has not passed.
- Docs deployment for first-agent onboarding is not live.
- Runtime install checksum metadata is missing for the selected release.
- Console authentication is missing or does not fail closed.
- `IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS` is enabled in staging or production.
- Any cross-tenant data appears in console, REST, MCP, or proof output.
- Any secret value appears in response bodies, logs, screenshots, or Rails UI.
- Idempotent replay creates a second side effect.
- Runtime proof is reported as signed when evidence is absent.
- A failed request renders as a fake success state.
- The action gateway accepts raw execution internals such as `tenant_id`,
  `task_definition`, `runtime_endpoint`, `runtime_id`, raw bodies, ciphertext,
  nonce, or key material.

## Cleanup And Rollback

For local dry runs:

- stop local processes started for the run
- delete temporary files under the artifact directory printed by the script
- remove disposable env exports from the shell session

For staging and production dry runs:

1. Archive or delete the disposable action.
2. Revoke the disposable API key.
3. Deregister the disposable runtime or mark it inactive.
4. Delete or disable the disposable webhook target.
5. Confirm the tenant no longer has active dry-run actions or runtimes.
6. Keep only non-sensitive launch-record fields listed below.

If a stop condition is hit after an external side effect, do not retry with a new
idempotency key until the side effect is confirmed safe to repeat or has been
manually compensated.

## Record

For the launch record, capture only:

- tenant identifier or non-sensitive alias
- runtime id
- action name
- run/task ids
- pass/fail status for REST, MCP, proof, idempotency, and failure-mode checks
- timestamps
- non-sensitive error codes
