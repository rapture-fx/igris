# Embedded Igris SDK Release Notes

Status date: 2026-07-12

## Internal release status

The `igris` Python package is the private-alpha adoption surface. With no
Connected configuration it operates in Embedded mode only: it locally guards
synchronous Python functions, records signed decision and outcome events, and
verifies the hash-chained JSONL journal offline with zero network activity.

Connected mode is explicit and opt-in. When both `IGRIS_API_URL` and
`IGRIS_API_KEY` are configured, a guarded action synchronizes its ActionContract
before local execution. Evidence upload remains a separate explicit
`igris evidence sync` command. Redirects are refused, synchronization failure
prevents execution, and there is no silent downgrade to Embedded-only behavior.

This package does not provide Managed execution, remote approval, central
policy, automatic evidence upload, a durable background outbox, telemetry,
containment, recovery, or exactly-once execution/networking.

## Public release blockers

The package is not ready for public PyPI publication until the namespace and
migration strategy from the legacy distribution is resolved. Do not publish this
package in this task.

Current blockers:

- `igris` and the legacy `igris-inertial` distribution both expose top-level
  `import igris`.
- Installing both can silently replace whichever distribution last wrote the
  `igris` package files.
- Users cannot reliably tell which package owns `import igris` from Python
  import behavior alone.
- Public documentation, migration warnings, and package ownership must be
  approved before publication.

## igris versus igris-inertial namespace collision

The new Embedded SDK remains:

- distribution name: `igris`
- import name: `igris`

The legacy `igris-inertial` distribution remains untouched. This branch does not
modify the nested legacy repository and does not implement runtime package
conflict detection as a substitute for a migration plan.

## Why both packages cannot safely coexist

Python resolves `import igris` to one installed package path. If two
distributions install the same top-level package, the winner depends on install
order, environment tooling, editable installs, and wheel contents. That can
change public APIs and security behavior without an explicit application code
change.

## Recommended long-term migration direction

Approve one explicit path before public release:

- transfer users from `igris-inertial` to `igris` with a documented deprecation
  and removal window, or
- rename one distribution/import namespace before public release, or
- ship a coordinated compatibility release from the legacy distribution that
  makes the transition explicit.

Do not ask users to install both packages in the same environment.

## Python compatibility matrix

Declared package range: Python `>=3.10`.

| Version | Local result on this branch | CI expectation |
| --- | --- | --- |
| 3.10.19 | 179 SDK tests passed locally | Covered by `.github/workflows/sdk-python.yml` |
| 3.11.6 | 179 SDK tests plus lint, format, wheel, and sdist checks passed locally | Covered by `.github/workflows/sdk-python.yml` |
| 3.12.12 | 179 SDK tests passed locally | Covered by `.github/workflows/sdk-python.yml` |
| 3.13.3 | 179 SDK tests passed locally | Covered by `.github/workflows/sdk-python.yml` |

Do not claim a public release supports a Python version until the CI matrix has
run successfully for that version.

## Build and artifact verification

Required before internal release:

```bash
cd sdk/python
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv build
```

Artifact checks:

- wheel and sdist build successfully
- wheel installs into a clean virtual environment
- sdist installs into a clean virtual environment where practical
- `import igris` works
- `from igris import guard` works
- `igris key-info` works without printing private-key material
- an injected-approval guarded example creates a journal
- `igris verify` verifies that generated journal
- artifacts do not contain test journals, local keys, `.env` files, or generated
  identities

## Security and privacy checklist

- Unconfigured Embedded mode performs no network activity.
- Connected network activity occurs only with explicit complete configuration;
  contract sync runs before execution and evidence sync is CLI-only.
- Contract sync refuses every redirect so Authorization is never forwarded or
  transport-downgraded.
- No telemetry.
- Backend credentials are read from the environment and sent only as the
  Authorization header; they are never journaled or stored as evidence.
- No production systems.
- Approval remains fail-closed.
- Decision evidence remains persisted before execution.
- Post-execution evidence failures expose `execution_occurred=True`,
  `evidence_state="incomplete"`, and `retry_safe=False`.
- Agents receiving `retry_safe=False` must not automatically retry the guarded
  function.
- Private key material is stored locally and never printed by `igris key-info`.
- Error strings must not include guarded function result values or secret input
  values.
- Evidence v1 stores a bounded redacted input summary. Built-in sensitive names
  and caller-declared `redact=[...]` values are removed, but ordinary argument
  values remain in the signed journal and are uploaded by explicit evidence
  sync. Applications requiring no argument values in Connected storage must
  explicitly redact every business parameter; changing this default is an
  evidence-format decision deferred beyond stabilization.

## Pre-release checklist

- [x] Run the full local SDK matrix for Python 3.10, 3.11, 3.12, and 3.13.
- [x] Inspect wheel contents.
- [x] Inspect sdist contents.
- [x] Install wheel in a clean environment.
- [x] Install sdist in a clean environment.
- [x] Run `igris key-info` in both clean environments.
- [x] Run a guarded example in both clean environments.
- [x] Run `igris verify` on each generated journal.
- [x] Confirm no generated signing identities or journals are included in
      artifacts.
- [ ] Confirm namespace-collision migration plan is approved before any public
      PyPI publication.

## This task does not publish the package

This hardening task builds and validates local artifacts only. It does not
publish `igris`, does not publish `igris-inertial`, and does not reserve or
modify any public package index state.
