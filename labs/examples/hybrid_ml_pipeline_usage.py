#!/usr/bin/env python3
"""
Example usage of Schlep-Engine Hybrid ML Pipeline
Demonstrates batch + streaming dual mode with Rust/Python integration
"""

import asyncio
import requests
from pathlib import Path


# =============================================================================
# Example 1: Batch REST API Upload (Large Dataset)
# =============================================================================

def example_batch_upload():
    """Upload a large dataset via batch REST API"""

    api_url = "http://localhost:8000/api/v1/ingestion/batch/upload"

    # Upload a CSV file
    with open("large_dataset.csv", "rb") as f:
        files = {"file": ("dataset.csv", f, "text/csv")}

        params = {
            "dataset_name": "customer_churn_data",
            "format": "csv",
            "processing_mode": "async",  # async for large files
            "apply_preprocessing": True,
            "deduplication": True
        }

        response = requests.post(api_url, files=files, params=params)

        if response.status_code == 200:
            result = response.json()
            print(f"✓ Batch upload successful!")
            print(f"  Job ID: {result['job_id']}")
            print(f"  Status: {result['status']}")
            print(f"  Rows: {result.get('rows_ingested', 'Processing...')}")

            return result['job_id']


# =============================================================================
# Example 2: Streaming Real-Time Data (NATS/ZeroMQ)
# =============================================================================

async def example_streaming_publish():
    """Publish real-time data via streaming API"""

    api_url = "http://localhost:8000/api/v1/ingestion/stream/publish"

    # Real-time sensor data
    stream_data = {
        "stream_name": "iot_sensors",
        "data": {
            "sensor_id": "temp_001",
            "timestamp": "2025-10-03T10:30:00Z",
            "temperature": 23.5,
            "humidity": 65.2,
            "location": "warehouse_a"
        },
        "protocol": "nats"  # or "zeromq"
    }

    response = requests.post(api_url, json=stream_data)

    if response.status_code == 200:
        result = response.json()
        print(f"✓ Stream message published!")
        print(f"  Status: {result['status']}")
        print(f"  Protocol: {stream_data['protocol']}")


# =============================================================================
# Example 3: Unified API (Auto-Detection)
# =============================================================================

def example_unified_ingestion():
    """Use unified API that auto-detects batch vs streaming"""

    api_url = "http://localhost:8000/api/v1/ingestion/unified/ingest"

    # Unified request
    payload = {
        "mode": "auto",  # auto-detect based on size
        "dataset_name": "sales_transactions",
        "format": "csv",
        "target_framework": "sklearn",  # Convert to scikit-learn format
        "preprocessing_options": {
            "deduplication": True,
            "normalization": True
        }
    }

    # Upload file data
    with open("sales_data.csv", "rb") as f:
        response = requests.post(
            api_url,
            json=payload,
            data=f.read(),
            headers={"content-type": "application/octet-stream"}
        )

        if response.status_code == 200:
            result = response.json()
            print(f"✓ Unified ingestion completed!")
            print(f"  Mode selected: {result['selected_mode']}")
            print(f"  Framework: {payload['target_framework']}")
            print(f"  Result: {result['result']}")


# =============================================================================
# Example 4: Python SDK - High-Level API
# =============================================================================

async def example_python_sdk():
    """Use Python SDK for simplified hybrid pipeline access"""

    from app.hybrid_kernels.rust_bridge import rust_bridge
    from app.hybrid_kernels.ml_adapters import get_framework_data

    # Load and preprocess with Rust
    table = await rust_bridge.load_dataset(
        file_path="messy_data.csv",
        format="csv"
    )

    print(f"✓ Loaded dataset: {table.num_rows} rows, {table.num_columns} columns")

    # Deduplicate with Rust Polars
    clean_table = await rust_bridge.deduplicate(
        file_path="messy_data.csv",
        columns=["user_id", "timestamp"]
    )

    print(f"✓ Deduplicated: {clean_table.num_rows} rows (removed {table.num_rows - clean_table.num_rows})")

    # Convert to scikit-learn format (zero-copy with Arrow)
    X, y = get_framework_data(
        table=clean_table,
        framework="sklearn",
        target_column="target"
    )

    print(f"✓ Converted to NumPy: X.shape={X.shape}, y.shape={y.shape}")

    # Train model
    from sklearn.ensemble import RandomForestClassifier

    model = RandomForestClassifier(n_estimators=100)
    model.fit(X, y)

    print(f"✓ Model trained successfully!")


# =============================================================================
# Example 5: Multi-Framework Support
# =============================================================================

async def example_multi_framework():
    """Convert same dataset to multiple ML frameworks"""

    from app.hybrid_kernels.rust_bridge import rust_bridge
    from app.hybrid_kernels.ml_adapters import UnifiedMLAdapter

    # Load once via Rust
    table = await rust_bridge.load_dataset("ml_dataset.csv", "csv")

    # Convert to scikit-learn
    sklearn_data = UnifiedMLAdapter.from_arrow(table, "sklearn", target_column="label")
    print(f"✓ scikit-learn: {type(sklearn_data)}")

    # Convert to TensorFlow
    tf_dataset = UnifiedMLAdapter.from_arrow(table, "tensorflow", target_column="label")
    print(f"✓ TensorFlow: {type(tf_dataset)}")

    # Convert to PyTorch
    torch_tensors = UnifiedMLAdapter.from_arrow(table, "pytorch", target_column="label")
    print(f"✓ PyTorch: {type(torch_tensors)}")

    # Convert to HuggingFace (zero-copy!)
    hf_dataset = UnifiedMLAdapter.from_arrow(table, "huggingface")
    print(f"✓ HuggingFace: {type(hf_dataset)}")


# =============================================================================
# Example 6: High-Performance Join Operation
# =============================================================================

async def example_high_perf_join():
    """Demonstrate Rust-powered high-performance joins"""

    from app.hybrid_kernels.rust_bridge import rust_bridge

    # Join two large datasets with Rust Polars
    joined_table = await rust_bridge.join_datasets(
        left_path="customers.csv",
        right_path="orders.csv",
        left_on=["customer_id"],
        right_on=["customer_id"],
        how="left",
        format="csv"
    )

    print(f"✓ Joined datasets: {joined_table.num_rows} rows")
    print(f"  Columns: {', '.join(joined_table.column_names)}")

    # Memory usage comparison
    stats = await rust_bridge.get_dataset_stats("customers.csv")
    print(f"  Memory usage: {stats['memory_usage_mb']:.2f} MB")
    print(f"  Target: 70-80% less than pandas equivalent")


# =============================================================================
# Example 7: Real-Time Streaming + ML Inference
# =============================================================================

async def example_streaming_ml_pipeline():
    """Real-time streaming with ML inference"""

    from app.ingestion.stream_gateway import stream_gateway

    # Subscribe to real-time stream
    async for message in stream_gateway.subscribe_to_stream("sensor_data"):
        # Process with Rust kernel (fast tokenization/cleaning)
        # Then run ML inference

        print(f"Received: {message.data}")

        # Simulated ML inference
        prediction = await run_ml_inference(message.data)

        # Publish prediction to results stream
        await stream_gateway.publish_to_stream(
            stream_name="predictions",
            data={"input": message.data, "prediction": prediction}
        )


async def run_ml_inference(data):
    """Simulated ML inference"""
    return {"class": "normal", "confidence": 0.95}


# =============================================================================
# Example 8: Monitoring & Metrics
# =============================================================================

def example_monitoring():
    """Query metrics and monitoring endpoints"""

    # Get system status
    response = requests.get("http://localhost:8000/api/v1/ingestion/unified/status")
    status = response.json()

    print("System Status:")
    print(f"  Rust kernels: {status['components']['rust_kernels']}")
    print(f"  Streaming: {status['components']['streaming']}")
    print(f"  ML frameworks: {', '.join(status['components']['ml_frameworks'])}")
    print(f"  Memory optimization: {status['memory_optimization_target']}")

    # Get Prometheus metrics
    metrics_response = requests.get("http://localhost:8000/metrics")
    print(f"\nPrometheus metrics available: {len(metrics_response.text.splitlines())} lines")

    # Check Grafana dashboard
    print("\nGrafana dashboard: http://localhost:3000/d/hybrid-ml-pipeline")


# =============================================================================
# Main Execution
# =============================================================================

async def main():
    """Run all examples"""

    print("=" * 80)
    print("Schlep-Engine Hybrid ML Pipeline Examples")
    print("=" * 80)

    print("\n1. Batch REST Upload:")
    job_id = example_batch_upload()

    print("\n2. Streaming Publish:")
    await example_streaming_publish()

    print("\n3. Unified API:")
    example_unified_ingestion()

    print("\n4. Python SDK:")
    await example_python_sdk()

    print("\n5. Multi-Framework Support:")
    await example_multi_framework()

    print("\n6. High-Performance Join:")
    await example_high_perf_join()

    print("\n7. Monitoring:")
    example_monitoring()

    print("\n" + "=" * 80)
    print("All examples completed!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
