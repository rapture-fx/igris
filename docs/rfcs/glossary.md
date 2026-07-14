# Igris protocol glossary

Status: **Draft terminology**

| Term | Meaning |
| --- | --- |
| Action | Stable, inspectable declaration of a consequential capability |
| ActionContract | Versioned static serialized declaration of an Action |
| Action instance | One attempted invocation of an ActionContract |
| Adapter | Language/framework integration that maps an ordinary callable or tool to an Action |
| Allowed | Provider decision permitting this instance to begin execution |
| Attribution | Binding a signing key to a person, organization, workload, or device |
| Authorization | Policy conclusion that an attributed principal may perform an operation |
| Canonical bytes | Exact schema-defined byte representation used for hashing |
| Causation | Signed relationship asserting that one protocol object caused another |
| Chain anchor | Expected preceding hash or checkpoint used to evaluate a segment |
| Chain completeness | Confidence that no earlier/later event is omitted; stronger than internal validity |
| Connected | Optional coordination/transport participation; not execution provenance |
| Continuity | Valid previous-hash linkage relative to supplied events/anchor |
| Decision | Provider observation of allowed or denied for one instance |
| Embedded | Execution in the caller's environment, guarded/observed but not controlled by Igris runtime |
| Evidence | Typed signed lifecycle assertion with explicit claim boundaries |
| Evidence incomplete | A required event is missing/unpersisted; execution state remains separately reported |
| External-side-effect truth | Independent confidence that a real-world effect occurred as intended |
| Integrity | Bytes/hash/signature match a public key under a schema algorithm |
| Managed | Future SDK integration where authenticated Igris runtime controls execution; outside Protocol v1 |
| Outcome | Adapter-observed normal return or ordinary failure; not independent external truth |
| Provider | Explicit implementation of approval, signing, storage, registry, clock, or identifier capability |
| Reference implementation | Implementation used to validate and illustrate a specification, not the specification itself |
| Signing identity reference | Algorithm-qualified key lookup handle; not automatically human identity |
| Trust store | Scoped key bindings, status, authority, and temporal metadata used by a verifier |
| Verification result | Structured parsing, integrity, key, chain, semantic, and trust conclusions |
| Witness/checkpoint | External observation of a chain head used to strengthen completeness/timing claims |
