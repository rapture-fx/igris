export const CODING_AGENT_PROMPT = `You are helping me connect this project to Igris.

Goal:
Configure this repository so a coding agent can request one consequential Action through Igris instead of calling deployment or publication tools directly.

Steps:

1. Inspect the project structure and identify where external actions, jobs, webhooks, or operational workflows are triggered.
2. Read the Igris docs and use the currently supported integration path. Do not invent SDK methods or unsupported APIs.
3. Start with deploy.staging. Configure the Action once; do not invent a new product capability or use production credentials.
4. Route the Action through Igris using the managed REST API or thin Python SDK, with a stable business idempotency key.
5. Add required environment variables using \`.env.example\` only. Do not commit real secrets.
6. Add a small smoke test or local verification command that proves the Action can create a Run and retrieve honest Proof.
7. Keep the change minimal and reversible. Do not refactor unrelated code.
8. Report the files changed, setup steps, required environment variables, and any follow-up work.

Safety rules:

* Do not expose secrets.
* Do not use production credentials.
* Do not modify billing, customer data, or destructive workflows.
* Do not bypass Igris policy, approval, or run-record behavior.
* Do not blindly replay an uncertain external effect; require Reconciliation.
* Do not claim exactly-once execution or cryptographic proof of external-world effects.
* If the required Igris feature is not available yet, stop and explain what is missing instead of faking it.`
