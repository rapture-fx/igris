# Embedded Igris SDK Release Notes

Status date: 2026-07-10

## Internal release status

The `igris` Python package is intended for internal dogfooding as an Embedded
SDK only. It locally guards synchronous Python functions, records a signed
decision event before execution, records a signed outcome event after execution,
and verifies the local JSONL journal offline.

This package does not provide Connected mode, Managed execution, backend
synchronization, remote approval, telemetry, containment, recovery, or
exactly-once execution.

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
| 3.10 | Not available locally | Covered by `.github/workflows/sdk-python.yml` |
| 3.11 | Full SDK suite and packaging checks run locally | Covered by `.github/workflows/sdk-python.yml` |
| 3.12 | Not available locally | Covered by `.github/workflows/sdk-python.yml` |
| 3.13 | Full SDK suite run locally | Covered by `.github/workflows/sdk-python.yml` |

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

- No network behavior.
- No telemetry.
- No backend credentials.
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

## Pre-release checklist

- [ ] Run the full SDK CI matrix for Python 3.10, 3.11, 3.12, and 3.13.
- [ ] Inspect wheel contents.
- [ ] Inspect sdist contents.
- [ ] Install wheel in a clean environment.
- [ ] Install sdist in a clean environment.
- [ ] Run `igris key-info` in the clean environment.
- [ ] Run a guarded example with an injected approval provider.
- [ ] Run `igris verify` on the generated journal.
- [ ] Confirm no generated signing identities or journals are included in
      artifacts.
- [ ] Confirm namespace-collision migration plan is approved before any public
      PyPI publication.

## This task does not publish the package

This hardening task builds and validates local artifacts only. It does not
publish `igris`, does not publish `igris-inertial`, and does not reserve or
modify any public package index state.
