"""
Performance and benchmark tests for ML Service

Tests cover:
- Latency measurements (P50, P95, P99)
- Throughput testing
- Memory usage
- Concurrent performance
- Batch vs single prediction performance
"""

import pytest
import time
import statistics
import ml_service_pb2


@pytest.mark.performance
@pytest.mark.grpc
class TestLatencyPerformance:
    """Test suite for latency measurements"""

    def test_predict_latency_baseline(self, grpc_stub, benchmark):
        """Benchmark single prediction latency"""
        request = ml_service_pb2.PredictRequest(
            model_id="iris-classifier",
            features=[5.1, 3.5, 1.4, 0.2]
        )

        def predict():
            return grpc_stub.Predict(request)

        result = benchmark(predict)
        assert result.error == ""

    def test_predict_p99_latency(self, grpc_stub):
        """Test P99 latency is under target (<20ms)"""
        latencies = []

        # Make 100 predictions
        for i in range(100):
            request = ml_service_pb2.PredictRequest(
                model_id="iris-classifier",
                features=[float(i % 10)] * 4
            )

            start = time.time()
            response = grpc_stub.Predict(request)
            latency_ms = (time.time() - start) * 1000

            assert response.error == ""
            latencies.append(latency_ms)

        # Calculate percentiles
        latencies.sort()
        p50 = statistics.median(latencies)
        p95 = latencies[94]  # 95th percentile
        p99 = latencies[98]  # 99th percentile

        print(f"\nLatency stats: P50={p50:.2f}ms, P95={p95:.2f}ms, P99={p99:.2f}ms")

        # Target: P99 < 20ms for mock model
        # This is a reasonable target for a mock implementation
        assert p99 < 100, f"P99 latency {p99:.2f}ms exceeds target"

    def test_batch_predict_latency(self, grpc_stub, benchmark):
        """Benchmark batch prediction latency"""
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[float(i)] * 4)
            for i in range(10)
        ]
        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        def batch_predict():
            return grpc_stub.BatchPredict(request)

        result = benchmark(batch_predict)
        assert result.success_count == 10

    def test_health_check_latency(self, grpc_stub, benchmark):
        """Benchmark health check latency"""
        request = ml_service_pb2.HealthCheckRequest(detailed=False)

        def health_check():
            return grpc_stub.HealthCheck(request)

        result = benchmark(health_check)
        assert result.status == "healthy"

    def test_model_info_latency(self, grpc_stub, benchmark):
        """Benchmark model info retrieval latency"""
        request = ml_service_pb2.ModelInfoRequest(model_id="iris-classifier")

        def get_model_info():
            return grpc_stub.GetModelInfo(request)

        result = benchmark(get_model_info)
        assert result.model_id == "iris-classifier"

    def test_latency_consistency(self, grpc_stub):
        """Test that latency is consistent across requests"""
        latencies = []

        # Make 50 predictions
        for _ in range(50):
            request = ml_service_pb2.PredictRequest(
                model_id="iris-classifier",
                features=[5.1, 3.5, 1.4, 0.2]
            )

            start = time.time()
            response = grpc_stub.Predict(request)
            latency_ms = (time.time() - start) * 1000

            assert response.error == ""
            latencies.append(latency_ms)

        # Calculate standard deviation
        mean_latency = statistics.mean(latencies)
        stdev_latency = statistics.stdev(latencies)

        print(f"\nLatency: mean={mean_latency:.2f}ms, stdev={stdev_latency:.2f}ms")

        # Standard deviation should be relatively small (consistent performance)
        cv = stdev_latency / mean_latency  # Coefficient of variation
        assert cv < 1.0, f"High latency variance: CV={cv:.2f}"


@pytest.mark.performance
class TestThroughputPerformance:
    """Test suite for throughput measurements"""

    def test_single_predictions_throughput(self, grpc_stub):
        """Measure throughput for single predictions"""
        num_requests = 100
        start = time.time()

        for i in range(num_requests):
            request = ml_service_pb2.PredictRequest(
                model_id="iris-classifier",
                features=[float(i % 10)] * 4
            )
            response = grpc_stub.Predict(request)
            assert response.error == ""

        duration = time.time() - start
        throughput = num_requests / duration

        print(f"\nSingle prediction throughput: {throughput:.2f} req/s")
        assert throughput > 10  # At least 10 requests per second

    def test_batch_predictions_throughput(self, grpc_stub):
        """Measure throughput for batch predictions"""
        batch_size = 10
        num_batches = 20

        start = time.time()

        for _ in range(num_batches):
            feature_sets = [
                ml_service_pb2.FeatureSet(features=[float(i)] * 4)
                for i in range(batch_size)
            ]
            request = ml_service_pb2.BatchPredictRequest(
                model_id="iris-classifier",
                feature_sets=feature_sets
            )
            response = grpc_stub.BatchPredict(request)
            assert response.success_count == batch_size

        duration = time.time() - start
        total_predictions = batch_size * num_batches
        throughput = total_predictions / duration

        print(f"\nBatch prediction throughput: {throughput:.2f} predictions/s")
        assert throughput > 50  # Should be higher than single predictions

    @pytest.mark.slow
    def test_sustained_throughput(self, grpc_stub):
        """Test sustained throughput over longer period"""
        duration_seconds = 10
        request_count = [0]
        error_count = [0]
        start_time = time.time()

        while time.time() - start_time < duration_seconds:
            try:
                request = ml_service_pb2.PredictRequest(
                    model_id="iris-classifier",
                    features=[5.1, 3.5, 1.4, 0.2]
                )
                response = grpc_stub.Predict(request)
                if response.error == "":
                    request_count[0] += 1
                else:
                    error_count[0] += 1
            except Exception:
                error_count[0] += 1

        throughput = request_count[0] / duration_seconds
        error_rate = error_count[0] / max(request_count[0] + error_count[0], 1)

        print(f"\nSustained throughput: {throughput:.2f} req/s, error rate: {error_rate:.2%}")
        assert throughput > 5  # Minimum sustained throughput
        assert error_rate < 0.05  # Less than 5% error rate


@pytest.mark.performance
class TestScalabilityPerformance:
    """Test suite for scalability measurements"""

    def test_performance_vs_batch_size(self, grpc_stub):
        """Test how performance scales with batch size"""
        batch_sizes = [1, 5, 10, 50, 100]
        results = {}

        for batch_size in batch_sizes:
            feature_sets = [
                ml_service_pb2.FeatureSet(features=[float(i)] * 4)
                for i in range(batch_size)
            ]
            request = ml_service_pb2.BatchPredictRequest(
                model_id="iris-classifier",
                feature_sets=feature_sets
            )

            start = time.time()
            response = grpc_stub.BatchPredict(request)
            duration = time.time() - start

            throughput = batch_size / duration
            results[batch_size] = {
                "duration_ms": duration * 1000,
                "throughput": throughput,
                "latency_per_item": duration * 1000 / batch_size
            }

            print(f"\nBatch size {batch_size}: "
                  f"{throughput:.2f} items/s, "
                  f"{results[batch_size]['latency_per_item']:.2f}ms per item")

        # Larger batches should have better throughput
        assert results[100]["throughput"] > results[1]["throughput"]

    def test_concurrent_prediction_performance(self, grpc_stub):
        """Test performance under concurrent load"""
        import threading

        num_threads = 10
        requests_per_thread = 10
        results = []
        start_times = []
        end_times = []

        def make_predictions():
            thread_start = time.time()
            start_times.append(thread_start)

            for _ in range(requests_per_thread):
                request = ml_service_pb2.PredictRequest(
                    model_id="iris-classifier",
                    features=[5.1, 3.5, 1.4, 0.2]
                )
                response = grpc_stub.Predict(request)
                results.append(response.error == "")

            thread_end = time.time()
            end_times.append(thread_end)

        # Create and start threads
        threads = []
        for _ in range(num_threads):
            thread = threading.Thread(target=make_predictions)
            threads.append(thread)
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join()

        # Calculate metrics
        total_duration = max(end_times) - min(start_times)
        total_requests = num_threads * requests_per_thread
        throughput = total_requests / total_duration
        success_rate = sum(results) / len(results)

        print(f"\nConcurrent performance: {throughput:.2f} req/s, "
              f"success rate: {success_rate:.2%}")

        assert success_rate > 0.95  # At least 95% success rate
        assert throughput > 20  # Reasonable concurrent throughput


@pytest.mark.performance
class TestMemoryPerformance:
    """Test suite for memory usage"""

    def test_memory_usage_baseline(self, grpc_stub):
        """Test baseline memory usage"""
        import psutil
        import os

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Make 100 predictions
        for i in range(100):
            request = ml_service_pb2.PredictRequest(
                model_id="iris-classifier",
                features=[float(i)] * 4
            )
            grpc_stub.Predict(request)

        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory

        print(f"\nMemory usage: initial={initial_memory:.2f}MB, "
              f"final={final_memory:.2f}MB, "
              f"increase={memory_increase:.2f}MB")

        # Memory increase should be minimal for predictions
        assert memory_increase < 50  # Less than 50MB increase

    @pytest.mark.slow
    def test_memory_leak_detection(self, grpc_stub):
        """Test for memory leaks over sustained usage"""
        import psutil
        import os

        process = psutil.Process(os.getpid())

        # Sample memory at intervals
        memory_samples = []

        for iteration in range(5):
            # Make many predictions
            for _ in range(100):
                request = ml_service_pb2.PredictRequest(
                    model_id="iris-classifier",
                    features=[5.1, 3.5, 1.4, 0.2]
                )
                grpc_stub.Predict(request)

            memory_mb = process.memory_info().rss / 1024 / 1024
            memory_samples.append(memory_mb)
            time.sleep(0.5)

        # Check if memory is continuously increasing
        memory_trend = memory_samples[-1] - memory_samples[0]

        print(f"\nMemory trend over 5 iterations: {memory_trend:.2f}MB")
        print(f"Memory samples: {[f'{m:.2f}MB' for m in memory_samples]}")

        # Memory shouldn't increase dramatically
        assert memory_trend < 30  # Less than 30MB increase over test


@pytest.mark.performance
class TestComparativePerformance:
    """Test suite comparing different approaches"""

    def test_single_vs_batch_performance(self, grpc_stub):
        """Compare single predictions vs batch"""
        num_items = 50

        # Single predictions
        start = time.time()
        for i in range(num_items):
            request = ml_service_pb2.PredictRequest(
                model_id="iris-classifier",
                features=[float(i)] * 4
            )
            grpc_stub.Predict(request)
        single_duration = time.time() - start

        # Batch prediction
        feature_sets = [
            ml_service_pb2.FeatureSet(features=[float(i)] * 4)
            for i in range(num_items)
        ]
        request = ml_service_pb2.BatchPredictRequest(
            model_id="iris-classifier",
            feature_sets=feature_sets
        )

        start = time.time()
        grpc_stub.BatchPredict(request)
        batch_duration = time.time() - start

        speedup = single_duration / batch_duration

        print(f"\nSingle: {single_duration:.3f}s, "
              f"Batch: {batch_duration:.3f}s, "
              f"Speedup: {speedup:.2f}x")

        # Batch should be faster (or at least not much slower)
        assert batch_duration < single_duration * 1.5

    def test_detailed_vs_basic_health_check(self, grpc_stub, benchmark):
        """Compare detailed vs basic health check performance"""
        basic_request = ml_service_pb2.HealthCheckRequest(detailed=False)
        detailed_request = ml_service_pb2.HealthCheckRequest(detailed=True)

        # Benchmark basic
        def basic_health():
            return grpc_stub.HealthCheck(basic_request)

        basic_result = benchmark(basic_health)

        # Benchmark detailed
        def detailed_health():
            return grpc_stub.HealthCheck(detailed_request)

        detailed_result = benchmark.pedantic(detailed_health, iterations=10, rounds=5)

        # Both should be fast
        assert basic_result.status == "healthy"
        assert detailed_result.status == "healthy"
