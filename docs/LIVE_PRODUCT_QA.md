# Live Product QA

Use this runbook with the Azure Container Apps default URLs. Do not wait for
custom domains.

## Placeholders

Replace these in your shell or browser session only:

- `API_URL`: `https://<api-default-fqdn>`
- `CONSOLE_URL`: `https://<console-default-fqdn>`
- `ADMIN_USERNAME`: `<admin-username>`
- `ADMIN_PASSWORD`: `<admin-password>`
- `AGENT_API_KEY`: `<agent-or-app-api-key>`

Do not paste real values into docs, tickets, screenshots, or commits.

## Browser Steps

1. Open `CONSOLE_URL/up`.
   Expected: plain `ok`.

2. Open `CONSOLE_URL`.
   Expected: browser Basic auth prompt appears. Sign in with `ADMIN_USERNAME`
   and `ADMIN_PASSWORD`.

3. Open `/settings?section=project`.
   Expected: no demo chip, no degraded strip. Rename the project to a harmless
   QA name and reload.

4. Open `/settings?section=agent_keys`.
   Expected: key list shows metadata only. Create a temporary Agent/app key.
   Copy the raw key into your password manager or shell as `AGENT_API_KEY`.
   Reload and confirm the raw key is gone.

5. Open `/actions/new`.
   Expected: wizard validates name, target, policy, and endpoint steps.
   Create a temporary action with target `Mock demo` or another safe test target.

6. Open the new Action Detail page.
   Expected: endpoint/curl snippet uses `API_URL`, not old Render, Hetzner, or
   unbound custom-domain URLs.

7. In the Action Detail test panel, submit valid JSON:

   ```json
   {"source":"founder-live-qa","ok":true}
   ```

   Expected: redirect to `/runs/<run-id>` with a real run id.

8. Open `/runs`.
   Expected: the new run appears in the list.

9. Open `/runs?inspect=<run-id>`.
   Expected: Run Inspector drawer opens and shows safe status/evidence fields.

10. Open `/runs/<run-id>`.
    Expected: audit/evidence/proof language is clear and no secret values appear.

11. Open `/runtimes`.
    Expected: runtime key status loads. Create a temporary runtime key only if
    you are ready to copy it immediately. The install/start command should show
    the raw key once.

12. Reload `/runtimes`.
    Expected: raw runtime key is gone; only key metadata/prefix remains.

## Curl Steps

Health:

```bash
export API_URL="https://<api-default-fqdn>"
export AGENT_API_KEY="<agent-or-app-api-key>"

curl -fsS "$API_URL/healthz"
curl -fsS "$API_URL/readyz"
```

Expected: both commands return JSON and HTTP 200.

Unauthorized action list:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$API_URL/v1/actions"
```

Expected: `401`.

Authorized action list:

```bash
curl -sS -H "Authorization: Bearer $AGENT_API_KEY" "$API_URL/v1/actions"
```

Expected: HTTP 200 JSON with an `actions` array.

Create a temporary safe action:

```bash
ACTION_NAME="qa_tmp_$(date +%s)"
curl -sS -X POST "$API_URL/v1/actions" \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"$ACTION_NAME\",
    \"display_name\":\"QA temporary action\",
    \"description\":\"Temporary founder QA action\",
    \"target_type\":\"mock_demo\",
    \"target_url\":\"\",
    \"method\":\"POST\",
    \"policy_preset\":\"Read-only\",
    \"replay_class\":\"read_only\",
    \"approval_required\":false,
    \"irreversible\":false
  }"
```

Expected: HTTP 201 JSON for the new action.

Call the action endpoint:

```bash
curl -sS -X POST "$API_URL/v1/actions/$ACTION_NAME/run" \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":{"source":"founder-live-qa","ok":true}}'
```

Expected: HTTP 202 JSON with `task_id`. Open `CONSOLE_URL/runs/<task_id>`.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `CONSOLE_URL/up` is not 200 | Console container down or cold-start failure | Check console logs; do not redeploy until the failing revision is understood. |
| Browser never prompts for Basic auth | Admin username/password may be unset | Verify configured secrets in Azure portal without exposing values. |
| Console shows demo chip | `OVERTURE_API_BASE_URL` missing in console app | Stop QA and fix configuration in a controlled deploy task. |
| Console shows degraded strip | API unavailable, DB unavailable, or service key invalid | Check `API_URL/readyz` and console/API logs. |
| `GET /v1/actions` with key returns 401 | Wrong, revoked, or copied-truncated key | Create a new Agent/app key and retry. |
| Action create returns 400 | Invalid action name or payload | Use lowercase letters, numbers, and underscores; choose a supported target. |
| Action run returns `runtime_unavailable` | Local-runtime action has no healthy runtime | Test a `mock_demo` action or connect the runtime first. |
| Run detail 404 | Wrong `task_id` or tenant mismatch | Copy the `task_id` directly from the run response or Runs list. |

## Do Not Proceed To Custom Domains Until These Pass

- API `healthz` and `readyz` are 200 on default Azure URL.
- Console `/up` is 200 on default Azure URL.
- Console is not in demo mode.
- Agent/app key create, list, revoke has been manually verified.
- A temporary action can be created and called with an Agent/app key.
- A resulting run appears in Runs, Run Inspector, and Run Detail.
- Runtime key copy-once behavior has been verified.
- No smoke test prints full keys or passwords.
