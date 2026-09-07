# Security Rotation — burned credentials from `.env.azure.local` history

Status: **OPEN — rotation not yet attested. Do not proceed to staging or
production deployment until every item below is checked off and attested.**

No secret values appear in this document. Names and locations only.

## What happened

`.env.azure.local` was committed to this repository (history:
`c792a9849` → `4ef166a88` → `8ee6a6ec3` → `1fd35ea04`, removed from tracking
in `610989b1a`). Removal from tracking does **not** remove the contents from
git history: anyone with (past or present) read access to the GitHub remote
can recover every value from those commits. All credentials that ever
appeared in that file must be treated as **burned** until rotated.

## Burned credential categories

| Category | Where it appeared | Sensitivity |
|---|---|---|
| **Neon Postgres role password** (embedded in `NEON_POOLED_URL` and `NEON_DIRECT_URL` DSNs) | all four historical revisions | **Critical — live production database access** |
| **Overture service API key** (`OVERTURE_API_KEY` value referenced in the file body) | at least revision `1fd35ea04` | **Critical — authenticated API access** |
| **Console admin password** (`ADMIN_PASSWORD` value referenced in the file body) | at least revision `1fd35ea04` | **High — console operator access** |
| Azure identifiers: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, resource group / app names | all revisions | Low — identifiers, not credentials; no rotation strictly required, but they map the attack surface |

(`API_IMAGE` / `CONSOLE_IMAGE` are public-ish GHCR refs; `AZ_RG`,
`AZ_LOCATION`, `AZ_ENV` are labels. No action needed beyond awareness.)

## Rotation steps

### 1. Neon (critical, do first)

1. Log into the Neon console → project for `igris` production.
2. For the role used in the burned DSNs: **Roles → reset password** (or create
   a new role, grant identically, and drop the old role after cutover).
3. Regenerate both connection strings (pooled + direct) with the new password.
4. Update every consumer, single-quoting DSNs in env files (they contain `&`/`?`):
   - Azure Container App `igris-api` secrets/env (`az containerapp secret set` +
     `az containerapp update`, or the portal).
   - Local operator env files (`.neon_*_env` on operator machines — never in repo).
   - GitHub Actions secrets if any workflow holds a Neon DSN.
5. Verify old DSN no longer authenticates: `psql '<old DSN>' -c 'select 1'`
   must fail. Verify the app still serves (`/v1/health`, one authenticated read).

### 2. Overture service API key

1. Generate a replacement key through the standard tenant API-key path.
2. Update consumers: Rails console Container App env (`OVERTURE_API_KEY`),
   any operator scripts/env files, GitHub environment secrets if present.
3. Revoke the old key (delete/disable the key row so its hash no longer
   authenticates).
4. Verify: request with old key → 401; console still works with new key.

### 3. Console admin password

1. Set a new `ADMIN_PASSWORD` on the console Container App (secret update +
   revision restart).
2. Verify old credential no longer logs in; new one does.

### 4. Azure identifiers (optional hardening)

`AZURE_CLIENT_ID` etc. are not credentials. If the associated app
registration uses client *secrets* (rather than federated credentials),
rotate those in Entra ID → App registrations → Certificates & secrets, and
update wherever stored.

### 5. GitHub secrets sweep

1. Repo/org → Settings → Secrets and variables → Actions (and Environments
   `staging` / `production`).
2. For each secret whose value matches a burned category (Neon DSN,
   Overture key, admin password): update to the rotated value.
3. Audit repo collaborator list — history exposure is bounded by who has ever
   had read access (including any leaked clone).

## Verification / attestation checklist

- [ ] Neon role password rotated; old DSNs fail to authenticate (tested)
- [ ] New DSNs live in Azure Container App config; API healthy after restart
- [ ] Overture API key rotated; old key returns 401 (tested)
- [ ] Console admin password rotated; old password rejected (tested)
- [ ] GitHub Actions/environment secrets updated where applicable
- [ ] Operator-local env files updated (and confirmed untracked: `git ls-files | grep -E '\.env'` shows only `.env.example`)
- [ ] Attestation recorded below (who, when, evidence pointer — e.g. Neon audit log entry, az CLI output digest)

| Item | Rotated by | Date | Evidence |
|---|---|---|---|
| Neon role password | | | |
| Overture API key | | | |
| Console admin password | | | |

## Notes

- **Rewriting git history is NOT sufficient or required**: the remote history
  has already been fetchable; treat values as public and rotate. History
  rewrite (filter-repo + force-push) is optional hygiene afterwards and needs
  coordination across all clones/worktrees — do not attempt casually.
- Prevention already in place: the file is untracked and `.gitignore` covers
  env files; deploy workflows read GitHub environment secrets rather than
  repo files.
- **Gate**: `deploy-api-azure.yml` / `deploy-console-azure.yml` /
  `deploy-auth-azure.yml` must not be run against staging or production until
  the attestation table above is filled in.
