# SDK Refactoring Plan: Extract Business Logic to Thin Client

## Executive Summary

Current Python SDK has **6,777 lines of code** with embedded business logic. This refactoring will:
- Extract all business logic to backend API
- Reduce SDK to **<2,000 lines** (thin HTTP client only)
- Maintain backward compatibility through migration layer
- Improve maintainability and reduce dependency footprint

## Current State Analysis

### SDK Architecture Problems
1. **Embedded Business Logic**: Data processing, ML pipeline logic in SDK
2. **Heavy Dependencies**: 1,363 test files, complex error handling
3. **Tight Coupling**: SDK makes assumptions about data formats, validation
4. **Code Duplication**: Similar validation logic across multiple API classes

### Current SDK Structure
```
schlep_engine/
├── client/main.py              (314 lines) - Complex client orchestration
├── api/
│   ├── data_processing.py     (452 lines) - Business logic heavy
│   ├── ml_pipeline.py         (387 lines) - Complex ML operations
│   ├── document_extraction.py (298 lines) - Document processing logic
│   ├── data_quality.py        (234 lines) - Data validation logic
│   ├── model_registry.py      (187 lines) - Model management
│   ├── storage.py             (165 lines) - File operations
│   ├── analytics.py           (143 lines) - Analytics processing
│   ├── auth.py                (129 lines) - Authentication handling
│   ├── monitoring.py          (112 lines) - Metrics processing
│   └── base.py                (98 lines) - Base API class
├── auth/                       (89 lines) - Authentication manager
├── client/                     (234 lines) - HTTP client wrappers
├── models/                     (567 lines) - Data models
├── utils/                      (234 lines) - Utility functions
└── exceptions/                  (156 lines) - Custom exceptions
```

## Refactor Strategy

### Phase 1: Define Thin Client Interface

**Target: Pure HTTP client with validation only**

```python
class SchlepEngineClient:
    """Thin HTTP client - business logic in backend only"""
    
    def __init__(self, base_url: str, api_key: str = None, auth_manager = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.auth_manager = auth_manager
        self.http_client = HTTPClient(base_url, api_key, auth_manager)
        
    # Thin API methods - simple HTTP calls only
    async def predict(self, model_id: str, features: List[float]) -> dict:
        """Simple prediction call - backend handles validation and processing"""
        return await self.http_client.post(f"/ml/predict", {
            "model_id": model_id,
            "features": features
        })
    
    async def upload_file(self, file_path: str) -> dict:
        """File upload - backend handles processing logic"""
        return await self.http_client.upload_file("/storage/upload", file_path)
    
    async def process_data(self, data_id: str, operations: List[str]) -> dict:
        """Data processing - backend handles operation logic"""
        return await self.http_client.post(f"/data/{data_id}/process", {
            "operations": operations
        })
```

### Phase 2: Extract Business Logic to Backend

**Backend API Enhancements:**

1. **Enhanced Data Processing Endpoint**
   ```
   POST /api/v1/data/{data_id}/process
   {
       "operations": ["clean", "normalize", "validate", "transform"],
       "config": {
           "column_types": {"age": "integer", "name": "string"},
           "validation_rules": {"age": {"min": 0, "max": 150}}
       }
   }
   ```

2. **ML Pipeline Management**
   ```
   POST /api/v1/ml/pipelines
   {
       "name": "customer_churn_predictor",
       "steps": [
           {"type": "preprocess", "config": {...}},
           {"type": "model", "model_id": "churn_v2"},
           {"type": "postprocess", "config": {...}}
       ]
   }
   ```

3. **Document Enhancement**
   ```
   POST /api/v1/documents/extract
   {
       "document_type": "invoice",
       "extraction_rules": {
           "invoice_number": {"pattern": r"INV-\d{6}"},
           "amount": {"field": "total_amount"}
       }
   }
   ```

### Phase 3: Migration Layer for Backward Compatibility

```python
class LegacySchlepEngineClient(SchlepEngineClient):
    """Maintains backward compatibility for existing code"""
    
    async def process_dataframe(self, df, operations: List[str]) -> dict:
        """Legacy method that mimics old SDK behavior"""
        # Upload dataframe
        upload_result = await self.upload_dataframe(df)
        data_id = upload_result["id"]
        
        # Process with backend logic
        return await self.process_data(data_id, operations)
    
    async def run_ml_pipeline(self, config: dict) -> dict:
        """Legacy pipeline method"""
        return await self.http_client.post("/ml/pipelines/run", config)
```

## Implementation Plan

### Week 1: Thin Client Implementation

**Tasks:**
- [ ] Create new `thin_client.py` with minimal interface
- [ ] Implement basic HTTP client with authentication
- [ ] Add retry logic and error handling (no business logic)
- [ ] Write unit tests for thin client

**Deliverables:**
- `schlep_engine/thin_client.py` (~200 lines)
- `tests/test_thin_client.py` (~150 lines)
- Migration guide document

### Week 2: Backend API Enhancements

**Tasks:**
- [ ] Implement enhanced data processing endpoints
- [ ] Add ML pipeline management APIs
- [ ] Create document extraction enhancement endpoints
- [ ] Add batch processing capabilities

**Backend Changes:**
- Go Gateway: +200 lines (enhanced endpoints)
- Python ML Service: +150 lines (processing logic)
- Database: +50 lines (pipeline storage)

### Week 3: Migration Layer

**Tasks:**
- [ ] Implement `LegacySchlepEngineClient` wrapper
- [ ] Add deprecation warnings for old methods
- [ ] Create automated migration script
- [ ] Update documentation and examples

### Week 4: Testing & Deployment

**Tasks:**
- [ ] Comprehensive testing of thin client
- [ ] Performance benchmarking
- [ ] Backward compatibility validation
- [ ] Gradual rollout with feature flags

## Migration Strategy

### Gradual Transition Path

1. **Phase 1 (Week 5-6)**: 
   - Deploy thin client alongside legacy SDK
   - Feature flag for new client
   - Internal testing and validation

2. **Phase 2 (Week 7-8)**:
   - Default to thin client for new users
   - Legacy SDK still available for existing code
   - Migration assistance and documentation

3. **Phase 3 (Week 9-10)**:
   - Legacy SDK deprecated with warnings
   - 6-month deprecation timeline
   - Automated migration suggestions

### Compatibility Matrix

| Feature | Legacy SDK | Thin Client | Migration Path |
|---------|------------|------------|-----------------|
| File Upload | ✅ (Processing in SDK) | ✅ (Backend processing) | Transparent |
| Data Processing | ✅ (Complex logic) | ✅ (Backend handles) | API change |
| ML Pipeline | ✅ (SDK orchestration) | ✅ (Backend orchestration) | API change |
| Authentication | ✅ (Client-side) | ✅ (Server-side) | Transparent |
| Error Handling | ✅ (Detailed) | ✅ (Simplified) | Simplified |

## Benefits of Refactoring

### For Users
1. **Simpler SDK**: 3x smaller codebase, easier to understand
2. **Better Performance**: Business logic in optimized backend
3. **Consistent Experience**: Same logic regardless of language SDK
4. **Faster Updates**: Backend improvements available immediately

### For Developers
1. **Maintainability**: 70% less code to maintain
2. **Testability**: Simpler unit tests, higher coverage
3. **Reliability**: Backend has better resources and monitoring
4. **Multi-language Consistency**: Same backend logic across all SDKs

### For Infrastructure
1. **Resource Efficiency**: Less client-side computation
2. **Centralized Logic**: Single source of truth for business rules
3. **Better Monitoring**: Backend observability on all operations
4. **Security**: Sensitive processing stays on server

## Risk Mitigation

### Technical Risks
1. **Backward Compatibility**: Migration layer ensures existing code works
2. **Performance Regression**: Backend processing is typically faster
3. **Feature Parity**: All features moved to backend with enhancements

### Migration Risks
1. **User Adoption**: Comprehensive documentation and examples
2. **Breaking Changes**: Gradual transition with warnings
3. **Support**: Extended support for legacy SDK during transition

### Timeline Risks
1. **Development Delays**: Parallel development with feature flags
2. **Testing Coverage**: Comprehensive automated testing
3. **Rollback Plan**: Can revert to legacy SDK if issues

## Success Metrics

### Code Quality
- **Lines of Code**: 6,777 → <2,000 (70% reduction)
- **Test Coverage**: Target >90% (simpler code to test)
- **Dependencies**: Reduce by 50% (no data processing deps)

### Performance
- **Client Performance**: 50% improvement (less processing)
- **Memory Usage**: 60% reduction (lightweight client)
- **Startup Time**: 70% faster (less initialization)

### Adoption
- **New Users**: 100% thin client adoption
- **Existing Users**: 80% migration within 6 months
- **Issue Rate**: <5% increase in support tickets

## Deliverables

### Code Deliverables
1. **Thin Client Package** (`schlep_engine/thin_client/`)
2. **Migration Layer** (`schlep_engine/legacy/`)
3. **Backend Enhancements** (Go Gateway endpoints)
4. **Test Suite** (comprehensive coverage)

### Documentation Deliverables
1. **Migration Guide** (`docs/sdk-migration.md`)
2. **API Reference** (updated for thin client)
3. **Breaking Changes** (`docs/breaking-changes.md`)
4. **Best Practices** (`docs/sdk-best-practices.md`)

### Tooling Deliverables
1. **Migration Script** (`tools/migrate-sdk.py`)
2. **Compatibility Checker** (`tools/check-compatibility.py`)
3. **Performance Benchmark** (`tools/benchmark-sdk.py`)
4. **Feature Flag Manager** (`tools/feature-flags/`)

## Timeline Overview

```
Week 1-2: Thin Client Development     ████████░░░░░░░░░░░░░░░░░░
Week 3-4: Backend API Enhancements   ░░░░░░░░████████░░░░░░░░░
Week 5-6: Migration Layer            ░░░░░░░░░░░░░░░████████░░░
Week 7-8: Testing & Deployment       ░░░░░░░░░░░░░░░░░░░░████████

Total: 8 weeks
Resources: 2 engineers
Risk Level: Medium (mitigated by migration layer)
```

## Next Steps

1. **Approve Refactor Plan**: Get stakeholder approval
2. **Set Up Feature Flags**: Implement gradual rollout mechanism
3. **Begin Thin Client Development**: Week 1 tasks
4. **Schedule Backend Work**: Coordinate with backend team
5. **Prepare Migration Guides**: Documentation and examples

---

**Status**: Ready for implementation  
**Priority**: High (reduces technical debt by ~5,000 lines)  
**Impact**: Significant improvement in maintainability and user experience
