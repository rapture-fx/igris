"""
Advanced batch processing and job queue management for Schlep-engine CLI.
Provides sophisticated parallel processing, job scheduling, and queue management.
"""

import os
import sys
import json
import yaml
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional, Union, Callable
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
import time
import pickle
import threading
from queue import Queue, PriorityQueue

import click
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.prompt import Prompt, Confirm
from rich.live import Live
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskID

from ..core.config import Config
from ..core.client import APIClient
from ..core.utils import (
    handle_exceptions, validate_file_path, validate_directory_path,
    format_duration, format_bytes, Timer
)
from ..ui.progress import ProgressTracker, BatchProgressTracker
from ..ui.table import create_table, display_table
from ..ui.spinner import operation_spinner

console = Console()

class JobStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"

class JobPriority(Enum):
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4

@dataclass
class Job:
    """Represents a batch processing job."""
    id: str
    name: str
    command: str
    args: Dict[str, Any]
    priority: JobPriority
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    retry_count: int = 0
    max_retries: int = 3
    timeout: Optional[int] = None
    dependencies: List[str] = None
    tags: List[str] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []
        if self.tags is None:
            self.tags = []
    
    def __lt__(self, other):
        """For priority queue ordering."""
        return self.priority.value > other.priority.value

@dataclass
class QueueStats:
    """Statistics for job queue."""
    total_jobs: int = 0
    pending_jobs: int = 0
    running_jobs: int = 0
    completed_jobs: int = 0
    failed_jobs: int = 0
    cancelled_jobs: int = 0
    avg_processing_time: float = 0
    success_rate: float = 0

class BatchJobManager:
    """Advanced job queue manager for batch processing."""
    
    def __init__(self, max_workers: int = 4, persistence_dir: Optional[Path] = None):
        self.max_workers = max_workers
        self.persistence_dir = persistence_dir or Path.home() / '.schlep-cli' / 'batch_jobs'
        self.persistence_dir.mkdir(parents=True, exist_ok=True)
        
        self.job_queue = PriorityQueue()
        self.active_jobs: Dict[str, Job] = {}
        self.completed_jobs: Dict[str, Job] = {}
        self.job_history: List[Job] = []
        
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.running = False
        self.worker_thread = None
        
        # Load persistent jobs
        self._load_jobs()
    
    def add_job(self, job: Job) -> str:
        """Add a job to the queue."""
        # Check dependencies
        if job.dependencies:
            for dep_id in job.dependencies:
                if dep_id not in self.completed_jobs:
                    # Dependencies not met, keep in pending
                    job.status = JobStatus.PENDING
        
        self.job_queue.put(job)
        self._save_job(job)
        
        console.print(f"[green]Job '{job.name}' added to queue with priority {job.priority.name}[/green]")
        return job.id
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a job."""
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            job.status = JobStatus.CANCELLED
            job.completed_at = datetime.now()
            self.completed_jobs[job_id] = job
            del self.active_jobs[job_id]
            self._save_job(job)
            return True
        return False
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID."""
        if job_id in self.active_jobs:
            return self.active_jobs[job_id]
        elif job_id in self.completed_jobs:
            return self.completed_jobs[job_id]
        return None
    
    def list_jobs(self, status: Optional[JobStatus] = None, tags: Optional[List[str]] = None) -> List[Job]:
        """List jobs with optional filtering."""
        all_jobs = list(self.active_jobs.values()) + list(self.completed_jobs.values())
        
        if status:
            all_jobs = [job for job in all_jobs if job.status == status]
        
        if tags:
            all_jobs = [job for job in all_jobs if any(tag in job.tags for tag in tags)]
        
        return sorted(all_jobs, key=lambda j: j.created_at, reverse=True)
    
    def get_queue_stats(self) -> QueueStats:
        """Get queue statistics."""
        all_jobs = list(self.active_jobs.values()) + list(self.completed_jobs.values())
        
        stats = QueueStats()
        stats.total_jobs = len(all_jobs)
        
        for job in all_jobs:
            if job.status == JobStatus.PENDING:
                stats.pending_jobs += 1
            elif job.status == JobStatus.RUNNING:
                stats.running_jobs += 1
            elif job.status == JobStatus.COMPLETED:
                stats.completed_jobs += 1
            elif job.status == JobStatus.FAILED:
                stats.failed_jobs += 1
            elif job.status == JobStatus.CANCELLED:
                stats.cancelled_jobs += 1
        
        # Calculate success rate
        if stats.completed_jobs + stats.failed_jobs > 0:
            stats.success_rate = stats.completed_jobs / (stats.completed_jobs + stats.failed_jobs) * 100
        
        # Calculate average processing time
        completed_jobs = [j for j in all_jobs if j.status == JobStatus.COMPLETED and j.started_at and j.completed_at]
        if completed_jobs:
            total_time = sum((j.completed_at - j.started_at).total_seconds() for j in completed_jobs)
            stats.avg_processing_time = total_time / len(completed_jobs)
        
        return stats
    
    def start_processing(self):
        """Start processing jobs from the queue."""
        if self.running:
            console.print("[yellow]Job processor is already running[/yellow]")
            return
        
        self.running = True
        self.worker_thread = threading.Thread(target=self._process_jobs, daemon=True)
        self.worker_thread.start()
        console.print("[green]Job processor started[/green]")
    
    def stop_processing(self):
        """Stop processing jobs."""
        self.running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5)
        console.print("[yellow]Job processor stopped[/yellow]")
    
    def _process_jobs(self):
        """Main job processing loop."""
        while self.running:
            try:
                if not self.job_queue.empty() and len(self.active_jobs) < self.max_workers:
                    job = self.job_queue.get_nowait()
                    
                    # Check if dependencies are met
                    if job.dependencies and not self._dependencies_met(job):
                        # Put back in queue
                        self.job_queue.put(job)
                        time.sleep(1)
                        continue
                    
                    # Start job
                    job.status = JobStatus.RUNNING
                    job.started_at = datetime.now()
                    self.active_jobs[job.id] = job
                    
                    # Submit to executor
                    future = self.executor.submit(self._execute_job, job)
                    future.add_done_callback(lambda f, j=job: self._job_completed(j, f))
                
                time.sleep(0.1)
            
            except Exception as e:
                console.print(f"[red]Error in job processor: {e}[/red]")
                time.sleep(1)
    
    def _dependencies_met(self, job: Job) -> bool:
        """Check if job dependencies are satisfied."""
        for dep_id in job.dependencies:
            if dep_id not in self.completed_jobs:
                return False
            dep_job = self.completed_jobs[dep_id]
            if dep_job.status != JobStatus.COMPLETED:
                return False
        return True
    
    def _execute_job(self, job: Job) -> Dict[str, Any]:
        """Execute a single job."""
        try:
            # This would integrate with actual job execution logic
            # For now, simulate different job types
            
            if job.command == 'process_files':
                return self._execute_file_processing(job)
            elif job.command == 'train_model':
                return self._execute_model_training(job)
            elif job.command == 'deploy_service':
                return self._execute_service_deployment(job)
            else:
                raise ValueError(f"Unknown command: {job.command}")
        
        except Exception as e:
            raise Exception(f"Job execution failed: {str(e)}")
    
    def _execute_file_processing(self, job: Job) -> Dict[str, Any]:
        """Execute file processing job."""
        files = job.args.get('files', [])
        batch_size = job.args.get('batch_size', 10)
        
        # Simulate processing
        processed_files = []
        for i, file_path in enumerate(files):
            time.sleep(0.1)  # Simulate processing time
            processed_files.append({
                'file': file_path,
                'size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
                'status': 'processed'
            })
            
            # Check for timeout
            if job.timeout and (datetime.now() - job.started_at).total_seconds() > job.timeout:
                raise TimeoutError(f"Job timed out after {job.timeout} seconds")
        
        return {
            'processed_files': processed_files,
            'total_processed': len(processed_files),
            'batch_size': batch_size
        }
    
    def _execute_model_training(self, job: Job) -> Dict[str, Any]:
        """Execute model training job."""
        config = job.args.get('config', {})
        
        # Simulate training
        epochs = config.get('epochs', 10)
        for epoch in range(epochs):
            time.sleep(0.5)  # Simulate epoch processing
            
            # Check for timeout
            if job.timeout and (datetime.now() - job.started_at).total_seconds() > job.timeout:
                raise TimeoutError(f"Job timed out after {job.timeout} seconds")
        
        return {
            'model_id': str(uuid.uuid4()),
            'epochs': epochs,
            'accuracy': 0.95,  # Simulated
            'loss': 0.05
        }
    
    def _execute_service_deployment(self, job: Job) -> Dict[str, Any]:
        """Execute service deployment job."""
        service_config = job.args.get('service_config', {})
        environment = job.args.get('environment', 'dev')
        
        # Simulate deployment
        time.sleep(2)  # Simulate deployment time
        
        return {
            'service_id': str(uuid.uuid4()),
            'environment': environment,
            'status': 'deployed',
            'url': f"https://{service_config.get('name', 'service')}-{environment}.example.com"
        }
    
    def _job_completed(self, job: Job, future):
        """Handle job completion."""
        try:
            result = future.result()
            job.status = JobStatus.COMPLETED
            job.result = result
            job.completed_at = datetime.now()
            
        except Exception as e:
            job.error = str(e)
            
            # Check if we should retry
            if job.retry_count < job.max_retries:
                job.retry_count += 1
                job.status = JobStatus.RETRYING
                job.started_at = None
                
                # Put back in queue for retry
                self.job_queue.put(job)
                return
            else:
                job.status = JobStatus.FAILED
                job.completed_at = datetime.now()
        
        # Move from active to completed
        if job.id in self.active_jobs:
            del self.active_jobs[job.id]
        
        self.completed_jobs[job.id] = job
        self.job_history.append(job)
        self._save_job(job)
    
    def _save_job(self, job: Job):
        """Persist job to disk."""
        job_file = self.persistence_dir / f"{job.id}.json"
        with open(job_file, 'w') as f:
            # Convert to dict for JSON serialization
            job_dict = asdict(job)
            job_dict['created_at'] = job.created_at.isoformat()
            if job.started_at:
                job_dict['started_at'] = job.started_at.isoformat()
            if job.completed_at:
                job_dict['completed_at'] = job.completed_at.isoformat()
            job_dict['status'] = job.status.value
            job_dict['priority'] = job.priority.value
            
            json.dump(job_dict, f, indent=2)
    
    def _load_jobs(self):
        """Load persistent jobs from disk."""
        for job_file in self.persistence_dir.glob("*.json"):
            try:
                with open(job_file, 'r') as f:
                    job_dict = json.load(f)
                
                # Convert back to Job object
                job = Job(
                    id=job_dict['id'],
                    name=job_dict['name'],
                    command=job_dict['command'],
                    args=job_dict['args'],
                    priority=JobPriority(job_dict['priority']),
                    status=JobStatus(job_dict['status']),
                    created_at=datetime.fromisoformat(job_dict['created_at']),
                    started_at=datetime.fromisoformat(job_dict['started_at']) if job_dict.get('started_at') else None,
                    completed_at=datetime.fromisoformat(job_dict['completed_at']) if job_dict.get('completed_at') else None,
                    error=job_dict.get('error'),
                    result=job_dict.get('result'),
                    retry_count=job_dict.get('retry_count', 0),
                    max_retries=job_dict.get('max_retries', 3),
                    timeout=job_dict.get('timeout'),
                    dependencies=job_dict.get('dependencies', []),
                    tags=job_dict.get('tags', [])
                )
                
                # Place in appropriate collection
                if job.status in [JobStatus.PENDING]:
                    self.job_queue.put(job)
                elif job.status in [JobStatus.RUNNING]:
                    # Reset running jobs to pending on startup
                    job.status = JobStatus.PENDING
                    job.started_at = None
                    self.job_queue.put(job)
                else:
                    self.completed_jobs[job.id] = job
                    self.job_history.append(job)
            
            except Exception as e:
                console.print(f"[red]Failed to load job from {job_file}: {e}[/red]")

# Global job manager instance
job_manager = BatchJobManager()

@click.group()
def batch():
    """Advanced batch processing and job queue management."""
    pass

@batch.command()
@click.argument('files_pattern')
@click.option(
    '--batch-size', '-b',
    type=click.IntRange(1, 1000),
    default=50,
    help='Number of files to process per batch'
)
@click.option(
    '--parallel-jobs', '-p',
    type=click.IntRange(1, 32),
    default=4,
    help='Number of parallel processing jobs'
)
@click.option(
    '--priority',
    type=click.Choice(['low', 'normal', 'high', 'urgent']),
    default='normal',
    help='Job priority'
)
@click.option(
    '--max-retries',
    type=click.IntRange(0, 10),
    default=3,
    help='Maximum retry attempts'
)
@click.option(
    '--timeout',
    type=click.IntRange(1, 3600),
    help='Job timeout in seconds'
)
@click.option(
    '--depends-on',
    multiple=True,
    help='Job IDs this job depends on'
)
@click.option(
    '--tags',
    multiple=True,
    help='Tags for job categorization'
)
@click.option(
    '--schedule',
    help='Schedule job for later (e.g., "2024-01-01 12:00:00" or "+30m")'
)
@click.pass_context
@handle_exceptions
def submit_files(ctx, files_pattern: str, batch_size: int, parallel_jobs: int,
                 priority: str, max_retries: int, timeout: Optional[int],
                 depends_on: tuple, tags: tuple, schedule: Optional[str]):
    """
    Submit file processing jobs to the batch queue.
    
    Examples:
        schlep batch submit-files "data/*.csv" --batch-size 100 --parallel-jobs 8
        schlep batch submit-files "logs/*.json" --priority high --max-retries 5
        schlep batch submit-files "images/*.jpg" --timeout 300 --tags image-processing
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    import glob
    
    # Find matching files
    files = glob.glob(files_pattern, recursive=True)
    files = [f for f in files if os.path.isfile(f)]
    
    if not files:
        console.print(f"[yellow]No files found matching pattern: {files_pattern}[/yellow]")
        return
    
    console.print(f"[cyan]Found {len(files)} files to process[/cyan]")
    
    # Create batches
    file_batches = [files[i:i + batch_size] for i in range(0, len(files), batch_size)]
    
    console.print(f"[cyan]Creating {len(file_batches)} batch jobs[/cyan]")
    
    # Submit jobs
    job_ids = []
    priority_enum = JobPriority[priority.upper()]
    
    for i, batch in enumerate(file_batches):
        job = Job(
            id=str(uuid.uuid4()),
            name=f"process_files_batch_{i+1}",
            command='process_files',
            args={
                'files': batch,
                'batch_size': len(batch),
                'parallel_workers': parallel_jobs
            },
            priority=priority_enum,
            status=JobStatus.PENDING,
            created_at=datetime.now(),
            max_retries=max_retries,
            timeout=timeout,
            dependencies=list(depends_on),
            tags=list(tags)
        )
        
        job_id = job_manager.add_job(job)
        job_ids.append(job_id)
    
    # Display summary
    summary_text = Text()
    summary_text.append(f"Submitted {len(job_ids)} batch jobs\n\n", style="bold green")
    summary_text.append(f"Files per batch: {batch_size}\n", style="cyan")
    summary_text.append(f"Priority: {priority}\n", style="cyan")
    summary_text.append(f"Max retries: {max_retries}\n", style="cyan")
    if timeout:
        summary_text.append(f"Timeout: {timeout}s\n", style="cyan")
    if depends_on:
        summary_text.append(f"Dependencies: {', '.join(depends_on)}\n", style="cyan")
    if tags:
        summary_text.append(f"Tags: {', '.join(tags)}\n", style="cyan")
    
    console.print(Panel(summary_text, title="Jobs Submitted", border_style="green"))
    
    # Show job IDs
    console.print("[cyan]Job IDs:[/cyan]")
    for job_id in job_ids:
        console.print(f"  {job_id}")

@batch.command()
@click.argument('config_file', type=click.Path(exists=True))
@click.option(
    '--priority',
    type=click.Choice(['low', 'normal', 'high', 'urgent']),
    default='normal',
    help='Job priority'
)
@click.option(
    '--environment', '-e',
    default='dev',
    help='Target environment'
)
@click.option(
    '--max-retries',
    type=click.IntRange(0, 10),
    default=2,
    help='Maximum retry attempts'
)
@click.option(
    '--timeout',
    type=click.IntRange(1, 7200),
    default=1800,
    help='Job timeout in seconds'
)
@click.option(
    '--depends-on',
    multiple=True,
    help='Job IDs this job depends on'
)
@click.option(
    '--tags',
    multiple=True,
    help='Tags for job categorization'
)
@click.pass_context
@handle_exceptions
def submit_training(ctx, config_file: str, priority: str, environment: str,
                   max_retries: int, timeout: int, depends_on: tuple, tags: tuple):
    """
    Submit ML training jobs to the batch queue.
    
    Examples:
        schlep batch submit-training config/fraud-detection.yml --priority high
        schlep batch submit-training config/recommendation.yml --environment prod
        schlep batch submit-training config/nlp-model.yml --timeout 3600
    """
    config = ctx.obj.get('config') or Config()
    client = ctx.obj.get('client')
    
    config_path = validate_file_path(config_file)
    
    # Load training configuration
    with open(config_path, 'r') as f:
        if config_path.suffix in ['.yml', '.yaml']:
            training_config = yaml.safe_load(f)
        else:
            training_config = json.load(f)
    
    # Create training job
    job = Job(
        id=str(uuid.uuid4()),
        name=f"train_model_{training_config.get('name', 'unknown')}",
        command='train_model',
        args={
            'config': training_config,
            'environment': environment,
            'config_file': str(config_path)
        },
        priority=JobPriority[priority.upper()],
        status=JobStatus.PENDING,
        created_at=datetime.now(),
        max_retries=max_retries,
        timeout=timeout,
        dependencies=list(depends_on),
        tags=list(tags) + ['ml-training']
    )
    
    job_id = job_manager.add_job(job)
    
    # Display job details
    job_text = Text()
    job_text.append(f"ML Training Job Submitted\n\n", style="bold green")
    job_text.append(f"Job ID: {job_id}\n", style="cyan")
    job_text.append(f"Model: {training_config.get('name', 'Unknown')}\n", style="white")
    job_text.append(f"Priority: {priority}\n", style="white")
    job_text.append(f"Environment: {environment}\n", style="white")
    job_text.append(f"Timeout: {timeout}s\n", style="white")
    
    console.print(Panel(job_text, title="Training Job", border_style="green"))

@batch.command()
@click.option(
    '--status',
    type=click.Choice(['pending', 'running', 'completed', 'failed', 'cancelled', 'retrying']),
    help='Filter by job status'
)
@click.option(
    '--tags',
    multiple=True,
    help='Filter by tags'
)
@click.option(
    '--limit', '-l',
    type=click.IntRange(1, 200),
    default=20,
    help='Maximum number of jobs to show'
)
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.option(
    '--watch', '-w',
    is_flag=True,
    help='Watch for live updates'
)
@click.pass_context
@handle_exceptions
def list_jobs(ctx, status: Optional[str], tags: tuple, limit: int, json: bool, watch: bool):
    """
    List batch processing jobs.
    
    Examples:
        schlep batch list-jobs --status running
        schlep batch list-jobs --tags ml-training --limit 50
        schlep batch list-jobs --watch
    """
    if watch:
        watch_job_queue()
    else:
        show_job_list(status, tags, limit, json)

@batch.command()
@click.argument('job_id')
@click.option(
    '--json',
    is_flag=True,
    help='Output in JSON format'
)
@click.option(
    '--watch', '-w',
    is_flag=True,
    help='Watch job with live updates'
)
@click.pass_context
@handle_exceptions
def status(ctx, job_id: str, json: bool, watch: bool):
    """
    Get detailed status of a specific job.
    
    Examples:
        schlep batch status abc123-def456-ghi789
        schlep batch status abc123-def456-ghi789 --watch
        schlep batch status abc123-def456-ghi789 --json
    """
    if watch:
        watch_single_job(job_id)
    else:
        show_job_status(job_id, json)

@batch.command()
@click.argument('job_ids', nargs=-1)
@click.option(
    '--force', '-f',
    is_flag=True,
    help='Force cancellation without confirmation'
)
@click.pass_context
@handle_exceptions
def cancel(ctx, job_ids: tuple, force: bool):
    """
    Cancel one or more jobs.
    
    Examples:
        schlep batch cancel abc123-def456-ghi789
        schlep batch cancel job1 job2 job3 --force
    """
    if not job_ids:
        console.print("[yellow]No job IDs specified[/yellow]")
        return
    
    if not force:
        if not Confirm.ask(f"Cancel {len(job_ids)} job(s)?", default=False):
            console.print("Cancellation cancelled")
            return
    
    cancelled = []
    failed = []
    
    for job_id in job_ids:
        if job_manager.cancel_job(job_id):
            cancelled.append(job_id)
        else:
            failed.append(job_id)
    
    if cancelled:
        console.print(f"[green]Cancelled {len(cancelled)} job(s)[/green]")
        for job_id in cancelled:
            console.print(f"  ✓ {job_id}")
    
    if failed:
        console.print(f"[red]Failed to cancel {len(failed)} job(s)[/red]")
        for job_id in failed:
            console.print(f"  ✗ {job_id}")

@batch.command()
@click.pass_context
@handle_exceptions
def queue_stats(ctx):
    """
    Display queue statistics and performance metrics.
    
    Examples:
        schlep batch queue-stats
    """
    stats = job_manager.get_queue_stats()
    
    # Display comprehensive stats
    stats_text = Text()
    stats_text.append("Batch Queue Statistics\n\n", style="bold cyan")
    
    # Job counts
    stats_text.append(f"Total Jobs: {stats.total_jobs}\n", style="white")
    stats_text.append(f"Pending: {stats.pending_jobs}\n", style="yellow")
    stats_text.append(f"Running: {stats.running_jobs}\n", style="blue")
    stats_text.append(f"Completed: {stats.completed_jobs}\n", style="green")
    stats_text.append(f"Failed: {stats.failed_jobs}\n", style="red")
    stats_text.append(f"Cancelled: {stats.cancelled_jobs}\n", style="dim")
    
    stats_text.append("\n")
    
    # Performance metrics
    if stats.success_rate > 0:
        stats_text.append(f"Success Rate: {stats.success_rate:.1f}%\n", style="green" if stats.success_rate >= 90 else "yellow")
    
    if stats.avg_processing_time > 0:
        stats_text.append(f"Avg Processing Time: {format_duration(stats.avg_processing_time)}\n", style="cyan")
    
    # Queue utilization
    if stats.total_jobs > 0:
        active_percentage = ((stats.running_jobs + stats.pending_jobs) / stats.total_jobs) * 100
        stats_text.append(f"Queue Utilization: {active_percentage:.1f}%\n", style="cyan")
    
    console.print(Panel(stats_text, title="Queue Statistics", border_style="blue"))
    
    # Job distribution chart
    if stats.total_jobs > 0:
        create_job_distribution_chart(stats)

@batch.command()
@click.option(
    '--max-workers',
    type=click.IntRange(1, 32),
    help='Maximum concurrent workers'
)
@click.pass_context
@handle_exceptions
def start_processor(ctx, max_workers: Optional[int]):
    """
    Start the batch job processor.
    
    Examples:
        schlep batch start-processor
        schlep batch start-processor --max-workers 8
    """
    if max_workers:
        # Create new job manager with different worker count
        global job_manager
        job_manager.stop_processing()
        job_manager = BatchJobManager(max_workers=max_workers)
    
    job_manager.start_processing()
    
    console.print(f"[green]Batch processor started with {job_manager.max_workers} workers[/green]")
    console.print("[dim]Use 'schlep batch stop-processor' to stop[/dim]")

@batch.command()
@click.pass_context
@handle_exceptions
def stop_processor(ctx):
    """
    Stop the batch job processor.
    
    Examples:
        schlep batch stop-processor
    """
    job_manager.stop_processing()
    console.print("[yellow]Batch processor stopped[/yellow]")

@batch.command()
@click.option(
    '--older-than',
    help='Clean jobs older than specified time (e.g., "7d", "30d", "1h")'
)
@click.option(
    '--status',
    type=click.Choice(['completed', 'failed', 'cancelled']),
    multiple=True,
    help='Clean jobs with specific status'
)
@click.option(
    '--dry-run',
    is_flag=True,
    help='Show what would be cleaned without actually doing it'
)
@click.pass_context
@handle_exceptions
def cleanup(ctx, older_than: Optional[str], status: tuple, dry_run: bool):
    """
    Clean up old or completed jobs.
    
    Examples:
        schlep batch cleanup --older-than 30d --status completed
        schlep batch cleanup --status failed --dry-run
    """
    # Parse time filter
    cutoff_time = None
    if older_than:
        cutoff_time = parse_time_delta(older_than)
    
    # Find jobs to clean
    jobs_to_clean = []
    all_jobs = job_manager.list_jobs()
    
    for job in all_jobs:
        # Check age filter
        if cutoff_time and job.created_at > cutoff_time:
            continue
        
        # Check status filter
        if status and job.status.value not in status:
            continue
        
        # Don't clean running or pending jobs
        if job.status in [JobStatus.RUNNING, JobStatus.PENDING]:
            continue
        
        jobs_to_clean.append(job)
    
    if not jobs_to_clean:
        console.print("[green]No jobs to clean[/green]")
        return
    
    console.print(f"[cyan]Found {len(jobs_to_clean)} jobs to clean[/cyan]")
    
    if dry_run:
        # Show what would be cleaned
        table = create_table(title="Jobs to Clean (Dry Run)", show_lines=True)
        table.add_column("Job ID", style="bold")
        table.add_column("Name")
        table.add_column("Status", justify="center")
        table.add_column("Age", justify="right")
        
        for job in jobs_to_clean[:20]:  # Show first 20
            age = datetime.now() - job.created_at
            table.add_row(
                job.id[:12] + "...",
                job.name,
                job.status.value,
                format_duration(age.total_seconds())
            )
        
        if len(jobs_to_clean) > 20:
            console.print(f"[dim]... and {len(jobs_to_clean) - 20} more jobs[/dim]")
        
        display_table(table)
        return
    
    # Confirm cleanup
    if not Confirm.ask(f"Clean {len(jobs_to_clean)} jobs?", default=False):
        console.print("Cleanup cancelled")
        return
    
    # Perform cleanup
    cleaned_count = 0
    for job in jobs_to_clean:
        try:
            # Remove from completed jobs
            if job.id in job_manager.completed_jobs:
                del job_manager.completed_jobs[job.id]
            
            # Remove persistent file
            job_file = job_manager.persistence_dir / f"{job.id}.json"
            if job_file.exists():
                job_file.unlink()
            
            cleaned_count += 1
        
        except Exception as e:
            console.print(f"[red]Failed to clean job {job.id}: {e}[/red]")
    
    console.print(f"[green]Cleaned {cleaned_count} jobs[/green]")

def show_job_list(status_filter: Optional[str], tags_filter: tuple, limit: int, json_output: bool):
    """Display list of jobs."""
    # Convert status filter
    status_enum = None
    if status_filter:
        status_enum = JobStatus(status_filter)
    
    # Get jobs with filters
    jobs = job_manager.list_jobs(status=status_enum, tags=list(tags_filter) if tags_filter else None)
    jobs = jobs[:limit]
    
    if not jobs:
        console.print("[yellow]No jobs found[/yellow]")
        return
    
    if json_output:
        job_dicts = []
        for job in jobs:
            job_dict = asdict(job)
            job_dict['created_at'] = job.created_at.isoformat()
            if job.started_at:
                job_dict['started_at'] = job.started_at.isoformat()
            if job.completed_at:
                job_dict['completed_at'] = job.completed_at.isoformat()
            job_dict['status'] = job.status.value
            job_dict['priority'] = job.priority.value
            job_dicts.append(job_dict)
        
        console.print(json.dumps(job_dicts, indent=2))
        return
    
    # Create jobs table
    table = create_table(title=f"Batch Jobs ({len(jobs)} found)", show_lines=True)
    table.add_column("Job ID", style="bold")
    table.add_column("Name")
    table.add_column("Command")
    table.add_column("Status", justify="center")
    table.add_column("Priority", justify="center")
    table.add_column("Created", justify="right")
    table.add_column("Duration", justify="right")
    
    for job in jobs:
        # Format status with color
        status_color = {
            JobStatus.PENDING: "yellow",
            JobStatus.RUNNING: "blue",
            JobStatus.COMPLETED: "green",
            JobStatus.FAILED: "red",
            JobStatus.CANCELLED: "dim",
            JobStatus.RETRYING: "cyan"
        }
        
        status_display = f"[{status_color.get(job.status, 'white')}]{job.status.value}[/{status_color.get(job.status, 'white')}]"
        
        # Calculate duration
        if job.status == JobStatus.RUNNING and job.started_at:
            duration = datetime.now() - job.started_at
        elif job.completed_at and job.started_at:
            duration = job.completed_at - job.started_at
        else:
            duration = None
        
        duration_display = format_duration(duration.total_seconds()) if duration else "[dim]N/A[/dim]"
        
        # Format creation time
        age = datetime.now() - job.created_at
        if age.days > 0:
            created_display = f"{age.days}d ago"
        elif age.seconds > 3600:
            created_display = f"{age.seconds // 3600}h ago"
        else:
            created_display = f"{age.seconds // 60}m ago"
        
        table.add_row(
            job.id[:12] + "...",
            job.name,
            job.command,
            status_display,
            job.priority.name.lower(),
            created_display,
            duration_display
        )
    
    display_table(table)

def show_job_status(job_id: str, json_output: bool):
    """Show detailed status of a single job."""
    job = job_manager.get_job(job_id)
    if not job:
        console.print(f"[red]Job {job_id} not found[/red]")
        return
    
    if json_output:
        job_dict = asdict(job)
        job_dict['created_at'] = job.created_at.isoformat()
        if job.started_at:
            job_dict['started_at'] = job.started_at.isoformat()
        if job.completed_at:
            job_dict['completed_at'] = job.completed_at.isoformat()
        job_dict['status'] = job.status.value
        job_dict['priority'] = job.priority.value
        
        console.print(json.dumps(job_dict, indent=2))
        return
    
    # Create detailed status display
    job_text = Text()
    job_text.append(f"Job Details: {job.name}\n\n", style="bold cyan")
    
    # Basic information
    job_text.append(f"ID: {job.id}\n", style="white")
    job_text.append(f"Command: {job.command}\n", style="white")
    job_text.append(f"Status: {job.status.value}\n", style="white")
    job_text.append(f"Priority: {job.priority.name}\n", style="white")
    job_text.append(f"Created: {job.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n", style="white")
    
    if job.started_at:
        job_text.append(f"Started: {job.started_at.strftime('%Y-%m-%d %H:%M:%S')}\n", style="white")
    
    if job.completed_at:
        job_text.append(f"Completed: {job.completed_at.strftime('%Y-%m-%d %H:%M:%S')}\n", style="white")
    
    # Progress information
    if job.status == JobStatus.RUNNING and job.started_at:
        duration = datetime.now() - job.started_at
        job_text.append(f"Running time: {format_duration(duration.total_seconds())}\n", style="cyan")
    elif job.completed_at and job.started_at:
        duration = job.completed_at - job.started_at
        job_text.append(f"Total duration: {format_duration(duration.total_seconds())}\n", style="cyan")
    
    # Retry information
    if job.retry_count > 0:
        job_text.append(f"Retry count: {job.retry_count}/{job.max_retries}\n", style="yellow")
    
    # Dependencies
    if job.dependencies:
        job_text.append(f"Dependencies: {', '.join(job.dependencies)}\n", style="dim")
    
    # Tags
    if job.tags:
        job_text.append(f"Tags: {', '.join(job.tags)}\n", style="dim")
    
    console.print(Panel(job_text, title="Job Status", border_style="blue"))
    
    # Show error if failed
    if job.error:
        error_text = Text()
        error_text.append("Error Details\n\n", style="bold red")
        error_text.append(job.error, style="red")
        console.print(Panel(error_text, title="Error", border_style="red"))
    
    # Show result if completed
    if job.result:
        result_text = Text()
        result_text.append("Job Result\n\n", style="bold green")
        result_text.append(json.dumps(job.result, indent=2), style="white")
        console.print(Panel(result_text, title="Result", border_style="green"))

def watch_job_queue():
    """Watch job queue with live updates."""
    console.print("[cyan]Watching job queue (updating every 5s)[/cyan]")
    console.print("[dim]Press Ctrl+C to stop watching[/dim]\n")
    
    try:
        with Live(auto_refresh=False) as live:
            while True:
                try:
                    # Get current jobs and stats
                    jobs = job_manager.list_jobs()[:10]  # Show top 10
                    stats = job_manager.get_queue_stats()
                    
                    # Create combined display
                    layout = create_live_queue_display(jobs, stats)
                    live.update(layout, refresh=True)
                    
                    time.sleep(5)
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    console.print(f"[red]Error watching queue: {e}[/red]")
                    break
    
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped watching job queue[/yellow]")

def watch_single_job(job_id: str):
    """Watch a single job with live updates."""
    console.print(f"[cyan]Watching job: {job_id}[/cyan]")
    console.print("[dim]Press Ctrl+C to stop watching[/dim]\n")
    
    try:
        with Live(auto_refresh=False) as live:
            while True:
                try:
                    job = job_manager.get_job(job_id)
                    if not job:
                        console.print(f"[red]Job {job_id} not found[/red]")
                        break
                    
                    # Create job status display
                    display = create_live_job_display(job)
                    live.update(display, refresh=True)
                    
                    # Exit if job is completed
                    if job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
                        console.print(f"\n[cyan]Job {job.status.value}[/cyan]")
                        break
                    
                    time.sleep(2)
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    console.print(f"[red]Error watching job: {e}[/red]")
                    break
    
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped watching job[/yellow]")

def create_live_queue_display(jobs: List[Job], stats: QueueStats) -> Panel:
    """Create live display for queue monitoring."""
    # Stats summary
    stats_text = Text()
    stats_text.append("Queue Status\n", style="bold cyan")
    stats_text.append(f"Total: {stats.total_jobs} | ", style="white")
    stats_text.append(f"Pending: {stats.pending_jobs} | ", style="yellow")
    stats_text.append(f"Running: {stats.running_jobs} | ", style="blue")
    stats_text.append(f"Completed: {stats.completed_jobs}\n", style="green")
    
    if stats.success_rate > 0:
        stats_text.append(f"Success Rate: {stats.success_rate:.1f}%\n", style="green")
    
    # Recent jobs table
    table = create_table(title="Recent Jobs", show_lines=True)
    table.add_column("Job ID", style="bold")
    table.add_column("Name")
    table.add_column("Status", justify="center")
    table.add_column("Age", justify="right")
    
    for job in jobs:
        age = datetime.now() - job.created_at
        age_display = f"{age.seconds // 60}m" if age.seconds < 3600 else f"{age.seconds // 3600}h"
        
        status_color = {
            JobStatus.PENDING: "yellow",
            JobStatus.RUNNING: "blue",
            JobStatus.COMPLETED: "green",
            JobStatus.FAILED: "red",
            JobStatus.CANCELLED: "dim"
        }
        
        status_display = f"[{status_color.get(job.status, 'white')}]{job.status.value}[/{status_color.get(job.status, 'white')}]"
        
        table.add_row(
            job.id[:8] + "...",
            job.name[:20] + ("..." if len(job.name) > 20 else ""),
            status_display,
            age_display
        )
    
    # Combine stats and table
    combined = Text()
    combined.append_text(stats_text)
    combined.append("\n")
    
    return Panel(combined, title=f"Job Queue Monitor - {datetime.now().strftime('%H:%M:%S')}", border_style="cyan")

def create_live_job_display(job: Job) -> Panel:
    """Create live display for single job monitoring."""
    job_text = Text()
    job_text.append(f"Job: {job.name}\n\n", style="bold cyan")
    job_text.append(f"Status: {job.status.value}\n", style="white")
    job_text.append(f"Priority: {job.priority.name}\n", style="white")
    
    if job.started_at:
        duration = datetime.now() - job.started_at
        job_text.append(f"Running: {format_duration(duration.total_seconds())}\n", style="cyan")
    
    if job.retry_count > 0:
        job_text.append(f"Retries: {job.retry_count}/{job.max_retries}\n", style="yellow")
    
    return Panel(job_text, title=f"Job Monitor - {datetime.now().strftime('%H:%M:%S')}", border_style="blue")

def create_job_distribution_chart(stats: QueueStats):
    """Create a simple text-based job distribution chart."""
    if stats.total_jobs == 0:
        return
    
    chart_text = Text()
    chart_text.append("Job Distribution\n\n", style="bold cyan")
    
    # Calculate percentages
    statuses = [
        ("Pending", stats.pending_jobs, "yellow"),
        ("Running", stats.running_jobs, "blue"), 
        ("Completed", stats.completed_jobs, "green"),
        ("Failed", stats.failed_jobs, "red"),
        ("Cancelled", stats.cancelled_jobs, "dim")
    ]
    
    max_width = 40
    for status, count, color in statuses:
        if count > 0:
            percentage = (count / stats.total_jobs) * 100
            bar_width = int((count / stats.total_jobs) * max_width)
            bar = "█" * bar_width + "░" * (max_width - bar_width)
            
            chart_text.append(f"{status:10}: ", style="white")
            chart_text.append(f"[{color}]{bar}[/{color}]", style=color)
            chart_text.append(f" {count} ({percentage:.1f}%)\n", style="white")
    
    console.print(Panel(chart_text, title="Distribution", border_style="cyan"))

def parse_time_delta(time_str: str) -> datetime:
    """Parse time delta string (e.g., '7d', '1h', '30m') and return cutoff time."""
    import re
    
    match = re.match(r'(\d+)([dhm])', time_str.lower())
    if not match:
        raise ValueError(f"Invalid time format: {time_str}")
    
    amount, unit = match.groups()
    amount = int(amount)
    
    if unit == 'd':
        delta = timedelta(days=amount)
    elif unit == 'h':
        delta = timedelta(hours=amount)
    elif unit == 'm':
        delta = timedelta(minutes=amount)
    else:
        raise ValueError(f"Invalid time unit: {unit}")
    
    return datetime.now() - delta

if __name__ == "__main__":
    batch()