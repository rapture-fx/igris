# Phase 14 Multi-Tenancy API Integration Guide

This directory contains comprehensive documentation for integrating multi-tenancy features into the Schlep-Engine API.

## Documentation Files

### 1. **api_analysis.md** - COMPLETE TECHNICAL ANALYSIS
Read this first for comprehensive understanding of:
- Current API handler structure (Fiber v2 framework)
- All endpoint definitions and routing
- Request processing flow with safety integration
- Middleware architecture and integration points
- Current authentication/authorization mechanisms
- Integration points for Phase 14 features
- Database schema recommendations
- File locations and dependencies

**Key Sections:**
- Handler Structure (InferHandler, AdminOptimizerHandler)
- Endpoint Definitions (8 current endpoints)
- Request Processing Flow (complete lifecycle)
- Middleware Stack Order
- Authentication/Authorization Infrastructure
- Phase 14 Integration Points

**Best For:** Understanding the complete picture, making architectural decisions

### 2. **architecture_diagram.txt** - VISUAL & DETAILED FLOWS
Read this for visual understanding of:
- ASCII architecture diagrams showing component relationships
- Current vs Phase 14 middleware stack
- Complete data flow for tenant-aware inference requests
- BYOK key upload and usage sequence
- Database schema additions
- Error codes and HTTP status mapping
- Performance and security considerations
- Migration strategy with timeline

**Key Sections:**
- Current Architecture Overview
- Phase 14 Integration Points (6 major areas)
- Data Flow for Inference with Tenants
- BYOK Key Management Flow
- Database Schema (5 new tables)
- Middleware Stack Changes
- Security and Performance Considerations

**Best For:** Implementation planning, team discussions, understanding data flows

### 3. **quick_reference.md** - IMPLEMENTATION GUIDE
Read this for step-by-step implementation:
- Which files to read and in what order
- What's already in place vs what's missing
- Complete implementation checklist with priorities
- Code patterns and templates (copy-paste ready)
- Integration points with exact line numbers
- Testing strategy
- Deployment roadmap (5 weeks)
- Success criteria

**Key Sections:**
- Key Files to Understand
- What's Already in Place
- What's Missing
- Phase 14 Implementation Checklist (10 tasks)
- Code Patterns (Middleware, Handler, Routes)
- Integration Points in Existing Code
- Testing Strategy
- Deployment Strategy

**Best For:** Starting implementation, following step-by-step

## Quick Start

### For Architects/Leads
1. Read: `api_analysis.md` sections 1-5
2. Review: `architecture_diagram.txt` - Current Architecture
3. Decide: `architecture_diagram.txt` - Phase 14 Integration Points

### For Developers
1. Start: `quick_reference.md` - Key Files to Understand
2. Understand: `api_analysis.md` - specific sections
3. Implement: `quick_reference.md` - Implementation Checklist
4. Reference: `architecture_diagram.txt` - Data Flows

### For DevOps/Database
1. Review: `architecture_diagram.txt` - Database Schema Additions
2. Plan: `quick_reference.md` - Success Criteria
3. Reference: `api_analysis.md` - Section 8 (Database Support)

## Implementation Roadmap

### Week 1: Middleware Foundation (Priority 1)
- Create `internal/middleware/tenant.go`
- Extract tenant context
- Add to middleware stack
- See: `quick_reference.md` - MIDDLEWARE section

### Week 2: BYOK Vault System (Priority 2)
- Create `internal/vault/` package
- Implement encryption/decryption
- Add vault endpoints
- See: `quick_reference.md` - VAULT ENDPOINTS section

### Week 3: Policy Engine (Priority 3)
- Create policy handlers
- Add policy endpoints
- Extend SafetyController
- See: `quick_reference.md` - POLICY ENDPOINTS section

### Week 4: Tenant Management (Priority 4)
- Create tenant CRUD endpoints
- Add tenant configuration
- Implement admin endpoints
- See: `quick_reference.md` - TENANT MANAGEMENT section

### Week 5+: Integration & Testing (Priority 5)
- Tenant-aware inference
- Per-tenant metrics
- Testing and deployment
- See: `quick_reference.md` - Deployment Strategy

## Key File Locations

### Current API Structure
- Entry Point: `/cmd/schlep-api/main.go`
- Routes: `/internal/api/routes_infer.go`
- Handlers: `/cmd/schlep-api/handlers/infer.go`
- Middleware: `/internal/middleware/`

### Phase 12 Safety (Leverage This!)
- Safety Controller: `/internal/safety/safety_controller.go`
- Audit Logger: `/internal/safety/audit_logger.go` (Already has tenantID!)
- Key Validator: `/internal/safety/key_validator.go`

### To Create for Phase 14
- Tenant Middleware: `/internal/middleware/tenant.go` (NEW)
- Vault Package: `/internal/vault/{encrypt,storage,manager}.go` (NEW)
- Vault Handler: `/internal/api/vault_handler.go` (NEW)
- Policy Handler: `/internal/api/policy_handler.go` (NEW)
- Tenant Handler: `/internal/api/tenant_handler.go` (NEW)

## Key Insights

1. **AuditLogger Already Supports Tenants**
   - Has `tenantID string` field
   - Just needs to be populated from middleware
   - See: `api_analysis.md` - Section 5.4

2. **JWT Middleware Exists But Unused**
   - Located in `/internal/security/auth.go`
   - Can be extended for tenant claims
   - See: `api_analysis.md` - Section 5.1

3. **SafetyController Can Be Extended**
   - Already has `PreRequestCheck()` method
   - Can add `PreRequestCheckWithTenant()` for tenant budgets
   - See: `quick_reference.md` - SafetyController Changes

4. **Middleware Stack is Perfect**
   - Clean separation of concerns
   - Extensible design
   - Just add tenant auth after TraceID
   - See: `architecture_diagram.txt` - Middleware Stack

5. **No Major Architectural Changes Needed**
   - Just extensions to existing patterns
   - Reuse handler architecture
   - Extend safety controls
   - See: `api_analysis.md` - Section 7

## Architecture Summary

### Current Endpoints (8)
```
POST /v1/infer
POST /v1/chat/completions
GET /v1/health
GET /v1/models
GET /v1/providers/stats
GET /metrics
GET /v1/metrics
POST /admin/optimizer
```

### Phase 14 New Endpoints (14+)
```
VAULT (5):
POST /v1/tenants/{id}/vault/keys
GET /v1/tenants/{id}/vault/keys
PUT /v1/tenants/{id}/vault/keys/{keyId}
DELETE /v1/tenants/{id}/vault/keys/{keyId}
POST /v1/tenants/{id}/vault/validate

POLICIES (5):
GET /v1/tenants/{id}/policies
POST /v1/tenants/{id}/policies
PUT /v1/tenants/{id}/policies/{policyId}
DELETE /v1/tenants/{id}/policies/{policyId}
POST /v1/tenants/{id}/policies/{policyId}/validate

TENANTS (4+):
GET /v1/admin/tenants
POST /v1/admin/tenants
GET /v1/admin/tenants/{id}
PUT /v1/admin/tenants/{id}
GET /v1/tenants/me
PUT /v1/tenants/me

TENANT-AWARE INFERENCE (2):
POST /v1/tenants/{id}/infer
POST /v1/tenants/{id}/chat/completions
```

## Integration Points

### In InferHandler (lines 256-466)
- Extract tenantID from context
- Use tenant's BYOK key
- Apply tenant policy
- Record per-tenant metrics

### In SafetyController
- Extend PreRequestCheck for tenant budgets
- Use tenant-specific limits

### In AuditLogger
- Populate tenantID from middleware
- Query by tenant_id

### In Provider Registry
- Support per-tenant credentials
- Route BYOK keys to providers

## Database Schema

### New Tables (5)
```sql
tenants
tenant_users
tenant_api_keys
tenant_byok_keys
tenant_policies
```

See: `architecture_diagram.txt` - DATABASE SCHEMA ADDITIONS

## Success Criteria

- [ ] All 5 endpoint groups functional
- [ ] BYOK keys encrypted at rest
- [ ] Per-tenant budgets enforced
- [ ] Per-tenant rate limits working
- [ ] Audit logs segregated by tenant
- [ ] No multi-tenant data leakage
- [ ] Tenant lookup < 100ms latency
- [ ] 100% test coverage for new code

## Code Patterns

All three documents include code patterns and templates:
- Middleware pattern (extract, validate, store)
- Handler pattern (get context, process, respond)
- Route registration pattern (group, create handler, register)

See: `quick_reference.md` - CODE PATTERNS TO FOLLOW

## Next Step

Start with `quick_reference.md` section "Key Files to Understand" and follow the implementation checklist. Begin with middleware creation - that's your foundation for everything else.

---

For questions about specific sections:
- Architecture questions: See `api_analysis.md`
- Implementation details: See `quick_reference.md`
- Data flows: See `architecture_diagram.txt`

