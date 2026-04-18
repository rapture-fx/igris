# Documentation Implementation Audit

Generated: 2026-04-18T03:18:16.637Z

This report compares customer-facing docs route claims against routes registered in `igris-overture`, `igris-runtime`, and the web console codebase. It is evidence-based: a route claim is implemented only when the matching method/path is registered in code on the expected surface.

## Summary

- Route claims audited: 945
- Implemented on expected surface: 618
- Missing from code: 318
- Implemented on a different surface than documented: 2
- Path exists with a different method: 7

## Page Risk Summary

| Page | Route claims | Implemented | Missing | Wrong surface | Wrong method |
| --- | ---: | ---: | ---: | ---: | ---: |
| `web/apps/web-docs-hub/content/docs/webhooks.mdx` | 5 | 0 | 5 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id-steps.mdx` | 7 | 3 | 3 | 0 | 1 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id.mdx` | 7 | 3 | 3 | 0 | 1 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-cancel.mdx` | 7 | 3 | 3 | 0 | 1 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-proof-verify.mdx` | 7 | 3 | 3 | 0 | 1 |
| `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 3 | 0 | 2 | 0 | 1 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/delete-v1-account-api-key.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-plans.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-status.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-v1-account-api-key.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/post-v1-account-api-key.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/delete-v1-bt-definitions-id.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-definitions-id.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-definitions.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-templates.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/post-v1-bt-definitions.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-proof-readiness.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-submit.mdx` | 7 | 4 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-history-events.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts-export.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts-id.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/post-proof-receipts-verify.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-health.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-infer-multimodal-stats.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-models.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-providers-stats.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-chat-completions.mdx` | 7 | 4 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-infer-multimodal.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-infer.mdx` | 8 | 5 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-admin-models.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-btree-events.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-model-latest.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-participants.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-status.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-health.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-hitl-requests.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-hitl-status.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-lora-status.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-memory-key.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-memory-status.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-agent-id-state.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-profile.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-task-task-id-wal.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-violations.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-swarm-agents.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-swarm-status.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-admin-models-load.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-admin-models-swap.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-deploy.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-run.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-validate.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-chat-completions.mdx` | 7 | 4 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-federated-update.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-approve.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-reject.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-request.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-memory-search.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-memory-store.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-plan.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-reflect.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-execute.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-stream.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-submit.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-task-id-cancel.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-join.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-propose.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-vote.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-circuit-breaker-status.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-council-analytics.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-recent.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-analytics.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-config.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-status.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-stats.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-council.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-provider-weights.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-shadow.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-speculative-simulate.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-speculative.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-strategy.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/delete-api-v1-runtime-deregister.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-commands.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-download.mdx` | 7 | 4 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-list.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-config-push.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-heartbeat.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-register.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-update.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/delete-v1-vault-keys-provider.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-policy-history.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-policy.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys-provider-rotate.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys-provider-validate.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/put-v1-policy.mdx` | 6 | 3 | 3 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/audit.mdx` | 6 | 4 | 0 | 2 | 0 |
| `web/apps/web-docs-hub/content/docs/provider-health.mdx` | 4 | 2 | 0 | 0 | 2 |
| `web/apps/web-docs-hub/content/docs/api-reference/mcp-transport/post-v1-mcp-stream.mdx` | 4 | 3 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/mcp-transport/post-v1-mcp.mdx` | 4 | 3 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/articles/safe-agents-capability-gates.mdx` | 1 | 0 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx` | 16 | 15 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` | 12 | 11 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/robotics.mdx` | 1 | 0 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/tamper-evident-logs.mdx` | 3 | 2 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/troubleshooting.mdx` | 11 | 10 | 1 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/agents.mdx` | 2 | 2 | 0 | 0 | 0 |
| `web/apps/web-docs-hub/content/docs/api-reference/index.mdx` | 105 | 105 | 0 | 0 | 0 |
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

## Unsupported Or Mismatched Claims

| Status | Page | Line | Method | Path | Expected surface | Evidence |
| --- | --- | ---: | --- | --- | --- | --- |
| missing | `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 48 | GET | `/v1/agents` | local-runtime | none |
| wrong-method | `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 52 | GET | `/v1/agents/agent-abc` | local-runtime | PATCH /v1/agents/:id (cloud-api, igris-overture/api/routes_execution.go) |
| missing | `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` | 93 | POST | `/v1/agents/agent-abc/terminate` | local-runtime | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/delete-v1-account-api-key.mdx` | 27 | GET | `/api/subscription/status](/docs/api-reference/account-trial-and-billing/get-api-subscription-status` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/delete-v1-account-api-key.mdx` | 28 | GET | `/api/subscription/plans](/docs/api-reference/account-trial-and-billing/get-api-subscription-plans` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/delete-v1-account-api-key.mdx` | 29 | GET | `/v1/account/api-key](/docs/api-reference/account-trial-and-billing/get-v1-account-api-key` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-plans.mdx` | 26 | GET | `/api/subscription/status](/docs/api-reference/account-trial-and-billing/get-api-subscription-status` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-plans.mdx` | 27 | GET | `/v1/account/api-key](/docs/api-reference/account-trial-and-billing/get-v1-account-api-key` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-plans.mdx` | 28 | POST | `/v1/account/api-key](/docs/api-reference/account-trial-and-billing/post-v1-account-api-key` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-status.mdx` | 26 | GET | `/api/subscription/plans](/docs/api-reference/account-trial-and-billing/get-api-subscription-plans` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-status.mdx` | 27 | GET | `/v1/account/api-key](/docs/api-reference/account-trial-and-billing/get-v1-account-api-key` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-api-subscription-status.mdx` | 28 | POST | `/v1/account/api-key](/docs/api-reference/account-trial-and-billing/post-v1-account-api-key` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-v1-account-api-key.mdx` | 27 | GET | `/api/subscription/status](/docs/api-reference/account-trial-and-billing/get-api-subscription-status` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-v1-account-api-key.mdx` | 28 | GET | `/api/subscription/plans](/docs/api-reference/account-trial-and-billing/get-api-subscription-plans` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/get-v1-account-api-key.mdx` | 29 | POST | `/v1/account/api-key](/docs/api-reference/account-trial-and-billing/post-v1-account-api-key` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/post-v1-account-api-key.mdx` | 28 | GET | `/api/subscription/status](/docs/api-reference/account-trial-and-billing/get-api-subscription-status` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/post-v1-account-api-key.mdx` | 29 | GET | `/api/subscription/plans](/docs/api-reference/account-trial-and-billing/get-api-subscription-plans` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/post-v1-account-api-key.mdx` | 30 | GET | `/v1/account/api-key](/docs/api-reference/account-trial-and-billing/get-v1-account-api-key` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/delete-v1-bt-definitions-id.mdx` | 28 | GET | `/v1/bt/templates](/docs/api-reference/behavior-trees/get-v1-bt-templates` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/delete-v1-bt-definitions-id.mdx` | 29 | GET | `/v1/bt/definitions](/docs/api-reference/behavior-trees/get-v1-bt-definitions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/delete-v1-bt-definitions-id.mdx` | 30 | GET | `/v1/bt/definitions/:id](/docs/api-reference/behavior-trees/get-v1-bt-definitions-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-definitions-id.mdx` | 27 | GET | `/v1/bt/templates](/docs/api-reference/behavior-trees/get-v1-bt-templates` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-definitions-id.mdx` | 28 | GET | `/v1/bt/definitions](/docs/api-reference/behavior-trees/get-v1-bt-definitions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-definitions-id.mdx` | 29 | POST | `/v1/bt/definitions](/docs/api-reference/behavior-trees/post-v1-bt-definitions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-definitions.mdx` | 26 | GET | `/v1/bt/templates](/docs/api-reference/behavior-trees/get-v1-bt-templates` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-definitions.mdx` | 27 | GET | `/v1/bt/definitions/:id](/docs/api-reference/behavior-trees/get-v1-bt-definitions-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-definitions.mdx` | 28 | POST | `/v1/bt/definitions](/docs/api-reference/behavior-trees/post-v1-bt-definitions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-templates.mdx` | 22 | GET | `/v1/bt/definitions](/docs/api-reference/behavior-trees/get-v1-bt-definitions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-templates.mdx` | 23 | GET | `/v1/bt/definitions/:id](/docs/api-reference/behavior-trees/get-v1-bt-definitions-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/get-v1-bt-templates.mdx` | 24 | POST | `/v1/bt/definitions](/docs/api-reference/behavior-trees/post-v1-bt-definitions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/post-v1-bt-definitions.mdx` | 27 | GET | `/v1/bt/templates](/docs/api-reference/behavior-trees/get-v1-bt-templates` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/post-v1-bt-definitions.mdx` | 28 | GET | `/v1/bt/definitions](/docs/api-reference/behavior-trees/get-v1-bt-definitions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/post-v1-bt-definitions.mdx` | 29 | GET | `/v1/bt/definitions/:id](/docs/api-reference/behavior-trees/get-v1-bt-definitions-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id-steps.mdx` | 27 | POST | `/v1/tasks/submit](/docs/api-reference/durable-tasks/post-v1-tasks-submit` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id-steps.mdx` | 28 | GET | `/v1/tasks/:id](/docs/api-reference/durable-tasks/get-v1-tasks-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id-steps.mdx` | 29 | GET | `/v1/tasks](/docs/api-reference/durable-tasks/get-v1-tasks` | unspecified | none |
| wrong-method | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id-steps.mdx` | 41 | POST | `/v1/tasks/submit.` | unspecified | GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go) |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id.mdx` | 27 | POST | `/v1/tasks/submit](/docs/api-reference/durable-tasks/post-v1-tasks-submit` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id.mdx` | 28 | GET | `/v1/tasks](/docs/api-reference/durable-tasks/get-v1-tasks` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id.mdx` | 29 | GET | `/v1/tasks/:id/steps](/docs/api-reference/durable-tasks/get-v1-tasks-id-steps` | unspecified | none |
| wrong-method | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-id.mdx` | 41 | POST | `/v1/tasks/submit.` | unspecified | GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go) |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-proof-readiness.mdx` | 26 | POST | `/v1/tasks/submit](/docs/api-reference/durable-tasks/post-v1-tasks-submit` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-proof-readiness.mdx` | 27 | GET | `/v1/tasks/:id](/docs/api-reference/durable-tasks/get-v1-tasks-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks-proof-readiness.mdx` | 28 | GET | `/v1/tasks](/docs/api-reference/durable-tasks/get-v1-tasks` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks.mdx` | 27 | POST | `/v1/tasks/submit](/docs/api-reference/durable-tasks/post-v1-tasks-submit` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks.mdx` | 28 | GET | `/v1/tasks/:id](/docs/api-reference/durable-tasks/get-v1-tasks-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/get-v1-tasks.mdx` | 29 | GET | `/v1/tasks/:id/steps](/docs/api-reference/durable-tasks/get-v1-tasks-id-steps` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-cancel.mdx` | 28 | POST | `/v1/tasks/submit](/docs/api-reference/durable-tasks/post-v1-tasks-submit` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-cancel.mdx` | 29 | GET | `/v1/tasks/:id](/docs/api-reference/durable-tasks/get-v1-tasks-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-cancel.mdx` | 30 | GET | `/v1/tasks](/docs/api-reference/durable-tasks/get-v1-tasks` | unspecified | none |
| wrong-method | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-cancel.mdx` | 42 | POST | `/v1/tasks/submit.` | unspecified | GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go) |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-proof-verify.mdx` | 28 | POST | `/v1/tasks/submit](/docs/api-reference/durable-tasks/post-v1-tasks-submit` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-proof-verify.mdx` | 29 | GET | `/v1/tasks/:id](/docs/api-reference/durable-tasks/get-v1-tasks-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-proof-verify.mdx` | 30 | GET | `/v1/tasks](/docs/api-reference/durable-tasks/get-v1-tasks` | unspecified | none |
| wrong-method | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-id-proof-verify.mdx` | 42 | POST | `/v1/tasks/submit.` | unspecified | GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go)<br />GET /v1/tasks/:id (cloud-api, igris-overture/api/routes_tasks_test.go) |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-submit.mdx` | 28 | GET | `/v1/tasks/:id](/docs/api-reference/durable-tasks/get-v1-tasks-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-submit.mdx` | 29 | GET | `/v1/tasks](/docs/api-reference/durable-tasks/get-v1-tasks` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/post-v1-tasks-submit.mdx` | 30 | GET | `/v1/tasks/:id/steps](/docs/api-reference/durable-tasks/get-v1-tasks-id-steps` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-history-events.mdx` | 27 | GET | `/v1/receipts](/docs/api-reference/execution-history-and-receipts/get-v1-receipts` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-history-events.mdx` | 28 | GET | `/v1/receipts/:id](/docs/api-reference/execution-history-and-receipts/get-v1-receipts-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-history-events.mdx` | 29 | GET | `/v1/receipts/export](/docs/api-reference/execution-history-and-receipts/get-v1-receipts-export` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts-export.mdx` | 28 | GET | `/v1/history/events](/docs/api-reference/execution-history-and-receipts/get-v1-history-events` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts-export.mdx` | 29 | GET | `/v1/receipts](/docs/api-reference/execution-history-and-receipts/get-v1-receipts` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts-export.mdx` | 30 | GET | `/v1/receipts/:id](/docs/api-reference/execution-history-and-receipts/get-v1-receipts-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts-id.mdx` | 27 | GET | `/v1/history/events](/docs/api-reference/execution-history-and-receipts/get-v1-history-events` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts-id.mdx` | 28 | GET | `/v1/receipts](/docs/api-reference/execution-history-and-receipts/get-v1-receipts` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts-id.mdx` | 29 | GET | `/v1/receipts/export](/docs/api-reference/execution-history-and-receipts/get-v1-receipts-export` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts.mdx` | 27 | GET | `/v1/history/events](/docs/api-reference/execution-history-and-receipts/get-v1-history-events` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts.mdx` | 28 | GET | `/v1/receipts/:id](/docs/api-reference/execution-history-and-receipts/get-v1-receipts-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/get-v1-receipts.mdx` | 29 | GET | `/v1/receipts/export](/docs/api-reference/execution-history-and-receipts/get-v1-receipts-export` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/post-proof-receipts-verify.mdx` | 27 | GET | `/v1/history/events](/docs/api-reference/execution-history-and-receipts/get-v1-history-events` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/post-proof-receipts-verify.mdx` | 28 | GET | `/v1/receipts](/docs/api-reference/execution-history-and-receipts/get-v1-receipts` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/post-proof-receipts-verify.mdx` | 29 | GET | `/v1/receipts/:id](/docs/api-reference/execution-history-and-receipts/get-v1-receipts-id` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-health.mdx` | 22 | POST | `/v1/infer](/docs/api-reference/inference-integration/post-v1-infer` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-health.mdx` | 23 | POST | `/v1/chat/completions](/docs/api-reference/inference-integration/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-health.mdx` | 24 | GET | `/v1/models](/docs/api-reference/inference-integration/get-v1-models` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-infer-multimodal-stats.mdx` | 22 | POST | `/v1/infer](/docs/api-reference/inference-integration/post-v1-infer` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-infer-multimodal-stats.mdx` | 23 | POST | `/v1/chat/completions](/docs/api-reference/inference-integration/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-infer-multimodal-stats.mdx` | 24 | GET | `/v1/health](/docs/api-reference/inference-integration/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-models.mdx` | 27 | POST | `/v1/infer](/docs/api-reference/inference-integration/post-v1-infer` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-models.mdx` | 28 | POST | `/v1/chat/completions](/docs/api-reference/inference-integration/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-models.mdx` | 29 | GET | `/v1/health](/docs/api-reference/inference-integration/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-providers-stats.mdx` | 22 | POST | `/v1/infer](/docs/api-reference/inference-integration/post-v1-infer` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-providers-stats.mdx` | 23 | POST | `/v1/chat/completions](/docs/api-reference/inference-integration/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/get-v1-providers-stats.mdx` | 24 | GET | `/v1/health](/docs/api-reference/inference-integration/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-chat-completions.mdx` | 28 | POST | `/v1/infer](/docs/api-reference/inference-integration/post-v1-infer` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-chat-completions.mdx` | 29 | GET | `/v1/health](/docs/api-reference/inference-integration/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-chat-completions.mdx` | 30 | GET | `/v1/models](/docs/api-reference/inference-integration/get-v1-models` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-infer-multimodal.mdx` | 26 | POST | `/v1/infer](/docs/api-reference/inference-integration/post-v1-infer` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-infer-multimodal.mdx` | 27 | POST | `/v1/chat/completions](/docs/api-reference/inference-integration/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-infer-multimodal.mdx` | 28 | GET | `/v1/health](/docs/api-reference/inference-integration/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-infer.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/inference-integration/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-infer.mdx` | 30 | GET | `/v1/health](/docs/api-reference/inference-integration/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/post-v1-infer.mdx` | 31 | GET | `/v1/models](/docs/api-reference/inference-integration/get-v1-models` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-admin-models.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-admin-models.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-admin-models.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-btree-events.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-btree-events.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-btree-events.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-model-latest.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-model-latest.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-model-latest.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-participants.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-participants.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-participants.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-status.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-status.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-federated-status.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-health.mdx` | 27 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-health.mdx` | 28 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-health.mdx` | 29 | POST | `/v1/plan](/docs/api-reference/local-runtime-api/post-v1-plan` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-hitl-requests.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-hitl-requests.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-hitl-requests.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-hitl-status.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-hitl-status.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-hitl-status.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-lora-status.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-lora-status.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-lora-status.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-memory-key.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-memory-key.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-memory-key.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-memory-status.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-memory-status.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-memory-status.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-agent-id-state.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-agent-id-state.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-agent-id-state.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-profile.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-profile.mdx` | 28 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-profile.mdx` | 29 | POST | `/v1/plan](/docs/api-reference/local-runtime-api/post-v1-plan` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-task-task-id-wal.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-task-task-id-wal.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-task-task-id-wal.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-violations.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-violations.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-runtime-violations.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-swarm-agents.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-swarm-agents.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-swarm-agents.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-swarm-status.mdx` | 27 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-swarm-status.mdx` | 28 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/get-v1-swarm-status.mdx` | 29 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-admin-models-load.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-admin-models-load.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-admin-models-load.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-admin-models-swap.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-admin-models-swap.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-admin-models-swap.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-deploy.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-deploy.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-deploy.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-run.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-run.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-run.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-validate.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-validate.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-btree-validate.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-chat-completions.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-chat-completions.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-chat-completions.mdx` | 30 | POST | `/v1/plan](/docs/api-reference/local-runtime-api/post-v1-plan` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-federated-update.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-federated-update.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-federated-update.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-approve.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-approve.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-approve.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-reject.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-reject.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-reject.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-request.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-request.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-hitl-request.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-memory-search.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-memory-search.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-memory-search.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-memory-store.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-memory-store.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-memory-store.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-plan.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-plan.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-plan.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-reflect.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-reflect.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-reflect.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-execute.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-execute.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-execute.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-stream.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-stream.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-stream.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-submit.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-submit.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-submit.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-task-id-cancel.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-task-id-cancel.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-runtime-task-task-id-cancel.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-join.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-join.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-join.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-propose.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-propose.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-propose.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-vote.mdx` | 28 | GET | `/v1/health](/docs/api-reference/local-runtime-api/get-v1-health` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-vote.mdx` | 29 | GET | `/v1/runtime/profile](/docs/api-reference/local-runtime-api/get-v1-runtime-profile` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/post-v1-swarm-vote.mdx` | 30 | POST | `/v1/chat/completions](/docs/api-reference/local-runtime-api/post-v1-chat-completions` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/mcp-transport/post-v1-mcp-stream.mdx` | 27 | POST | `/v1/mcp](/docs/api-reference/mcp-transport/post-v1-mcp` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/mcp-transport/post-v1-mcp.mdx` | 27 | POST | `/v1/mcp/stream](/docs/api-reference/mcp-transport/post-v1-mcp-stream` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-circuit-breaker-status.mdx` | 26 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-circuit-breaker-status.mdx` | 27 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-circuit-breaker-status.mdx` | 28 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-council-analytics.mdx` | 26 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-council-analytics.mdx` | 27 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-council-analytics.mdx` | 28 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard.mdx` | 26 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard.mdx` | 27 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard.mdx` | 28 | POST | `/v1/routing/strategy](/docs/api-reference/routing-control-analytics/post-v1-routing-strategy` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-recent.mdx` | 26 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-recent.mdx` | 27 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-recent.mdx` | 28 | POST | `/v1/routing/strategy](/docs/api-reference/routing-control-analytics/post-v1-routing-strategy` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-analytics.mdx` | 26 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-analytics.mdx` | 27 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-analytics.mdx` | 28 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-config.mdx` | 26 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-config.mdx` | 27 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-config.mdx` | 28 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-status.mdx` | 26 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-status.mdx` | 27 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-speculative-status.mdx` | 28 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-stats.mdx` | 26 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-stats.mdx` | 27 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/get-v1-routing-stats.mdx` | 28 | POST | `/v1/routing/strategy](/docs/api-reference/routing-control-analytics/post-v1-routing-strategy` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-council.mdx` | 27 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-council.mdx` | 28 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-council.mdx` | 29 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-provider-weights.mdx` | 27 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-provider-weights.mdx` | 28 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-provider-weights.mdx` | 29 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-shadow.mdx` | 27 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-shadow.mdx` | 28 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-shadow.mdx` | 29 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-speculative-simulate.mdx` | 27 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-speculative-simulate.mdx` | 28 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-speculative-simulate.mdx` | 29 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-speculative.mdx` | 27 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-speculative.mdx` | 28 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-speculative.mdx` | 29 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-strategy.mdx` | 27 | GET | `/v1/routing/stats](/docs/api-reference/routing-control-analytics/get-v1-routing-stats` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-strategy.mdx` | 28 | GET | `/v1/routing/recent](/docs/api-reference/routing-control-analytics/get-v1-routing-recent` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/post-v1-routing-strategy.mdx` | 29 | GET | `/v1/routing/leaderboard](/docs/api-reference/routing-control-analytics/get-v1-routing-leaderboard` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/delete-api-v1-runtime-deregister.mdx` | 28 | GET | `/v1/runtime/install](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/delete-api-v1-runtime-deregister.mdx` | 29 | GET | `/v1/runtime/checksum](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/delete-api-v1-runtime-deregister.mdx` | 30 | GET | `/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-commands.mdx` | 27 | GET | `/v1/runtime/install](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-commands.mdx` | 28 | GET | `/v1/runtime/checksum](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-commands.mdx` | 29 | GET | `/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-download.mdx` | 27 | GET | `/v1/runtime/install](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-download.mdx` | 28 | GET | `/v1/runtime/checksum](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-download.mdx` | 29 | GET | `/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-list.mdx` | 28 | GET | `/v1/runtime/install](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-list.mdx` | 29 | GET | `/v1/runtime/checksum](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-list.mdx` | 30 | GET | `/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum.mdx` | 26 | GET | `/v1/runtime/install](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum.mdx` | 27 | GET | `/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum.mdx` | 28 | GET | `/api/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download.mdx` | 26 | GET | `/v1/runtime/install](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download.mdx` | 27 | GET | `/v1/runtime/checksum](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download.mdx` | 28 | GET | `/api/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install.mdx` | 26 | GET | `/v1/runtime/checksum](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install.mdx` | 27 | GET | `/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install.mdx` | 28 | GET | `/api/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-api-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-config-push.mdx` | 28 | GET | `/v1/runtime/install](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-config-push.mdx` | 29 | GET | `/v1/runtime/checksum](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-config-push.mdx` | 30 | GET | `/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-heartbeat.mdx` | 28 | GET | `/v1/runtime/install](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-heartbeat.mdx` | 29 | GET | `/v1/runtime/checksum](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-heartbeat.mdx` | 30 | GET | `/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-register.mdx` | 28 | GET | `/v1/runtime/install](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-register.mdx` | 29 | GET | `/v1/runtime/checksum](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-register.mdx` | 30 | GET | `/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-update.mdx` | 28 | GET | `/v1/runtime/install](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-install` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-update.mdx` | 29 | GET | `/v1/runtime/checksum](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-checksum` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-update.mdx` | 30 | GET | `/v1/runtime/download](/docs/api-reference/runtime-distribution-fleet-coordination/get-v1-runtime-download` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/delete-v1-vault-keys-provider.mdx` | 28 | GET | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/delete-v1-vault-keys-provider.mdx` | 29 | POST | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/delete-v1-vault-keys-provider.mdx` | 30 | GET | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-policy-history.mdx` | 26 | GET | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-policy-history.mdx` | 27 | POST | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-policy-history.mdx` | 28 | GET | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-policy.mdx` | 26 | GET | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-policy.mdx` | 27 | POST | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-policy.mdx` | 28 | GET | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider.mdx` | 27 | GET | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider.mdx` | 28 | POST | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider.mdx` | 29 | DELETE | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/delete-v1-vault-keys-provider` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys.mdx` | 27 | POST | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys.mdx` | 28 | GET | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys.mdx` | 29 | DELETE | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/delete-v1-vault-keys-provider` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys-provider-rotate.mdx` | 28 | GET | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys-provider-rotate.mdx` | 29 | POST | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys-provider-rotate.mdx` | 30 | GET | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys-provider-validate.mdx` | 28 | GET | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys-provider-validate.mdx` | 29 | POST | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys-provider-validate.mdx` | 30 | GET | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys.mdx` | 28 | GET | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys.mdx` | 29 | GET | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys.mdx` | 30 | DELETE | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/delete-v1-vault-keys-provider` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/put-v1-policy.mdx` | 27 | GET | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/put-v1-policy.mdx` | 28 | POST | `/v1/vault/keys](/docs/api-reference/vault-policy-and-governance/post-v1-vault-keys` | unspecified | none |
| missing | `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/put-v1-policy.mdx` | 29 | GET | `/v1/vault/keys/:provider](/docs/api-reference/vault-policy-and-governance/get-v1-vault-keys-provider` | unspecified | none |
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
