"""
Testing and Migration Utilities

This module provides utilities for running both legacy and new code paths
and comparing their results. Perfect for A/B testing, canary deployments,
and migration validation.

Usage:
    # Your requested pattern
    if app.config['TESTING_MODE']:
        old_result = legacy_process_data(data)
        new_result = secure_process_data(data)
        compare_results(old_result, new_result)
"""

import asyncio
import time
import logging
import traceback
from typing import Dict, Any, Optional, List, Callable, Tuple, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import json
import hashlib
from enum import Enum

from app.core.api_config import settings

logger = logging.getLogger(__name__)


class ComparisonResult(str, Enum):
    """Result types for comparison"""
    IDENTICAL = "identical"
    DIFFERENT = "different"
    ERROR_LEGACY = "error_legacy"
    ERROR_NEW = "error_new"
    ERROR_BOTH = "error_both"
    TIMEOUT = "timeout"


@dataclass
class ExecutionResult:
    """Result of executing a code path"""
    result: Any = None
    error: Optional[str] = None
    execution_time_ms: float = 0.0
    success: bool = True
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class ComparisonReport:
    """Detailed comparison report"""
    legacy_result: ExecutionResult
    new_result: ExecutionResult
    comparison: ComparisonResult
    differences: List[Dict[str, Any]]
    similarity_score: float
    timestamp: datetime
    test_id: str
    operation_name: str
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/storage"""
        return {
            'legacy_result': asdict(self.legacy_result),
            'new_result': asdict(self.new_result),
            'comparison': self.comparison.value,
            'differences': self.differences,
            'similarity_score': self.similarity_score,
            'timestamp': self.timestamp.isoformat(),
            'test_id': self.test_id,
            'operation_name': self.operation_name
        }


# ============================================================================
# CORE TESTING FUNCTIONS
# ============================================================================

def is_testing_mode() -> bool:
    """Check if testing mode is enabled"""
    return settings.TESTING_MODE


def should_run_comparison(sample_rate: Optional[float] = None) -> bool:
    """
    Determine if comparison should run based on sampling rate.
    
    Args:
        sample_rate: Override default sampling rate (0.0-100.0)
    
    Returns:
        bool: True if comparison should run
    """
    if not is_testing_mode():
        return False
    
    if sample_rate is None:
        sample_rate = settings.TESTING_CONFIG['sample_percentage']
    
    import random
    return random.random() * 100 < sample_rate


async def execute_with_timeout(
    func: Callable,
    args: Tuple = (),
    kwargs: Dict[str, Any] = None,
    timeout_seconds: int = None
) -> ExecutionResult:
    """
    Execute a function with timeout and error handling.
    
    Args:
        func: Function to execute
        args: Function arguments
        kwargs: Function keyword arguments
        timeout_seconds: Timeout in seconds
    
    Returns:
        ExecutionResult with timing and error information
    """
    if kwargs is None:
        kwargs = {}
    
    if timeout_seconds is None:
        timeout_seconds = settings.TESTING_CONFIG['comparison_timeout_seconds']
    
    start_time = time.time()
    
    try:
        if asyncio.iscoroutinefunction(func):
            result = await asyncio.wait_for(
                func(*args, **kwargs),
                timeout=timeout_seconds
            )
        else:
            result = func(*args, **kwargs)
        
        execution_time = (time.time() - start_time) * 1000
        
        return ExecutionResult(
            result=result,
            success=True,
            execution_time_ms=execution_time,
            metadata={'function': func.__name__}
        )
    
    except asyncio.TimeoutError:
        execution_time = (time.time() - start_time) * 1000
        error_msg = f"Function {func.__name__} timed out after {timeout_seconds}s"
        logger.warning(error_msg)
        
        return ExecutionResult(
            success=False,
            error=error_msg,
            execution_time_ms=execution_time,
            metadata={'function': func.__name__, 'timeout': True}
        )
    
    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        error_msg = f"Function {func.__name__} failed: {str(e)}"
        logger.error(f"{error_msg}\n{traceback.format_exc()}")
        
        return ExecutionResult(
            success=False,
            error=error_msg,
            execution_time_ms=execution_time,
            metadata={
                'function': func.__name__,
                'exception_type': type(e).__name__,
                'traceback': traceback.format_exc()
            }
        )


def compare_results(
    legacy_result: Any,
    new_result: Any,
    operation_name: str = "operation",
    tolerance: float = None
) -> ComparisonReport:
    """
    Compare results from legacy and new code paths.
    
    Args:
        legacy_result: Result from legacy code
        new_result: Result from new code  
        operation_name: Name of the operation being tested
        tolerance: Tolerance for numeric comparisons
    
    Returns:
        ComparisonReport with detailed comparison results
    """
    if tolerance is None:
        tolerance = settings.TESTING_CONFIG['max_difference_threshold']
    
    test_id = hashlib.md5(
        f"{operation_name}_{datetime.now().isoformat()}".encode()
    ).hexdigest()[:8]
    
    # Handle execution results
    if isinstance(legacy_result, ExecutionResult):
        legacy_exec = legacy_result
        legacy_data = legacy_result.result
    else:
        legacy_exec = ExecutionResult(result=legacy_result, success=True)
        legacy_data = legacy_result
    
    if isinstance(new_result, ExecutionResult):
        new_exec = new_result
        new_data = new_result.result
    else:
        new_exec = ExecutionResult(result=new_result, success=True)
        new_data = new_result
    
    # Determine comparison result
    if not legacy_exec.success and not new_exec.success:
        comparison = ComparisonResult.ERROR_BOTH
    elif not legacy_exec.success:
        comparison = ComparisonResult.ERROR_LEGACY
    elif not new_exec.success:
        comparison = ComparisonResult.ERROR_NEW
    else:
        # Both succeeded, compare actual results
        differences = _find_differences(legacy_data, new_data, tolerance)
        if not differences:
            comparison = ComparisonResult.IDENTICAL
        else:
            comparison = ComparisonResult.DIFFERENT
    
    # Calculate similarity score
    similarity_score = _calculate_similarity(legacy_data, new_data, tolerance)
    
    # Find detailed differences
    if comparison == ComparisonResult.DIFFERENT:
        differences = _find_differences(legacy_data, new_data, tolerance)
    else:
        differences = []
    
    report = ComparisonReport(
        legacy_result=legacy_exec,
        new_result=new_exec,
        comparison=comparison,
        differences=differences,
        similarity_score=similarity_score,
        timestamp=datetime.now(),
        test_id=test_id,
        operation_name=operation_name
    )
    
    # Log the comparison
    _log_comparison_result(report)
    
    return report


def _find_differences(
    legacy_data: Any,
    new_data: Any,
    tolerance: float = 0.05
) -> List[Dict[str, Any]]:
    """Find differences between two data structures"""
    differences = []
    
    try:
        if type(legacy_data) != type(new_data):
            differences.append({
                'type': 'type_mismatch',
                'legacy_type': str(type(legacy_data)),
                'new_type': str(type(new_data)),
                'path': 'root'
            })
            return differences
        
        if isinstance(legacy_data, dict) and isinstance(new_data, dict):
            differences.extend(_compare_dicts(legacy_data, new_data, tolerance))
        elif isinstance(legacy_data, (list, tuple)) and isinstance(new_data, (list, tuple)):
            differences.extend(_compare_lists(legacy_data, new_data, tolerance))
        elif isinstance(legacy_data, (int, float)) and isinstance(new_data, (int, float)):
            if abs(legacy_data - new_data) > tolerance:
                differences.append({
                    'type': 'numeric_difference',
                    'legacy_value': legacy_data,
                    'new_value': new_data,
                    'difference': abs(legacy_data - new_data),
                    'path': 'root'
                })
        elif legacy_data != new_data:
            differences.append({
                'type': 'value_difference',
                'legacy_value': legacy_data,
                'new_value': new_data,
                'path': 'root'
            })
    
    except Exception as e:
        differences.append({
            'type': 'comparison_error',
            'error': str(e),
            'path': 'root'
        })
    
    return differences


def _compare_dicts(legacy_dict: dict, new_dict: dict, tolerance: float, path: str = "") -> List[Dict[str, Any]]:
    """Compare two dictionaries recursively"""
    differences = []
    
    all_keys = set(legacy_dict.keys()) | set(new_dict.keys())
    
    for key in all_keys:
        current_path = f"{path}.{key}" if path else key
        
        if key not in legacy_dict:
            differences.append({
                'type': 'missing_in_legacy',
                'key': key,
                'new_value': new_dict[key],
                'path': current_path
            })
        elif key not in new_dict:
            differences.append({
                'type': 'missing_in_new',
                'key': key,
                'legacy_value': legacy_dict[key],
                'path': current_path
            })
        else:
            differences.extend(_find_differences(
                legacy_dict[key], 
                new_dict[key], 
                tolerance
            ))
    
    return differences


def _compare_lists(legacy_list: list, new_list: list, tolerance: float, path: str = "") -> List[Dict[str, Any]]:
    """Compare two lists"""
    differences = []
    
    if len(legacy_list) != len(new_list):
        differences.append({
            'type': 'length_difference',
            'legacy_length': len(legacy_list),
            'new_length': len(new_list),
            'path': path
        })
    
    min_length = min(len(legacy_list), len(new_list))
    for i in range(min_length):
        current_path = f"{path}[{i}]" if path else f"[{i}]"
        differences.extend(_find_differences(
            legacy_list[i],
            new_list[i],
            tolerance
        ))
    
    return differences


def _calculate_similarity(legacy_data: Any, new_data: Any, tolerance: float) -> float:
    """Calculate similarity score between two data structures (0.0 - 1.0)"""
    try:
        differences = _find_differences(legacy_data, new_data, tolerance)
        if not differences:
            return 1.0
        
        # Simple scoring: fewer differences = higher similarity
        max_possible_differences = _estimate_max_differences(legacy_data)
        if max_possible_differences == 0:
            return 1.0
        
        similarity = max(0.0, 1.0 - (len(differences) / max_possible_differences))
        return similarity
    
    except Exception:
        return 0.0


def _estimate_max_differences(data: Any) -> int:
    """Estimate maximum possible differences for similarity calculation"""
    if isinstance(data, dict):
        return len(data) + sum(_estimate_max_differences(v) for v in data.values())
    elif isinstance(data, (list, tuple)):
        return len(data) + sum(_estimate_max_differences(item) for item in data)
    else:
        return 1


def _log_comparison_result(report: ComparisonReport) -> None:
    """Log comparison results"""
    if settings.TESTING_CONFIG['log_differences']:
        if report.comparison == ComparisonResult.IDENTICAL:
            logger.info(f" Test {report.test_id}: {report.operation_name} - Results identical")
        elif report.comparison == ComparisonResult.DIFFERENT:
            logger.warning(
                f" Test {report.test_id}: {report.operation_name} - "
                f"Found {len(report.differences)} differences "
                f"(similarity: {report.similarity_score:.2%})"
            )
            for diff in report.differences[:5]:  # Log first 5 differences
                logger.warning(f"   Difference: {diff}")
        else:
            logger.error(f" Test {report.test_id}: {report.operation_name} - {report.comparison.value}")


# ============================================================================
# HIGH-LEVEL TESTING FUNCTIONS
# ============================================================================

async def run_dual_path_test(
    legacy_func: Callable,
    new_func: Callable,
    args: Tuple = (),
    kwargs: Dict[str, Any] = None,
    operation_name: str = "dual_path_test"
) -> ComparisonReport:
    """
    Run both legacy and new functions and compare results.
    
    This implements your exact requested pattern:
    if app.config['TESTING_MODE']:
        old_result = legacy_process_data(data)
        new_result = secure_process_data(data)
        compare_results(old_result, new_result)
    
    Args:
        legacy_func: Legacy function to test
        new_func: New function to test
        args: Arguments for both functions
        kwargs: Keyword arguments for both functions
        operation_name: Name for logging/identification
    
    Returns:
        ComparisonReport with detailed results
    """
    if kwargs is None:
        kwargs = {}
    
    if not should_run_comparison():
        # Just run the new function if not in testing mode
        result = await execute_with_timeout(new_func, args, kwargs)
        return ComparisonReport(
            legacy_result=ExecutionResult(success=False, error="Skipped - not in testing mode"),
            new_result=result,
            comparison=ComparisonResult.ERROR_LEGACY,
            differences=[],
            similarity_score=0.0,
            timestamp=datetime.now(),
            test_id="skipped",
            operation_name=operation_name
        )
    
    logger.info(f" Running dual path test: {operation_name}")
    
    # Run both functions
    if settings.TESTING_CONFIG['run_legacy_code']:
        legacy_result = await execute_with_timeout(legacy_func, args, kwargs)
    else:
        legacy_result = ExecutionResult(success=False, error="Legacy code disabled in config")
    
    if settings.TESTING_CONFIG['run_new_code']:
        new_result = await execute_with_timeout(new_func, args, kwargs)
    else:
        new_result = ExecutionResult(success=False, error="New code disabled in config")
    
    # Compare results
    report = compare_results(legacy_result, new_result, operation_name)
    
    # Handle failures if configured
    if (settings.TESTING_CONFIG['fail_on_differences'] and 
        report.comparison == ComparisonResult.DIFFERENT):
        raise Exception(f"Test failed: Found differences in {operation_name}")
    
    return report


def legacy_process_data(data: Dict[str, Any], options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Legacy data processing function (placeholder).
    
    This represents your old code path without security features.
    """
    if options is None:
        options = {}
    
    # Simulate legacy processing (simple, no security)
    processed_data = {}
    
    for key, value in data.items():
        if isinstance(value, str):
            processed_data[key] = value.strip()
        else:
            processed_data[key] = value
    
    return {
        'data': processed_data,
        'processed_fields': len(data),
        'method': 'legacy',
        'security_applied': False
    }


async def secure_process_data(
    data: Dict[str, Any], 
    options: Dict[str, Any] = None,
    user: Any = None,
    session: Any = None
) -> Dict[str, Any]:
    """
    New secure data processing function.
    
    This represents your new code path with security features.
    """
    from app.core.security_utils import (
        apply_encryption_if_enabled,
        detect_pii_if_enabled,
        get_security_config
    )
    
    if options is None:
        options = {}
    
    # Get security configuration
    security_config = get_security_config()
    security_applied = []
    
    # Process data with security
    processed_data = {}
    
    for key, value in data.items():
        if isinstance(value, str):
            processed_data[key] = value.strip()
        else:
            processed_data[key] = value
    
    # Apply security features if enabled
    if security_config['pii_detection']:
        pii_results = detect_pii_if_enabled(processed_data)
        if pii_results and pii_results['has_pii']:
            security_applied.append('pii_detected')
    
    if security_config['encryption']:
        processed_data = apply_encryption_if_enabled(processed_data)
        security_applied.append('encryption_applied')
    
    return {
        'data': processed_data,
        'processed_fields': len(data),
        'method': 'secure',
        'security_applied': True,
        'security_features': security_applied
    }


# ============================================================================
# TESTING DECORATORS
# ============================================================================

def test_with_legacy(legacy_func: Callable):
    """
    Decorator to automatically test new function against legacy function.
    
    Usage:
        @test_with_legacy(old_function)
        def new_function(data):
            return secure_process(data)
    """
    def decorator(new_func: Callable):
        async def wrapper(*args, **kwargs):
            if is_testing_mode():
                # Run dual path test
                report = await run_dual_path_test(
                    legacy_func, new_func, args, kwargs,
                    operation_name=f"{new_func.__name__}_vs_{legacy_func.__name__}"
                )
                
                # Return the new result (or legacy if new failed)
                if report.new_result.success:
                    return report.new_result.result
                elif report.legacy_result.success:
                    logger.warning(f"Using legacy result due to new function failure")
                    return report.legacy_result.result
                else:
                    raise Exception("Both legacy and new functions failed")
            else:
                # Just run new function
                if asyncio.iscoroutinefunction(new_func):
                    return await new_func(*args, **kwargs)
                else:
                    return new_func(*args, **kwargs)
        
        return wrapper
    return decorator


# Export main functions
__all__ = [
    'is_testing_mode',
    'should_run_comparison',
    'run_dual_path_test',
    'compare_results',
    'legacy_process_data',
    'secure_process_data',
    'test_with_legacy',
    'ComparisonReport',
    'ComparisonResult',
    'ExecutionResult'
] 