# Runtime Live E2E

This is the live runtime test path for Azure default URLs. It does not change
Rust runtime behavior.

## Binary And Package Command

From source:

```bash
cd igris-runtime
cargo build --release -p igris-server --bin igris-runtime --features agent-platform
./target/release/igris-runtime --help
```

Installed package path documented in the runtime package:

```bash
npm install -g @igris/runtime
igris-runtime --version
igris-runtime serve
```

The binary also exposes the alias `igris`, but the documented runtime command is
`igris-runtime`.

## Required Environment Variables

Use placeholders only in docs:

```bash
export IGRIS_CONFIG="/absolute/path/to/config.json5"
export IGRIS_LICENSE_KEY="<runtime-license-key>"
export IGRIS_API_KEY="<runtime-key-from-console-runtimes-page>"
export IGRIS_OVERTURE_URL="https://<api-default-fqdn>"
export IGRIS_RUNTIME_ENDPOINT="http://<host-or-tunnel>:8080"
export IGRIS_RUNTIME_SECRET="<local-runtime-http-secret>"
export IGRIS_OVERTURE_PUBLIC_KEY="<overture-ed25519-public-key-if-runtime-submission-api-enabled>"
```

Notes:

- `IGRIS_API_KEY` is the runtime key generated from `/runtimes`, not the console
  Basic auth password.
- `IGRIS_OVERTURE_URL` points the runtime registration client at the live API.
- `IGRIS_RUNTIME_ENDPOINT` is optional in code, but required for Overture to
  dispatch work back to a runtime that is reachable from the live API.
- Default security requires runtime auth and requires `IGRIS_OVERTURE_PUBLIC_KEY`
  while `IGRIS_ENABLE_RUNTIME_SUBMISSION_API` is enabled.
- `IGRIS_ALLOW_INSECURE_DEV_MODE=true` bypasses boot hardening and should not be
  used for live readiness except in an isolated local-only diagnostic.

## Connection Contract

The runtime registers with the live API when all of these are true:

- Runtime starts in online licensed mode.
- `IGRIS_API_KEY` is set.
- `IGRIS_OVERTURE_URL` points to the Azure API URL.
- The runtime can reach `POST /api/v1/runtime/register`.

The runtime sends:

- `X-API-Key: <runtime key>`
- machine id, hostname, platform, runtime version
- runtime endpoint, when `IGRIS_RUNTIME_ENDPOINT` is set
- Ed25519 public key and registration signature

After registration, it heartbeats every 30 seconds to
`POST /api/v1/runtime/heartbeat`.

## Exact E2E Steps

1. In the console, open `/runtimes`.
   Expected: runtime key section loads.

2. Create a runtime key.
   Expected: raw key appears once and the start command includes it.

3. On the local machine, export the env vars above.
   Expected: do not echo the raw key after export.

4. Validate config:

   ```bash
   igris-runtime --config "$IGRIS_CONFIG" validate-config
   ```

   Expected: config validation succeeds.

5. Start the runtime:

   ```bash
   igris-runtime --config "$IGRIS_CONFIG" serve
   ```

   Expected: logs show license validated and runtime registered with Overture.
   Logs should include a runtime id, not the raw key.

6. Check local health:

   ```bash
   igris-runtime health --url http://localhost:8080
   ```

   Expected: health check succeeds.

7. Refresh console `/runtimes`.
   Expected: the runtime appears active/healthy after a heartbeat interval.

8. Create a `local_runtime` action or use an existing one that targets the
   connected runtime.
   Expected: action detail no longer reports `runtime_unavailable`.

9. Send a test request from Action Detail.
   Expected: a run is created, Run Detail shows the selected runtime, and proof
   fields are present.

## Blocker

This repository audit cannot complete the final runtime connection test because
it requires founder-local machine access, a copy-once runtime key, a license key,
and a reachable runtime endpoint. The code path is present and documented, but
live E2E status remains manual-pending until those local steps are executed.
