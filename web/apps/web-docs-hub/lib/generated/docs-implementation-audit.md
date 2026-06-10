# Documentation Implementation Audit

Generated: 2026-06-10T16:23:18.104Z

This report compares customer-facing docs route claims against routes registered in `igris-overture`, `igris-runtime`, and the web console codebase. It is evidence-based: a route claim is implemented only when the matching method/path is registered in code on the expected surface.

The API reference has a separate endpoint verification report in `api-verification.md`. The guide-page section below is the highest-signal view for finding made-up or stale customer-facing workflow documentation.

## Summary

- Route claims audited: 890
- Implemented on expected surface: 890
- Missing from code: 0
- Implemented on a different surface than documented: 0
- Path exists with a different method: 0

## Guide Page Summary

- Guide route claims audited: 123
- Implemented on expected surface: 123
- Missing from code: 0
- Implemented on a different surface than documented: 0
- Path exists with a different method: 0

| Page | Route claims | Implemented | Missing | Wrong surface | Wrong method |
| --- | ---: | ---: | ---: | ---: | ---: |
| `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/agents.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/approval-workflows.mdx` | 3 | 3 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/architecture.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/articles/edge-deployment-guide.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/behavior-trees.mdx` | 10 | 10 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx` | 11 | 11 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/deploy-local-runtime.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/execution-receipts.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/first-cloud-integration.mdx` | 3 | 3 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/first-verified-run.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/fleet-management.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/history.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/key-management.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/mcp-server.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/mcp.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/memory.mdx` | 8 | 8 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/quickstart.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/rate-limiting.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/receipts-audit-workflow.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/request-execute-verify.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/sdk.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/security.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/tamper-evident-logs.mdx` | 3 | 3 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/trial-billing.mdx` | 11 | 11 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/troubleshooting.mdx` | 11 | 11 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/upgrade-migration.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/verification.mdx` | 2 | 2 | 0 | 0 | 0 |

## Unsupported Or Mismatched Guide Claims

No unsupported guide-page route claims were found.

## All Page Risk Summary

| Page | Route claims | Implemented | Missing | Wrong surface | Wrong method |
| --- | ---: | ---: | ---: | ---: | ---: |
| `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/agents.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/delete-v1-account-api-key.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-plans.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-status.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-v1-account-api-key.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/post-v1-account-api-key.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/actions/delete-v1-actions-id.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/actions/get-v1-actions-id.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/actions/get-v1-actions-runs-id.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/actions/get-v1-actions.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/actions/patch-v1-actions-id.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/actions/post-v1-actions-name-run.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/actions/post-v1-actions-run.mdx` | 8 | 8 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/actions/post-v1-actions.mdx` | 6 | 6 | 0 | 0 | 0 |
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
| `web/apps/web-docs-hub/content/docs/api-reference/index.mdx` | 106 | 106 | 0 | 0 | 0 |
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
| `web/apps/web-docs-hub/content/docs/api-reference/mcp-transport/post-v1-mcp.mdx` | 3 | 3 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/platform-health/get-v1-health.mdx` | 3 | 3 | 0 | 0 | 0 |
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
| `web/apps/web-docs-hub/content/docs/architecture.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/articles/edge-deployment-guide.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/behavior-trees.mdx` | 10 | 10 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx` | 11 | 11 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/deploy-local-runtime.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/execution-receipts.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/first-cloud-integration.mdx` | 3 | 3 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/first-verified-run.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/fleet-management.mdx` | 7 | 7 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/history.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/key-management.mdx` | 6 | 6 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/mcp-server.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/mcp.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/memory.mdx` | 8 | 8 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/quickstart.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/rate-limiting.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/receipts-audit-workflow.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/request-execute-verify.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/sdk.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/security.mdx` | 4 | 4 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/tamper-evident-logs.mdx` | 3 | 3 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/trial-billing.mdx` | 11 | 11 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/troubleshooting.mdx` | 11 | 11 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/upgrade-migration.mdx` | 1 | 1 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/verification.mdx` | 2 | 2 | 0 | 0 | 0 |

## All Unsupported Or Mismatched Claims

No unsupported route claims were found.
