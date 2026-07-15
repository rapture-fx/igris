# ADR 0009: Normative artifact precedence and closed signed schemas

Status: **Proposed**
Date: 2026-07-15

## Context

Prose, machine-readable schemas, canonical byte fixtures, and implementations
can disagree. Signed objects also cannot safely ignore fields whose semantics
the verifier does not understand.

## Decision

A release manifest identifies the complete normative artifact set. Prose owns
semantic requirements; canonicalization and registry specifications own exact
byte/identifier rules; machine-readable schemas own structural validation; and
released vectors own the enumerated byte and result examples. Reference
implementations are non-normative.

If normative artifacts disagree, no artifact silently wins. The release has a
specification defect for that case; implementations fail closed with
`specification_conflict` until an erratum or superseding release resolves it.
Schema-1 historical vectors remain exact compatibility authorities.

Future signed-object schemas are closed. Unknown signed members and unknown
schema identifiers produce typed unsupported/invalid results and are not
ignored. Any new signed field requires a schema-version increment.

## Consequences

- Implementation behavior cannot become normative by accident.
- Verifiers can reject ambiguous signed content before trust evaluation.
- Release review must validate prose, schema, canonical rules, and vectors as
  one set.
- Adding a signed field has an explicit compatibility cost.

## Rejected alternatives

“Implementation wins,” “vectors always win,” and preserve-but-ignore unknown
signed fields are rejected because each can silently change signed meaning.
