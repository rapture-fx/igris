# Synthetic Refund Evaluation

This sample models a customer-support agent requesting a refund. It is
deliberately synthetic: it never contacts Stripe, a bank, a payment processor,
or any external service, and it never moves money.

The single guarded function demonstrates three outcomes:

- an allowed request that returns a fictional local record;
- a denied request whose function does not execute;
- an allowed request whose function executes locally and raises an error.

`DemoApprovalProvider` is deterministic and non-interactive. It denies the
synthetic `cust_demo_denied` customer and allows the other two requests. The
provider receives only Igris's redacted, bounded input summary.

## Embedded

After installing the supplied Igris wheel in an isolated environment:

```bash
export IGRIS_HOME="$(mktemp -d)/igris"
./examples/private-alpha/run_embedded.sh
```

The runner removes both Connected environment variables, runs the sample,
prints the exact journal path, verifies it offline, and reports these event
classes:

```text
decision.allowed: 2
decision.denied: 1
outcome.succeeded: 1
outcome.failed: 1
```

There is no outcome for the denied call because the function did not execute.

## Connected (Optional)

Complete `docs/alpha/embedded-quickstart.md` first. With explicit credentials
for a disposable private-alpha endpoint, the decorator and Python code remain
unchanged:

```bash
export IGRIS_API_URL="https://your-private-alpha-endpoint.example"
export IGRIS_API_KEY="replace_with_a_disposable_test_key"
export IGRIS_HOME="$(mktemp -d)/igris"
./examples/private-alpha/run_connected.sh
```

The guarded calls synchronize the ActionContract before local execution. The
runner then uploads evidence only through the explicit `igris evidence sync`
command and requests the returned batch status. Do not use production
credentials or infrastructure for this sample.
