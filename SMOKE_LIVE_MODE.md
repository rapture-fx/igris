# Live-mode smoke test

Run after deploying per `docs/LIVE_MODE_BRINGUP.md`. Confirms the console is in
**live mode** (not fixture/preview) and the action → run → inspect loop works
end to end. Two parts: a scripted curl pass and a manual UI walkthrough.

## A. Scripted (curl)

```bash
API_BASE=https://igris-api.<region>.azurecontainerapps.io \
CONSOLE_BASE=https://app.igrisinertial.com \
OVERTURE_API_KEY=igris_… \
ADMIN_USERNAME=founder ADMIN_PASSWORD=… \
scripts/smoke/live-mode-smoke.sh
```

It checks, and exits non-zero on any failure:

- `GET /healthz` → 200, `GET /readyz` → 200 (DB reachable through Neon).
- `GET /v1/actions` without the key → 401; with the key → 200 (tenant-scoped).
- `POST /v1/actions` (idempotent `smoke_check`) → 201/409, then the action
  appears in the list — this also guards the action-list scanner round-trip.
- `GET /up` on the console → 200; `/actions` challenges without creds; and the
  rendered page has **no** "Demo data" chip (the live-mode signal).

The API key and admin password are never printed. `smoke_check` is a harmless
read-only `hosted_api` action you can delete from the UI afterward.

## B. Manual UI walkthrough

Open the console (`https://app.igrisinertial.com`), authenticate at the
front-door prompt, then:

1. **Settings** — no fixture/preview/"Demo data" indicator anywhere.
2. **Rename the project** (Settings or /welcome) → name persists on reload
   (it's stored on the Go tenant row, not in Rails).
3. **Create an Agent / app API key** (Settings → API keys) → the raw key shows
   exactly once; it then appears in the list as metadata only.
4. **Create an Action** (`/actions/new`) → choose a target + policy preset.
5. **Open the Action Detail** page for it.
6. **Send a test request** from Action Detail.
7. Confirm the **redirect to `/runs/:id`** with a real run id.
8. Open **`/runs`** → the run is listed.
9. Open **`/runs?inspect=<id>`** → the right-side Run Inspector drawer opens.
10. On **`/runtimes`**, generate a **runtime key** → the command shows the
    generated key exactly once.
11. Confirm the runtime command on `/runtimes` contains that generated key.
12. Back on **`/actions`**, the action you created is listed (not a fixture).

## If a check fails

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Console shows "Demo data — OVERTURE_API_BASE_URL not set" | env unset on console | set `OVERTURE_API_BASE_URL`, redeploy `igris-console` |
| Orange "Overture degraded" strip | API down / 5xx / scaled-to-zero cold start | retry; check `igris-api` logs and `/readyz` |
| `/v1/actions` always 401 | `OVERTURE_API_KEY` invalid/revoked | re-mint via `tenant-key`, set secret, redeploy console |
| `/readyz` not 200 | DB unreachable | check `DATABASE_URL` (pooled) + Neon `?sslmode=require` |
| API never starts | provider guardrail | ensure `PROVIDER_MODE=hybrid` + `ALLOW_NON_REAL_PROVIDER_MODE_IN_PRODUCTION=true` (see bring-up doc) |
| `/actions` page 500 / empty after creating an action | list-scan regression | confirm `igris-overture/api/routes_actions.go` list SELECT includes `fallback_policy` (regression-tested) |
