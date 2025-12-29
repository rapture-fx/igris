# Unified Dashboard Implementation Plan

## Executive Summary

Based on comprehensive analysis of **Igris Overture** (cloud gateway in Go) and **Igris Runtime** (edge inference in Rust), here's the proper approach for the unified dashboard.

---

## Current State Analysis

### What We Have (Existing Dashboard)
✅ **Dashboard** - Main overview (complex, system health monitoring)
✅ **Observability** - Traces and metrics
✅ **Providers & Keys** - Provider management
✅ **Routing Policies** - Policy configuration
✅ **Edge Fleet** - Fleet instances
✅ **Settings** - Tenant settings

### What We Built (New Pages - Need Review)
⚠️ **Overture section** - Partially correct but incomplete:
  - Cost & Quota ✓ (maps to `/v1/usage`)
  - Shadow Mode ✗ (NOT a real feature - should be removed)
  - EscapeVector ✗ (is Runtime emergency cache, not Overture feature)

⚠️ **Runtime section** - Wrong organization:
  - Device Details ✓ (maps to `/v1/fleet/instances`)
  - Config Push ✗ (exists but not main feature)
  - Swarm Status ✓ (maps to `/v1/swarm/*`)

⚠️ **Agents section** - Partially correct:
  - Planning & Reflection ✓ (maps to `/v1/plan` and `/v1/reflect`)
  - Tools Management ✓ (maps to tool registry)
  - QLoRA Training ✓ (maps to `/v1/lora/status`)

---

## CORRECT Feature Mapping

### OVERTURE Features (Cloud Gateway)

#### 1. **Multi-Tenancy & Access Control**
**Existing**: Settings page
**APIs**:
- `/v1/tenants` - Tenant CRUD
- `/v1/auth/*` - Login, 2FA, token management
- `/v1/vault/*` - BYOK key management

**Dashboard Needs**:
- Tenant list with status (active/suspended)
- API key management
- 2FA configuration
- Vault key status

---

#### 2. **Provider Management**
**Existing**: Providers & Keys page ✓
**APIs**:
- `/v1/providers/*` - Register, test, list providers
- `/v1/providers/stats` - Provider statistics
- `/v1/providers/:id/health` - Provider health

**Dashboard Needs** (ENHANCE EXISTING):
- Provider registration form
- Health status per provider
- Performance leaderboard
- Provider testing tool

---

#### 3. **Intelligent Routing**
**Existing**: Routing Policies page ✓
**APIs**:
- `/v1/routing/stats` - Routing statistics
- `/v1/routing/recent` - Recent requests
- `/v1/routing/leaderboard` - Provider leaderboard

**Dashboard Needs** (ENHANCE EXISTING):
- Routing strategy selector (speculative, council, quality-based)
- Live routing decisions visualization
- Provider leaderboard by quality
- Recent requests with routing decisions

---

#### 4. **Usage & Billing**
**NEW SECTION NEEDED**
**APIs**:
- `/v1/usage` - Current usage
- `/v1/usage/history` - Historical usage
- Cost tracking per provider

**Dashboard Needs**:
- Real-time usage metrics
- Cost breakdown by provider
- Usage history charts
- Quota management

---

#### 5. **Observability & Tracing**
**Existing**: Observability page ✓
**APIs**:
- `/v1/traces` - List traces
- `/v1/traces/summary` - Trace summary
- `/v1/audit` - Audit logs
- `/metrics` - Prometheus metrics

**Dashboard Needs** (ENHANCE EXISTING):
- Trace visualization
- Span details
- Audit log viewer
- Metrics dashboard

---

#### 6. **SLO & Policy Enforcement**
**NEW SECTION NEEDED**
**APIs**:
- `/admin/slo/status` - SLO status
- `/admin/slo/audit` - SLO audit events
- `/v1/policy` - Policy CRUD
- `/v1/policy/history` - Policy changes

**Dashboard Needs**:
- SLO breach alerts
- Policy editor
- Policy version history
- SLO metrics visualization

---

#### 7. **Cognitive Advisor**
**NEW SECTION NEEDED**
**APIs**:
- `/admin/cognitive/proposals` - List proposals
- `/admin/cognitive/proposals/:id/*` - Approve/reject/apply

**Dashboard Needs**:
- Proposal list
- Approval workflow UI
- Applied proposals history

---

#### 8. **Fleet Management** (Overture Side)
**Existing**: Edge Fleet page ✓
**APIs**:
- `/api/fleet/register` - Register agent
- `/api/fleet/agents` - List all agents
- `/api/fleet/agents/:agent_id` - Agent details
- `/api/fleet/health` - Fleet health overview

**Dashboard Needs** (ENHANCE EXISTING):
- Agent registration status
- Agent list with telemetry
- Fleet health overview
- Agent configuration sync status

---

### RUNTIME Features (Edge Inference)

#### 1. **Local LLM Inference**
**NEW SECTION NEEDED**
**APIs**:
- `/v1/chat/completions` - Main inference endpoint
- `/v1/health` - Runtime health
- `/metrics` - Prometheus metrics

**Dashboard Needs**:
- Inference statistics (requests/sec, tokens)
- Cache hit rate (EscapeVector)
- Model information (loaded models)
- GPU utilization

---

#### 2. **Advanced Agent Modes**
**Existing**: Agents section ✓
**APIs**:
- `/v1/plan` - Planning agent
- `/v1/reflect` - Reflection loop
- Tool execution stats

**Dashboard Needs** (ENHANCE EXISTING):
- Planning steps visualization
- Reflection iterations chart
- Tool call history
- Quality improvement metrics

---

#### 3. **LoRA Training**
**Existing**: QLoRA Training page ✓
**APIs**:
- `/v1/lora/status` - Training status
- Training metrics from telemetry

**Dashboard Needs** (ENHANCE EXISTING):
- Training progress bar
- Loss curve chart
- Adapter version management
- Training data volume

---

#### 4. **Swarm Orchestration**
**NEW SECTION NEEDED**
**APIs**:
- MCP context sharing
- Swarm agent coordination
- Consensus metrics

**Dashboard Needs**:
- Active swarm agents
- Consensus visualization
- Inter-agent messages
- Swarm performance metrics

---

#### 5. **Multi-Modal Processing**
**NEW SECTION NEEDED**
**APIs**:
- Vision processing stats
- Audio processing stats
- Format detection metrics

**Dashboard Needs**:
- Processed images/audio count
- Format distribution
- Processing latency

---

#### 6. **Emergency & Failover**
**NEW SECTION (NOT "Shadow Mode")**
**APIs**:
- EscapeVector cache stats
- Fallback trigger events
- Degradation metrics

**Dashboard Needs**:
- Cache hit rate
- Fallback events timeline
- Degraded mode indicators
- Cache quality scores

---

## Recommended Navigation Structure

```
┌─ Dashboard (Main Overview)
│
├─ OVERTURE (Cloud Gateway)
│  ├─ Providers
│  ├─ Routing & Quality
│  ├─ Usage & Billing
│  ├─ SLO & Policies
│  ├─ Cognitive Advisor
│  └─ Fleet Management
│
├─ RUNTIME (Edge Inference)
│  ├─ Local Inference
│  ├─ Agent Modes
│  │  ├─ Planning
│  │  ├─ Reflection
│  │  └─ Tools
│  ├─ LoRA Training
│  ├─ Swarm Orchestration
│  ├─ Multi-Modal
│  └─ Emergency Failover
│
├─ OBSERVABILITY
│  ├─ Traces
│  ├─ Metrics
│  └─ Audit Logs
│
└─ SETTINGS
   ├─ Tenants
   ├─ Authentication
   └─ Vault (BYOK)
```

---

## Action Items

### Phase 1: Cleanup & Mapping
1. ✅ Remove "Shadow Mode" page (doesn't exist)
2. ✅ Move "EscapeVector" to Runtime → Emergency Failover
3. ✅ Enhance existing Providers page with health monitoring
4. ✅ Enhance existing Routing page with leaderboard
5. ✅ Enhance existing Observability with traces UI

### Phase 2: New Features
1. ⚠️ Add Usage & Billing section
2. ⚠️ Add SLO & Policies section
3. ⚠️ Add Cognitive Advisor section
4. ⚠️ Add Runtime Local Inference stats
5. ⚠️ Add Multi-Modal processing stats
6. ⚠️ Add Swarm Orchestration UI

### Phase 3: API Integration
1. Connect to actual Overture APIs (Go backend)
2. Connect to actual Runtime APIs (Rust backend)
3. Real-time metrics via Prometheus
4. WebSocket for live updates

---

## Next Steps

1. **Approve this plan** - Confirm the structure is correct
2. **Phase 1 execution** - Clean up incorrect pages and enhance existing ones
3. **Phase 2 execution** - Add missing features based on real APIs
4. **Phase 3 execution** - Replace mock data with real API calls

---

## Summary of Changes Needed

| Page | Action | Reason |
|------|--------|--------|
| Shadow Mode | ❌ DELETE | Doesn't exist in codebase |
| Overture > EscapeVector | 🔀 MOVE to Runtime | It's a Runtime emergency cache |
| Overture > Providers | ✏️ ENHANCE | Add health monitoring, testing, leaderboard |
| Overture > Routing | ✏️ ENHANCE | Add routing stats, recent requests, strategy selector |
| Observability | ✏️ ENHANCE | Add trace viewer, span details |
| Usage & Billing | ➕ ADD NEW | Critical for multi-tenancy |
| SLO & Policies | ➕ ADD NEW | Core governance feature |
| Cognitive Advisor | ➕ ADD NEW | AI-powered policy optimization |
| Runtime Inference | ➕ ADD NEW | Local LLM stats missing |
| Multi-Modal | ➕ ADD NEW | Vision/audio processing stats |
| Swarm | ➕ ADD NEW | Multi-agent orchestration |

