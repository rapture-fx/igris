# Execution Verification and Proof

Receipts are proof artifacts only after Overture validates their hash and
signature against registered runtime keys. Logs are supporting evidence, not
proof.

Runtime callback envelopes are signed control-plane messages, not proof
receipts. They authorize mutation of coordinator state for checkpoint,
complete, and failed callbacks. Each envelope covers version, tenant ID, task
ID, runtime ID, callback type, SHA-256 body digest, timestamp, nonce, algorithm,
and Ed25519 signature. Overture verifies the envelope before accepting the
callback body.

The Rust runtime sends these envelopes live when the coordinator includes
callback configuration in the dispatch payload. Callback acceptance proves the
runtime identity and exact callback body for the lifecycle mutation; receipts
remain the cryptographic execution evidence used for proof verification.

Task proof state stores safe verification summaries: status, expected hash,
stored hash, signature presence, hash validity, signature match, runtime key
presence, chain-link validity, reason, and verification timestamp.

Verification answers whether an action happened according to persisted runtime
evidence, whether evidence was modified, whether the action stayed
policy-compliant, and whether recovery changed the execution path.

Production-ready: receipt signature verification, signed runtime callback
validation, task proof summaries, lineage sync, tamper detection for
hash/signature mismatch, and safe persistence of rejected callback attempts.

Experimental: per-action proof beyond runtime-provided receipts when an action
does not produce external confirmation. Signed callbacks prove who requested a
state mutation and which body was presented; receipts remain the artifact that
proves execution evidence.
