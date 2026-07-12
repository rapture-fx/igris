# Private-Alpha Product Defects

## PA-001: Contract synchronization follows HTTP redirects

- Status: **RESOLVED at `c71bd8e60`** (2026-07-12)
- Resolution: `HttpContractSyncClient` installs a no-redirect handler
  (`_NoRedirectHandler` via `build_opener`); every 3xx response maps to a typed
  `ContractSyncError` with `error_code=redirect_refused`,
  `execution_occurred=False`, `retry_safe=False`, and credential-free messages.
  No follow-on request is ever constructed, so the Authorization header is
  never forwarded (commit `7424580bb`, "fix(sdk): refuse contract sync
  redirects"). Proven by unit tests
  (`test_redirect_status_is_typed_and_never_followed`,
  `test_redirect_handler_creates_no_target_request_or_authorization`,
  `test_redirect_failure_prevents_execution_and_journal_write`) and the live
  end-to-end proof `TestContractSyncRedirectsAreNeverFollowedEndToEnd`
  (statuses 301–308: zero target calls, empty target Authorization, origin
  retains Bearer, no journal write, no execution). Confirmed by the final
  security delta review
  (`docs/security/igris-private-alpha-integration-final-delta-review.md`).
  The reproduction below is preserved as recorded against `b30767da1`.
- Severity: High
- Proposed owner: Agent G (Python SDK Connected transport)
- Reproduction: Configure both Connected variables to a disposable local HTTP
  server whose `POST /v1/contracts/sync` returns `302` with a local redirect,
  then invoke an `approval="never"` guarded probe. At `b30767da1`, the clean
  wheel followed the redirect as `GET`, forwarded the Authorization header,
  accepted a synthetic `200` response, and executed the function.
- Expected: A credential-bearing contract synchronization request refuses
  redirects, matching explicit evidence synchronization, and raises a typed
  pre-execution transport error with `execution_occurred=False`.
- Actual: Contract synchronization does not install the evidence client's
  redirect-refusing handler. Standard urllib redirect behavior followed the
  `302` and forwarded the bearer credential. The private-alpha documentation
  therefore does not claim redirect refusal for contract sync.

## PA-002: Shipped SDK documentation contradicts Connected capabilities

- Status: **PARTIALLY RESOLVED at `c71bd8e60`** (2026-07-12)
- Resolution (RELEASE.md portion): `sdk/python/RELEASE.md` now accurately
  documents explicit opt-in Connected mode (automatic ActionContract
  synchronization before first execution when both `IGRIS_API_URL` and
  `IGRIS_API_KEY` are set, explicit CLI-only `igris evidence sync`, redirect
  refusal) and states that public PyPI publication remains blocked pending the
  legacy `igris-inertial` namespace migration. The original contradiction in
  the release notes no longer exists.
- Remaining condition (README portion): the `sdk/python/README.md`
  "Installation" section still presents `pip install igris` / `uv add igris`
  as the installation commands. An internal release note directly above them
  states that public publication is blocked, but the commands themselves do
  not work for private-alpha participants, who install only a supplied or
  locally built wheel. PA-002 stays open on this single condition: replace or
  annotate the README install commands with the wheel-based alpha install path
  (or close when public publication makes the commands real).
  The reproduction below is preserved as recorded against `b30767da1`.
- Severity: Medium
- Proposed owner: Agent G (release documentation)
- Reproduction: Read `sdk/python/RELEASE.md` lines 7-14 and 103-108 at
  `b30767da1`, then run the implemented Connected contract or evidence commands.
- Expected: Internal release notes describe automatic configured ActionContract
  synchronization and explicit evidence synchronization.
- Actual: The release notes state that no Connected mode, backend
  synchronization, or network behavior exists. The SDK README also presents a
  public `pip install igris` command despite documenting that public publication
  is blocked. This alpha kit uses only a supplied or locally built wheel.
