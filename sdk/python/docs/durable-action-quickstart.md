# Durable Action Quickstart (Clean Room)

This is the supported product path for **durable** Igris: configure explicitly,
synchronize an ActionContract, create an exact contract-hash binding, submit a
durable run with a business idempotency key, observe status, and retrieve
**Igris Run Proof**.

Embedded `igris.wrap_tool` / `@igris.guard` remain **local by default**. Setting
`IGRIS_API_URL` alone never switches them to remote execution. Durable mode uses
the Igris control plane plus typed Runtime orchestration — it does **not**
upload Python source, wheels, pickle, import paths, or shell commands, and
Runtime is not an arbitrary Python executor.

## Install (supported interim path)

Do **not** run `pip install igris` from the public package index. That name
resolves to an unrelated third-party package and/or collides with legacy
distributions. This SDK publishes (internally) as distribution name **`igris-sdk`**
while keeping `import igris`.

```bash
# From a repository checkout (preferred for private alpha):
python -m venv .venv && source .venv/bin/activate
python -m pip install -U pip
python -m pip install ./sdk/python

# Or build and install the wheel:
cd sdk/python && python -m pip install build && python -m build
python -m pip install dist/igris_sdk-*.whl
```

Verify:

```bash
python -c "import igris; print(igris.__version__)"
igris --version
```

## Prerequisites (infrastructure)

The control plane and a bound webhook adapter must already be running for your
tenant. Operators typically apply database migrations and start services
separately — you do not need migration numbers for the basic developer journey.
You need:

* Igris API endpoint URL
* Tenant-scoped API key (`igris_…`)
* A reachable authenticated webhook Action target (adapter) for your Action

## Configure the durable client explicitly

```python
from igris import IgrisDurableClient, wrap_tool
from igris.approval import ApprovalDecision

# Explicit construction — never inferred from env alone for wrap_tool.
client = IgrisDurableClient(
    endpoint="https://your-igris-endpoint",  # or http://127.0.0.1:… for local
    api_key="igris_…",
)

# Alternatively, after setting BOTH IGRIS_API_URL and IGRIS_API_KEY:
# client = IgrisDurableClient.from_env()
```

## 1. Wrap or declare the consequential function (Embedded gate)

Use the existing Embedded primitive. This still executes locally when *you*
call it. The durable path below does not upload this function to Runtime.

```python
class AlwaysAllow:
    def decide(self, request):
        return ApprovalDecision("allowed", "quickstart")

def transfer(account_id: str, amount_cents: int) -> dict:
    return {"account_id": account_id, "amount_cents": amount_cents, "ok": True}

tool = wrap_tool(
    transfer,
    action="demo.consequential_transfer",
    risk="critical",
    approval="never",
    approval_provider=AlwaysAllow(),
)
contract = tool.__igris_contract__
print(contract.action_name, contract.contract_hash)
```

## 2. Synchronize the ActionContract

```python
sync = client.sync_contract(tool)  # or client.sync_contract(contract)
print("synced", sync.contract_hash, "created=", sync.created)
```

## 3. Create or inspect the Action target

Target identity stays visible. This registers an executable webhook target —
not Python upload.

```python
target = client.create_action_target(
    name="demo_transfer_adapter",
    target_type="webhook",
    target_url="http://127.0.0.1:18099/v1/demo/transfer",
    method="POST",
    replay_class="retryable",
    approval_required=False,
    target_metadata={
        "local_auth_header_name": "X-Igris-Adapter-Token",
        "local_auth_secret_env": "IGRIS_DEMO_ADAPTER_TOKEN",
    },
)
print("target_action_id", target.id)
```

## 4. Create or reuse an exact binding

Binding requires the **exact** `contract_hash` and `target_action_id`.
Name-only binding is rejected.

```python
binding = client.ensure_binding(
    action_name=contract.action_name,
    contract_hash=contract.contract_hash,
    target_action_id=target.id,
    input_mapping={
        "account_id": "account_id",
        "amount_cents": "amount_cents",
    },
)
print("binding", binding.id, "target_version", binding.target_version_hash)
```

CLI equivalent:

```bash
igris binding create \
  --action demo.consequential_transfer \
  --contract-hash "$CONTRACT_HASH" \
  --target-action-id "$TARGET_ID" \
  --input-mapping '{"account_id":"account_id","amount_cents":"amount_cents"}' \
  --json
```

## 5. Submit a durable run (explicit idempotency key)

```python
run = client.run(
    contract.action_name,
    input={"account_id": "acct_1", "amount_cents": 100},
    idempotency_key="demo-transfer-2026-07-20-001",  # business key; not random
    contract_hash=contract.contract_hash,
)
print("run_id", run.run_id)
```

## 6. Status / wait

```python
status = run.wait(timeout=60.0, poll_interval=1.0)
print(status.status, status.recovery_status, status.is_terminal)

# Unresolved effect states raise ReconciliationRequiredError — no auto-retry.
```

```bash
igris run status "$RUN_ID"
igris run wait "$RUN_ID" --timeout 60 --json
```

## 7. Retrieve Igris Run Proof

Igris Run Proof (`igris_run_proof.v1`) is a **linked product representation**:
Runtime receipt claims and Action Protocol Evidence remain separate nested
claim types. `eligible_linked` means server eligibility, not a single
cryptographic proof object.

```python
proof = run.proof()  # prefers igris_run_proof; linked_proof retained for compat
print(proof.schema, proof.product_term)
print(proof.statuses)
print(proof.claim_boundary)
print(proof.runtime_proof)
print(proof.action_protocol_evidence)
```

```bash
igris run proof "$RUN_ID"
```

## 8. Optional: sync Evidence and link (explicit)

Evidence upload is never automatic.

```bash
igris evidence sync
igris run link-evidence "$RUN_ID" --batch-id "$BATCH_ID"
```

```python
# After igris evidence sync returned a verified batch_id:
link = run.link_evidence(batch_id)
print(link.run_linkage_status)  # eligible_linked = server eligibility
```

If eligibility fails, the client raises typed `EvidenceNotLinkableError`.

## What this path does *not* do

* Does not make `wrap_tool` remote
* Does not bind by Action name alone
* Does not invent idempotency keys
* Does not upload Python to Runtime
* Does not collapse Runtime proof and Action Protocol Evidence into one claim
* Does not auto-retry reconciliation-required / unknown-effect states
