# Schlep-Engine Endpoint Classification Report

## Summary Statistics
- **Total endpoints:** 488
- **Go-native candidates:** 128
- **Rust-eligible candidates:** 24
- **Python-ML only:** 54
- **Hybrid workflows:** 282

## Classification Breakdown

- Go-native: 26.2%
- Rust-eligible: 4.9%
- Python-ML only: 11.1%
- Hybrid workflows: 57.8%

---

## Go-Native Endpoints (128 total)

**Rationale:** These endpoints are ideal for Go implementation due to their nature:
- Health checks and monitoring (low latency, high throughput)
- Simple CRUD operations (database queries)
- WebSocket/streaming (Go's excellent concurrency)
- Authentication (security, token validation)
- Analytics dashboards (aggregation queries)

### Analytics & Dashboards (22 endpoints)

- `GET /models/stats` - advanced_ml.py (priority: MEDIUM)
- `GET /labeling/rules/stats` - ai_framework_endpoints.py (priority: MEDIUM)
- `GET /dashboard-summary` - analytics.py (priority: MEDIUM)
- `GET /analytics/model-insights/{model_id}` - automated_retraining.py (priority: MEDIUM)
- `GET /analytics/system` - automated_retraining.py (priority: MEDIUM)
- `GET /overview/{customer_id}` - billing.py (priority: MEDIUM)
- `GET /datasets/stats` - dashboard_stats.py (priority: MEDIUM)
- `GET /stats` - dashboard_stats.py (priority: MEDIUM)
- `GET /pipelines/stats` - data_pipeline.py (priority: MEDIUM)
- `GET /platform/analytics` - dataset_marketplace.py (priority: MEDIUM)
- `GET /{dataset_id}/analytics` - dataset_marketplace.py (priority: MEDIUM)
- `GET /analytics/overview` - enterprise.py (priority: MEDIUM)
- `GET /analytics/best-practices` - experiments.py (priority: MEDIUM)
- `GET /analytics/efficiency` - experiments.py (priority: MEDIUM)
- `GET /analytics/portfolio` - experiments.py (priority: MEDIUM)
- `GET /analytics/trends` - experiments.py (priority: MEDIUM)
- `GET /platform/analytics` - experiments.py (priority: MEDIUM)
- `GET /dashboard/{customer_id}` - metrics_dashboard.py (priority: MEDIUM)
- `GET /dashboard/overview` - monitoring_dashboard.py (priority: MEDIUM)
- `GET /analytics` - real_time_streaming.py (priority: MEDIUM)
- ... and 2 more endpoints

### Authentication (10 endpoints)

- `PUT /admin/users/{user_id}/role` - auth_unified.py (priority: HIGH)
- `POST /login` - auth_unified.py (priority: HIGH)
- `POST /logout` - auth_unified.py (priority: HIGH)
- `GET /me` - auth_unified.py (priority: HIGH)
- `GET /oauth/accounts` - auth_unified.py (priority: HIGH)
- `GET /oauth/{provider}/authorize` - auth_unified.py (priority: HIGH)
- `GET /oauth/{provider}/callback` - auth_unified.py (priority: HIGH)
- `DELETE /oauth/{provider}/unlink` - auth_unified.py (priority: HIGH)
- `POST /refresh` - auth_unified.py (priority: HIGH)
- `POST /register` - auth_unified.py (priority: HIGH)

### CRUD Operations (6 endpoints)

- `GET /admin/users` - auth_unified.py (priority: MEDIUM)
- `GET /customer/{customer_id}/payments` - billing.py (priority: MEDIUM)
- `GET /customer/{customer_id}/subscriptions` - billing.py (priority: MEDIUM)
- `GET /billing/{customer_id}` - self_service.py (priority: MEDIUM)
- `GET /billing/{customer_id}/invoices` - self_service.py (priority: MEDIUM)
- `GET /billing/{customer_id}/invoices/{invoice_id}/download` - self_service.py (priority: MEDIUM)

### Health & Monitoring (84 endpoints)

- `GET /optimization/health` - adaptive_optimizer.py (priority: HIGH)
- `GET /optimization/status` - adaptive_optimizer.py (priority: HIGH)
- `GET /health` - admin.py (priority: HIGH)
- `GET /monitoring/{monitoring_id}/status` - advanced_ai.py (priority: HIGH)
- `GET /status` - advanced_integrations.py (priority: HIGH)
- `GET /health` - analytics.py (priority: HIGH)
- `GET /health` - api_status.py (priority: HIGH)
- `GET /legacy/status` - auth_unified.py (priority: HIGH)
- `GET /status` - auth_unified.py (priority: HIGH)
- `GET /health` - automated_retraining.py (priority: HIGH)
- `GET /pipelines/{pipeline_id}/status` - automated_retraining.py (priority: HIGH)
- `GET /health` - cost_monitoring.py (priority: HIGH)
- `GET /metrics/stream` - cost_monitoring.py (priority: HIGH)
- `GET /stream/status/{job_id}` - data_streaming.py (priority: HIGH)
- `GET /health` - dataset_marketplace.py (priority: HIGH)
- `GET /metrics-snapshot` - debug.py (priority: HIGH)
- `GET /status` - digital_twin.py (priority: HIGH)
- `GET /cluster/status` - distributed_processing.py (priority: HIGH)
- `GET /health` - distributed_processing.py (priority: HIGH)
- `GET /metrics` - distributed_processing.py (priority: HIGH)
- ... and 64 more endpoints

### WebSocket/Streaming (6 endpoints)

- `WEBSOCKET /websocket/{stream_name}` - advanced_integrations.py (priority: HIGH)
- `WEBSOCKET /stream/progress/{job_id}` - data_streaming.py (priority: HIGH)
- `WEBSOCKET /{twin_id}/ws` - digital_twin.py (priority: HIGH)
- `WEBSOCKET /live/{customer_id}` - metrics_dashboard.py (priority: HIGH)
- `WEBSOCKET /live` - real_time_streaming.py (priority: HIGH)
- `WEBSOCKET /ws/{user_id}` - websocket_manager.py (priority: HIGH)

---

## Rust-Eligible Endpoints (24 total)

**Rationale:** These endpoints benefit from Rust's performance and safety:
- Data validation (CPU-intensive, type safety)
- Data transformations (memory efficiency)
- Parsing operations (zero-copy parsing)
- Security/compliance checks (safety guarantees)

### Compliance & Security (5 endpoints)

- `GET /audit-logs` - audit.py (priority: HIGH)
- `GET /{dataset_id}/quality-report` - dataset_marketplace.py (priority: HIGH)
- `GET /compliance/report` - dpa_compliance.py (priority: HIGH)
- `GET /pipelines/{pipeline_id}/quality` - ml_preparation.py (priority: HIGH)
- `GET /admin/audit-logs` - security_endpoints.py (priority: HIGH)

### Data Validation & Processing (19 endpoints)

- `GET /processing-jobs/{job_id}` - dataset_marketplace.py (priority: MEDIUM)
- `POST /extract/documents` - document_extraction.py (priority: MEDIUM)
- `POST /extract/ocr` - document_extraction.py (priority: MEDIUM)
- `POST /extract/pdf` - document_extraction.py (priority: MEDIUM)
- `POST /extract/pdf` - document_extraction.py (priority: MEDIUM)
- `GET /extractions` - document_extraction.py (priority: MEDIUM)
- `GET /extractions/{extraction_id}` - document_extraction.py (priority: MEDIUM)
- `POST /processors/register` - dpa_compliance.py (priority: MEDIUM)
- `POST /processors/{processor_id}/approve` - dpa_compliance.py (priority: MEDIUM)
- `POST /processors/{processor_id}/assessments` - dpa_compliance.py (priority: MEDIUM)
- `GET /processors/{processor_id}/summary` - dpa_compliance.py (priority: MEDIUM)
- `POST /processors/{processor_id}/transfer-agreements` - dpa_compliance.py (priority: MEDIUM)
- `POST /process` - multimodal.py (priority: MEDIUM)
- `POST /validate` - multimodal.py (priority: MEDIUM)
- `GET /processor/detailed-report` - performance.py (priority: MEDIUM)
- `POST /processor/optimize-cache` - performance.py (priority: MEDIUM)
- `POST /processor/reset-metrics` - performance.py (priority: MEDIUM)
- `POST /validate-question` - semantic_insights.py (priority: MEDIUM)
- `POST /validate-operation` - subscription_aware_ml_endpoints.py (priority: MEDIUM)

---

## Python-ML Only Endpoints (54 total)

**Rationale:** These endpoints MUST remain in Python:
- ML model inference (scikit-learn, PyTorch, TensorFlow)
- Model training and retraining
- Feature engineering
- Advanced AI operations (NLP, computer vision)
- MLOps workflows

### Advanced ML (6 endpoints)

- `POST /detect-anomalies` - advanced_ml.py (priority: MEDIUM)
- `GET /capabilities` - multimodal.py (priority: MEDIUM)
- `GET /examples` - multimodal.py (priority: MEDIUM)
- `POST /ask` - semantic_insights.py (priority: MEDIUM)
- `GET /examples` - semantic_insights.py (priority: MEDIUM)
- `GET /schema` - semantic_insights.py (priority: MEDIUM)

### ML/AI Operations (35 endpoints)

- `POST /intelligent-analysis` - advanced_ai.py (priority: HIGH)
- `POST /predictive-analysis` - advanced_ai.py (priority: HIGH)
- `GET /insights/{model_name}` - advanced_ml.py (priority: HIGH)
- `GET /model-status/{model_name}` - advanced_ml.py (priority: HIGH)
- `GET /models` - advanced_ml.py (priority: HIGH)
- `DELETE /models/{model_name}` - advanced_ml.py (priority: HIGH)
- `POST /predict` - advanced_ml.py (priority: HIGH)
- `POST /train-model` - advanced_ml.py (priority: HIGH)
- `POST /labeling/predict` - ai_framework_endpoints.py (priority: HIGH)
- `POST /labeling/train-few-shot` - ai_framework_endpoints.py (priority: HIGH)
- `GET /models` - dashboard_stats.py (priority: HIGH)
- `POST /feature-engineering` - data_quality.py (priority: HIGH)
- `GET /{twin_id}/insights` - digital_twin.py (priority: HIGH)
- `POST /{twin_id}/insights` - digital_twin.py (priority: HIGH)
- `GET /{twin_id}/predictions` - digital_twin.py (priority: HIGH)
- `POST /ai-analysis` - distributed_processing.py (priority: HIGH)
- `GET /{experiment_id}/insights` - experiments.py (priority: HIGH)
- `GET /insights/user` - feedback_learning.py (priority: HIGH)
- `GET /insights/user/{user_id}` - feedback_learning.py (priority: HIGH)
- `POST /predict` - ml_pipeline.py (priority: HIGH)
- `POST /train/{pipeline_id}` - ml_pipeline.py (priority: HIGH)
- `GET /models` - mlops.py (priority: HIGH)
- `POST /models/register` - mlops.py (priority: HIGH)
- `GET /models/{model_id}` - mlops.py (priority: HIGH)
- `POST /models/{model_id}/ab-test` - mlops.py (priority: HIGH)
- ... and 10 more endpoints

### MLOps (13 endpoints)

- `GET /alerts` - automated_retraining.py (priority: HIGH)
- `POST /alerts/{alert_id}/acknowledge` - automated_retraining.py (priority: HIGH)
- `POST /drift-detection/configure` - automated_retraining.py (priority: HIGH)
- `GET /drift-reports/{model_id}` - automated_retraining.py (priority: HIGH)
- `GET /executions` - automated_retraining.py (priority: HIGH)
- `GET /executions/{execution_id}` - automated_retraining.py (priority: HIGH)
- `GET /pipelines` - automated_retraining.py (priority: HIGH)
- `POST /pipelines/create` - automated_retraining.py (priority: HIGH)
- `PUT /pipelines/{pipeline_id}` - automated_retraining.py (priority: HIGH)
- `DELETE /pipelines/{pipeline_id}` - automated_retraining.py (priority: HIGH)
- `POST /pipelines/{pipeline_id}/trigger` - automated_retraining.py (priority: HIGH)
- `POST /experiments/create` - mlops.py (priority: HIGH)
- `GET /statistics` - mlops.py (priority: HIGH)

---

## Hybrid Workflows (282 total)

**Rationale:** These endpoints require orchestration across multiple languages:
- Complex data pipelines (Go gateway → Rust processing → Python ML)
- File upload/download (Go routing → Rust validation → Python analysis)
- Data investigations (orchestration layer)
- Integration workflows

### Complex Workflows (20 endpoints)

- `GET /pipelines` - dashboard_stats.py (priority: MEDIUM)
- `GET /investigations` - data_pipeline.py (priority: MEDIUM)
- `GET /investigations/{investigation_id}` - data_pipeline.py (priority: MEDIUM)
- `DELETE /investigations/{investigation_id}` - data_pipeline.py (priority: MEDIUM)
- `POST /investigations/{investigation_id}/reprocess` - data_pipeline.py (priority: MEDIUM)
- `POST /investigations/` - data_processing.py (priority: MEDIUM)
- `GET /investigations/` - data_processing.py (priority: MEDIUM)
- `GET /investigations/{investigation_id}` - data_processing.py (priority: MEDIUM)
- `PUT /investigations/{investigation_id}` - data_processing.py (priority: MEDIUM)
- `DELETE /investigations/{investigation_id}` - data_processing.py (priority: MEDIUM)
- `GET /investigations/{investigation_id}/jobs/` - data_processing.py (priority: MEDIUM)
- `POST /{twin_id}/optimize` - digital_twin.py (priority: MEDIUM)
- `POST /workflows/create` - dpa_compliance.py (priority: MEDIUM)
- `POST /workflows/{workflow_id}/approve` - dpa_compliance.py (priority: MEDIUM)
- `POST /pipelines` - ml_preparation.py (priority: MEDIUM)
- `GET /pipelines` - ml_preparation.py (priority: MEDIUM)
- `GET /pipelines/{pipeline_id}` - ml_preparation.py (priority: MEDIUM)
- `POST /pipelines/{pipeline_id}/execute` - ml_preparation.py (priority: MEDIUM)
- `POST /pipelines/{pipeline_id}/export/{framework_type}` - ml_preparation.py (priority: MEDIUM)
- `GET /pipelines/{pipeline_id}/steps` - ml_preparation.py (priority: MEDIUM)

### Data Management (22 endpoints)

- `GET /data-quality` - dashboard_stats.py (priority: MEDIUM)
- `GET /datasets` - dashboard_stats.py (priority: MEDIUM)
- `POST /upload` - data_pipeline.py (priority: MEDIUM)
- `GET /download/{processing_id}` - data_quality.py (priority: MEDIUM)
- `POST /stream/upload` - data_streaming.py (priority: MEDIUM)
- `POST /upload` - dataset_marketplace.py (priority: MEDIUM)
- `POST /{dataset_id}/download` - dataset_marketplace.py (priority: MEDIUM)
- `GET /{dataset_id}/download-file` - dataset_marketplace.py (priority: MEDIUM)
- `POST /database/connect` - integrations.py (priority: MEDIUM)
- `POST /database/query` - integrations.py (priority: MEDIUM)
- `GET /database/{connection_name}/tables` - integrations.py (priority: MEDIUM)
- `GET /database/{connection_name}/tables/{table_name}/schema` - integrations.py (priority: MEDIUM)
- `POST /storage/connect` - integrations.py (priority: MEDIUM)
- `POST /storage/read-file` - integrations.py (priority: MEDIUM)
- `GET /storage/{connection_name}/files` - integrations.py (priority: MEDIUM)
- `POST /database/reset-query-metrics` - performance.py (priority: MEDIUM)
- `GET /docs/{customer_id}/download` - self_service.py (priority: MEDIUM)
- `GET /download/{file_id}` - storage.py (priority: MEDIUM)
- `POST /upload` - storage.py (priority: MEDIUM)
- `POST /upload-and-create` - unified_pipeline.py (priority: MEDIUM)
- ... and 2 more endpoints

### General API (240 endpoints)

- `GET /optimization/capabilities` - adaptive_optimizer.py (priority: LOW)
- `GET /optimization/history/{pipeline_id}` - adaptive_optimizer.py (priority: LOW)
- `POST /optimization/quick-tune` - adaptive_optimizer.py (priority: LOW)
- `POST /optimization/run` - adaptive_optimizer.py (priority: LOW)
- `POST /auto-insights` - advanced_ai.py (priority: LOW)
- `POST /monitoring/setup` - advanced_ai.py (priority: LOW)
- `DELETE /connections/{connection_type}` - advanced_integrations.py (priority: LOW)
- `POST /create` - advanced_integrations.py (priority: LOW)
- `POST /mqtt/publish` - advanced_integrations.py (priority: LOW)
- `POST /mqtt/subscribe` - advanced_integrations.py (priority: LOW)
- `GET /protocols` - advanced_integrations.py (priority: LOW)
- `POST /sse/send` - advanced_integrations.py (priority: LOW)
- `GET /sse/stream` - advanced_integrations.py (priority: LOW)
- `POST /websocket/broadcast` - advanced_integrations.py (priority: LOW)
- `GET /websocket/connections` - advanced_integrations.py (priority: LOW)
- `POST /export/huggingface` - ai_framework_endpoints.py (priority: LOW)
- `POST /export/pytorch` - ai_framework_endpoints.py (priority: LOW)
- `POST /export/sklearn` - ai_framework_endpoints.py (priority: LOW)
- `POST /export/tensorflow` - ai_framework_endpoints.py (priority: LOW)
- `POST /frameworks/recommendations` - ai_framework_endpoints.py (priority: LOW)
- ... and 220 more endpoints

---

## File Distribution Analysis

### Files with Most Endpoints

- **dataset_marketplace.py**: 21 endpoints
- **security_endpoints.py**: 18 endpoints
- **mlops.py**: 18 endpoints
- **experiments.py**: 18 endpoints
- **self_service.py**: 17 endpoints
- **automated_retraining.py**: 15 endpoints
- **performance.py**: 15 endpoints
- **validation.py**: 14 endpoints
- **digital_twin.py**: 14 endpoints
- **feedback_learning.py**: 14 endpoints
- **integrations.py**: 14 endpoints
- **auth_unified.py**: 13 endpoints
- **health.py**: 13 endpoints
- **distributed_processing.py**: 13 endpoints
- **ai_framework_endpoints.py**: 12 endpoints

---

## Migration Recommendations

### Phase 1: Quick Wins (Go-native)
1. **Health & Monitoring** (HIGH priority)
   - Move all `/health/*`, `/metrics/*`, `/prometheus` endpoints to Go
   - Benefits: Lower latency, better observability

2. **Authentication** (HIGH priority)
   - Migrate auth endpoints to Go for better security & performance
   - JWT validation, session management

3. **Simple Analytics** (MEDIUM priority)
   - Dashboard aggregations, stats endpoints
   - Go's concurrency excels at aggregation queries

### Phase 2: Performance Critical (Rust)
1. **Data Validation & Compliance** (HIGH priority)
   - Security validation, DPA compliance checks
   - Benefits: Type safety, zero-cost abstractions

2. **Data Processing** (MEDIUM priority)
   - File parsing, data transformation
   - Rust's memory efficiency shines here

### Phase 3: Keep in Python
1. **ML/AI Operations** (ALL stay in Python)
   - Model serving, training, inference
   - No migration needed - Python ecosystem is unmatched

2. **MLOps Workflows** (Stay in Python)
   - Experiment tracking, model registry
   - Leverage existing libraries

### Phase 4: Hybrid Orchestration
1. **Data Pipelines**
   - Go gateway receives request
   - Routes to Rust for validation/processing
   - Python for ML operations
   - Go aggregates and returns response

---

## Next Steps

1. **Prioritize by Traffic**: Identify high-traffic endpoints from logs
2. **Start with Health Checks**: Low risk, high visibility
3. **Benchmark Performance**: Measure before/after migration
4. **Gradual Rollout**: Use feature flags for controlled migration
5. **Monitor Metrics**: Track latency, throughput, error rates
