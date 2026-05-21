# Execution Verification and Proof

Receipts are proof artifacts only after Overture validates their hash and
signature against registered runtime keys. Logs are supporting evidence, not
proof.

Task proof state stores safe verification summaries: status, expected hash,
stored hash, signature presence, hash validity, signature match, runtime key
presence, chain-link validity, reason, and verification timestamp.

Verification answers whether an action happened according to persisted runtime
evidence, whether evidence was modified, whether the action stayed
policy-compliant, and whether recovery changed the execution path.

Production-ready: receipt signature verification, task proof summaries, lineage
sync, tamper detection for hash/signature mismatch.

Experimental: per-action proof beyond runtime-provided receipts when an action
does not produce external confirmation.
