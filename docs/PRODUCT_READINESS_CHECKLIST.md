# Product Readiness Checklist

Status values:

- `Pass` means the route or code path exists and is represented in the current
  repo.
- `Manual pending` means the live browser or curl flow must still be verified
  against the Azure default URLs.
- `Fail` means a known gap blocks user-facing readiness.

## Pass

| Area | Evidence |
| --- | --- |
| Settings: project rename | Rails `PATCH /project` calls Go `PATCH /v1/project`; Go validates and tenant-scopes the write. |
| Settings: Agent / app API key creation | Rails `POST /settings/api-keys` calls Go `POST /v1/api-keys`; raw key is render-only and shown once. |
| Settings: API key list/revoke | Rails lists metadata only and calls Go `DELETE /v1/api-keys/:id`; runtime keys are excluded from this list. |
| Actions: create action | Rails wizard posts to Go `POST /v1/actions` with validated names, targets, and policy presets. |
| Action Detail: endpoint display | Action detail page has endpoint/curl surfaces backed by `OVERTURE_PUBLIC_API_URL` or API base URL. |
| Action Detail: test request | `POST /actions/:id/run` parses JSON, calls Go `POST /v1/actions/:name/run`, and redirects to the run detail on success. |
| Runs: run list | Rails `/runs` reads Go `GET /v1/tasks`, supports filtering, and handles degraded API responses. |
| Runs: Run Inspector drawer | Rails `/runs?inspect=<id>` surface exists and is covered by controller tests. |
| Run Detail: audit/evidence language | Run detail tests cover evidence/proof wording and avoid raw secret output. |
| Runtimes: runtime key creation | Rails `POST /runtimes/api_key` calls Go `POST /v1/runtime/api-key`; raw key is render-only and shown once. |
| Runtimes: runtime install/start command | `/runtimes` renders local runtime guidance and key status from Go metadata. |
| External API call using Agent / app API key | Go action routes are protected by BetterAuth and accept tenant `igris_` keys. `scripts/smoke/action-endpoint-smoke.sh` exercises this path. |
| Error state: invalid JSON | Rails action test flow catches `JSON::ParserError` and returns inline correction copy. |
| Error state: runtime unavailable | Go returns `runtime_unavailable` for unavailable local runtimes; Rails maps it to operator-facing guidance. |
| Error state: policy denied | Go returns `403 policy_denied`; Rails maps it to inline test-result copy. |
| Error state: API degraded | Rails data source/client preserves degraded state and renders the degraded strip instead of crashing. |

## Manual Pending

| Area | Live check |
| --- | --- |
| Project rename persistence | Rename project in Settings, reload, and confirm the name persists from Go/Neon. |
| Agent/app API key copy-once behavior | Create a key in Settings, confirm raw value appears once, reload, and confirm only prefix metadata remains. |
| API key revoke | Revoke a temporary key, then confirm it can no longer call `GET /v1/actions`. |
| Action creation in live console | Create a real action from `/actions/new`; confirm redirect to Action Detail. |
| Endpoint snippets | Confirm snippets show the Azure API default URL, not old Render or unbound custom domains. |
| Action test request | Send valid JSON from Action Detail and confirm redirect to `/runs/<id>`. |
| Runs list and inspector | Confirm the new run appears in `/runs` and opens in the inspector drawer. |
| Run detail evidence | Confirm Run Detail uses audit/evidence/proof language and does not expose secrets. |
| Runtime key copy-once behavior | Create a runtime key from `/runtimes`, confirm the command includes it once, reload, and confirm only metadata remains. |
| Runtime live registration | Start a local runtime with the generated runtime key and confirm it appears healthy in `/runtimes`. |
| Invalid JSON UX | Submit malformed JSON in Action Detail and confirm inline error. |
| Runtime unavailable UX | Create or use a local-runtime action without a healthy runtime and confirm `runtime_unavailable` guidance. |
| API degraded UX | Temporarily test against an invalid API base in a non-production local console, or observe during an API outage; do not change live Azure env for this check. |

## Fail

No repository-level product-loop failures were found in this audit. Runtime
live registration remains manual-pending because it requires running the local
runtime on the founder's machine with live credentials.
