# External Tester Checklist

Use this checklist to run the local Igris proof loop cold and report where trust or setup is unclear.

## Prerequisites

- macOS with Homebrew Postgres, or any local Postgres reachable through `DATABASE_URL` / `POSTGRES_URL`.
- Go, Rust/Cargo, Node, pnpm, curl, lsof, and psql on PATH.
- Ports `8080`, `8081`, `18090`, and `18091` available.
- Docker is optional. Do not install Docker just for this checklist unless you specifically want to validate the optional Docker path.

## Main Command

```bash
make run-recover-prove-local-provision
```

This is the validated local onboarding path. It provisions or reuses local Postgres, applies Overture migrations, runs setup checks, starts the live local services, and runs the full Run / Recover / Prove demo.

## Success Looks Like

Look for:

```text
live action path:              real
signed callback mode:          live-server-backed
failure/recovery mode:         live-server-backed
receipt verify HTTP status:    200
task verify HTTP status:       200
```

The command should also print a success task ID, failure task ID, runtime ID, execution ID, API inspection URLs, optional console URLs, and a path to a redacted evidence summary.

## Inspect

Use the printed URLs to inspect:

- successful task
- failed task
- execution run
- receipt/proof list
- task proof verification
- recovery event
- boundary violations

Expected replay-safety evidence:

- failed task has a signed failed callback path
- recovery event includes `automatic_replay_blocked`
- recovery event includes `replay_allowed=false`
- reason explains that an irreversible action cannot be automatically replayed during recovery

## Console Mock Fallback

When inspecting real backend evidence in the console, disable mock fallback:

```bash
NEXT_PUBLIC_ENABLE_MOCK_DATA=false
NEXT_PUBLIC_API_URL=http://127.0.0.1:8081
```

Development defaults may allow mock data when the backend is unavailable. That is useful for UI work, but it is not proof-loop inspection.

## Proof Expectations

Treat proof as unavailable or unverifiable when signed runtime artifacts or runtime keys are missing. Do not count a stored hash, a log line, or a successful API fetch as proof by itself.

Verification should be explained through:

- receipt hash re-derivation
- Ed25519 signature verification against a registered runtime key
- previous-hash chain-link status
- explicit proof status and verification reason

## Report Back

Please report answers in this structure:

1. Environment: OS, CPU architecture, and Postgres path used: Homebrew, manual
   DSN, or Docker.
2. Command result: did `make run-recover-prove-local-provision` complete
   without `--skip-live`? If not, paste the first failing command and the
   redacted error.
3. Setup friction: what prerequisite, command, port, migration, or database
   step slowed you down?
4. Product understanding: after the run, explain "run", "recover", and
   "prove" in your own words.
5. Proof trust: did the receipt/proof model feel inspectable and trustworthy?
   What still felt like a leap of faith?
6. Unclear terms: list any words, API names, output fields, or docs that were
   confusing.
7. Secret leakage: did any output look like a raw credential, private key,
   token, raw `DATABASE_URL`, raw callback body, or raw environment value?

It is safe to share the success/failure status, sanitized IDs, HTTP status
codes, local-only inspection URLs, and the redacted evidence summary. Redact
tenant IDs if sharing publicly.

Do not share raw `DATABASE_URL`, DB passwords, private keys, API keys, tokens,
raw callback bodies, or raw environment values.
