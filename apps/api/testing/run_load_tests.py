#!/usr/bin/env python3
"""
Load Testing Runner
Execute comprehensive load tests for all Schlep-engine tiers.
"""

import asyncio
import argparse
import logging
import json
from pathlib import Path
from datetime import datetime

from load_testing_framework import (
    LoadTestFramework,
    LoadTestConfig,
    TestType,
    generate_random_json_payload,
    generate_csv_data_payload,
    validate_json_response
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

async def run_api_endpoint_tests(framework: LoadTestFramework, base_url: str):
    """Test individual API endpoints"""
    logger.info("Running API endpoint tests...")

    endpoints = [
        "/api/v1/data",
        "/api/v1/ml-pipeline",
        "/api/v1/stream",
        "/api/v1/storage",
        "/api/health"
    ]

    results = {}

    for endpoint in endpoints:
        test_config = LoadTestConfig(
            test_name=f"endpoint_{endpoint.replace('/', '_').replace('-', '_')}",
            test_type=TestType.BASELINE,
            target_url=f"{base_url}{endpoint}",
            max_concurrent_users=20,
            test_duration_seconds=120,
            ramp_up_duration_seconds=30,
            ramp_down_duration_seconds=30,
            think_time_seconds=0.1,
            payload_generator=lambda: generate_random_json_payload(512),
            validation_function=validate_json_response
        )

        try:
            result = await framework.run_load_test(test_config)
            results[endpoint] = result
            logger.info(f"Completed test for {endpoint}")

        except Exception as e:
            logger.error(f"Failed to test {endpoint}: {e}")

        # Brief pause between endpoint tests
        await asyncio.sleep(10)

    return results

async def run_data_processing_tests(framework: LoadTestFramework, base_url: str):
    """Test data processing capabilities"""
    logger.info("Running data processing tests...")

    test_configs = [
        # Small file processing
        LoadTestConfig(
            test_name="data_processing_small",
            test_type=TestType.BASELINE,
            target_url=f"{base_url}/api/v1/data-processing",
            max_concurrent_users=10,
            test_duration_seconds=300,
            ramp_up_duration_seconds=60,
            ramp_down_duration_seconds=60,
            payload_generator=lambda: generate_csv_data_payload(100),
            think_time_seconds=1.0
        ),

        # Medium file processing
        LoadTestConfig(
            test_name="data_processing_medium",
            test_type=TestType.STRESS,
            target_url=f"{base_url}/api/v1/data-processing",
            max_concurrent_users=5,
            test_duration_seconds=600,
            ramp_up_duration_seconds=120,
            ramp_down_duration_seconds=120,
            payload_generator=lambda: generate_csv_data_payload(1000),
            think_time_seconds=2.0
        ),

        # Large file processing
        LoadTestConfig(
            test_name="data_processing_large",
            test_type=TestType.VOLUME,
            target_url=f"{base_url}/api/v1/data-processing",
            max_concurrent_users=2,
            test_duration_seconds=900,
            ramp_up_duration_seconds=180,
            ramp_down_duration_seconds=180,
            payload_generator=lambda: generate_csv_data_payload(10000),
            think_time_seconds=5.0
        )
    ]

    results = {}

    for config in test_configs:
        try:
            result = await framework.run_load_test(config)
            results[config.test_name] = result
            logger.info(f"Completed {config.test_name}")

        except Exception as e:
            logger.error(f"Failed {config.test_name}: {e}")

        # Pause between tests
        await asyncio.sleep(30)

    return results

async def run_ml_pipeline_tests(framework: LoadTestFramework, base_url: str):
    """Test ML pipeline capabilities"""
    logger.info("Running ML pipeline tests...")

    test_configs = [
        # ML training simulation
        LoadTestConfig(
            test_name="ml_training_load",
            test_type=TestType.BASELINE,
            target_url=f"{base_url}/api/v1/ml/train",
            max_concurrent_users=3,
            test_duration_seconds=600,
            ramp_up_duration_seconds=120,
            ramp_down_duration_seconds=120,
            payload_generator=lambda: {
                "model_type": "sklearn",
                "algorithm": "random_forest",
                "data_size": "medium",
                "parameters": {"n_estimators": 100}
            },
            think_time_seconds=10.0
        ),

        # ML inference load
        LoadTestConfig(
            test_name="ml_inference_load",
            test_type=TestType.STRESS,
            target_url=f"{base_url}/api/v1/ml/predict",
            max_concurrent_users=50,
            test_duration_seconds=300,
            ramp_up_duration_seconds=60,
            ramp_down_duration_seconds=60,
            payload_generator=lambda: {
                "model_id": "test_model",
                "features": [random.uniform(0, 1) for _ in range(10)]
            },
            think_time_seconds=0.1
        )
    ]

    results = {}

    for config in test_configs:
        try:
            result = await framework.run_load_test(config)
            results[config.test_name] = result
            logger.info(f"Completed {config.test_name}")

        except Exception as e:
            logger.error(f"Failed {config.test_name}: {e}")

        await asyncio.sleep(30)

    return results

async def run_streaming_tests(framework: LoadTestFramework, base_url: str):
    """Test streaming capabilities"""
    logger.info("Running streaming tests...")

    # Note: This would typically use WebSocket connections
    # For now, we'll test the streaming API endpoints

    test_configs = [
        # WebSocket connection simulation
        LoadTestConfig(
            test_name="streaming_websocket",
            test_type=TestType.ENDURANCE,
            target_url=f"{base_url}/api/v1/stream/connect",
            max_concurrent_users=25,
            test_duration_seconds=1200,  # 20 minutes
            ramp_up_duration_seconds=300,
            ramp_down_duration_seconds=300,
            payload_generator=lambda: {
                "stream_type": "websocket",
                "topic": "test_stream"
            },
            think_time_seconds=0.5
        ),

        # High-frequency streaming
        LoadTestConfig(
            test_name="streaming_high_frequency",
            test_type=TestType.SPIKE,
            target_url=f"{base_url}/api/v1/stream/publish",
            max_concurrent_users=100,
            test_duration_seconds=180,
            ramp_up_duration_seconds=10,
            ramp_down_duration_seconds=60,
            payload_generator=lambda: {
                "topic": "high_freq_test",
                "data": generate_random_json_payload(256)
            },
            think_time_seconds=0.01
        )
    ]

    results = {}

    for config in test_configs:
        try:
            result = await framework.run_load_test(config)
            results[config.test_name] = result
            logger.info(f"Completed {config.test_name}")

        except Exception as e:
            logger.error(f"Failed {config.test_name}: {e}")

        await asyncio.sleep(30)

    return results

async def generate_comprehensive_report(all_results: dict, output_dir: Path):
    """Generate a comprehensive test report"""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    report_path = output_dir / f"comprehensive_load_test_report_{timestamp}.json"

    # Calculate overall statistics
    all_test_results = []
    for category_results in all_results.values():
        all_test_results.extend(category_results.values())

    if all_test_results:
        total_requests = sum(r.total_requests for r in all_test_results)
        total_successful = sum(r.successful_requests for r in all_test_results)
        avg_response_time = sum(r.avg_response_time_ms for r in all_test_results) / len(all_test_results)
        avg_p95_response_time = sum(r.p95_response_time_ms for r in all_test_results) / len(all_test_results)
        overall_error_rate = (total_requests - total_successful) / total_requests if total_requests > 0 else 0

        summary = {
            "total_tests_run": len(all_test_results),
            "total_requests": total_requests,
            "total_successful_requests": total_successful,
            "overall_success_rate": (total_successful / total_requests * 100) if total_requests > 0 else 0,
            "average_response_time_ms": avg_response_time,
            "average_p95_response_time_ms": avg_p95_response_time,
            "overall_error_rate": overall_error_rate * 100
        }
    else:
        summary = {"message": "No test results to summarize"}

    # Create comprehensive report
    report = {
        "timestamp": timestamp,
        "summary": summary,
        "detailed_results": {
            category: {name: result.__dict__ for name, result in results.items()}
            for category, results in all_results.items()
        }
    }

    # Write report
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)

    logger.info(f"Comprehensive report saved: {report_path}")

    # Print summary to console
    if all_test_results:
        print("\n" + "="*60)
        print("LOAD TESTING SUMMARY")
        print("="*60)
        print(f"Total Tests: {summary['total_tests_run']}")
        print(f"Total Requests: {summary['total_requests']:,}")
        print(f"Success Rate: {summary['overall_success_rate']:.2f}%")
        print(f"Average Response Time: {summary['average_response_time_ms']:.2f}ms")
        print(f"P95 Response Time: {summary['average_p95_response_time_ms']:.2f}ms")
        print(f"Error Rate: {summary['overall_error_rate']:.2f}%")
        print("="*60)

async def main():
    parser = argparse.ArgumentParser(description='Run Schlep-engine load tests')
    parser.add_argument('--base-url', default='http://localhost:8000', help='Base URL for the API')
    parser.add_argument('--api-key', help='API key for authentication')
    parser.add_argument('--tier', choices=['developer', 'growth', 'scale', 'all'], default='all',
                        help='Plan tier to test')
    parser.add_argument('--test-type', choices=['api', 'data', 'ml', 'streaming', 'tier-benchmarks', 'all'],
                        default='all', help='Type of tests to run')
    parser.add_argument('--output-dir', default='./reports/load_testing', help='Output directory for reports')

    args = parser.parse_args()

    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Initialize framework
    framework = LoadTestFramework(base_url=args.base_url, api_key=args.api_key)

    all_results = {}

    try:
        if args.test_type in ['tier-benchmarks', 'all']:
            logger.info("Running tier benchmarks...")

            if args.tier == 'all':
                tiers = ['developer', 'growth', 'scale']
            else:
                tiers = [args.tier]

            for tier in tiers:
                logger.info(f"Running benchmarks for {tier} tier...")
                tier_results = await framework.run_tier_benchmarks(tier)
                all_results[f'{tier}_tier_benchmarks'] = tier_results

        if args.test_type in ['api', 'all']:
            api_results = await run_api_endpoint_tests(framework, args.base_url)
            all_results['api_endpoints'] = api_results

        if args.test_type in ['data', 'all']:
            data_results = await run_data_processing_tests(framework, args.base_url)
            all_results['data_processing'] = data_results

        if args.test_type in ['ml', 'all']:
            ml_results = await run_ml_pipeline_tests(framework, args.base_url)
            all_results['ml_pipeline'] = ml_results

        if args.test_type in ['streaming', 'all']:
            streaming_results = await run_streaming_tests(framework, args.base_url)
            all_results['streaming'] = streaming_results

        # Generate comprehensive report
        await generate_comprehensive_report(all_results, output_dir)

        logger.info("All load tests completed successfully!")

    except KeyboardInterrupt:
        logger.info("Load testing interrupted by user")
    except Exception as e:
        logger.error(f"Load testing failed: {e}")

if __name__ == "__main__":
    import random
    asyncio.run(main())