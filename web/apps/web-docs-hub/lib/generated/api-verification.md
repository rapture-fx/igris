# API Verification Report

Generated: 2026-04-17T16:25:32.944Z

This report is evidence-based. It does not claim endpoint health beyond what is present in route registration, tests, and client references in this repository.

## Summary

- Total documented endpoints: 103
- Test-covered: 12
- Client-referenced: 12
- Implemented but unverified: 79

## Endpoints

| Status | Method | Path | Section | Evidence |
| --- | --- | --- | --- | --- |
| test-covered | POST | `/v1/infer` | Inference & Integration | tests: 5, clients: 2 |
| test-covered | POST | `/v1/chat/completions` | Inference & Integration | tests: 3, clients: 4 |
| test-covered | GET | `/v1/health` | Inference & Integration | tests: 5, clients: 5 |
| client-referenced | GET | `/v1/models` | Inference & Integration | clients: 2 |
| client-referenced | GET | `/v1/providers/stats` | Inference & Integration | clients: 2 |
| test-covered | POST | `/v1/infer/multimodal` | Inference & Integration | tests: 1 |
| test-covered | GET | `/v1/infer/multimodal/stats` | Inference & Integration | tests: 1 |
| implemented-unverified | GET | `/v1/runtime/install` | Runtime Distribution & Fleet Coordination | none |
| implemented-unverified | GET | `/v1/runtime/checksum` | Runtime Distribution & Fleet Coordination | none |
| implemented-unverified | GET | `/v1/runtime/download` | Runtime Distribution & Fleet Coordination | none |
| implemented-unverified | GET | `/api/v1/runtime/download` | Runtime Distribution & Fleet Coordination | none |
| test-covered | POST | `/api/v1/runtime/register` | Runtime Distribution & Fleet Coordination | tests: 1, clients: 1 |
| test-covered | POST | `/api/v1/runtime/heartbeat` | Runtime Distribution & Fleet Coordination | tests: 1, clients: 1 |
| implemented-unverified | GET | `/api/v1/runtime/commands` | Runtime Distribution & Fleet Coordination | none |
| client-referenced | DELETE | `/api/v1/runtime/deregister` | Runtime Distribution & Fleet Coordination | clients: 1 |
| implemented-unverified | GET | `/api/v1/runtime/list` | Runtime Distribution & Fleet Coordination | none |
| implemented-unverified | POST | `/api/v1/runtime/config/push` | Runtime Distribution & Fleet Coordination | none |
| implemented-unverified | POST | `/api/v1/runtime/update` | Runtime Distribution & Fleet Coordination | none |
| implemented-unverified | GET | `/api/subscription/status` | Account, Trial, and Billing | none |
| implemented-unverified | GET | `/api/subscription/plans` | Account, Trial, and Billing | none |
| implemented-unverified | GET | `/v1/account/api-key` | Account, Trial, and Billing | none |
| implemented-unverified | POST | `/v1/account/api-key` | Account, Trial, and Billing | none |
| implemented-unverified | DELETE | `/v1/account/api-key` | Account, Trial, and Billing | none |
| client-referenced | GET | `/v1/vault/keys` | Vault, Policy, and Governance | clients: 2 |
| client-referenced | POST | `/v1/vault/keys` | Vault, Policy, and Governance | clients: 2 |
| client-referenced | GET | `/v1/vault/keys/:provider` | Vault, Policy, and Governance | clients: 2 |
| client-referenced | DELETE | `/v1/vault/keys/:provider` | Vault, Policy, and Governance | clients: 3 |
| client-referenced | POST | `/v1/vault/keys/:provider/rotate` | Vault, Policy, and Governance | clients: 2 |
| implemented-unverified | POST | `/v1/vault/keys/:provider/validate` | Vault, Policy, and Governance | none |
| implemented-unverified | GET | `/v1/policy` | Vault, Policy, and Governance | none |
| implemented-unverified | PUT | `/v1/policy` | Vault, Policy, and Governance | none |
| implemented-unverified | GET | `/v1/policy/history` | Vault, Policy, and Governance | none |
| implemented-unverified | GET | `/v1/history/events` | Execution, History, and Receipts | none |
| implemented-unverified | GET | `/v1/receipts` | Execution, History, and Receipts | none |
| implemented-unverified | GET | `/v1/receipts/:id` | Execution, History, and Receipts | none |
| implemented-unverified | GET | `/v1/receipts/export` | Execution, History, and Receipts | none |
| implemented-unverified | POST | `/proof/receipts/verify` | Execution, History, and Receipts | none |
| implemented-unverified | GET | `/v1/routing/stats` | Routing Control & Analytics | none |
| implemented-unverified | GET | `/v1/routing/recent` | Routing Control & Analytics | none |
| implemented-unverified | GET | `/v1/routing/leaderboard` | Routing Control & Analytics | none |
| implemented-unverified | POST | `/v1/routing/strategy` | Routing Control & Analytics | none |
| implemented-unverified | POST | `/v1/routing/provider_weights` | Routing Control & Analytics | none |
| implemented-unverified | GET | `/v1/routing/speculative/status` | Routing Control & Analytics | none |
| implemented-unverified | GET | `/v1/routing/speculative/config` | Routing Control & Analytics | none |
| implemented-unverified | POST | `/v1/routing/speculative` | Routing Control & Analytics | none |
| implemented-unverified | GET | `/v1/routing/speculative/analytics` | Routing Control & Analytics | none |
| implemented-unverified | POST | `/v1/routing/speculative/simulate` | Routing Control & Analytics | none |
| implemented-unverified | POST | `/v1/routing/council` | Routing Control & Analytics | none |
| implemented-unverified | GET | `/v1/routing/council/analytics` | Routing Control & Analytics | none |
| implemented-unverified | POST | `/v1/routing/shadow` | Routing Control & Analytics | none |
| implemented-unverified | GET | `/v1/routing/circuit-breaker/status` | Routing Control & Analytics | none |
| implemented-unverified | GET | `/v1/bt/templates` | Behavior Trees | none |
| implemented-unverified | GET | `/v1/bt/definitions` | Behavior Trees | none |
| implemented-unverified | GET | `/v1/bt/definitions/:id` | Behavior Trees | none |
| implemented-unverified | POST | `/v1/bt/definitions` | Behavior Trees | none |
| implemented-unverified | DELETE | `/v1/bt/definitions/:id` | Behavior Trees | none |
| test-covered | POST | `/v1/tasks/submit` | Durable Tasks | tests: 1, clients: 1 |
| test-covered | GET | `/v1/tasks/:id` | Durable Tasks | tests: 1, clients: 1 |
| test-covered | GET | `/v1/tasks` | Durable Tasks | tests: 1, clients: 1 |
| client-referenced | GET | `/v1/tasks/:id/steps` | Durable Tasks | clients: 1 |
| test-covered | POST | `/v1/tasks/:id/cancel` | Durable Tasks | tests: 1 |
| implemented-unverified | GET | `/v1/tasks/proof/readiness` | Durable Tasks | none |
| implemented-unverified | POST | `/v1/tasks/:id/proof/verify` | Durable Tasks | none |
| test-covered | POST | `/v1/mcp` | MCP Transport | tests: 1 |
| implemented-unverified | POST | `/v1/mcp/stream` | MCP Transport | none |
| implemented-unverified | GET | `/v1/health` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/runtime/profile` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/chat/completions` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/plan` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/reflect` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/admin/models` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/admin/models/load` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/admin/models/swap` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/btree/validate` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/btree/run` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/btree/deploy` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/btree/events` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/lora/status` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/memory/status` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/memory/store` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/memory/search` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/memory/:key` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/hitl/status` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/hitl/requests` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/hitl/request` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/hitl/approve` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/hitl/reject` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/swarm/status` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/swarm/agents` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/swarm/join` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/swarm/propose` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/swarm/vote` | Local Runtime API | none |
| client-referenced | GET | `/v1/federated/status` | Local Runtime API | clients: 1 |
| client-referenced | POST | `/v1/federated/update` | Local Runtime API | clients: 1 |
| client-referenced | GET | `/v1/federated/model/latest` | Local Runtime API | clients: 1 |
| implemented-unverified | GET | `/v1/federated/participants` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/runtime/execute` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/runtime/violations` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/runtime/task/submit` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/runtime/task/stream` | Local Runtime API | none |
| implemented-unverified | POST | `/v1/runtime/task/{task_id}/cancel` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/runtime/task/{task_id}/wal` | Local Runtime API | none |
| implemented-unverified | GET | `/v1/runtime/agent/:id/state` | Local Runtime API | none |
