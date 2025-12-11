# Multi-Tenant Observability - Backend Implementation Guide

## Overview
This document outlines the backend changes required to support multi-tenant observability filtering and tier-based retention windows.

## Features Implemented (Frontend)
- ✅ Multi-tenant dropdown in Observability header (Scale tier only)
- ✅ 90-day retention badge (Scale tier) vs 30-day (Growth tier)
- ✅ Time range selector with 90d option
- ✅ Disabled state with tooltip for Growth tier users
- ✅ Updated pricing page to highlight these features

## Backend Requirements

### 1. Request Trace Schema Enhancement
Add `tenant_id` field to all observability trace records:

```go
type RequestTrace struct {
    ID              string    `json:"id"`
    TenantID        string    `json:"tenant_id"`  // NEW: Required for multi-tenant filtering
    Timestamp       time.Time `json:"timestamp"`
    Model           string    `json:"model"`
    Provider        string    `json:"provider"`
    Status          int       `json:"status"`
    Latency         int64     `json:"latency"`
    Cost            float64   `json:"cost"`
    // ... existing fields
}
```

### 2. Observability Query Filtering
Update all observability query functions to support optional `tenant_id` filtering:

**File**: `internal/observability/query.go` (to be created)

```go
type QueryFilters struct {
    TenantID      *string   // Optional: Filter by tenant (Scale tier only)
    TimeRange     string    // "1h", "24h", "7d", "30d", "90d"
    Provider      *string
    Model         *string
    Status        *int
    MinLatency    *int64
    // ... other filters
}

func QueryTraces(ctx context.Context, filters QueryFilters) ([]RequestTrace, error) {
    // Build query with tenant_id filter when provided
    // Apply tier-based retention window (30d Growth, 90d Scale)
    // Return filtered traces
}
```

### 3. Tier-Based Retention Windows
Implement automatic data retention based on tenant tier:

**File**: `internal/observability/retention.go` (to be created)

```go
const (
    RetentionDeveloper = 0 * 24 * time.Hour    // No retention
    RetentionGrowth    = 30 * 24 * time.Hour   // 30 days
    RetentionScale     = 90 * 24 * time.Hour   // 90 days
    RetentionTrial     = 14 * 24 * time.Hour   // 14 days
)

func GetRetentionWindow(tier string) time.Duration {
    switch tier {
    case "growth":
        return RetentionGrowth
    case "scale":
        return RetentionScale
    case "trial":
        return RetentionTrial
    default:
        return RetentionDeveloper
    }
}

// Cleanup job (run daily via cron)
func CleanupExpiredTraces(ctx context.Context) error {
    // For each tenant, delete traces older than their retention window
    // Scale: 90 days
    // Growth: 30 days
}
```

### 4. API Endpoint Updates

**Endpoint**: `GET /v1/observability/traces`

Query parameters:
- `tenant_id` (optional, Scale tier only) - Filter by specific tenant
- `time_range` - One of: "1h", "24h", "7d", "30d", "90d"
- `provider` (optional)
- `model` (optional)
- `status` (optional)
- `limit` - Max results (default: 1000 Growth, 100000 Scale)

Response:
```json
{
  "traces": [...],
  "total": 1234,
  "filtered": 567,
  "retention_days": 90,
  "tier": "scale"
}
```

**Endpoint**: `GET /v1/observability/tenants` (Scale tier only)

Returns list of tenants for the current account:
```json
{
  "tenants": [
    { "id": "tenant-1", "name": "Acme Corp" },
    { "id": "tenant-2", "name": "TechStart Inc" }
  ]
}
```

### 5. Metrics Labels Enhancement
Ensure all Prometheus metrics include `tenant_id` label (already implemented in `internal/observability/metrics.go`):

```go
// ✅ Already implemented - examples:
speculativeRequestsTotal.WithLabelValues(mode, winnerProvider, tenantID).Inc()
schlepPolicyVersionActive.WithLabelValues(tenantID, version).Set(value)
schlepSLAViolationsTotal.WithLabelValues(tenantID, provider, violationType, severity).Inc()
```

### 6. Storage Layer Updates

**PostgreSQL Schema** (example):
```sql
CREATE TABLE IF NOT EXISTS observability_traces (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,  -- NEW
    timestamp TIMESTAMP NOT NULL,
    model VARCHAR(255),
    provider VARCHAR(255),
    status INTEGER,
    latency BIGINT,
    cost DECIMAL(10, 6),
    -- ... other fields

    -- Indexes
    INDEX idx_tenant_timestamp (tenant_id, timestamp),
    INDEX idx_timestamp (timestamp)
);

-- Retention cleanup query (run daily)
DELETE FROM observability_traces
WHERE tenant_id IN (
    SELECT tenant_id FROM tenants WHERE plan = 'growth'
) AND timestamp < NOW() - INTERVAL '30 days';

DELETE FROM observability_traces
WHERE tenant_id IN (
    SELECT tenant_id FROM tenants WHERE plan = 'scale'
) AND timestamp < NOW() - INTERVAL '90 days';
```

## Testing Checklist

### Frontend (Already Implemented)
- [x] Multi-tenant dropdown appears for Scale tier
- [x] Multi-tenant dropdown disabled with tooltip for Growth tier
- [x] 90-day retention badge shown for Scale tier
- [x] 30-day retention badge with upgrade link for Growth tier
- [x] Time range selector includes 90d option
- [x] Pricing page updated with new features

### Backend (To Be Implemented)
- [ ] Add `tenant_id` field to trace ingestion
- [ ] Create observability query endpoint with tenant_id filtering
- [ ] Implement tenant list endpoint for Scale tier
- [ ] Set up retention cleanup cron job
- [ ] Test 30-day retention enforcement for Growth tier
- [ ] Test 90-day retention enforcement for Scale tier
- [ ] Verify Prometheus metrics include tenant_id labels

## Migration Notes

1. **Existing Data**: Add `tenant_id` to existing traces during migration
2. **Backward Compatibility**: API should work without `tenant_id` filter (returns all traces for the account)
3. **Performance**: Ensure indexes on (tenant_id, timestamp) for efficient queries

## Security Considerations

1. **Authorization**: Verify user has access to requested `tenant_id`
2. **Growth Tier Enforcement**: Reject `tenant_id` filter requests from non-Scale tier users
3. **Data Isolation**: Ensure traces are strictly isolated by tenant_id

## Implementation Priority

1. **High Priority** (Core functionality):
   - Add tenant_id to trace schema
   - Implement retention cleanup
   - Create tenant list API

2. **Medium Priority** (Enhanced filtering):
   - Multi-tenant query filtering
   - Tier-based query limits

3. **Low Priority** (Nice to have):
   - Advanced analytics by tenant
   - Cross-tenant comparison (Scale tier)
