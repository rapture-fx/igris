# Embedded Quickstart (15 Minutes)

Use this path first. It needs no account, API key, backend, container, or
network service. The sample executes a synthetic function in your Python
process and writes keys and evidence only to the temporary directory you set.

## 1. Check Python and create an isolated environment

Igris declares Python 3.10 or newer. This alpha was exercised locally on
Python 3.11 and 3.12; use a supported interpreter available on your machine.

From the repository root:

```bash
python3 --version
python3 -m venv .venv-igris-alpha
source .venv-igris-alpha/bin/activate
python -m pip install --upgrade pip
```

On Windows PowerShell, activate with
`.venv-igris-alpha\Scripts\Activate.ps1` instead.

## 2. Build and install the private-alpha artifact

Do not run `pip install igris` from the public package index. Public publication
is blocked by an unrelated legacy package that uses the same import name.

If the Igris team supplied a wheel, install its exact path:

```bash
python -m pip install /path/to/igris-0.1.0-py3-none-any.whl
```

Otherwise build the wheel from this checkout (the build step downloads build
dependencies if they are not already cached):

```bash
python -m pip install build
python -m build --wheel --outdir /tmp/igris-private-alpha-dist sdk/python
python -m pip install /tmp/igris-private-alpha-dist/igris-0.1.0-py3-none-any.whl
python -c "import igris; print(igris.__version__)"
```

Expected version pattern: `0.1.0`.

## 3. Understand the one-guard change

The sample's consequential boundary is an ordinary local Python function:

```python
import igris

@igris.guard(
    action="support.refund.request",
    risk="high",
    approval="required",
    approval_provider=APPROVAL_PROVIDER,
)
def request_synthetic_refund(customer_id: str, amount_cents: int, support_note: str):
    ...
```

With `approval="required"`, the default provider prompts in a terminal and
defaults to deny. This sample injects `DemoApprovalProvider` so evaluation is
deterministic and non-interactive. It denies one named synthetic customer and
allows the other calls. Approval remains local.

## 4. Run Embedded mode

Create an isolated location for the signing identity and journal. Explicitly
remove Connected configuration so this is a local-only run:

```bash
export IGRIS_HOME="$(mktemp -d)/igris"
unset IGRIS_API_URL IGRIS_API_KEY
./examples/private-alpha/run_embedded.sh
```

Expected output patterns (IDs, hashes, and temporary paths vary):

```text
ALLOWED: synthetic_refund_recorded ...
DENIED: function did not execute ...
FAILED: function executed locally and raised RuntimeError ...
JOURNAL: <temporary path>/igris/journal.jsonl
key_id:      ed25519:<fingerprint prefix>
OK: 5 event(s) verified ...
decision.allowed: 2
decision.denied: 1
outcome.succeeded: 1
outcome.failed: 1
```

Nothing contacts a payment service and no money moves.

## 5. Run the CLI commands directly

The runner already executes these; running them again makes the verification
boundary explicit:

```bash
igris key-info
igris verify "$IGRIS_HOME/journal.jsonl" --public-key "$IGRIS_HOME/verify_key.pem"
python examples/private-alpha/inspect_journal.py "$IGRIS_HOME/journal.jsonl"
```

`key-info` prints the public key identity and path, never the private key.
`verify` works offline and checks every event's schema, hash, Ed25519 signature,
and link to the preceding event.

## Read the five events

- A `decision.allowed` event is signed and durably appended before execution.
- A `decision.denied` event means approval refused and the function did not run.
- An `outcome.succeeded` event means the allowed function returned locally.
- An `outcome.failed` event means the allowed function ran locally and raised;
  the original exception was re-raised.
- A denied decision has no outcome because execution never started.

These events show what the local guarded process observed. They do not prove a
real payment or other external side effect occurred.

## Files and network boundary

This run creates only:

```text
$IGRIS_HOME/signing_key.pem   private Ed25519 key
$IGRIS_HOME/verify_key.pem    public verification key
$IGRIS_HOME/journal.jsonl     signed append-only JSONL events
```

With both Connected variables unset, Igris performs no network calls: no
telemetry, update check, registration, evidence upload, or background sync.
The function runs in the caller's process. Keep `signing_key.pem` secret and do
not commit any of these generated files.

Next, either stop here or continue to the optional
[Connected quickstart](connected-quickstart.md).
