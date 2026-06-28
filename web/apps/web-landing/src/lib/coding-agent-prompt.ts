export const CODING_AGENT_PROMPT = `You are helping me connect this project to Igris.

Goal:
Configure this repository so an AI agent can request one safe, registered action through Igris instead of calling tools or services directly.

Steps:

1. Inspect the project structure and identify where external actions, jobs, webhooks, or operational workflows are triggered.
2. Read the Igris docs and use the currently supported integration path. Do not invent SDK methods or unsupported APIs.
3. Register one safe example action, such as creating an internal task, sending a non-sensitive test notification, or running a harmless workflow.
4. Route the action through Igris so the request can be checked, executed, tracked, and recorded.
5. Add required environment variables using \`.env.example\` only. Do not commit real secrets.
6. Add a small smoke test or local verification command that proves the action can be requested through Igris.
7. Keep the change minimal and reversible. Do not refactor unrelated code.
8. Report the files changed, setup steps, required environment variables, and any follow-up work.

Safety rules:

* Do not expose secrets.
* Do not use production credentials.
* Do not modify billing, customer data, or destructive workflows.
* Do not bypass Igris policy, approval, or run-record behavior.
* If the required Igris feature is not available yet, stop and explain what is missing instead of faking it.`