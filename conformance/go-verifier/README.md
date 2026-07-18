# igris-verify — standalone offline Schema-1 verifier

`igris-verify` is an independent implementation of Igris Schema-1
verification: ActionContract hashes, Evidence event signatures, and Evidence
chain continuity, evaluated entirely offline. It was implemented from the
normative protocol documents and frozen conformance vectors without reading,
importing, or translating the maintained Python or production Go verification
code, and CI mechanically enforces that its build graph is the Go standard
library only. "Independent implementation" means independent within this
project — it is not an external certification or third-party audit.

It verifies; it never signs, and it refuses to load private key material.

## Requirements and build

Go 1.24 or newer. No other dependency, no network access during build or run
(`GOPROXY=off` works).

```sh
cd conformance/go-verifier
go build ./cmd/igris-verify     # produces ./igris-verify
go test ./...                   # unit, adversarial, and CLI tests
```

## Usage

```text
igris-verify verify <path|-> [--key <path>] [--type contract|evidence|chain|value]
igris-verify artifact --type <type> --input <path|-> [--key <path>] [--human]
igris-verify vectors --suite <dir> [--vector <id>] [--family <name>] [--capability <name>]
```

- `verify` is the developer-facing form. The artifact type is detected
  structurally from the input (a JSON object with contract fields, an
  evidence event, a JSONL chain, or a bare legacy JSON value); detection
  never downgrades, and `--type` forces a specific check when the input is
  ambiguous.
- `artifact` is the explicit form of the same verification.
- `-` reads the artifact from stdin:

```sh
# Verify a JSONL evidence journal with its public key:
./igris-verify verify path/to/journal.jsonl --key path/to/verify_key.pem

# Same, from stdin:
cat journal.jsonl | ./igris-verify verify - --key verify_key.pem --type chain
```

Public keys load from PEM (SubjectPublicKeyInfo), raw base64, or hex Ed25519
forms. Multi-line JSONL input is treated as an evidence chain; a single JSON
document is a single artifact regardless of formatting.

## Output

`verify`/`artifact` emit exactly one machine-readable
`igris:protocol:verification-result:1` JSON object on **stdout** (the schema
is `spec/schemas/verification-result-1.schema.json`; the data model and the
39-code issue registry are `spec/verification-result-schema-draft.md`).
`--human` adds a short explanation on **stderr**; it never echoes payload
values or key material.

Exit codes (from `cmd/igris-verify/main.go`):

| Code | Meaning |
| --- | --- |
| 0 | verification completed and a result was emitted — **any** summary, including `invalid` |
| 1 | conformance-vector mismatch in `vectors` mode |
| 2 | invalid CLI invocation or corrupt vector suite |
| 3 | requested artifact capability/schema unsupported by this build |
| 4 | local resource/I/O failure prevented a result from being produced |

Note that exit 0 does **not** mean the artifact is valid: read the result
object's `summary` and dimension fields. Scripts should branch on the JSON,
not the exit code.

## Running the frozen conformance suite

```sh
./igris-verify vectors --suite ../../spec/test-vectors/suite-schema-1
```

This first re-verifies every manifest-listed file hash (321/321), then runs
all 120 frozen vectors against this verifier only and emits a machine-readable
report on stdout (`"status":"pass"`, `"selected":120`, `"passed":120` on
success). `--vector`, `--family`, and `--capability` narrow the selection.

## Offline guarantee

The process performs no network, DNS, database, subprocess, or environment
access, and requires no Connected service and no Python runtime. Everything
needed for verification is the artifact, the public key, and (for `vectors`)
the frozen suite directory.

## What a result proves — and what it does not

A `signature=valid` result proves the artifact's canonical bytes hash to the
recorded value and that the signature verifies under the **supplied** public
key. Evidence is producer-attested: the signer's host, clock, SDK, and
callable are trusted claims of the producer, not independently observed
facts.

A valid signature does **not** prove:

- who controls the key (`trust` is a separate dimension: `trust=unknown` with
  a cryptographically valid signature is the normal result absent a trust
  binding, and it is not the same thing as `signature=invalid`);
- that a trusted signer was *authorized* to perform the action;
- that the producer host was uncompromised;
- complete history: chain continuity (`continuity=valid_genesis` /
  `valid_anchored`) proves internal linkage of the provided segment only.
  Tail truncation is undetectable without an external checkpoint, which
  Schema-1 does not include (`completeness=completeness_unknown` is the
  honest normal answer);
- that an external side effect occurred: an Outcome records what the producer
  observed the callable return or raise — it is not independent proof that a
  payment settled, an email sent, or any other external effect happened.

See RFC 003 "Explicit non-claims" for the complete list.
