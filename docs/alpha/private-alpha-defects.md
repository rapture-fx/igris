# Private-Alpha Product Defects

## PA-001: Contract synchronization follows HTTP redirects

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
