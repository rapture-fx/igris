# Igris Private-Alpha Evaluation

This self-contained kit evaluates Igris as a drop-in action layer around one
synthetic consequential function. No verbal guidance should be necessary.

## Start Here

1. Complete [Embedded Quickstart](embedded-quickstart.md), targeted at 15
   minutes and requiring no account or backend.
2. Read [What Leaves Your Machine](what-leaves-your-machine.md).
3. If disposable private-alpha credentials were supplied, optionally complete
   [Connected Quickstart](connected-quickstart.md).
4. Submit the [Evaluator Scorecard](evaluator-scorecard.md).

Use [Troubleshooting](troubleshooting.md) for typed failures. Product issues
observed during validation are recorded in
[Private-Alpha Product Defects](private-alpha-defects.md).

Maintainers can reproduce the clean Embedded acceptance path from the
repository root:

```bash
./scripts/private-alpha/validate_embedded.sh
```

Connected acceptance is deliberately separate and runs only with explicit
disposable test variables:

```bash
export IGRIS_ALPHA_TEST_API_URL="https://your-private-alpha-endpoint.example"
export IGRIS_ALPHA_TEST_API_KEY="replace_with_a_disposable_test_key"
./scripts/private-alpha/validate_connected.sh
```

The validator builds a wheel, creates a temporary virtual environment, installs
the artifact, runs the sample, verifies the journal, and checks event classes.
It deletes its temporary files and never provisions infrastructure or keys.
