# Igris private-alpha.2 example

Demonstrates the two alpha.2 additions on top of the frozen alpha.1 refund
demo (which lives in `../private-alpha/` and is intentionally unchanged):

1. **Wrapping existing callables** — `igris.wrap_tool` guards a function you
   cannot or do not want to edit, including `async def` functions.
2. **Evidence privacy inspection and the fail-closed sync preflight** —
   `igris evidence inspect` classifies argument retention locally, and
   `igris evidence sync` refuses partially redacted or unknown journals
   unless `--allow-unredacted` is passed for that single invocation.

Everything here is synthetic: no payment processor, bank, or external service
is called, and the privacy demo uploads to an in-process recording client,
never to a real endpoint.

## Run

```bash
export IGRIS_HOME="$(mktemp -d)/igris-home"
python alpha2_demo.py          # decorated + wrapped sync + wrapped async actions
igris verify "$IGRIS_HOME/journal.jsonl" --public-key "$IGRIS_HOME/verify_key.pem"
igris evidence inspect         # exits 3: journal retains ordinary values
python privacy_sync_demo.py    # refusal, then explicit one-shot acknowledgement
```

The repository harness `scripts/ci/run_alpha2_harness.sh` runs this same
sequence against a freshly built wheel in a clean virtual environment.
