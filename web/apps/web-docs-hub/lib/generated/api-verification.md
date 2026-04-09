# API Verification Report

Generated: 2026-04-09T15:51:08.068Z

This report is evidence-based. It does not claim endpoint health beyond what is present in route registration, tests, and client references in this repository.

## Summary

- Total documented endpoints: 51
- Test-covered: 5
- Client-referenced: 10
- Implemented but unverified: 36

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
| implemented-unverified | GET | `/v1/bt/templates` | Behavior Trees | none |
| implemented-unverified | GET | `/v1/bt/definitions` | Behavior Trees | none |
| implemented-unverified | GET | `/v1/bt/definitions/:id` | Behavior Trees | none |
| implemented-unverified | POST | `/v1/bt/definitions` | Behavior Trees | none |
| implemented-unverified | DELETE | `/v1/bt/definitions/:id` | Behavior Trees | none |
| client-referenced | POST | `/v1/tasks/submit` | Durable Tasks | clients: 1 |
| client-referenced | GET | `/v1/tasks/:id` | Durable Tasks | clients: 1 |
| client-referenced | GET | `/v1/tasks` | Durable Tasks | clients: 1 |
| implemented-unverified | GET | `/v1/health` | Local Runtime API | none |
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
