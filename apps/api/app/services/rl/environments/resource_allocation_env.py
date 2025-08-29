"""
Resource Allocation Environment for Pipeline Optimization

This environment optimizes the allocation of computational resources
(CPU, memory, storage) across data processing pipelines to maximize
overall system efficiency and throughput.
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
try:
    import gymnasium as gym
    from gymnasium import spaces
except ImportError:
    import gym
    from gym import spaces
from datetime import datetime, timedelta
import psutil
import time
from concurrent.futures import ThreadPoolExecutor
import threading

logger = logging.getLogger(__name__)


@dataclass
class ResourceConfig:
    """Resource configuration parameters."""
    max_cpu_cores: int = psutil.cpu_count()
    max_memory_gb: int = int(psutil.virtual_memory().total / (1024**3))
    max_storage_gb: int = 1000
    max_concurrent_pipelines: int = 10
    resource_allocation_granularity: float = 0.1  # Minimum allocation unit


@dataclass
class PipelineJob:
    """Represents a pipeline job requiring resources."""
    job_id: str
    pipeline_type: str
    estimated_cpu_hours: float
    estimated_memory_gb: float
    estimated_storage_gb: float
    priority: int  # 1-10, higher is more important
    deadline: Optional[datetime] = None
    data_size_mb: int = 0
    complexity_score: float = 1.0


class ResourceAllocationEnvironment(gym.Env):
    """
    RL Environment for optimizing resource allocation across pipelines.
    
    The agent learns to allocate limited computational resources to maximize:
    - Overall system throughput
    - Meeting job deadlines
    - Resource utilization efficiency
    - Cost optimization
    """
    
    def __init__(self, 
                 resource_config: Optional[ResourceConfig] = None,
                 simulation_mode: bool = True,
                 optimization_objective: str = "balanced_efficiency"):
        super().__init__()
        
        self.resource_config = resource_config or ResourceConfig()
        self.simulation_mode = simulation_mode
        self.optimization_objective = optimization_objective
        
        # Define action and observation spaces
        self.action_space = self._create_action_space()
        self.observation_space = self._create_observation_space()
        
        # Environment state
        self.current_jobs: List[PipelineJob] = []
        self.running_jobs: Dict[str, Dict[str, Any]] = {}
        self.completed_jobs: List[Dict[str, Any]] = []
        self.failed_jobs: List[Dict[str, Any]] = []
        
        # Resource tracking
        self.allocated_cpu: float = 0.0
        self.allocated_memory: float = 0.0
        self.allocated_storage: float = 0.0
        
        # Performance metrics
        self.total_throughput = 0.0
        self.average_completion_time = 0.0
        self.resource_utilization_history = []
        self.deadline_miss_count = 0
        
        # Episode tracking
        self.current_step = 0
        self.episode_count = 0
        self.max_steps_per_episode = 200
        
        # Simulation parameters
        self.time_step_duration = 60  # seconds per step
        self.current_simulation_time = datetime.now()
        
        logger.info("Initialized ResourceAllocationEnvironment")
        logger.info(f"Max resources: {self.resource_config.max_cpu_cores} CPU, "
                   f"{self.resource_config.max_memory_gb}GB RAM, "
                   f"{self.resource_config.max_storage_gb}GB Storage")
    
    def reset(self) -> np.ndarray:
        """Reset the environment to initial state."""
        self.current_step = 0
        self.episode_count += 1
        
        # Clear job queues
        self.current_jobs = []
        self.running_jobs = {}
        self.completed_jobs = []
        self.failed_jobs = []
        
        # Reset resource allocation
        self.allocated_cpu = 0.0
        self.allocated_memory = 0.0
        self.allocated_storage = 0.0
        
        # Reset performance metrics
        self.total_throughput = 0.0
        self.average_completion_time = 0.0
        self.resource_utilization_history = []
        self.deadline_miss_count = 0
        
        # Generate initial job queue
        self.current_jobs = self._generate_job_queue()
        
        # Reset simulation time
        self.current_simulation_time = datetime.now()
        
        observation = self._create_observation()
        logger.debug(f"Environment reset for episode {self.episode_count}")
        return observation
    
    def step(self, action: np.ndarray) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        """Execute one step in the environment."""
        self.current_step += 1
        self.current_simulation_time += timedelta(seconds=self.time_step_duration)
        
        # Interpret action as resource allocation decisions
        allocation_decisions = self._action_to_allocations(action)
        
        # Apply resource allocations
        allocation_results = self._apply_resource_allocations(allocation_decisions)
        
        # Update running jobs
        self._update_running_jobs()
        
        # Check for completed jobs
        newly_completed = self._check_completed_jobs()
        
        # Generate new jobs
        new_jobs = self._generate_new_jobs()
        self.current_jobs.extend(new_jobs)
        
        # Calculate reward
        reward = self._calculate_reward(allocation_results, newly_completed)
        
        # Update metrics
        self._update_performance_metrics()
        
        # Create observation
        observation = self._create_observation()
        
        # Check if episode is done
        done = (self.current_step >= self.max_steps_per_episode or 
                len(self.current_jobs) == 0 and len(self.running_jobs) == 0)
        
        # Prepare info
        info = {
            "allocated_resources": {
                "cpu": self.allocated_cpu,
                "memory": self.allocated_memory,
                "storage": self.allocated_storage
            },
            "jobs": {
                "pending": len(self.current_jobs),
                "running": len(self.running_jobs),
                "completed": len(self.completed_jobs),
                "failed": len(self.failed_jobs)
            },
            "utilization": {
                "cpu": self.allocated_cpu / self.resource_config.max_cpu_cores,
                "memory": self.allocated_memory / self.resource_config.max_memory_gb,
                "storage": self.allocated_storage / self.resource_config.max_storage_gb
            },
            "throughput": self.total_throughput,
            "deadline_misses": self.deadline_miss_count
        }
        
        return observation, reward, done, info
    
    def _create_action_space(self) -> spaces.Box:
        """Create action space for resource allocation decisions."""
        # Action space represents allocation percentages for each resource type
        # and job selection probabilities
        # [cpu_allocation_ratio, memory_allocation_ratio, storage_allocation_ratio, 
        #  job_priority_weight, urgent_job_weight]
        return spaces.Box(low=0.0, high=1.0, shape=(5,), dtype=np.float32)
    
    def _create_observation_space(self) -> spaces.Box:
        """Create observation space for environment state."""
        # Observation includes:
        # - Current resource utilization (3 values)
        # - Job queue statistics (10 values)
        # - Performance metrics (7 values)
        # - System state (5 values)
        obs_dim = 25
        return spaces.Box(low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32)
    
    def _generate_job_queue(self, num_jobs: int = None) -> List[PipelineJob]:
        """Generate initial job queue."""
        if num_jobs is None:
            num_jobs = np.random.randint(5, 15)
        
        jobs = []
        pipeline_types = ["manufacturing", "ecommerce", "financial", "general"]
        
        for i in range(num_jobs):
            pipeline_type = np.random.choice(pipeline_types)
            
            # Generate job characteristics based on pipeline type
            if pipeline_type == "manufacturing":
                cpu_hours = np.random.uniform(0.5, 4.0)
                memory_gb = np.random.uniform(2.0, 16.0)
                storage_gb = np.random.uniform(1.0, 50.0)
                complexity = np.random.uniform(0.8, 1.5)
            elif pipeline_type == "financial":
                cpu_hours = np.random.uniform(1.0, 8.0)
                memory_gb = np.random.uniform(4.0, 32.0)
                storage_gb = np.random.uniform(0.5, 20.0)
                complexity = np.random.uniform(1.2, 2.0)
            else:
                cpu_hours = np.random.uniform(0.3, 3.0)
                memory_gb = np.random.uniform(1.0, 8.0)
                storage_gb = np.random.uniform(0.5, 10.0)
                complexity = np.random.uniform(0.5, 1.2)
            
            # Generate deadline (some jobs have deadlines, others don't)
            deadline = None
            if np.random.random() < 0.6:  # 60% of jobs have deadlines
                deadline_hours = np.random.uniform(1.0, 24.0)
                deadline = self.current_simulation_time + timedelta(hours=deadline_hours)
            
            job = PipelineJob(
                job_id=f"job_{self.episode_count}_{i}",
                pipeline_type=pipeline_type,
                estimated_cpu_hours=cpu_hours,
                estimated_memory_gb=memory_gb,
                estimated_storage_gb=storage_gb,
                priority=np.random.randint(1, 11),
                deadline=deadline,
                data_size_mb=int(np.random.uniform(100, 10000)),
                complexity_score=complexity
            )
            
            jobs.append(job)
        
        return jobs
    
    def _generate_new_jobs(self) -> List[PipelineJob]:
        """Generate new jobs that arrive during the episode."""
        # Poisson-like arrival process
        arrival_rate = 0.3  # average jobs per time step
        num_new_jobs = np.random.poisson(arrival_rate)
        
        if num_new_jobs > 0:
            return self._generate_job_queue(num_new_jobs)
        return []
    
    def _action_to_allocations(self, action: np.ndarray) -> Dict[str, Any]:
        """Convert RL action to resource allocation decisions."""
        cpu_ratio = action[0]
        memory_ratio = action[1]
        storage_ratio = action[2]
        priority_weight = action[3]
        urgency_weight = action[4]
        
        return {
            "cpu_allocation_ratio": cpu_ratio,
            "memory_allocation_ratio": memory_ratio,
            "storage_allocation_ratio": storage_ratio,
            "priority_weight": priority_weight,
            "urgency_weight": urgency_weight
        }
    
    def _apply_resource_allocations(self, allocation_decisions: Dict[str, Any]) -> Dict[str, Any]:
        """Apply resource allocation decisions to pending jobs."""
        results = {
            "jobs_started": [],
            "jobs_queued": [],
            "resource_conflicts": [],
            "allocation_efficiency": 0.0
        }
        
        if not self.current_jobs:
            return results
        
        # Calculate available resources
        available_cpu = self.resource_config.max_cpu_cores - self.allocated_cpu
        available_memory = self.resource_config.max_memory_gb - self.allocated_memory
        available_storage = self.resource_config.max_storage_gb - self.allocated_storage
        
        # Sort jobs based on allocation strategy
        sorted_jobs = self._prioritize_jobs(
            self.current_jobs, 
            allocation_decisions["priority_weight"],
            allocation_decisions["urgency_weight"]
        )
        
        # Allocate resources to jobs
        for job in sorted_jobs:
            # Check if job can be started with current resources
            cpu_needed = job.estimated_cpu_hours * allocation_decisions["cpu_allocation_ratio"]
            memory_needed = job.estimated_memory_gb * allocation_decisions["memory_allocation_ratio"]
            storage_needed = job.estimated_storage_gb * allocation_decisions["storage_allocation_ratio"]
            
            if (cpu_needed <= available_cpu and 
                memory_needed <= available_memory and 
                storage_needed <= available_storage and
                len(self.running_jobs) < self.resource_config.max_concurrent_pipelines):
                
                # Start the job
                self._start_job(job, cpu_needed, memory_needed, storage_needed)
                
                # Update available resources
                available_cpu -= cpu_needed
                available_memory -= memory_needed
                available_storage -= storage_needed
                
                results["jobs_started"].append(job.job_id)
                self.current_jobs.remove(job)
            else:
                results["jobs_queued"].append(job.job_id)
                
                # Track resource conflicts
                conflicts = []
                if cpu_needed > available_cpu:
                    conflicts.append("cpu")
                if memory_needed > available_memory:
                    conflicts.append("memory")
                if storage_needed > available_storage:
                    conflicts.append("storage")
                
                if conflicts:
                    results["resource_conflicts"].append({
                        "job_id": job.job_id,
                        "conflicts": conflicts
                    })
        
        # Calculate allocation efficiency
        total_cpu_requested = sum(j.estimated_cpu_hours for j in sorted_jobs)
        total_memory_requested = sum(j.estimated_memory_gb for j in sorted_jobs)
        
        if total_cpu_requested > 0 and total_memory_requested > 0:
            cpu_efficiency = min(1.0, available_cpu / total_cpu_requested)
            memory_efficiency = min(1.0, available_memory / total_memory_requested)
            results["allocation_efficiency"] = (cpu_efficiency + memory_efficiency) / 2
        
        return results
    
    def _prioritize_jobs(self, jobs: List[PipelineJob], 
                        priority_weight: float, urgency_weight: float) -> List[PipelineJob]:
        """Prioritize jobs based on allocation strategy."""
        def job_score(job):
            score = 0.0
            
            # Priority component
            score += job.priority * priority_weight
            
            # Urgency component (deadline-based)
            if job.deadline:
                time_to_deadline = (job.deadline - self.current_simulation_time).total_seconds() / 3600
                if time_to_deadline > 0:
                    urgency = 1.0 / time_to_deadline  # Higher urgency for closer deadlines
                    score += urgency * urgency_weight
                else:
                    score += 100.0 * urgency_weight  # Very high score for overdue jobs
            
            # Efficiency component (favor jobs with better resource utilization)
            efficiency = 1.0 / (job.estimated_cpu_hours + job.estimated_memory_gb + 1e-6)
            score += efficiency * 0.1
            
            return score
        
        return sorted(jobs, key=job_score, reverse=True)
    
    def _start_job(self, job: PipelineJob, cpu_allocated: float, 
                  memory_allocated: float, storage_allocated: float):
        """Start a job with allocated resources."""
        start_time = self.current_simulation_time
        
        # Estimate completion time based on allocated resources
        # More resources can potentially speed up the job
        base_duration = job.estimated_cpu_hours * 3600  # Convert to seconds
        
        # Resource efficiency factor
        cpu_efficiency = cpu_allocated / job.estimated_cpu_hours if job.estimated_cpu_hours > 0 else 1.0
        memory_efficiency = memory_allocated / job.estimated_memory_gb if job.estimated_memory_gb > 0 else 1.0
        
        # Jobs can be faster with more resources, but with diminishing returns
        speedup_factor = min(2.0, (cpu_efficiency + memory_efficiency) / 2)
        estimated_duration = base_duration / speedup_factor
        
        # Add some variability based on complexity
        duration_variability = job.complexity_score * np.random.uniform(0.8, 1.2)
        final_duration = estimated_duration * duration_variability
        
        estimated_completion = start_time + timedelta(seconds=final_duration)
        
        # Add to running jobs
        self.running_jobs[job.job_id] = {
            "job": job,
            "start_time": start_time,
            "estimated_completion": estimated_completion,
            "cpu_allocated": cpu_allocated,
            "memory_allocated": memory_allocated,
            "storage_allocated": storage_allocated,
            "progress": 0.0
        }
        
        # Update total allocated resources
        self.allocated_cpu += cpu_allocated
        self.allocated_memory += memory_allocated
        self.allocated_storage += storage_allocated
        
        logger.debug(f"Started job {job.job_id} with {cpu_allocated:.2f} CPU, "
                    f"{memory_allocated:.2f}GB RAM, {storage_allocated:.2f}GB storage")
    
    def _update_running_jobs(self):
        """Update progress of running jobs."""
        for job_id, job_info in self.running_jobs.items():
            # Update progress based on elapsed time
            elapsed_time = (self.current_simulation_time - job_info["start_time"]).total_seconds()
            estimated_duration = (job_info["estimated_completion"] - job_info["start_time"]).total_seconds()
            
            if estimated_duration > 0:
                job_info["progress"] = min(1.0, elapsed_time / estimated_duration)
    
    def _check_completed_jobs(self) -> List[Dict[str, Any]]:
        """Check for completed jobs and move them to completed list."""
        completed = []
        jobs_to_remove = []
        
        for job_id, job_info in self.running_jobs.items():
            if self.current_simulation_time >= job_info["estimated_completion"]:
                # Job is completed
                actual_duration = (self.current_simulation_time - job_info["start_time"]).total_seconds()
                
                # Check if deadline was met
                deadline_met = True
                if job_info["job"].deadline:
                    deadline_met = self.current_simulation_time <= job_info["job"].deadline
                    if not deadline_met:
                        self.deadline_miss_count += 1
                
                completed_job = {
                    "job_id": job_id,
                    "job": job_info["job"],
                    "start_time": job_info["start_time"],
                    "completion_time": self.current_simulation_time,
                    "actual_duration": actual_duration,
                    "cpu_allocated": job_info["cpu_allocated"],
                    "memory_allocated": job_info["memory_allocated"],
                    "storage_allocated": job_info["storage_allocated"],
                    "deadline_met": deadline_met,
                    "efficiency_score": self._calculate_job_efficiency(job_info)
                }
                
                completed.append(completed_job)
                self.completed_jobs.append(completed_job)
                jobs_to_remove.append(job_id)
                
                # Free up allocated resources
                self.allocated_cpu -= job_info["cpu_allocated"]
                self.allocated_memory -= job_info["memory_allocated"]
                self.allocated_storage -= job_info["storage_allocated"]
                
                logger.debug(f"Completed job {job_id} (deadline met: {deadline_met})")
        
        # Remove completed jobs from running jobs
        for job_id in jobs_to_remove:
            del self.running_jobs[job_id]
        
        return completed
    
    def _calculate_job_efficiency(self, job_info: Dict[str, Any]) -> float:
        """Calculate efficiency score for a completed job."""
        job = job_info["job"]
        actual_duration = (self.current_simulation_time - job_info["start_time"]).total_seconds()
        estimated_duration = job.estimated_cpu_hours * 3600
        
        # Time efficiency
        time_efficiency = estimated_duration / actual_duration if actual_duration > 0 else 0.0
        
        # Resource efficiency
        cpu_efficiency = job.estimated_cpu_hours / job_info["cpu_allocated"] if job_info["cpu_allocated"] > 0 else 0.0
        memory_efficiency = job.estimated_memory_gb / job_info["memory_allocated"] if job_info["memory_allocated"] > 0 else 0.0
        
        # Combined efficiency score
        efficiency = (time_efficiency + cpu_efficiency + memory_efficiency) / 3
        return min(2.0, efficiency)  # Cap at 2.0 for exceptional performance
    
    def _calculate_reward(self, allocation_results: Dict[str, Any], 
                         newly_completed: List[Dict[str, Any]]) -> float:
        """Calculate reward based on optimization objective."""
        reward = 0.0
        
        # Reward for jobs started
        jobs_started = len(allocation_results["jobs_started"])
        reward += jobs_started * 1.0
        
        # Reward for jobs completed
        jobs_completed = len(newly_completed)
        reward += jobs_completed * 2.0
        
        # Bonus for meeting deadlines
        for completed_job in newly_completed:
            if completed_job["deadline_met"]:
                reward += 1.0
            else:
                reward -= 2.0  # Penalty for missing deadlines
        
        # Resource utilization reward
        cpu_utilization = self.allocated_cpu / self.resource_config.max_cpu_cores
        memory_utilization = self.allocated_memory / self.resource_config.max_memory_gb
        avg_utilization = (cpu_utilization + memory_utilization) / 2
        
        # Reward efficient utilization (not too low, not too high)
        if 0.4 <= avg_utilization <= 0.8:
            reward += 1.0 * avg_utilization
        elif avg_utilization > 0.8:
            reward += 0.5  # Slight penalty for overutilization
        else:
            reward -= 0.5  # Penalty for underutilization
        
        # Efficiency bonus
        allocation_efficiency = allocation_results.get("allocation_efficiency", 0.0)
        reward += allocation_efficiency
        
        # Penalty for resource conflicts
        conflict_penalty = len(allocation_results.get("resource_conflicts", []))
        reward -= conflict_penalty * 0.2
        
        # Long-term performance bonus
        if len(self.completed_jobs) > 0:
            avg_efficiency = np.mean([job["efficiency_score"] for job in self.completed_jobs])
            reward += avg_efficiency * 0.5
        
        return reward
    
    def _update_performance_metrics(self):
        """Update overall performance metrics."""
        # Calculate throughput (jobs completed per time unit)
        if self.current_step > 0:
            self.total_throughput = len(self.completed_jobs) / self.current_step
        
        # Calculate average completion time
        if self.completed_jobs:
            completion_times = [job["actual_duration"] for job in self.completed_jobs]
            self.average_completion_time = np.mean(completion_times)
        
        # Track resource utilization
        cpu_util = self.allocated_cpu / self.resource_config.max_cpu_cores
        memory_util = self.allocated_memory / self.resource_config.max_memory_gb
        storage_util = self.allocated_storage / self.resource_config.max_storage_gb
        
        self.resource_utilization_history.append({
            "step": self.current_step,
            "cpu_utilization": cpu_util,
            "memory_utilization": memory_util,
            "storage_utilization": storage_util,
            "average_utilization": (cpu_util + memory_util + storage_util) / 3
        })
    
    def _create_observation(self) -> np.ndarray:
        """Create observation vector representing current environment state."""
        obs = np.zeros(25, dtype=np.float32)
        
        # Current resource utilization (3 values)
        obs[0] = self.allocated_cpu / self.resource_config.max_cpu_cores
        obs[1] = self.allocated_memory / self.resource_config.max_memory_gb
        obs[2] = self.allocated_storage / self.resource_config.max_storage_gb
        
        # Job queue statistics (10 values)
        obs[3] = len(self.current_jobs)  # Pending jobs
        obs[4] = len(self.running_jobs)  # Running jobs
        obs[5] = len(self.completed_jobs)  # Completed jobs
        obs[6] = len(self.failed_jobs)  # Failed jobs
        
        if self.current_jobs:
            priorities = [job.priority for job in self.current_jobs]
            obs[7] = np.mean(priorities)  # Average priority
            obs[8] = np.max(priorities)   # Max priority
            
            # Urgent jobs (with deadlines in next 2 hours)
            urgent_count = 0
            for job in self.current_jobs:
                if job.deadline and (job.deadline - self.current_simulation_time).total_seconds() <= 7200:
                    urgent_count += 1
            obs[9] = urgent_count
            
            # Average resource requirements
            obs[10] = np.mean([job.estimated_cpu_hours for job in self.current_jobs])
            obs[11] = np.mean([job.estimated_memory_gb for job in self.current_jobs])
            obs[12] = np.mean([job.estimated_storage_gb for job in self.current_jobs])
        
        # Performance metrics (7 values)
        obs[13] = self.total_throughput
        obs[14] = self.average_completion_time / 3600.0  # Normalize to hours
        obs[15] = self.deadline_miss_count
        
        if self.resource_utilization_history:
            recent_util = self.resource_utilization_history[-5:]  # Last 5 steps
            obs[16] = np.mean([u["cpu_utilization"] for u in recent_util])
            obs[17] = np.mean([u["memory_utilization"] for u in recent_util])
            obs[18] = np.mean([u["average_utilization"] for u in recent_util])
            obs[19] = np.std([u["average_utilization"] for u in recent_util])
        
        # System state (5 values)
        obs[20] = self.current_step / self.max_steps_per_episode  # Episode progress
        obs[21] = len(self.current_jobs) / self.resource_config.max_concurrent_pipelines
        obs[22] = len(self.running_jobs) / self.resource_config.max_concurrent_pipelines
        obs[23] = self.episode_count / 100.0  # Normalized episode count
        
        # Time of day effect (simulate varying workloads)
        hour_of_day = self.current_simulation_time.hour
        obs[24] = np.sin(2 * np.pi * hour_of_day / 24)  # Cyclic time encoding
        
        # Ensure no NaN or infinite values
        obs = np.nan_to_num(obs, nan=0.0, posinf=1.0, neginf=-1.0)
        
        return obs
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary."""
        if not self.completed_jobs and not self.resource_utilization_history:
            return {"status": "no_data"}
        
        # Job completion metrics
        job_metrics = {
            "total_completed": len(self.completed_jobs),
            "total_failed": len(self.failed_jobs),
            "deadline_miss_rate": self.deadline_miss_count / max(1, len(self.completed_jobs)),
            "average_completion_time_hours": self.average_completion_time / 3600.0 if self.average_completion_time > 0 else 0,
            "throughput_jobs_per_step": self.total_throughput
        }
        
        # Resource utilization metrics
        if self.resource_utilization_history:
            util_data = self.resource_utilization_history
            resource_metrics = {
                "average_cpu_utilization": np.mean([u["cpu_utilization"] for u in util_data]),
                "average_memory_utilization": np.mean([u["memory_utilization"] for u in util_data]),
                "average_storage_utilization": np.mean([u["storage_utilization"] for u in util_data]),
                "peak_cpu_utilization": np.max([u["cpu_utilization"] for u in util_data]),
                "peak_memory_utilization": np.max([u["memory_utilization"] for u in util_data]),
                "utilization_stability": 1.0 - np.std([u["average_utilization"] for u in util_data])
            }
        else:
            resource_metrics = {}
        
        # Efficiency metrics
        if self.completed_jobs:
            efficiency_scores = [job["efficiency_score"] for job in self.completed_jobs]
            efficiency_metrics = {
                "average_efficiency": np.mean(efficiency_scores),
                "max_efficiency": np.max(efficiency_scores),
                "min_efficiency": np.min(efficiency_scores),
                "efficiency_consistency": 1.0 - np.std(efficiency_scores)
            }
        else:
            efficiency_metrics = {}
        
        return {
            "status": "success",
            "job_metrics": job_metrics,
            "resource_metrics": resource_metrics,
            "efficiency_metrics": efficiency_metrics,
            "episode_info": {
                "current_episode": self.episode_count,
                "current_step": self.current_step,
                "simulation_time": self.current_simulation_time.isoformat()
            }
        }