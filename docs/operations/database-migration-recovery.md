# Connected database migration recovery

## Scope

This runbook covers only the explicit actions-first Connected bootstrap. It
does not authorize production access, history edits, or legacy inference-root
adoption.

## First response

1. Stop the migration command. Do not start the API against an ambiguous schema.
2. Preserve the full error and transaction outcome without copying the database
   URL or credentials.
3. Run `make database-bootstrap-preflight` with the same direct URL.
4. Take or verify a backup before any recovery mutation.
5. Rehearse recovery on a disposable clone.

## State-specific recovery

| Preflight result | Meaning | Safe response |
| --- | --- | --- |
| `fresh-baseline-v066-plus-067-069` | No managed public objects exist | Run ordinary apply. |
| `existing-v066-forward-067-069` | Recorded baseline and exact v066 catalog | Back up, then run ordinary apply. |
| `current-v069-noop` | Ledger and v069 catalog agree | No migration action. |
| `explicit-v066-adoption-plus-067-069` | Exact v066 schema exists without the checksum ledger | Review provenance and backup, then use explicit adoption. |
| non-empty unrecorded schema | Unknown or partial schema | Stop. Restore a known backup or obtain an authoritative schema source. |
| checksum mismatch | Ledger or repository artifact changed | Stop. Compare the deployed commit and ledger with the release manifest. Never update the checksum to silence the error. |
| ledger/schema mismatch | A required object is missing or changed | Stop. Restore or investigate the drift; do not mark migrations applied. |
| partial 067-069 ledger | An unsupported external process wrote partial history | Stop and investigate transaction/ledger tampering. |

## Interrupted bootstrap

The command installs the baseline, creates the ledger, and applies 067-069 in a
single transaction. PostgreSQL rolls all of it back on failure. After
connectivity is stable, preflight should show either the original state or a
fully current v069 state. Any other result is evidence of out-of-band mutation
and must fail closed.

## Ledger inspection

Read-only inspection:

```sql
SELECT component, version, artifact_kind, checksum_sha256, applied_at
FROM public.igris_schema_history
WHERE component = 'connected-actions'
ORDER BY version;
```

Expected current versions are `v066`, `067_action_contract_versions`,
`068_sdk_evidence_ingestion`, and `069_connected_immutable_records`. Do not
insert, update, or delete ledger rows manually.

## Restore and migration-069 triggers

The immutable-record triggers are:

- `action_contract_versions_immutable`
- `sdk_signing_keys_immutable`
- `sdk_evidence_batches_immutable`
- `sdk_evidence_events_immutable`

An offline logical restore may require the table owner or superuser to disable
them. Record the change, keep application roles disconnected, restore, re-enable
all four triggers, and run preflight plus the immutability tests. Ordinary
application migrations never disable them.

## Rollback policy

There are no down migrations. Roll back a failed deployment by reverting the
application and restoring the pre-migration database backup when necessary.
Never edit migrations 001-069 or delete successful ledger rows to simulate a
downgrade.

## Escalation evidence

Capture the repository commit, PostgreSQL major version, selected bootstrap
path, artifact checksums, catalog hash, and exact error. Do not capture the
connection URL, passwords, tenant payloads, signing material, evidence bodies,
or private endpoints.
