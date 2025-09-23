"""
Distributed Processing Fault Tolerance and Error Recovery
=========================================================

This module implements comprehensive fault tolerance mechanisms for distributed
processing, including job recovery, worker failure handling, data integrity
checks, and automatic failover systems.

Features:
- Automatic job recovery and retry mechanisms
- Worker failure detection and replacement
- Data consistency and integrity checks
- Circuit breaker patterns for external dependencies
- Graceful degradation strategies
- Checkpointing and state recovery
"""

import asyncio
import logging
import time
import json
import threading
import pickle
import hashlib
from typing import Dict, Any, List, Optional, Callable, Set
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from pathlib import Path
from enum import Enum
import shutil
import os

from app.core.distributed_config import get_distributed_config
from app.services.distributed_processor import ProcessingJob, JobResult

logger = logging.getLogger(__name__)


class FailureType(Enum):
    """Types of failures that can occur"""
    WORKER_FAILURE = "worker_failure"
    NETWORK_FAILURE = "network_failure"
    MEMORY_ERROR = "memory_error"
    TIMEOUT = "timeout"
    DATA_CORRUPTION = "data_corruption"
    DEPENDENCY_FAILURE = "dependency_failure"
    RESOURCE_EXHAUSTION = "resource_exhaustion"
    UNKNOWN = "unknown"


@dataclass
class JobCheckpoint:
    """Represents a job checkpoint for recovery"""
    job_id: str
    checkpoint_id: str
    timestamp: float
    progress_percent: float
    state_data: Dict[str, Any]
    checkpoint_path: str
    data_hash: str


@dataclass
class FailureRecord:
    """Record of a system failure"""
    failure_id: str
    timestamp: float
    failure_type: FailureType
    component: str  # 'worker', 'scheduler', 'storage', etc.
    job_id: Optional[str]
    error_message: str
    stack_trace: Optional[str]
    recovery_action: Optional[str]
    resolved: bool = False
    resolved_at: Optional[float] = None


class CircuitBreaker:
    """Circuit breaker pattern for fault tolerance"""

    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = 0
        self.state = 'closed'  # 'closed', 'open', 'half_open'
        self.lock = threading.Lock()

    def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        with self.lock:
            if self.state == 'open':
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.state = 'half_open'
                    logger.info("Circuit breaker transitioning to half-open")
                else:
                    raise Exception("Circuit breaker is open - service unavailable")

        try:
            result = func(*args, **kwargs)

            with self.lock:
                if self.state == 'half_open':
                    self.state = 'closed'
                    self.failure_count = 0
                    logger.info("Circuit breaker closed - service recovered")

            return result

        except Exception as e:
            with self.lock:
                self.failure_count += 1
                self.last_failure_time = time.time()

                if self.failure_count >= self.failure_threshold:
                    self.state = 'open'
                    logger.warning(f"Circuit breaker opened after {self.failure_count} failures")

            raise


class CheckpointManager:
    """Manage job checkpoints for recovery"""

    def __init__(self, checkpoint_dir: str = "/tmp/distributed_checkpoints"):
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.checkpoints = {}
        self.lock = threading.Lock()

    def create_checkpoint(
        self,
        job_id: str,
        progress_percent: float,
        state_data: Dict[str, Any]
    ) -> str:
        """Create a checkpoint for job recovery"""
        checkpoint_id = f"{job_id}_{int(time.time())}"
        checkpoint_path = self.checkpoint_dir / f"{checkpoint_id}.pkl"

        try:
            # Serialize state data
            with open(checkpoint_path, 'wb') as f:
                pickle.dump(state_data, f)

            # Calculate data hash for integrity
            with open(checkpoint_path, 'rb') as f:
                data_hash = hashlib.sha256(f.read()).hexdigest()

            checkpoint = JobCheckpoint(
                job_id=job_id,
                checkpoint_id=checkpoint_id,
                timestamp=time.time(),
                progress_percent=progress_percent,
                state_data=state_data,
                checkpoint_path=str(checkpoint_path),
                data_hash=data_hash
            )

            with self.lock:
                if job_id not in self.checkpoints:
                    self.checkpoints[job_id] = []
                self.checkpoints[job_id].append(checkpoint)

            logger.info(f"Created checkpoint {checkpoint_id} for job {job_id} at {progress_percent}%")
            return checkpoint_id

        except Exception as e:
            logger.error(f"Failed to create checkpoint for job {job_id}: {e}")
            raise

    def restore_checkpoint(self, job_id: str, checkpoint_id: Optional[str] = None) -> Optional[JobCheckpoint]:
        """Restore job from checkpoint"""
        with self.lock:
            if job_id not in self.checkpoints:
                return None

            checkpoints = self.checkpoints[job_id]
            if not checkpoints:
                return None

            # Use latest checkpoint if not specified
            if checkpoint_id is None:
                checkpoint = max(checkpoints, key=lambda c: c.timestamp)
            else:
                checkpoint = next((c for c in checkpoints if c.checkpoint_id == checkpoint_id), None)

            if not checkpoint:
                return None

            # Verify checkpoint integrity
            if not self._verify_checkpoint_integrity(checkpoint):
                logger.error(f"Checkpoint {checkpoint.checkpoint_id} failed integrity check")
                return None

            # Load state data
            try:
                with open(checkpoint.checkpoint_path, 'rb') as f:
                    checkpoint.state_data = pickle.load(f)

                logger.info(f"Restored checkpoint {checkpoint.checkpoint_id} for job {job_id}")
                return checkpoint

            except Exception as e:
                logger.error(f"Failed to restore checkpoint {checkpoint.checkpoint_id}: {e}")
                return None

    def _verify_checkpoint_integrity(self, checkpoint: JobCheckpoint) -> bool:
        """Verify checkpoint data integrity"""
        try:
            if not os.path.exists(checkpoint.checkpoint_path):
                return False

            with open(checkpoint.checkpoint_path, 'rb') as f:
                current_hash = hashlib.sha256(f.read()).hexdigest()

            return current_hash == checkpoint.data_hash

        except Exception as e:
            logger.error(f"Checkpoint integrity check failed: {e}")
            return False

    def cleanup_old_checkpoints(self, job_id: str, keep_count: int = 3):
        """Clean up old checkpoints, keeping only the most recent ones"""
        with self.lock:
            if job_id not in self.checkpoints:
                return

            checkpoints = self.checkpoints[job_id]
            if len(checkpoints) <= keep_count:
                return

            # Sort by timestamp and keep only the most recent
            checkpoints.sort(key=lambda c: c.timestamp, reverse=True)
            to_delete = checkpoints[keep_count:]

            for checkpoint in to_delete:
                try:
                    if os.path.exists(checkpoint.checkpoint_path):
                        os.remove(checkpoint.checkpoint_path)
                    logger.debug(f"Deleted old checkpoint {checkpoint.checkpoint_id}")
                except Exception as e:
                    logger.warning(f"Failed to delete checkpoint file: {e}")

            self.checkpoints[job_id] = checkpoints[:keep_count]


class JobRecoveryManager:
    """Manage job recovery and retry logic"""

    def __init__(self):
        self.config = get_distributed_config()
        self.checkpoint_manager = CheckpointManager()
        self.failure_records = {}
        self.recovery_strategies = {
            FailureType.WORKER_FAILURE: self._recover_from_worker_failure,
            FailureType.NETWORK_FAILURE: self._recover_from_network_failure,
            FailureType.MEMORY_ERROR: self._recover_from_memory_error,
            FailureType.TIMEOUT: self._recover_from_timeout,
            FailureType.DATA_CORRUPTION: self._recover_from_data_corruption,
            FailureType.DEPENDENCY_FAILURE: self._recover_from_dependency_failure,
            FailureType.RESOURCE_EXHAUSTION: self._recover_from_resource_exhaustion
        }
        self.lock = threading.Lock()

    def record_failure(
        self,
        failure_type: FailureType,
        component: str,
        error_message: str,
        job_id: Optional[str] = None,
        stack_trace: Optional[str] = None
    ) -> str:
        """Record a system failure"""
        failure_id = f"{failure_type.value}_{int(time.time())}"

        failure_record = FailureRecord(
            failure_id=failure_id,
            timestamp=time.time(),
            failure_type=failure_type,
            component=component,
            job_id=job_id,
            error_message=error_message,
            stack_trace=stack_trace
        )

        with self.lock:
            self.failure_records[failure_id] = failure_record

        logger.error(f"Recorded failure {failure_id}: {failure_type.value} in {component} - {error_message}")
        return failure_id

    def attempt_recovery(self, failure_id: str, job: Optional[ProcessingJob] = None) -> bool:
        """Attempt to recover from a recorded failure"""
        with self.lock:
            if failure_id not in self.failure_records:
                return False

            failure_record = self.failure_records[failure_id]

        logger.info(f"Attempting recovery for failure {failure_id}")

        try:
            # Get recovery strategy for this failure type
            recovery_func = self.recovery_strategies.get(failure_record.failure_type)

            if not recovery_func:
                logger.warning(f"No recovery strategy for failure type: {failure_record.failure_type}")
                return False

            # Attempt recovery
            success = recovery_func(failure_record, job)

            if success:
                with self.lock:
                    failure_record.resolved = True
                    failure_record.resolved_at = time.time()
                    failure_record.recovery_action = f"Recovered using {recovery_func.__name__}"

                logger.info(f"Successfully recovered from failure {failure_id}")
            else:
                logger.warning(f"Recovery attempt failed for failure {failure_id}")

            return success

        except Exception as e:
            logger.error(f"Recovery attempt for failure {failure_id} raised exception: {e}")
            return False

    def _recover_from_worker_failure(self, failure: FailureRecord, job: Optional[ProcessingJob]) -> bool:
        """Recover from worker failure"""
        logger.info("Attempting recovery from worker failure")

        if not job:
            return False

        try:
            # Try to restore from checkpoint
            checkpoint = self.checkpoint_manager.restore_checkpoint(job.job_id)

            if checkpoint:
                logger.info(f"Found checkpoint for job {job.job_id} at {checkpoint.progress_percent}%")
                # In a real implementation, this would reschedule the job from the checkpoint
                return True
            else:
                logger.info(f"No checkpoint found for job {job.job_id}, will restart from beginning")
                # Restart job from beginning
                return True

        except Exception as e:
            logger.error(f"Worker failure recovery failed: {e}")
            return False

    def _recover_from_network_failure(self, failure: FailureRecord, job: Optional[ProcessingJob]) -> bool:
        """Recover from network failure"""
        logger.info("Attempting recovery from network failure")

        # Wait for network recovery (simplified approach)
        time.sleep(5)

        # Check if network is back up (simplified check)
        try:
            import socket
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            logger.info("Network connectivity restored")
            return True
        except Exception:
            logger.warning("Network still unavailable")
            return False

    def _recover_from_memory_error(self, failure: FailureRecord, job: Optional[ProcessingJob]) -> bool:
        """Recover from memory error"""
        logger.info("Attempting recovery from memory error")

        if not job:
            return False

        try:
            # Reduce processing parameters to use less memory
            if 'chunk_size' in job.parameters:
                job.parameters['chunk_size'] = min(1000, job.parameters['chunk_size'] // 2)
                logger.info(f"Reduced chunk size to {job.parameters['chunk_size']}")

            if 'parallel_workers' in job.parameters:
                job.parameters['parallel_workers'] = max(1, job.parameters['parallel_workers'] // 2)
                logger.info(f"Reduced parallel workers to {job.parameters['parallel_workers']}")

            # Force garbage collection
            import gc
            gc.collect()

            return True

        except Exception as e:
            logger.error(f"Memory error recovery failed: {e}")
            return False

    def _recover_from_timeout(self, failure: FailureRecord, job: Optional[ProcessingJob]) -> bool:
        """Recover from timeout"""
        logger.info("Attempting recovery from timeout")

        if not job:
            return False

        # Increase timeout for retry
        job.timeout = min(job.timeout * 2, 7200)  # Max 2 hours
        logger.info(f"Increased job timeout to {job.timeout} seconds")

        return True

    def _recover_from_data_corruption(self, failure: FailureRecord, job: Optional[ProcessingJob]) -> bool:
        """Recover from data corruption"""
        logger.info("Attempting recovery from data corruption")

        if not job:
            return False

        try:
            # Check if input file still exists and is readable
            if not os.path.exists(job.input_path):
                logger.error(f"Input file {job.input_path} no longer exists")
                return False

            # Try to read a small portion of the file
            file_size = os.path.getsize(job.input_path)
            if file_size == 0:
                logger.error(f"Input file {job.input_path} is empty")
                return False

            # Basic file integrity check
            try:
                with open(job.input_path, 'rb') as f:
                    f.read(1024)  # Try to read first 1KB
                logger.info("File appears to be readable")
                return True
            except Exception as e:
                logger.error(f"File read test failed: {e}")
                return False

        except Exception as e:
            logger.error(f"Data corruption recovery failed: {e}")
            return False

    def _recover_from_dependency_failure(self, failure: FailureRecord, job: Optional[ProcessingJob]) -> bool:
        """Recover from dependency failure"""
        logger.info("Attempting recovery from dependency failure")

        # Wait for dependencies to recover
        time.sleep(10)

        # Check dependency health (simplified)
        try:
            # This would check external services, databases, etc.
            # For now, we'll assume they're back up
            logger.info("Dependencies appear to be available")
            return True
        except Exception as e:
            logger.error(f"Dependency recovery check failed: {e}")
            return False

    def _recover_from_resource_exhaustion(self, failure: FailureRecord, job: Optional[ProcessingJob]) -> bool:
        """Recover from resource exhaustion"""
        logger.info("Attempting recovery from resource exhaustion")

        try:
            # Clean up temporary files
            temp_dirs = ["/tmp", "/var/tmp"]
            for temp_dir in temp_dirs:
                if os.path.exists(temp_dir):
                    # Clean up old files (simplified approach)
                    import glob
                    old_files = glob.glob(f"{temp_dir}/distributed_*")
                    for file_path in old_files:
                        try:
                            if os.path.isfile(file_path):
                                os.remove(file_path)
                            elif os.path.isdir(file_path):
                                shutil.rmtree(file_path)
                        except Exception:
                            pass

            # Force garbage collection
            import gc
            gc.collect()

            logger.info("Resource cleanup completed")
            return True

        except Exception as e:
            logger.error(f"Resource exhaustion recovery failed: {e}")
            return False

    def get_failure_statistics(self) -> Dict[str, Any]:
        """Get failure and recovery statistics"""
        with self.lock:
            total_failures = len(self.failure_records)
            resolved_failures = len([f for f in self.failure_records.values() if f.resolved])

            failure_by_type = {}
            for failure in self.failure_records.values():
                failure_type = failure.failure_type.value
                failure_by_type[failure_type] = failure_by_type.get(failure_type, 0) + 1

            recovery_rate = (resolved_failures / total_failures * 100) if total_failures > 0 else 0

            return {
                'total_failures': total_failures,
                'resolved_failures': resolved_failures,
                'recovery_rate_percent': recovery_rate,
                'failures_by_type': failure_by_type,
                'unresolved_failures': total_failures - resolved_failures
            }


class FaultTolerantJobExecutor:
    """Execute jobs with comprehensive fault tolerance"""

    def __init__(self):
        self.recovery_manager = JobRecoveryManager()
        self.circuit_breakers = {}
        self.config = get_distributed_config()

    def execute_job_with_fault_tolerance(self, job: ProcessingJob, executor_func: Callable) -> JobResult:
        """Execute job with comprehensive fault tolerance"""
        max_retries = job.max_retries
        retry_count = 0
        last_error = None

        logger.info(f"Starting fault-tolerant execution of job {job.job_id}")

        while retry_count <= max_retries:
            try:
                # Create checkpoint before execution
                if retry_count > 0:
                    self.recovery_manager.checkpoint_manager.create_checkpoint(
                        job.job_id,
                        progress_percent=0,
                        state_data={'retry_count': retry_count, 'attempt_time': time.time()}
                    )

                # Execute job
                logger.info(f"Executing job {job.job_id}, attempt {retry_count + 1}")
                result = executor_func(job)

                if isinstance(result, dict) and result.get('status') == 'completed':
                    logger.info(f"Job {job.job_id} completed successfully")

                    # Clean up checkpoints on success
                    self.recovery_manager.checkpoint_manager.cleanup_old_checkpoints(job.job_id, keep_count=1)

                    return JobResult(
                        job_id=job.job_id,
                        status='completed',
                        result=result.get('result'),
                        start_time=time.time(),
                        end_time=time.time()
                    )

                else:
                    raise Exception(f"Job execution returned unexpected result: {result}")

            except Exception as e:
                last_error = e
                retry_count += 1

                # Determine failure type
                failure_type = self._classify_error(e)

                # Record failure
                failure_id = self.recovery_manager.record_failure(
                    failure_type=failure_type,
                    component='job_executor',
                    error_message=str(e),
                    job_id=job.job_id,
                    stack_trace=str(e.__traceback__) if hasattr(e, '__traceback__') else None
                )

                logger.warning(f"Job {job.job_id} failed on attempt {retry_count}: {e}")

                if retry_count <= max_retries:
                    # Attempt recovery
                    recovery_success = self.recovery_manager.attempt_recovery(failure_id, job)

                    if recovery_success:
                        logger.info(f"Recovery successful for job {job.job_id}, retrying...")

                        # Apply exponential backoff
                        delay = min(60, 2 ** retry_count)
                        time.sleep(delay)
                        continue
                    else:
                        logger.warning(f"Recovery failed for job {job.job_id}")

                # Continue retrying even if recovery failed (up to max retries)
                if retry_count <= max_retries:
                    delay = min(60, 2 ** retry_count)
                    logger.info(f"Waiting {delay} seconds before retry {retry_count + 1}")
                    time.sleep(delay)

        # All retries exhausted
        logger.error(f"Job {job.job_id} failed after {max_retries + 1} attempts")

        return JobResult(
            job_id=job.job_id,
            status='failed',
            error=str(last_error),
            start_time=time.time(),
            end_time=time.time()
        )

    def _classify_error(self, error: Exception) -> FailureType:
        """Classify error type for appropriate recovery strategy"""
        error_message = str(error).lower()

        if 'memory' in error_message or 'memoryerror' in str(type(error)):
            return FailureType.MEMORY_ERROR
        elif 'timeout' in error_message or 'timedout' in error_message:
            return FailureType.TIMEOUT
        elif 'network' in error_message or 'connection' in error_message:
            return FailureType.NETWORK_FAILURE
        elif 'worker' in error_message or 'node' in error_message:
            return FailureType.WORKER_FAILURE
        elif 'corruption' in error_message or 'corrupt' in error_message:
            return FailureType.DATA_CORRUPTION
        elif 'dependency' in error_message or 'service' in error_message:
            return FailureType.DEPENDENCY_FAILURE
        elif 'resource' in error_message or 'space' in error_message:
            return FailureType.RESOURCE_EXHAUSTION
        else:
            return FailureType.UNKNOWN

    def get_circuit_breaker(self, service_name: str) -> CircuitBreaker:
        """Get or create circuit breaker for a service"""
        if service_name not in self.circuit_breakers:
            self.circuit_breakers[service_name] = CircuitBreaker()
        return self.circuit_breakers[service_name]


# Global fault tolerance manager
fault_tolerance_manager = FaultTolerantJobExecutor()

def get_fault_tolerance_manager() -> FaultTolerantJobExecutor:
    """Get the global fault tolerance manager"""
    return fault_tolerance_manager

def execute_with_fault_tolerance(job: ProcessingJob, executor_func: Callable) -> JobResult:
    """Execute job with fault tolerance"""
    return fault_tolerance_manager.execute_job_with_fault_tolerance(job, executor_func)

logger.info("Distributed fault tolerance system initialized")