"""
End-to-End Phase 1-5 Integration Example
==========================================

This example demonstrates the complete Schlep-Engine workflow:
- Phase 1: Multi-format data ingestion & ETL
- Phase 2: Model registry & hot reload
- Phase 3: L1/L2 caching & edge inference
- Phase 4: Observability with Prometheus & Jaeger
- Phase 5: Kubernetes deployment (infrastructure)

Prerequisites:
- Schlep-Engine API running (local or cloud)
- API key or user credentials
- Sample data files (CSV, JSON, Parquet, Avro)
"""

import asyncio
from pathlib import Path
from schlep_engine import SchlepEngineClient
import json

async def main():
    # Initialize client
    client = SchlepEngineClient(
        api_key="your-api-key-here",  # Or use auth.login()
        base_url="http://localhost:8000",  # Adjust for your environment
        debug=True
    )

    print("=" * 60)
    print("SCHLEP-ENGINE: Phase 1-5 Integration Demo")
    print("=" * 60)

    # ============================================================
    # PHASE 1: Multi-Format Data Ingestion & ETL
    # ============================================================
    print("\n[Phase 1] Multi-Format Data Ingestion & ETL")
    print("-" * 60)

    # Process CSV file
    print("  📄 Processing CSV file...")
    csv_result = await client.data.process_file(
        file_path="data/transactions.csv",
        transformations=[
            {"type": "filter", "condition": "amount > 100"},
            {"type": "deduplicate", "columns": ["transaction_id"]},
            {"type": "aggregate", "columns": ["amount"], "operation": "sum"}
        ]
    )
    print(f"  ✓ CSV processed: {csv_result.get('records_processed')} records")

    # Process Parquet file
    print("  📊 Processing Parquet file...")
    parquet_result = await client.data.process_file(
        file_path="data/ml_features.parquet",
        output_format="json"
    )
    print(f"  ✓ Parquet processed: {parquet_result.get('job_id')}")

    # ============================================================
    # PHASE 2: Model Registry & Lifecycle Management
    # ============================================================
    print("\n[Phase 2] Model Registry & Lifecycle Management")
    print("-" * 60)

    # Upload model to registry
    print("  📦 Uploading model to registry...")
    with open("models/fraud_detector_v2.pt", "rb") as model_file:
        upload_result = await client.model_registry.upload_model(
            model_file=model_file,
            name="fraud-detector",
            version="2.0.0",
            framework="pytorch",
            metadata={
                "accuracy": 0.95,
                "f1_score": 0.93,
                "trained_on": "2025-10-01"
            }
        )
    model_id = upload_result['model_id']
    print(f"  ✓ Model uploaded: {model_id}")

    # List available models
    print("  📋 Listing models in registry...")
    models = await client.model_registry.list_models(framework="pytorch")
    for model in models[:5]:
        print(f"    - {model['name']}:{model['version']} ({model['status']})")

    # Hot reload model (zero downtime)
    print("  🔄 Hot reloading model...")
    reload_result = await client.model_registry.hot_reload(
        model_id=model_id,
        version="2.0.0"
    )
    print(f"  ✓ Model reloaded in {reload_result['load_time_ms']}ms")

    # ============================================================
    # PHASE 3: Advanced Caching (L1/L2) & Edge Inference
    # ============================================================
    print("\n[Phase 3] Advanced Caching & Edge Inference")
    print("-" * 60)

    # Get cache statistics
    print("  📊 Fetching cache statistics...")
    cache_stats = await client.cache.get_stats(layer='all')
    print(f"    L1 Hit Rate: {cache_stats['l1_hit_rate']:.2%}")
    print(f"    L2 Hit Rate: {cache_stats['l2_hit_rate']:.2%}")
    print(f"    L1 Entries: {cache_stats.get('l1_entries', 0)}")
    print(f"    L2 Entries: {cache_stats.get('l2_entries', 0)}")

    # Warm cache with predictions
    print("  🔥 Warming cache for model...")
    warm_result = await client.cache.warm_cache(
        model_id=model_id,
        layer='both'
    )
    print(f"  ✓ Cached {warm_result['entries_cached']} entries in {warm_result['cache_time_ms']}ms")

    # View cache topology
    print("  🌐 Cache topology:")
    topology = await client.cache.get_topology()
    for node in topology.get('nodes', [])[:3]:
        print(f"    - {node['id']} ({node['region']}): {node['latency_ms']}ms")

    # Make inference with caching
    print("  🎯 Running inference with cache...")
    inference_result = await client.ml.predict(
        model_id=model_id,
        data={
            "transaction_amount": 5000,
            "merchant_category": "travel",
            "user_country": "US"
        }
    )
    print(f"  ✓ Prediction: {inference_result.get('prediction')}")
    print(f"    Cache Hit: {inference_result.get('cache_hit', False)}")
    print(f"    Latency: {inference_result.get('latency_ms')}ms")

    # ============================================================
    # PHASE 4: Observability 2.0 (Prometheus + Jaeger)
    # ============================================================
    print("\n[Phase 4] Observability 2.0")
    print("-" * 60)

    # Query Prometheus metrics
    print("  📈 Fetching Prometheus metrics...")
    metrics = await client.observability.get_metrics()
    print(f"  ✓ Retrieved {len(metrics.get('metrics', []))} metrics")
    for metric in metrics.get('metrics', [])[:5]:
        print(f"    - {metric['name']}: {metric['value']} ({metric['type']})")

    # Execute PromQL query
    print("  🔍 Running PromQL query...")
    prom_result = await client.observability.query_prometheus(
        query='rate(ml_inference_total[5m])'
    )
    print(f"  ✓ Inference rate: {prom_result.get('data', {}).get('value', 'N/A')}")

    # View distributed traces
    print("  🔗 Fetching distributed traces...")
    traces = await client.observability.get_traces(
        service='ml-service',
        min_duration=50,
        limit=5
    )
    print(f"  ✓ Found {len(traces.get('traces', []))} traces")
    for trace in traces.get('traces', [])[:3]:
        print(f"    - {trace['operation']}: {trace['duration_ms']}ms ({trace['span_count']} spans)")

    # Check alerts
    print("  🚨 Checking active alerts...")
    alerts = await client.observability.get_alerts(severity='critical')
    if alerts.get('alerts'):
        print(f"  ⚠️  {len(alerts['alerts'])} critical alerts active")
        for alert in alerts['alerts'][:3]:
            print(f"    - {alert['name']}: {alert['message']}")
    else:
        print("  ✓ No critical alerts")

    # Get dashboard info
    print("  📊 Accessing Grafana dashboards...")
    for dashboard_name in ['inference', 'cache', 'etl']:
        dashboard = await client.observability.get_dashboard(dashboard_name)
        print(f"    - {dashboard_name.upper()}: {dashboard.get('grafana_url', 'N/A')}")

    # ============================================================
    # PHASE 5: Infrastructure Status (Kubernetes)
    # ============================================================
    print("\n[Phase 5] Infrastructure Status")
    print("-" * 60)

    # Get service health
    print("  🏥 Checking service health...")
    health = await client.observability.get_service_health()
    for service_name, service_health in health.items():
        status_icon = "✓" if service_health.get('status') == 'healthy' else "✗"
        print(f"    {status_icon} {service_name}: {service_health.get('status')}")
        print(f"      Uptime: {service_health.get('uptime_seconds', 0)}s")
        print(f"      Replicas: {service_health.get('replicas', 'N/A')}")

    # Get HPA status (auto-scaling)
    print("  📊 Auto-scaling status...")
    try:
        monitoring = await client.monitoring.status()
        if 'hpa' in monitoring:
            print(f"    Gateway: {monitoring['hpa']['gateway']['current_replicas']}/{monitoring['hpa']['gateway']['max_replicas']} replicas")
            print(f"    ML Service: {monitoring['hpa']['ml_service']['current_replicas']}/{monitoring['hpa']['ml_service']['max_replicas']} replicas")
    except:
        print("    HPA metrics not available (may require Kubernetes deployment)")

    # ============================================================
    # Summary
    # ============================================================
    print("\n" + "=" * 60)
    print("INTEGRATION TEST COMPLETE")
    print("=" * 60)
    print("\n✓ Phase 1: Multi-format ETL processing")
    print("✓ Phase 2: Model registry & hot reload")
    print("✓ Phase 3: L1/L2 caching & edge routing")
    print("✓ Phase 4: Observability (Prometheus + Jaeger)")
    print("✓ Phase 5: Infrastructure health checks")
    print("\nAll phases integrated successfully!")

    await client.close()

if __name__ == "__main__":
    asyncio.run(main())
