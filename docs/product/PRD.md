# Igris Product Requirements Document

Status: Ratified product truth

Product stage: Hosted alpha

Ratified from: `origin/main` at `018d1c17df32f18b1c990d0d1a9e88c0e7a368e3`

Last updated: 2026-07-24

## Product definition

Igris is a safe execution boundary for consequential actions initiated by
coding agents and automated systems.

Igris lets a developer keep their coding agent, application, and tools while
routing consequential work through a durable boundary:

**Action → Run → Proof**

- **Action** is the named, configured operation the agent is allowed to request.
- **Run** is one durable attempt to execute an Action, including policy,
  idempotency, approval, failure, and recovery state.
- **Proof** is the honest, inspectable record Igris can produce about that Run.

Igris exists to make consequential automation safer to operate. It is not an
agent framework, a general workflow builder, or a replacement for the tools an
agent already uses.

## Initial customer and wedge

The initial user is an engineer who wants a coding agent to perform a
consequential software-delivery action without giving the agent an
unobservable, blindly replayable tool call.

The hosted-alpha wedge is:

- `deploy.staging`
- `deploy.production`
- `migrate.database`
- `publish.package`

The first product experience must make these operations understandable,
reviewable, and recoverable. New capability work outside this wedge requires
explicit product approval.

## Public product model

### Action

An Action is a stable, tenant-owned name and configuration for consequential
work. Configuration is an operator/setup concern; agents request Actions by
name and supply only the inputs needed for a Run.

### Run

A Run is the durable lifecycle of one requested Action. A Run must expose
truthful states, fail closed at authorization and validation boundaries, and
never imply that a rejected, uncertain, or failed external effect succeeded.

Idempotency reduces duplicate submission. It does not make an external system
exactly-once. If Igris cannot determine whether an external effect occurred,
the Run must enter an uncertain state rather than blindly replaying the effect.

### Proof

Proof is an inspectable record of what Igris authorized, dispatched, observed,
and verified for a Run. Signed receipts and hash-linked records can establish
integrity and provenance of Igris-observed events. They do not, by themselves,
cryptographically prove that an external-world effect was correct or complete.

Public claims must distinguish:

- what Igris requested or authorized;
- what Igris dispatched;
- what a target reported;
- what Igris independently verified; and
- what remains uncertain.

### Reconciliation

Reconciliation is the exceptional operator workflow for a Run whose external
effect is uncertain or whose recorded state conflicts with independently
observed reality.

Reconciliation is not an ordinary fourth step after every Run. It is not
cryptographic proof. It is a documented, authenticated, tenant-scoped human
decision that resolves uncertainty without pretending Igris has learned facts
it cannot verify. Reconciliation records who decided, when, why, and the
resulting disposition.

## Managed product and interfaces

Managed Igris is the initial deployment model. Igris operates the control-plane
and execution machinery needed to accept authenticated Action requests,
maintain durable Runs, and return Proof.

REST is the canonical managed interface. Public REST contracts define product
behavior. Other transports and tools must map to those contracts without
creating a second product model.

The Python SDK is a thin convenience layer over the managed REST interface. Its
primary hosted-alpha flow is:

```python
from igris import Igris

igris = Igris.from_env()
action = igris.configure_action("deploy.staging", ...)
run = action.run(...)
run.wait()
proof = run.proof()
```

The exact supported arguments and return values are defined by the released
SDK and REST contract. Documentation must not present unreleased SDK behavior
or a private artifact as publicly installable.

MCP and CLI integrations may help coding agents call the managed interface, but
they are adapters. They must not displace REST or introduce competing
vocabulary.

## Internal machinery

Overture, Runtime, the write-ahead log (WAL), checkpoints, bindings, receipts,
and related coordination components are internal machinery. They can appear in
advanced architecture, operations, and protocol documentation where needed.
They must not be prerequisites for ordinary product understanding or first-run
onboarding.

Internal machinery must continue to preserve:

- server-side authentication, authorization, tenant ownership, and validation;
- durable and tenant-scoped Run state;
- conservative retry and recovery behavior;
- explicit handling of uncertain external effects;
- secret minimization and safe logging;
- auditable operator decisions; and
- deployment and migration boundaries that fail closed.

## Action Protocol

Action Protocol is the open trust and interoperability layer beneath the
managed product. It may define portable contracts, proof formats, and
verification rules.

Action Protocol is not day-one onboarding. Public product pages may mention it
as the open layer underneath Igris, but first-run instructions must begin with
an Action and the managed API or Python SDK.

Protocol compatibility and signed-byte commitments remain governed by their
own ratified specifications. This PRD does not authorize a new protocol
version.

## Console

The hosted-alpha console is minimal and non-blocking. It may provide:

- account and authentication state;
- API-key creation and revocation;
- Run list and Run detail;
- Proof inspection; and
- exceptional Reconciliation.

The console is not required when an authenticated, documented operator path can
safely provision the first external user. The alpha must not expand into a
runtime fleet UI, workflow builder, protocol explorer, marketplace, or broad
analytics dashboard.

## Hosted-alpha experience

A first external engineer must be able to:

1. obtain an account and tenant;
2. create or receive a tenant-scoped API key;
3. install the supported Python SDK through a truthful documented path;
4. configure an Action once;
5. request a Run from a coding agent;
6. observe success, failure, approval, and uncertainty without ambiguous
   states; and
7. retrieve honest Proof without learning internal architecture first.

The product may require operator-assisted onboarding during alpha. Every manual
step must be documented, auditable, and must not require sharing production
secrets with the external engineer.

## Security and reliability requirements

- Authentication and tenant ownership are enforced server-side.
- API keys and target credentials are never trusted from client-visible state
  alone and are never written to public logs or Proof payloads.
- Public Action targets use HTTPS, except explicitly bounded local development.
- Outbound target handling remains deny-by-default against SSRF, redirect, and
  unsafe-network behavior.
- Run creation and retries use tenant-scoped idempotency.
- Irreversible or uncertain effects are not blindly replayed.
- Approval and Reconciliation transitions are authenticated, tenant-scoped,
  atomic, and auditable.
- Production migrations remain operator-run; application runtimes do not
  automatically execute them.
- Important deployment configuration is validated before traffic is promoted.
- Rollback restores the previous known-good application artifacts without
  rewriting migration history.

## Allowed product development

Without additional product approval, engineering may:

- remove blockers preventing the hosted-alpha wedge from working end to end;
- fix security, durability, correctness, privacy, and observability defects;
- simplify the Action → Run → Proof onboarding path;
- improve the REST interface and thin Python SDK without changing the public
  model;
- improve tests, deployment safety, runbooks, and cloud-development setup;
- make the minimal console sufficient for account, API keys, Runs, Proof, and
  Reconciliation; and
- maintain already-ratified protocol compatibility.

## Frozen product development

The following are frozen until explicitly approved in a PRD amendment or
approved roadmap item:

- a new Runtime architecture;
- an Overture redesign;
- a new protocol version;
- Evidence v2;
- robotics;
- fleet features;
- speculative execution;
- a large console or dashboard;
- new language SDKs;
- a workflow builder;
- marketplace work;
- new Clock branches; and
- new infrastructure capability not tied to an external-user blocker or
  PRD-approved roadmap item.

Historical implementations and documentation may remain available as advanced,
internal, or archived material. Their existence does not make them current
product direction.

## Product-development freeze rules

1. This file is the canonical product truth for product-facing work.
2. If a requested task contradicts this PRD, implementation stops until the
   product owner explicitly approves the contradiction or updates this file.
3. Public vocabulary is Action, Run, Proof, and exceptional Reconciliation.
4. Ordinary user-facing docs do not lead with Overture, Runtime, WAL,
   checkpoints, bindings, receipts, protocol schemas, fleet, or robotics.
5. No new core execution capability is added merely to improve architectural
   completeness.
6. A proposed infrastructure change must name the external-user blocker it
   removes and the acceptance evidence it will produce.
7. Product claims require source and, where relevant, runtime evidence. Tests
   or documentation alone do not establish hosted readiness.
8. Releases fail closed when SDK availability, authentication, migrations,
   secrets, target policy, or rollback behavior is unverified.

## Change control

PRD amendments require a focused pull request that:

- states the user problem and evidence;
- identifies allowed and newly unfrozen work;
- describes security, durability, deployment, and migration effects;
- updates affected public vocabulary and onboarding;
- records explicit product-owner approval; and
- does not hide a capability expansion inside an implementation-only change.

Implementation pull requests must cite this PRD and explain how they serve the
hosted-alpha wedge or an approved roadmap item.
