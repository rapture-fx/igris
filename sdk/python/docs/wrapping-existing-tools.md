# Wrapping existing tools

Igris is a drop-in action layer for AI agents. You can guard functions you own
with `@igris.guard`, or wrap **existing** callables without editing their source
using `igris.wrap_tool` and `igris.wrap_tools`. Both paths use the same guard
engine — contract building, redaction, approval, signed evidence, and Connected
synchronization — so a wrapped tool produces the same evidence as an equivalent
decorated function.

## When to use `@igris.guard`

Use the decorator when you own the function definition and can edit its source:

```python
@igris.guard(action="customer.refund", risk="critical")
def refund_customer(customer_id: str, amount: int):
    return payment_provider.refund(customer_id=customer_id, amount=amount)
```

The decorator is the authoritative action declaration. It rejects async
functions and generator functions at decoration time — this is deliberate
because the decorator's execution model assumes a single synchronous return.

## When to use `igris.wrap_tool`

Use `wrap_tool` when you cannot (or do not want to) edit the function's source:

```python
from some_library import process_refund

wrapped_refund = igris.wrap_tool(
    process_refund,
    action="payments.refund",
    risk="critical",
    redact=["customer_id"],
)
```

The returned callable is a new function — the original is never mutated. It
produces the same ActionContract, signed decision/outcome events, and Connected
sync behavior as an equivalent `@igris.guard` declaration.

`wrap_tool` accepts the same keyword arguments as `@igris.guard`:
`action`, `risk`, `approval`, `journal`, `redact`, `metadata`,
`approval_provider`, `identity`, and `sync_client`. The `action` parameter is
required (there is no sensible default action name for an arbitrary callable).

## How `wrap_tools` handles collections

`wrap_tools` wraps a sequence or mapping of callables in one call. It never
mutates the caller's collection.

**Sequence input** (tool name derived from `__name__`):

```python
wrapped = igris.wrap_tools(
    [refund, lookup, cancel],
    configuration={
        "refund": {"action": "payments.refund", "risk": "critical"},
        "lookup": {"action": "payments.lookup", "risk": "low"},
        "cancel": {"action": "payments.cancel", "risk": "high"},
    },
)
# Returns a new list of wrapped callables.
```

**Mapping input** (tool name is the mapping key):

```python
wrapped = igris.wrap_tools(
    {"refund": refund_func, "lookup": lookup_func},
    configuration={
        "refund": {"action": "payments.refund", "risk": "critical"},
        "lookup": {"action": "payments.lookup", "risk": "low"},
    },
)
# Returns a new dict of wrapped callables.
```

Rules:
- Every tool must have a configuration entry with at least an `action` string.
- Action names must be unique across all tools in the collection.
- Non-callable entries raise `ToolWrapError`.
- The helper is framework-neutral; it does not implement framework-specific
  tool registries or auto-discovery.

## Sync and async behavior

`wrap_tool` preserves the synchronous or asynchronous nature of the callable:

- Wrapping a `def` function returns a `def` wrapper.
- Wrapping an `async def` function returns an `async def` wrapper. The guard
  engine runs synchronously (contract sync, approval, decision event, evidence)
  and then `await`s the original callable. The outcome event is recorded after
  the coroutine completes.

This means `wrap_tool` supports async callables — unlike `@igris.guard`, which
rejects them at decoration time. The async wrapper follows the same fail-closed
semantics: a denial prevents `await` from being called, and exceptions
propagate unchanged.

## Signature and metadata preservation

The returned wrapper has:

- `__wrapped__` pointing to the original callable.
- `__name__`, `__qualname__`, `__doc__`, and `__module__` copied from the
  original where they exist (e.g. for plain functions and bound methods).
  Callable objects and `functools.partial` objects may not have `__name__` or
  `__qualname__`; in that case those attributes are absent on the wrapper.
- `inspect.signature(wrapper)` matching `inspect.signature(original)`.

The `__igris_contract__` attribute on the wrapper carries the `ActionContract`.

## Redaction

Redaction is identical to the decorator path. Built-in sensitive parameter
names (`api_key`, `password`, `token`, `secret`, etc.) are redacted
automatically. Pass `redact=["customer_id", "amount"]` to redact additional
business parameters. Nested sensitive keys inside dict or list arguments are
also scrubbed.

## Connected behavior

Connected contract synchronization works the same as the decorator: if
`IGRIS_API_URL` and `IGRIS_API_KEY` are both set (or a `sync_client` is
injected), the ActionContract is synchronized to the backend before local
approval and before the callable runs. Without Connected configuration, zero
network activity occurs — Embedded mode is the default.

## Unsupported callable categories

| Category | Behavior |
| --- | --- |
| Generator functions (`yield`) | Rejected with `ToolWrapError`; guarding a generator would record an outcome before any work runs. |
| Async generator functions (`async yield`) | Rejected with `ToolWrapError` for the same reason. |
| Already guarded functions | Rejected with `ToolWrapError` to prevent double-wrapping. |
| Non-callable entries | Rejected with `ToolWrapError`. |
| Built-in / C-extension callables lacking a complete signature | Rejected with `ContractError` if `inspect.signature` cannot resolve the parameters. |
| Descriptors before binding | Pass the bound method (e.g. `instance.method`) or the function accessed as a class attribute, not the raw descriptor. |

## No-network default

Unconfigured Embedded mode performs zero network activity — no telemetry, no
update checks, no background sync. The socket guard in the SDK test suite
proves this for every test. Connected mode is purely opt-in via explicit
environment variables or an injected `sync_client`.

## No automatic evidence upload

`wrap_tool` and `wrap_tools` never upload evidence. Evidence upload is a
separate, explicit command: `igris evidence sync`. Guarded execution — whether
via decorator or wrapper — never triggers a network call for evidence.

## Framework-neutral example

See `examples/tool-wrapping/wrap_existing_tools.py` for a synthetic agent tool
registry that wraps imported functions, async tools, a list of tools, a mapping
of tools, and a denied action — all without editing any original source and
with no framework dependency.