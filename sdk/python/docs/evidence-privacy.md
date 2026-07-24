# Evidence privacy inspection

Igris evidence v1 is signed local execution evidence. It is not an anonymous
format. Use `igris evidence inspect` before deciding whether a journal belongs
in Connected storage.

## What evidence can contain

A decision event contains an action name, parameter names, a bounded
`redacted_input_summary`, an input hash, decision data, timestamps, identifiers,
and optional metadata. An outcome can contain result or exception type names,
a result hash, and a sanitized error summary. Ordinary argument values remain
in `redacted_input_summary` unless their parameters were redacted.

Evidence sync sends the existing signed events, public verification key, key
identifier, and chain linkage. It never sends the private key. Upload does not
change Embedded execution provenance.

## Default redaction behavior

The SDK redacts built-in secret-like parameter names such as `api_key`,
`password`, `token`, `secret`, and `private_key`. Add every sensitive or
business parameter that should not be retained:

```python
@igris.guard(
    action="customer.update",
    redact=["customer_reference", "requested_change"],
)
def update_customer(customer_reference: str, requested_change: dict): ...
```

Matching is name-based and case-insensitive. A field name is not evidence that
its value is safe. Ordinary names are not automatically safe, and redaction
does not guarantee anonymity.

## What inspect reports

```bash
igris evidence inspect
igris evidence inspect path/to/journal.jsonl --public-key path/to/verify_key.pem
igris evidence inspect --verbose
```

Inspect verifies hashes, signatures, schema versions, and chain linkage before
classification. It performs no DNS, socket, urllib, or HTTP request and never
rewrites the journal or key files. It reports:

* event, decision, and outcome counts;
* allowed, denied, succeeded, and failed counts;
* one classification for each decision event;
* action names and only those parameter names whose content may be retained;
* whether the journal passes the `ordinary_connected_upload` argument policy.

The classifications are:

| Classification | Meaning |
| --- | --- |
| `fully_redacted` | Every recorded top-level argument value is exactly the evidence v1 `<REDACTED>` marker. |
| `partially_redacted` | One or more ordinary argument values remain. This also covers an invocation where none of its arguments were redacted. |
| `no_arguments` | The signed input summary is empty. |
| `unknown` | The summary is malformed, truncated, unsupported, or cannot be classified conservatively. |

Unsupported type placeholders are `unknown`: they omit the object's `repr`, but
can disclose a type name and are not equivalent to explicit redaction. Input
hashes are not treated as reversible-safe; a hash can still permit guessing of
low-entropy input.

## Why values are never printed

Inspect output and privacy exceptions contain counts, fixed explanations,
classification labels, action names, and potentially retained parameter names.
They never copy argument values from the signed summary. This allows logs and
CI output to identify which declaration needs redaction without duplicating the
business data being reviewed.

Parameter names and action names can themselves disclose business context.
Choose neutral names where their disclosure is unacceptable, and control
access to inspection output.

## Safe synchronization defaults

`igris evidence sync` runs the same local verification and privacy analysis
before constructing an HTTP request. Journals containing `partially_redacted`
or `unknown` invocations are refused by default. A refusal creates no request
and does not modify journal bytes, keys, sync state, or batch state.

Fully redacted and no-argument journals continue without an override.

## `--allow-unredacted` semantics

```bash
igris evidence sync path/to/journal.jsonl --allow-unredacted
```

This is a deliberate acknowledgement for that command invocation only. It is
not persisted, has no environment-variable equivalent, and does not change
future sync behavior. The original signed events and existing HTTP request
format are sent unchanged. Prefer adding explicit redaction and creating new
evidence when that is operationally possible; existing signed journals cannot
be safely rewritten.

The typed `EvidencePrivacyPreflightError` has:

* `error_code="evidence_privacy_acknowledgement_required"`;
* `execution_occurred=False`;
* `retry_safe=True`, meaning retrying sync after review with explicit
  acknowledgement is safe. It does not mean a guarded business action should
  be retried.

CLI exit codes are deterministic:

| Code | Meaning |
| --- | --- |
| `0` | Inspect policy passed, or sync completed/replayed/is up to date. |
| `1` | Invalid, tampered, unverifiable journal, or another operational sync failure. |
| `2` | CLI usage or Connected configuration failure. |
| `3` | Retained or unknown argument content requires explicit acknowledgement. |

## Synthetic-data guidance

Use synthetic values in evaluation, demonstrations, support reproductions, and
private-alpha testing. Synthetic input reduces impact if evidence is shared,
but still inspect it: a value being synthetic is not encoded in evidence v1 and
cannot be inferred by the classifier.

## Business-data guidance

Explicitly list every business parameter in `redact=[...]`, even when its name
does not look secret. Inspect the resulting journal before upload. If a journal
already contains retained business values, treat `--allow-unredacted` as a
reviewed disclosure decision, not as a routine compatibility flag.

## Compatibility with evidence v1

Inspection reads the existing `redacted_input_summary`; it adds no event field.
It does not change ActionContract v1, canonical serialization, event hashes,
signatures, chain linkage, batch identity, HTTP payloads, or server verification.
Existing journals remain verifiable. Acknowledged uploads use the same request
body that the preflight-free client would have produced.

## Privacy limitations

The selected policy answers only whether ordinary argument content is visibly
retained or structurally unknown in `redacted_input_summary`. It does not prove
anonymity or assess whether action names, parameter names, metadata, timestamps,
type names, exception text, output hashes, or input hashes are identifying.
Sanitized errors remove known secret values but can retain other business text.
Hashes do not eliminate privacy risk, especially for low-entropy domains.

Local verification proves integrity relative to the selected public key, not
that the host, key holder, action, or data is trustworthy. Journal tail
truncation remains undetectable without an external checkpoint.
