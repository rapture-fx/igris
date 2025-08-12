#!/usr/bin/env python3
"""
Test script for Background Processing & Scalability Implementation

This script validates all components of the background processing system:
- Celery configuration
- Retry mechanisms
- Monitoring functions
- Task definitions
"""

import sys
import time
import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_celery_configuration():
    """Test Celery configuration and imports"""
    logger.info("Testing Celery configuration...")
    
    try:
        from app.core.celery_app import celery_app
        from app.core.unified_config import settings
        
        # Test configuration
        assert hasattr(celery_app, 'conf'), "Celery app missing configuration"
        assert celery_app.conf.task_time_limit == 7200, "Task time limit not set correctly"
        assert celery_app.conf.task_soft_time_limit == 6600, "Task soft time limit not set correctly"
        assert celery_app.conf.worker_max_tasks_per_child == 500, "Worker max tasks not set correctly"
        
        # Test queue configuration
        queues = celery_app.conf.task_queues
        expected_queues = ['default', 'ai_processing', 'data_processing', 'export', 'notifications', 'monitoring']
        for queue in expected_queues:
            assert queue in queues, f"Queue {queue} not configured"
        
        logger.info("✅ Celery configuration test passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Celery configuration test failed: {e}")
        return False

def test_retry_mechanisms():
    """Test retry configuration and mechanisms"""
    logger.info("Testing retry mechanisms...")
    
    try:
        from app.core.retry_config import (
            RetryConfig, RetryStrategy, FailureType, 
            RetryManager, RETRY_CONFIGS
        )
        
        # Test retry configuration
        config = RetryConfig(
            max_retries=3,
            base_delay=1.0,
            strategy=RetryStrategy.EXPONENTIAL_BACKOFF
        )
        
        # Test delay calculation
        delay1 = config.calculate_delay(1)
        delay2 = config.calculate_delay(2)
        delay3 = config.calculate_delay(3)
        
        assert delay1 > 0, "Delay calculation failed"
        assert delay2 > delay1, "Exponential backoff not working"
        assert delay3 > delay2, "Exponential backoff not working"
        
        # Test failure classification
        class NetworkError(Exception):
            pass
        
        failure_type = config._classify_failure(NetworkError("Connection timeout"))
        assert failure_type == FailureType.NETWORK_ERROR, "Failure classification failed"
        
        # Test predefined configurations
        assert 'network_operations' in RETRY_CONFIGS, "Network operations config missing"
        assert 'database_operations' in RETRY_CONFIGS, "Database operations config missing"
        assert 'api_calls' in RETRY_CONFIGS, "API calls config missing"
        
        logger.info("✅ Retry mechanisms test passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Retry mechanisms test failed: {e}")
        return False

def test_monitoring_functions():
    """Test monitoring functions"""
    logger.info("Testing monitoring functions...")
    
    try:
        from app.core.celery_app import get_worker_health, get_queue_stats, get_task_performance
        
        # Test worker health function
        health = get_worker_health()
        assert isinstance(health, dict), "Worker health should return dict"
        assert 'memory_usage' in health, "Worker health missing memory usage"
        assert 'cpu_usage' in health, "Worker health missing CPU usage"
        assert 'worker_count' in health, "Worker health missing worker count"
        
        # Test queue stats function
        queue_stats = get_queue_stats()
        assert isinstance(queue_stats, dict), "Queue stats should return dict"
        
        # Test task performance function
        task_performance = get_task_performance()
        assert isinstance(task_performance, dict), "Task performance should return dict"
        
        logger.info("✅ Monitoring functions test passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Monitoring functions test failed: {e}")
        return False

def test_task_definitions():
    """Test task definitions and imports"""
    logger.info("Testing task definitions...")
    
    try:
        # Test data processing tasks
        from app.tasks.data_processing_tasks import (
            process_dataset, clean_data, validate_data, 
            analyze_data_with_ai, export_data, cleanup_expired_jobs
        )
        
        # Test export tasks
        from app.tasks.export_tasks import (
            export_dataset_csv, export_dataset_excel, 
            export_dataset_json, export_dataset_parquet, cleanup_old_exports
        )
        
        # Test notification tasks
        from app.tasks.notification_tasks import (
            send_email_notification, send_system_alert,
            send_task_completion_notification, send_error_notification,
            cleanup_old_notifications
        )
        
        # Test monitoring tasks
        from app.tasks.monitoring_tasks import (
            system_health_check, monitor_queue_health,
            performance_metrics_collection, cleanup_old_results
        )
        
        # Verify tasks are Celery tasks
        assert hasattr(process_dataset, 'delay'), "process_dataset not a Celery task"
        assert hasattr(clean_data, 'delay'), "clean_data not a Celery task"
        assert hasattr(export_dataset_csv, 'delay'), "export_dataset_csv not a Celery task"
        assert hasattr(send_email_notification, 'delay'), "send_email_notification not a Celery task"
        assert hasattr(system_health_check, 'delay'), "system_health_check not a Celery task"
        
        logger.info("✅ Task definitions test passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Task definitions test failed: {e}")
        return False

def test_utility_functions():
    """Test utility functions"""
    logger.info("Testing utility functions...")
    
    try:
        from app.tasks.data_processing_tasks import get_task_status, cancel_task
        from app.tasks.export_tasks import get_export_status, cancel_export
        from app.tasks.notification_tasks import get_notification_status, cancel_notification
        from app.tasks.monitoring_tasks import get_monitoring_status, get_system_health_summary
        
        # Test system health summary
        health_summary = get_system_health_summary()
        assert isinstance(health_summary, dict), "Health summary should return dict"
        assert 'timestamp' in health_summary, "Health summary missing timestamp"
        assert 'status' in health_summary, "Health summary missing status"
        
        logger.info("✅ Utility functions test passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Utility functions test failed: {e}")
        return False

def test_retry_decorators():
    """Test retry decorators"""
    logger.info("Testing retry decorators...")
    
    try:
        from app.core.retry_config import (
            retry_network_operation, retry_database_operation,
            retry_api_call, retry_file_operation
        )
        
        # Test decorator application
        @retry_network_operation
        def test_network_function():
            return "success"
        
        @retry_database_operation
        def test_database_function():
            return "success"
        
        @retry_api_call
        def test_api_function():
            return "success"
        
        @retry_file_operation
        def test_file_function():
            return "success"
        
        # Test function execution
        assert test_network_function() == "success", "Network function failed"
        assert test_database_function() == "success", "Database function failed"
        assert test_api_function() == "success", "API function failed"
        assert test_file_function() == "success", "File function failed"
        
        logger.info("✅ Retry decorators test passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Retry decorators test failed: {e}")
        return False

def main():
    """Run all tests"""
    logger.info("Starting Background Processing & Scalability tests...")
    
    tests = [
        ("Celery Configuration", test_celery_configuration),
        ("Retry Mechanisms", test_retry_mechanisms),
        ("Monitoring Functions", test_monitoring_functions),
        ("Task Definitions", test_task_definitions),
        ("Utility Functions", test_utility_functions),
        ("Retry Decorators", test_retry_decorators),
    ]
    
    results = []
    for test_name, test_func in tests:
        logger.info(f"\n{'='*50}")
        logger.info(f"Running {test_name} test...")
        result = test_func()
        results.append((test_name, result))
    
    # Summary
    logger.info(f"\n{'='*50}")
    logger.info("TEST SUMMARY")
    logger.info(f"{'='*50}")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        logger.info(f"{test_name}: {status}")
        if result:
            passed += 1
    
    logger.info(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("🎉 All tests passed! Background processing system is ready.")
        return 0
    else:
        logger.error("❌ Some tests failed. Please check the implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 