# Igris MVP — Production Smoke Test Checklist

Run after every deploy. Should take under 5 minutes.

Set these locally first (don't commit):

```bash
export API=https://api.igrisinertial.com
export CONSOLE=https://console.igrisinertial.com
export KEY="igris_<your console service key>"
# Front-door creds (set on Render → igris-console-rails → ADMIN_USERNAME / ADMIN_PASSWORD)
export ADMIN_USER=...
export ADMIN_PASS=...
# Helper for the curl runs below
export AUTH="-u ${ADMIN_USER}:${ADMIN_PASS}"
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

## 3. Rails front-door (HTTP Basic auth)

```bash
# Without credentials → 401 + WWW-Authenticate header
curl -i $CONSOLE/home | head -3
# Expect:
#   HTTP/2 401
#   www-authenticate: Basic realm="Igris Console"

# Wrong credentials → 401
curl -i -u badname:badpass $CONSOLE/home | head -1

# Right credentials → 200
curl -fsS $AUTH $CONSOLE/home > /dev/null && echo "front-door ok"

# /up bypasses Basic (Render liveness probe path)
curl -fsS $CONSOLE/up && echo "(no auth needed for /up)"
```

If the un-credentialed request returns 200 instead of 401, the
`ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars are not both set on
Render. **Fix before continuing — production must never be open.**

## 4. Rails sees Overture

```bash
# Console must render real mode — NO demo indicator and NO degraded strip
curl -fsS $AUTH $CONSOLE/actions > /tmp/actions.html
grep -c 'Demo data — OVERTURE_API_BASE_URL not set' /tmp/actions.html   # expect 0
grep -c 'Overture degraded' /tmp/actions.html                            # expect 0
grep -c 'Registry' /tmp/actions.html                                     # expect ≥ 1
```

If demo indicator is non-zero: `OVERTURE_API_BASE_URL` is unset on
Render. If degraded strip is non-zero: Go is unreachable from Rails —
check Render's outbound networking + the env var value.

## 5. Pages load

```bash
for path in /home /actions /actions/new /runs /runtimes /settings; do
  printf "%-20s -> " "$path"
  curl -sS -o /dev/null -w "%{http_code}\n" $AUTH $CONSOLE$path
done
# All 200.
```

## 6. Create-action round trip (real mode)

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

## 7. Run-action round trip

1. From `/actions/smoke_demo`, click **Run test action**.
2. Expect redirect to `/runs/<task_id>` with a flash showing
   `status=… proof=…`.
3. Confirm via API:
   ```bash
   curl -fsS "$API/v1/tasks/<task_id>" -H "Authorization: Bearer $KEY" | jq '.status, .proof'
   ```

## 8. Run detail renders honestly

Open `$CONSOLE/runs/<task_id>?tab=proof`:

- If the run completed and Overture signed a receipt, expect
  `Proof verified` and a truncated `sha256:…` digest.
- If proof is missing, expect `Proof unavailable` in plain text — the
  page must **not** fabricate a digest or a verified status.

## 9. Runtimes page degrades safely if none registered

```bash
curl -fsS $AUTH $CONSOLE/runtimes > /tmp/runtimes.html
grep -c '0 runtimes connected' /tmp/runtimes.html   # expect 1 in a fresh tenant
```

The page should still render 200 with the install snippet visible, no
500s. If you've already installed a runtime, expect at least one
`rt_…` card.

## 10. Tenant scoping smoke (optional but recommended)

If you have a second `igris_` key for a *different* tenant, repeat
step 2 with that key and confirm the response set is disjoint. The
unit test `api/auth_apikey_tenant_scoping_test.go` already locks this
behavior at the SQL layer; the curl-based check is belt-and-braces.

## 11. Secrets hygiene

The smoke run must not leak the API key or admin password anywhere:

```bash
# Render logs must not include the raw OVERTURE_API_KEY value.
# Spot-check Rails server log:
#   - look for "[Overture]" lines
#   - confirm none contain "Bearer igris_"
#   - confirm none contain the request body of create_action or run_action

# Browser DevTools → Network → check that no Rails response includes
# OVERTURE_API_KEY or ADMIN_PASSWORD in HTML, JS, headers, or cookies
# sent to the browser. (The Authorization header sent FROM the browser
# is fine — that's HTTP Basic. The console's Bearer token MUST NOT
# appear anywhere browser-visible.)
```

## When smoke passes

- Update the deploy log with the deploy SHA + smoke timestamp.
- If the smoke included DNS changes (e.g., first time pointing
  `console.igrisinertial.com` at Render), give Cloudflare 5 minutes
  to settle before publishing the change to users.
- The old Next.js console has been removed from the repo. Any remaining
  Cloudflare Pages cleanup is dashboard-only — see `DEPLOY.md`
  "Next.js console — removed".

## When smoke fails

Roll forward, not back, unless the failure is auth/data-related. Most
failures here are env-var omissions; fix the env var on the affected
service and redeploy.
