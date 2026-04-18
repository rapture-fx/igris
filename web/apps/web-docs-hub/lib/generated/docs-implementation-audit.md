# Documentation Implementation Audit

Generated: 2026-04-18T03:19:37.373Z

This report compares customer-facing docs route claims against routes registered in `igris-overture`, `igris-runtime`, and the web console codebase. It is evidence-based: a route claim is implemented only when the matching method/path is registered in code on the expected surface.

The API reference has a separate endpoint verification report in `api-verification.md`. The guide-page section below is the highest-signal view for finding made-up or stale customer-facing workflow documentation.

## Summary

- Route claims audited: 945
- Implemented on expected surface: 927
- Missing from code: 13
- Implemented on a different surface than documented: 2
- Path exists with a different method: 3

## Guide Page Summary

- Guide route claims audited: 216
- Implemented on expected surface: 198
- Missing from code: 13
- Implemented on a different surface than documented: 2
- Path exists with a different method: 3

| Page | Route claims | Implemented | Missing | Wrong surface | Wrong method |
| --- | ---: | ---: | ---: | ---: | ---: |
| `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 5 | 0 | 5 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 3 | 0 | 2 | 0 | 1 |
| `web/apps/web-docs-hub/content/docs/audit.mdx` | 6 | 4 | 0 | 2 | 0 |
| `web/apps/web-docs-hub/content/docs/provider-health.mdx` | 4 | 2 | 0 | 0 | 2 |
| `web/apps/web-docs-hub/content/docs/articles/safe-agents-capability-gates.mdx` | 1 | 0 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx` | 16 | 15 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` | 12 | 11 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/robotics.mdx` | 1 | 0 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/tamper-evident-logs.mdx` | 3 | 2 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/troubleshooting.mdx` | 11 | 10 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/agents.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/approval-workflows.mdx` | 3 | 3 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/architecture.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/articles/edge-deployment-guide.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/articles/thompson-sampling-routing.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/behavior-trees.mdx` | 10 | 10 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/circuit-breaker.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/cognitive-advisor.mdx` | 9 | 9 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/deploy-local-runtime.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/deployment.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/execution-receipts.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/first-cloud-integration.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/fleet-management.mdx` | 8 | 8 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/governance.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/history.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/key-management.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/mcp-server.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/mcp.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/memory.mdx` | 8 | 8 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/model-aggregation.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/multimodal.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/policy.mdx` | 11 | 11 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/quickstart.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/rate-limiting.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/receipts-audit-workflow.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/ros2-integration.mdx` | 12 | 12 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/security.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/shadow-mode.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/slo-enforcer.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/speculative-execution.mdx` | 8 | 8 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/swarm.mdx` | 9 | 9 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/trial-billing.mdx` | 14 | 14 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/upgrade-migration.mdx` | 1 | 1 | 0 | 0 | 0 |

## Unsupported Or Mismatched Guide Claims

| Status | Page | Line | Method | Path | Expected surface | Evidence |
| --- | --- | ---: | --- | --- | --- | --- |
| missing | `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 48 | GET | `/v1/agents` | local-runtime | none |
| wrong-method | `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 52 | GET | `/v1/agents/agent-abc` | local-runtime | PATCH /v1/agents/:id (cloud-api, igris-overture/api/routes_execution.go) |
| missing | `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 93 | POST | `/v1/agents/agent-abc/terminate` | local-runtime | none |
| missing | `web/apps/web-docs-hub/content/docs/articles/safe-agents-capability-gates.mdx` | 178 | POST | `/v1/webhooks` | cloud-api | none |
| wrong-surface | `web/apps/web-docs-hub/content/docs/audit.mdx` | 59 | GET | `/v1/receipts` | local-runtime | GET /v1/receipts (cloud-api, igris-overture/api/routes_receipts.go) |
| wrong-surface | `web/apps/web-docs-hub/content/docs/audit.mdx` | 63 | GET | `/v1/receipts/exec-01HXYZ` | local-runtime | GET /v1/receipts/:id (cloud-api, igris-overture/api/routes_receipts.go) |
| missing | `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx` | 52 | * | `/api/v1/runtime/*` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` | 205 | GET | `/v1/tasks?limit=20` | unspecified | none |
| wrong-method | `web/apps/web-docs-hub/content/docs/provider-health.mdx` | 125 | GET | `/v1/providers/health` | unspecified | DELETE /v1/providers/:id (cloud-api, igris-overture/api/routes_provider_registry.go)<br />PUT /v1/providers/:id (cloud-api, igris-overture/api/routes_provider_registry.go) |
| wrong-method | `web/apps/web-docs-hub/content/docs/provider-health.mdx` | 130 | GET | `/v1/providers/health` | cloud-api | DELETE /v1/providers/:id (cloud-api, igris-overture/api/routes_provider_registry.go)<br />PUT /v1/providers/:id (cloud-api, igris-overture/api/routes_provider_registry.go) |
| missing | `web/apps/web-docs-hub/content/docs/robotics.mdx` | 83 | * | `/v1/emergency-stop` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/tamper-evident-logs.mdx` | 29 | GET | `/v1/receipts/receipt-01HXYZ/verify` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/troubleshooting.mdx` | 341 | POST | `/v1/proof/receipts/verify` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 69 | POST | `/v1/webhooks` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 207 | GET | `/v1/webhooks` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 214 | PUT | `/v1/webhooks/wh_abc123` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 225 | DELETE | `/v1/webhooks/wh_abc123` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 232 | POST | `/v1/webhooks/wh_abc123/test` | cloud-api | none |

## All Page Risk Summary

| Page | Route claims | Implemented | Missing | Wrong surface | Wrong method |
| --- | ---: | ---: | ---: | ---: | ---: |
| `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 5 | 0 | 5 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 3 | 0 | 2 | 0 | 1 |
| `web/apps/web-docs-hub/content/docs/audit.mdx` | 6 | 4 | 0 | 2 | 0 |
| `web/apps/web-docs-hub/content/docs/provider-health.mdx` | 4 | 2 | 0 | 0 | 2 |
| `web/apps/web-docs-hub/content/docs/articles/safe-agents-capability-gates.mdx` | 1 | 0 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx` | 16 | 15 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` | 12 | 11 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/robotics.mdx` | 1 | 0 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/tamper-evident-logs.mdx` | 3 | 2 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/troubleshooting.mdx` | 11 | 10 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/agents.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/delete-v1-account-api-key.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-plans.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-status.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-v1-account-api-key.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/post-v1-account-api-key.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/delete-v1-bt-definitions-id.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-definitions-id.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-definitions.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-templates.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/post-v1-bt-definitions.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id-steps.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-proof-readiness.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-cancel.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-proof-verify.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-submit.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-history-events.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts-export.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts-id.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/post-proof-receipts-verify.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/index.mdx` | 105 | 105 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-health.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-infer-multimodal-stats.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-models.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-providers-stats.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-chat-completions.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-infer-multimodal.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-infer.mdx` | 8 | 8 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-admin-models.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-btree-events.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-model-latest.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-participants.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-status.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-health.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-hitl-requests.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-hitl-status.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-lora-status.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-memory-key.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-memory-status.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-agent-id-state.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-profile.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-task-task-id-wal.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-violations.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-swarm-agents.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-swarm-status.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-admin-models-load.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-admin-models-swap.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-deploy.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-run.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-validate.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-chat-completions.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-federated-update.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-approve.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-reject.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-request.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-memory-search.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-memory-store.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-plan.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-reflect.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-execute.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-stream.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-submit.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-task-id-cancel.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-join.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-propose.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-vote.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/mcp-transport/post-v1-mcp-stream.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/mcp-transport/post-v1-mcp.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-circuit-breaker-status.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-council-analytics.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-recent.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-analytics.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-config.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-status.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-stats.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-council.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-provider-weights.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-shadow.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-speculative-simulate.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-speculative.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-strategy.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/delete-api-v1-runtime-deregister.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-commands.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-download.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-list.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-config-push.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-heartbeat.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-register.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-update.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/delete-v1-vault-keys-provider.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-policy-history.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-policy.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys-provider-rotate.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys-provider-validate.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/put-v1-policy.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/approval-workflows.mdx` | 3 | 3 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/architecture.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/articles/edge-deployment-guide.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/articles/thompson-sampling-routing.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/behavior-trees.mdx` | 10 | 10 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/circuit-breaker.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/cognitive-advisor.mdx` | 9 | 9 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/deploy-local-runtime.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/deployment.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/execution-receipts.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/first-cloud-integration.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/fleet-management.mdx` | 8 | 8 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/governance.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/history.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/key-management.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/mcp-server.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/mcp.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/memory.mdx` | 8 | 8 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/model-aggregation.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/multimodal.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/policy.mdx` | 11 | 11 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/quickstart.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/rate-limiting.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/receipts-audit-workflow.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/ros2-integration.mdx` | 12 | 12 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/security.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/shadow-mode.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/slo-enforcer.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/speculative-execution.mdx` | 8 | 8 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/swarm.mdx` | 9 | 9 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/trial-billing.mdx` | 14 | 14 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/upgrade-migration.mdx` | 1 | 1 | 0 | 0 | 0 |

## All Unsupported Or Mismatched Claims

| Status | Page | Line | Method | Path | Expected surface | Evidence |
| --- | --- | ---: | --- | --- | --- | --- |
| missing | `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 48 | GET | `/v1/agents` | local-runtime | none |
| wrong-method | `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 52 | GET | `/v1/agents/agent-abc` | local-runtime | PATCH /v1/agents/:id (cloud-api, igris-overture/api/routes_execution.go) |
| missing | `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 93 | POST | `/v1/agents/agent-abc/terminate` | local-runtime | none |
| missing | `web/apps/web-docs-hub/content/docs/articles/safe-agents-capability-gates.mdx` | 178 | POST | `/v1/webhooks` | cloud-api | none |
| wrong-surface | `web/apps/web-docs-hub/content/docs/audit.mdx` | 59 | GET | `/v1/receipts` | local-runtime | GET /v1/receipts (cloud-api, igris-overture/api/routes_receipts.go) |
| wrong-surface | `web/apps/web-docs-hub/content/docs/audit.mdx` | 63 | GET | `/v1/receipts/exec-01HXYZ` | local-runtime | GET /v1/receipts/:id (cloud-api, igris-overture/api/routes_receipts.go) |
| missing | `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx` | 52 | * | `/api/v1/runtime/*` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` | 205 | GET | `/v1/tasks?limit=20` | unspecified | none |
| wrong-method | `web/apps/web-docs-hub/content/docs/provider-health.mdx` | 125 | GET | `/v1/providers/health` | unspecified | DELETE /v1/providers/:id (cloud-api, igris-overture/api/routes_provider_registry.go)<br />PUT /v1/providers/:id (cloud-api, igris-overture/api/routes_provider_registry.go) |
| wrong-method | `web/apps/web-docs-hub/content/docs/provider-health.mdx` | 130 | GET | `/v1/providers/health` | cloud-api | DELETE /v1/providers/:id (cloud-api, igris-overture/api/routes_provider_registry.go)<br />PUT /v1/providers/:id (cloud-api, igris-overture/api/routes_provider_registry.go) |
| missing | `web/apps/web-docs-hub/content/docs/robotics.mdx` | 83 | * | `/v1/emergency-stop` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/tamper-evident-logs.mdx` | 29 | GET | `/v1/receipts/receipt-01HXYZ/verify` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/troubleshooting.mdx` | 341 | POST | `/v1/proof/receipts/verify` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 69 | POST | `/v1/webhooks` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 207 | GET | `/v1/webhooks` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 214 | PUT | `/v1/webhooks/wh_abc123` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 225 | DELETE | `/v1/webhooks/wh_abc123` | cloud-api | none |
| missing | `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 232 | POST | `/v1/webhooks/wh_abc123/test` | cloud-api | none |
