# First External User Dry Run

Purpose: execute one real first-user flow end to end without mutating production
in this preparation task. Run this only during an approved launch dry run with a
fresh tenant and a disposable action target.

Required environment variables, names only:

- `IGRIS_API_BASE_URL`
- `IGRIS_CONSOLE_BASE_URL`
- `IGRIS_API_KEY`
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

## Flow

1. Create or invite the fresh tenant.
   - Success signal: console opens for the tenant and shows no prior actions,
     runs, or runtime evidence.
   - Failure signal: console shows existing tenant data or mixed project state.

2. Create an API key for the tenant.
   - Success signal: the API accepts `Authorization: Bearer $IGRIS_API_KEY`.
   - Failure signal: unauthenticated requests return `401`, and invalid keys do
     not reveal whether a tenant exists.

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

- Any cross-tenant data appears in console, REST, MCP, or proof output.
- Any secret value appears in response bodies, logs, screenshots, or Rails UI.
- Idempotent replay creates a second side effect.
- Runtime proof is reported as signed when evidence is absent.
- A failed request renders as a fake success state.

## Record

For the launch record, capture only:

- tenant identifier or non-sensitive alias
- runtime id
- action name
- run/task ids
- pass/fail status for REST, MCP, proof, idempotency, and failure-mode checks
- timestamps
- non-sensitive error codes
