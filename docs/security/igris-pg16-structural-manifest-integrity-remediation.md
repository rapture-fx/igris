# PostgreSQL 16 structural manifest integrity remediation

## Gate status and authority

Review commit `2b1baadfc7d3795c50a7c9373812e05c79999f94` rejected remediation tip
`c53e55b87bb646fcc7dcdb7fa35c82966e5d1598`. It demonstrated that the old
manifest coerced full definitions through PostgreSQL `name`, truncating at 63
bytes, and omitted exact trigger enable mode. This correction does not clear
that NO-GO verdict; its exact tip requires another independent review.

## Root cause and type audit

The old `objects` CTE used three heterogeneous `UNION ALL` columns. The first
definition value was `pg_extension.extname` (`name`), while later arms supplied
`text`. PostgreSQL resolved the shared CTE column before the outer
`regexp_replace`, so casting or normalizing the final line could not restore
the discarded suffix.

| Old family/expression | Source PostgreSQL type before the union | Integrity problem | Canonical-v2 representation |
| --- | --- | --- | --- |
| `kind` constant | `text` in the first arm; otherwise initially `unknown` literals | Relied on union inference in later arms | `object_type::text` in every arm |
| Extension identity/definition, relation names, function/type names | `name` | Fixed 63-byte identifier type could become the common union type | Every catalog `name` is cast to `text` before `VALUES` or `UNION ALL` |
| Relation, column, constraint, policy, type, sequence `concat_ws` definitions | `text` | Delimiter-only packing erased field boundaries and null/empty distinctions | One row per labeled attribute; every scalar is explicit `text` or `NULL::text` |
| `pg_get_constraintdef`, `pg_get_indexdef`, `pg_get_triggerdef`, `pg_get_functiondef`, `pg_get_viewdef`, `pg_get_ruledef`, `pg_get_expr`, `pg_get_partkeydef` | `text` | Full text was vulnerable when coerced into the shared `name` column | Cast to `text` at the source and stored as the complete attribute value |
| Catalog flags such as `relkind`, `tgenabled`, `provolatile`, `proparallel`, `contype` | internal `"char"` | Rendered definitions do not encode every enforcement state | Explicit `::text` attributes with stable labels |
| Catalog booleans | `boolean` | Previously collapsed into composite delimiter strings or omitted | Explicit `::text` attributes; trigger origin mode is also checked directly |
| Catalog numeric/ordinal/sequence fields | integer or numeric catalog types | Previously composite and ambiguously delimited | Explicit `::text` attributes inside length-framed fields |
| OID/reg* and identifier arrays | OID-derived or array types | Raw OIDs are not portable; array text can be ambiguous | Rendered names via `format_type`/qualified `format`, or repeated structured rows |
| Outer `regexp_replace(definition, ...)` | `text`, but only after CTE coercion | Too late to prevent truncation; whitespace folding also changed body bytes | Removed; full rendered values are hashed without lossy normalization |
| Old final `manifest_line` | `text` | Unit-separator concatenation could not distinguish embedded separators | Five structured output columns, all reported by PostgreSQL as `TEXT` |

The five output columns are `object_type`, `schema_name`, `object_identity`,
`attribute_name`, and nullable `attribute_value`. The integration test checks
their driver-visible PostgreSQL type is `TEXT` and confirms the full reviewed
immutability-function definition remains longer than 63 bytes.

## Canonical representation

Canonical manifest v2 is a deterministic structured byte stream, not a
delimiter-concatenated line format:

1. The stream begins with the version marker
   `igris-postgresql-structural-manifest-v2\0`.
2. SQL orders rows using `COLLATE "C"` over all five full fields, with null
   values first.
3. Each row contains all five stable field labels and values in fixed order.
4. Every label and non-null value uses an unsigned 64-bit big-endian byte
   length followed by the complete bytes.
5. A one-byte validity marker distinguishes null from an empty string.
6. Row boundary bytes plus length framing prevent separator-containing values
   or alternate field splits from colliding.
7. SHA-256 is computed over the complete versioned stream.

The rejected v1 hash
`4e852bad6ef9041c3b720fb683f83cc23cf5e7f9fd0f65bd1a344da63fc2b118`
is not trustworthy because materially different function definitions produced
that same value. The corrected PostgreSQL 16.14 v2 hash is
`d166fffa05546550ebb8fb3d613ea96ef977c4376461c9cb5a10d0359a9946a0`.
The pinned pre-role hash remains
`034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4`.

## Object-family coverage

| Family | Explicit structural attributes |
| --- | --- |
| Functions | Qualified identity arguments, return type, full definition and source, binary, language/kind, volatility, strictness, security-definer, leakproof, parallel safety, and repeated configuration settings |
| Triggers | Target/name, full definition, bound function identity, exact enable mode, row scope, timing/events, WHEN, update columns, arguments, constraint relation, deferrability, and initial mode |
| Constraints | Full definition, type, validation, deferrability, initial state, inheritance, local/referenced columns and relation, and foreign-key actions/match mode |
| Indexes | Full definition, predicate, expressions, uniqueness/primary/exclusion, immediate/valid/ready/live states, replica/cluster state, null-distinctness, and access method |
| Views and rules | Full view definition; relation options capture security barrier/invoker/check options; rules include full definition, event, enabled mode, and instead state |
| Policies and RLS | Command, permissive mode, USING/WITH CHECK, repeated role rows, plus relation RLS and FORCE RLS flags |
| Columns and sequences | Type, nullability, full default, identity/generated/compression/storage/collation, sequence parameters, and qualified ownership |
| Relations and types | Kind, persistence, replica identity, access method, partition bound/key, repeated options, domains/enums/composites/ranges, and composite attributes |
| Migration ledger | `igris_schema_history` relation, columns, defaults, checks, primary key, and indexes are included instead of excluded |

Expected owners and ACLs are intentionally excluded from the structural hash
because generated role names are run-specific. The role-model layer separately
requires every public relation and non-extension function to be owned by the
migration owner, verifies sensitive grants, and rejects runtime ownership.

Intentionally excluded are row data (including ledger contents, which have
separate checksum validation), comments, statistics/planner estimates, physical
storage locations, internal PostgreSQL triggers represented by their parent
constraints, extension-owned functions/types, and ACL/owner identifiers.

## PostgreSQL version dependency

This hash is PostgreSQL 16-specific. `pg_get_*` output is PostgreSQL-rendered
text and can change across major releases. The query also relies on catalog
fields available in supported PG16, including `attcompression`,
`indnullsnotdistinct`, and `rngmultitypid`. A PostgreSQL major upgrade requires
an expression/type audit, semantic manifest diff, complete regression rerun,
and independent approval before pinning a different hash.

## Regression matrix

Committed tests cover definitions identical through byte 63 but different
afterward; null versus empty; embedded separators; repeated-run ordering;
function body/security/search-path/volatility/strictness; exact trigger modes,
binding, timing/events/scope/WHEN; constraint validation/deferrability; long
index predicates and column defaults; view/return-rule changes; policy USING
and WITH CHECK; rule action/mode; generated and identity semantics; RLS/FORCE;
sequence ownership; and migration-ledger constraints.

The bounded bypass test replaces the existing immutability function, observes
that a protected update becomes possible, then proves the v2 hash changes and
staging preflight fails. It restores the original function and confirms the
protected update is rejected again.

## Release boundary

This remediation does not claim production readiness, hosted-CI success, or
release approval. Migrations 001 through 069, Evidence v1, ActionContract v1,
SDK APIs/fixtures, privacy behavior, and prior shell/cluster/workflow fixes are
unchanged. No shared database is an authorized validation target.
