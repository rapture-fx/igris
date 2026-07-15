# ADR 0011: Action and Evidence identities are opaque and language-neutral

Status: **Proposed**
Date: 2026-07-15

## Context

Python qualified names and source fingerprints are not durable semantic
identities. Evidence also needs portable instance and stream correlation
without importing tracing or workflow semantics.

## Decision

An Action's semantic identity is `(publisher_namespace, action_name)`.
Publisher namespaces are self-generated opaque 256-bit identifiers with the
`igris-publisher:` prefix; uniqueness is not trust. Contract versions and the
semantic contract hash cover language-neutral policy fields. Source and
implementation fingerprints are separate, optional implementation bindings.
Publisher attribution is a separate signed contract attestation, so signer
rotation does not change the semantic contract hash.

Future Evidence uses signed opaque 256-bit `igris-stream:` and
`igris-instance:` identifiers. Sequence is stream-local, begins at zero, and
increments by one. An event's identity is its `(stream_id, sequence,
event_hash)`; no separate event UUID is required. An Outcome references its
Decision hash. General tracing correlation remains optional.

## Consequences

- Python modules, decorators, and `wrap_tool` remain binding concerns.
- Two organizations can use the same action name without semantic collision
  when their publisher namespaces differ.
- Identity does not imply publisher trust or authorization.
- Chain continuity does not prove a complete tail without an external witness.

## Rejected alternatives

Global human-readable namespace registration, source hash as semantic identity,
Python module paths, and mandatory OpenTelemetry identifiers are rejected.
