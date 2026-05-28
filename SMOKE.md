# Igris MVP — Production Smoke Test Checklist

Run after every deploy. Should take under 5 minutes.

Set these locally first (don't commit):

```bash
export API=https://api.igrisinertial.com
export CONSOLE=https://console.igrisinertial.com
export KEY="igris_<your console service key>"
```

## 1. Health

```bash
# Go Overture
curl -fsS $API/healthz                          # 200, process alive
curl -fsS $API/readyz                           # 200, DB reachable

# Rails console
curl -fsS $CONSOLE/up                           # 200, "ok"
```

If any of these fail: check Render logs for that service; don't proceed.

## 2. Go auth gate

```bash
# Without a key → 401
curl -i $API/v1/actions | head -1
# Expect: HTTP/2 401

# With the key → 200
curl -fsS $API/v1/actions -H "Authorization: Bearer $KEY" | jq '.actions | length'
# Expect: integer (0 for a fresh tenant)
```

## 3. Rails sees Overture

```bash
# Console must render real mode — NO demo indicator and NO degraded strip
curl -fsS $CONSOLE/actions > /tmp/actions.html
grep -c 'Demo data — OVERTURE_API_BASE_URL not set' /tmp/actions.html   # expect 0
grep -c 'Overture degraded' /tmp/actions.html                            # expect 0
grep -c 'Registry' /tmp/actions.html                                     # expect ≥ 1
```

If demo indicator is non-zero: `OVERTURE_API_BASE_URL` is unset on
Render. If degraded strip is non-zero: Go is unreachable from Rails —
check Render's outbound networking + the env var value.

## 4. Pages load

```bash
for path in /home /actions /actions/new /runs /runtimes /settings; do
  printf "%-20s -> " "$path"
  curl -sS -o /dev/null -w "%{http_code}\n" $CONSOLE$path
done
# All 200.
```

## 5. Create-action round trip (real mode)

Through the browser at `$CONSOLE/actions/new`:

1. Walk the wizard with a throwaway name like `smoke_demo`
   (target_type=mock_demo, policy=idempotent, replay=retryable).
2. Submit at step 4. The browser should land on
   `$CONSOLE/actions/smoke_demo` with a flash:
   `Action "smoke_demo" created.`
3. Verify via API:
   ```bash
   curl -fsS $API/v1/actions -H "Authorization: Bearer $KEY" \
     | jq '.actions[] | select(.name=="smoke_demo")'
   ```
4. Clean up:
   ```bash
   ACTION_ID=$(curl -fsS $API/v1/actions -H "Authorization: Bearer $KEY" \
     | jq -r '.actions[] | select(.name=="smoke_demo") | .id')
   curl -fsS -X DELETE $API/v1/actions/$ACTION_ID -H "Authorization: Bearer $KEY"
   ```

## 6. Run-action round trip

1. From `/actions/smoke_demo`, click **Run test action**.
2. Expect redirect to `/runs/<task_id>` with a flash showing
   `status=… proof=…`.
3. Confirm via API:
   ```bash
   curl -fsS "$API/v1/tasks/<task_id>" -H "Authorization: Bearer $KEY" | jq '.status, .proof'
   ```

## 7. Run detail renders honestly

Open `$CONSOLE/runs/<task_id>?tab=proof`:

- If the run completed and Overture signed a receipt, expect
  `Proof verified` and a truncated `sha256:…` digest.
- If proof is missing, expect `Proof unavailable` in plain text — the
  page must **not** fabricate a digest or a verified status.

## 8. Runtimes page degrades safely if none registered

```bash
curl -fsS $CONSOLE/runtimes > /tmp/runtimes.html
grep -c '0 runtimes connected' /tmp/runtimes.html   # expect 1 in a fresh tenant
```

The page should still render 200 with the install snippet visible, no
500s. If you've already installed a runtime, expect at least one
`rt_…` card.

## 9. Tenant scoping smoke (optional but recommended)

If you have a second `igris_` key for a *different* tenant, repeat
step 2 with that key and confirm the response set is disjoint. The
unit test `api/auth_apikey_tenant_scoping_test.go` already locks this
behavior at the SQL layer; the curl-based check is belt-and-braces.

## 10. Secrets hygiene

The smoke run must not leak the API key anywhere:

```bash
# Render logs must not include the raw OVERTURE_API_KEY value.
# Spot-check Rails server log:
#   - look for "[Overture]" lines
#   - confirm none contain "Bearer igris_"
#   - confirm none contain the request body of create_action or run_action

# Browser DevTools → Network → check that no Rails response includes
# OVERTURE_API_KEY in HTML, JS, headers, or cookies sent to the browser.
```

## When smoke passes

- Update the deploy log with the deploy SHA + smoke timestamp.
- If the smoke included DNS changes (e.g., first time pointing
  `console.igrisinertial.com` at Render), give Cloudflare 5 minutes
  to settle before publishing the change to users.
- **Do not** decommission the parked Next.js console yet. Wait for at
  least one real workflow on Rails before flipping any user DNS.

## When smoke fails

Roll forward, not back, unless the failure is auth/data-related. Most
failures here are env-var omissions; fix the env var on the affected
service and redeploy.
