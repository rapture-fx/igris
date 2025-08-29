"""
Data Quality Optimization Environment

This environment optimizes data quality thresholds and processing parameters
to balance data quality requirements with processing costs and throughput.
The agent learns to make trade-offs between data cleanliness and efficiency.
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
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class DataQualityIssue(str, Enum):
    """Types of data quality issues."""
    MISSING_VALUES = "missing_values"
    DUPLICATES = "duplicates"
    OUTLIERS = "outliers"
    INCONSISTENT_FORMAT = "inconsistent_format"
    INVALID_VALUES = "invalid_values"
    SCHEMA_VIOLATIONS = "schema_violations"
    REFERENTIAL_INTEGRITY = "referential_integrity"


@dataclass
class DataQualityMetrics:
    """Data quality metrics for a dataset."""
    completeness: float = 0.0  # Percentage of non-missing values
    uniqueness: float = 0.0    # Percentage of unique records
    validity: float = 0.0      # Percentage of valid values
    consistency: float = 0.0   # Consistency across columns
    accuracy: float = 0.0      # Estimated accuracy of data
    timeliness: float = 0.0    # Data freshness score
    overall_score: float = 0.0 # Weighted overall quality score


@dataclass
class DataProcessingJob:
    """Represents a data processing job with quality requirements."""
    job_id: str
    dataset_size_mb: float
    data_complexity: float  # 0-1 scale
    quality_requirements: Dict[str, float]  # Required quality thresholds
    business_priority: int  # 1-10 scale
    deadline: Optional[datetime] = None
    processing_cost_budget: Optional[float] = None
    current_quality: Optional[DataQualityMetrics] = None


class DataQualityEnvironment(gym.Env):
    """
    RL Environment for optimizing data quality processing parameters.
    
    The agent learns to set quality thresholds and processing parameters
    to maximize data quality while minimizing processing costs and time.
    """
    
    def __init__(self, 
                 optimization_objective: str = "balanced_quality_cost",
                 simulation_mode: bool = True,
                 cost_per_mb_processed: float = 0.01):
        super().__init__()
        
        self.optimization_objective = optimization_objective
        self.simulation_mode = simulation_mode
        self.cost_per_mb_processed = cost_per_mb_processed
        
        # Define action and observation spaces
        self.action_space = self._create_action_space()
        self.observation_space = self._create_observation_space()
        
        # Environment state
        self.current_jobs: List[DataProcessingJob] = []
        self.completed_jobs: List[Dict[str, Any]] = []
        self.quality_history: List[Dict[str, Any]] = []
        
        # Quality processing parameters (learned by the agent)
        self.quality_thresholds = {
            "completeness_threshold": 0.95,
            "uniqueness_threshold": 0.98,
            "validity_threshold": 0.99,
            "consistency_threshold": 0.90,
            "accuracy_threshold": 0.95
        }
        
        self.processing_parameters = {
            "missing_value_strategy": 0.5,  # 0=drop, 0.5=impute, 1=keep
            "outlier_detection_sensitivity": 0.5,  # 0=loose, 1=strict
            "duplicate_removal_aggressiveness": 0.7,
            "validation_strictness": 0.8,
            "format_correction_level": 0.6
        }
        
        # Performance tracking
        self.total_processing_cost = 0.0
        self.total_quality_score = 0.0
        self.average_processing_time = 0.0
        self.quality_improvement_rate = 0.0
        
        # Episode tracking
        self.current_step = 0
        self.episode_count = 0
        self.max_steps_per_episode = 100
        
        logger.info("Initialized DataQualityEnvironment")
    
    def reset(self) -> np.ndarray:
        """Reset the environment to initial state."""
        self.current_step = 0
        self.episode_count += 1
        
        # Clear job queues
        self.current_jobs = []
        self.completed_jobs = []
        self.quality_history = []
        
        # Reset performance metrics
        self.total_processing_cost = 0.0
        self.total_quality_score = 0.0
        self.average_processing_time = 0.0
        self.quality_improvement_rate = 0.0
        
        # Reset processing parameters to defaults
        self.quality_thresholds = {
            "completeness_threshold": 0.95,
            "uniqueness_threshold": 0.98,
            "validity_threshold": 0.99,
            "consistency_threshold": 0.90,
            "accuracy_threshold": 0.95
        }
        
        self.processing_parameters = {
            "missing_value_strategy": 0.5,
            "outlier_detection_sensitivity": 0.5,
            "duplicate_removal_aggressiveness": 0.7,
            "validation_strictness": 0.8,
            "format_correction_level": 0.6
        }
        
        # Generate initial jobs
        self.current_jobs = self._generate_data_jobs()
        
        observation = self._create_observation()
        logger.debug(f"Data quality environment reset for episode {self.episode_count}")
        return observation
    
    def step(self, action: np.ndarray) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        """Execute one step in the environment."""
        self.current_step += 1
        
        # Interpret action as quality parameter updates
        parameter_updates = self._action_to_parameters(action)
        
        # Apply parameter updates
        self._update_quality_parameters(parameter_updates)
        
        # Process current jobs with updated parameters
        processing_results = self._process_data_jobs()
        
        # Calculate reward
        reward = self._calculate_reward(processing_results)
        
        # Update performance metrics
        self._update_performance_metrics(processing_results)
        
        # Generate new jobs
        new_jobs = self._generate_new_data_jobs()
        self.current_jobs.extend(new_jobs)
        
        # Create observation
        observation = self._create_observation()
        
        # Check if episode is done
        done = (self.current_step >= self.max_steps_per_episode or
                (len(self.current_jobs) == 0 and self.current_step > 20))
        
        # Prepare info
        info = {
            "processing_results": processing_results,
            "current_parameters": {
                "quality_thresholds": self.quality_thresholds.copy(),
                "processing_parameters": self.processing_parameters.copy()
            },
            "performance_metrics": {
                "total_cost": self.total_processing_cost,
                "average_quality": self.total_quality_score / max(1, len(self.completed_jobs)),
                "quality_improvement_rate": self.quality_improvement_rate
            },
            "jobs_status": {
                "pending": len(self.current_jobs),
                "completed": len(self.completed_jobs)
            }
        }
        
        return observation, reward, done, info
    
    def _create_action_space(self) -> spaces.Box:
        """Create action space for quality parameter adjustments."""
        # Action space represents adjustments to quality parameters
        # [completeness_adj, uniqueness_adj, validity_adj, consistency_adj, accuracy_adj,
        #  missing_strategy_adj, outlier_sensitivity_adj, duplicate_aggressiveness_adj,
        #  validation_strictness_adj, format_correction_adj]
        return spaces.Box(low=-0.2, high=0.2, shape=(10,), dtype=np.float32)
    
    def _create_observation_space(self) -> spaces.Box:
        """Create observation space for environment state."""
        # Observation includes:
        # - Current quality thresholds (5 values)
        # - Current processing parameters (5 values)
        # - Job characteristics (8 values)
        # - Performance metrics (7 values)
        obs_dim = 25
        return spaces.Box(low=0.0, high=1.0, shape=(obs_dim,), dtype=np.float32)
    
    def _generate_data_jobs(self, num_jobs: int = None) -> List[DataProcessingJob]:
        """Generate data processing jobs with varying quality requirements."""
        if num_jobs is None:
            num_jobs = np.random.randint(3, 8)
        
        jobs = []
        
        for i in range(num_jobs):
            # Generate realistic job characteristics
            dataset_size = np.random.lognormal(mean=3.0, sigma=1.5)  # MB
            complexity = np.random.uniform(0.2, 1.0)
            priority = np.random.randint(1, 11)
            
            # Generate quality requirements based on business priority
            base_quality = 0.7 + (priority / 10) * 0.25  # Higher priority = higher quality requirements
            quality_variation = np.random.uniform(-0.1, 0.1)
            
            quality_requirements = {
                "completeness": np.clip(base_quality + quality_variation, 0.5, 1.0),
                "uniqueness": np.clip(base_quality + np.random.uniform(-0.05, 0.05), 0.6, 1.0),
                "validity": np.clip(base_quality + np.random.uniform(-0.05, 0.05), 0.7, 1.0),
                "consistency": np.clip(base_quality + np.random.uniform(-0.1, 0.1), 0.5, 1.0),
                "accuracy": np.clip(base_quality + np.random.uniform(-0.1, 0.1), 0.6, 1.0)
            }
            
            # Generate current quality (usually lower than requirements)
            current_quality = DataQualityMetrics(
                completeness=max(0.3, quality_requirements["completeness"] - np.random.uniform(0.1, 0.4)),
                uniqueness=max(0.4, quality_requirements["uniqueness"] - np.random.uniform(0.05, 0.3)),
                validity=max(0.5, quality_requirements["validity"] - np.random.uniform(0.05, 0.3)),
                consistency=max(0.3, quality_requirements["consistency"] - np.random.uniform(0.1, 0.4)),
                accuracy=max(0.4, quality_requirements["accuracy"] - np.random.uniform(0.1, 0.4))
            )
            
            current_quality.overall_score = np.mean([
                current_quality.completeness, current_quality.uniqueness,
                current_quality.validity, current_quality.consistency,
                current_quality.accuracy
            ])
            
            # Generate deadline (some jobs have deadlines)
            deadline = None
            if np.random.random() < 0.4:  # 40% have deadlines
                deadline_hours = np.random.uniform(1.0, 48.0)
                deadline = datetime.now() + timedelta(hours=deadline_hours)
            
            # Generate cost budget
            cost_budget = None
            if np.random.random() < 0.6:  # 60% have cost budgets
                base_cost = dataset_size * self.cost_per_mb_processed
                cost_multiplier = np.random.uniform(1.5, 5.0)
                cost_budget = base_cost * cost_multiplier
            
            job = DataProcessingJob(
                job_id=f"data_job_{self.episode_count}_{i}",
                dataset_size_mb=dataset_size,
                data_complexity=complexity,
                quality_requirements=quality_requirements,
                business_priority=priority,
                deadline=deadline,
                processing_cost_budget=cost_budget,
                current_quality=current_quality
            )
            
            jobs.append(job)
        
        return jobs
    
    def _generate_new_data_jobs(self) -> List[DataProcessingJob]:
        """Generate new jobs that arrive during the episode."""
        # Lower arrival rate than resource allocation
        arrival_rate = 0.2
        num_new_jobs = np.random.poisson(arrival_rate)
        
        if num_new_jobs > 0:
            return self._generate_data_jobs(num_new_jobs)
        return []
    
    def _action_to_parameters(self, action: np.ndarray) -> Dict[str, float]:
        """Convert RL action to parameter adjustments."""
        return {
            # Quality threshold adjustments
            "completeness_threshold_adj": action[0],
            "uniqueness_threshold_adj": action[1],
            "validity_threshold_adj": action[2],
            "consistency_threshold_adj": action[3],
            "accuracy_threshold_adj": action[4],
            
            # Processing parameter adjustments
            "missing_value_strategy_adj": action[5],
            "outlier_detection_sensitivity_adj": action[6],
            "duplicate_removal_aggressiveness_adj": action[7],
            "validation_strictness_adj": action[8],
            "format_correction_level_adj": action[9]
        }
    
    def _update_quality_parameters(self, parameter_updates: Dict[str, float]):
        """Update quality parameters based on RL action."""
        # Update quality thresholds
        for threshold_name in self.quality_thresholds:
            adj_key = f"{threshold_name}_adj"
            if adj_key in parameter_updates:
                current_value = self.quality_thresholds[threshold_name]
                adjustment = parameter_updates[adj_key]
                new_value = np.clip(current_value + adjustment, 0.5, 1.0)
                self.quality_thresholds[threshold_name] = new_value
        
        # Update processing parameters
        processing_params = [
            "missing_value_strategy", "outlier_detection_sensitivity",
            "duplicate_removal_aggressiveness", "validation_strictness",
            "format_correction_level"
        ]
        
        for param_name in processing_params:
            adj_key = f"{param_name}_adj"
            if adj_key in parameter_updates:
                current_value = self.processing_parameters[param_name]
                adjustment = parameter_updates[adj_key]
                new_value = np.clip(current_value + adjustment, 0.0, 1.0)
                self.processing_parameters[param_name] = new_value
    
    def _process_data_jobs(self) -> Dict[str, Any]:
        """Process current data jobs with current quality parameters."""
        if not self.current_jobs:
            return {
                "jobs_processed": 0,
                "total_cost": 0.0,
                "average_quality_improvement": 0.0,
                "jobs_meeting_requirements": 0,
                "processing_details": []
            }
        
        processed_jobs = []
        total_cost = 0.0
        jobs_meeting_requirements = 0
        quality_improvements = []
        
        for job in self.current_jobs[:]:  # Process a copy to avoid modification issues
            # Simulate data quality processing
            processing_result = self._simulate_quality_processing(job)
            
            # Calculate processing cost
            base_cost = job.dataset_size_mb * self.cost_per_mb_processed
            complexity_multiplier = 1.0 + job.data_complexity
            
            # Cost increases with higher quality standards
            quality_multiplier = 1.0 + sum(self.quality_thresholds.values()) - 2.5
            processing_multiplier = 1.0 + sum(self.processing_parameters.values()) - 2.5
            
            total_processing_cost = base_cost * complexity_multiplier * quality_multiplier * processing_multiplier
            
            # Check budget constraints
            if job.processing_cost_budget and total_processing_cost > job.processing_cost_budget:
                # Reduce quality to fit budget
                processing_result = self._reduce_quality_for_budget(processing_result, job.processing_cost_budget, total_processing_cost)
                total_processing_cost = job.processing_cost_budget
            
            total_cost += total_processing_cost
            
            # Check if job meets quality requirements
            meets_requirements = self._check_quality_requirements(processing_result["final_quality"], job.quality_requirements)
            if meets_requirements:
                jobs_meeting_requirements += 1
            
            # Calculate quality improvement
            initial_quality = job.current_quality.overall_score
            final_quality = processing_result["final_quality"].overall_score
            quality_improvement = final_quality - initial_quality
            quality_improvements.append(quality_improvement)
            
            # Record completed job
            completed_job = {
                "job_id": job.job_id,
                "job": job,
                "processing_cost": total_processing_cost,
                "initial_quality": initial_quality,
                "final_quality": final_quality,
                "quality_improvement": quality_improvement,
                "meets_requirements": meets_requirements,
                "processing_time": processing_result["processing_time"],
                "quality_details": processing_result["final_quality"]
            }
            
            processed_jobs.append(completed_job)
            self.completed_jobs.append(completed_job)
            
            # Remove from current jobs
            self.current_jobs.remove(job)
        
        self.total_processing_cost += total_cost
        
        return {
            "jobs_processed": len(processed_jobs),
            "total_cost": total_cost,
            "average_quality_improvement": np.mean(quality_improvements) if quality_improvements else 0.0,
            "jobs_meeting_requirements": jobs_meeting_requirements,
            "processing_details": processed_jobs
        }
    
    def _simulate_quality_processing(self, job: DataProcessingJob) -> Dict[str, Any]:
        """Simulate quality processing for a job."""
        initial_quality = job.current_quality
        
        # Simulate improvement based on processing parameters
        completeness_improvement = self._simulate_completeness_processing(
            initial_quality.completeness, 
            self.processing_parameters["missing_value_strategy"],
            self.quality_thresholds["completeness_threshold"]
        )
        
        uniqueness_improvement = self._simulate_uniqueness_processing(
            initial_quality.uniqueness,
            self.processing_parameters["duplicate_removal_aggressiveness"],
            self.quality_thresholds["uniqueness_threshold"]
        )
        
        validity_improvement = self._simulate_validity_processing(
            initial_quality.validity,
            self.processing_parameters["validation_strictness"],
            self.quality_thresholds["validity_threshold"]
        )
        
        consistency_improvement = self._simulate_consistency_processing(
            initial_quality.consistency,
            self.processing_parameters["format_correction_level"],
            self.quality_thresholds["consistency_threshold"]
        )
        
        accuracy_improvement = self._simulate_accuracy_processing(
            initial_quality.accuracy,
            self.processing_parameters["outlier_detection_sensitivity"],
            self.quality_thresholds["accuracy_threshold"]
        )
        
        # Create final quality metrics
        final_quality = DataQualityMetrics(
            completeness=min(1.0, initial_quality.completeness + completeness_improvement),
            uniqueness=min(1.0, initial_quality.uniqueness + uniqueness_improvement),
            validity=min(1.0, initial_quality.validity + validity_improvement),
            consistency=min(1.0, initial_quality.consistency + consistency_improvement),
            accuracy=min(1.0, initial_quality.accuracy + accuracy_improvement)
        )
        
        final_quality.overall_score = np.mean([
            final_quality.completeness, final_quality.uniqueness,
            final_quality.validity, final_quality.consistency,
            final_quality.accuracy
        ])
        
        # Simulate processing time (higher quality = more time)
        base_time = job.dataset_size_mb * job.data_complexity * 0.1  # Base processing time
        quality_time_multiplier = 1.0 + sum(self.quality_thresholds.values()) - 2.5
        processing_time = base_time * quality_time_multiplier
        
        return {
            "final_quality": final_quality,
            "processing_time": processing_time,
            "improvements": {
                "completeness": completeness_improvement,
                "uniqueness": uniqueness_improvement,
                "validity": validity_improvement,
                "consistency": consistency_improvement,
                "accuracy": accuracy_improvement
            }
        }
    
    def _simulate_completeness_processing(self, initial_completeness: float, 
                                        strategy: float, threshold: float) -> float:
        """Simulate completeness improvement."""
        if initial_completeness >= threshold:
            return 0.0
        
        max_improvement = threshold - initial_completeness
        
        # Strategy: 0=drop records, 0.5=impute, 1=keep as-is
        if strategy < 0.33:  # Drop strategy
            improvement = max_improvement * np.random.uniform(0.8, 1.0)
        elif strategy < 0.67:  # Imputation strategy
            improvement = max_improvement * np.random.uniform(0.5, 0.9)
        else:  # Keep strategy
            improvement = max_improvement * np.random.uniform(0.1, 0.4)
        
        return improvement
    
    def _simulate_uniqueness_processing(self, initial_uniqueness: float,
                                      aggressiveness: float, threshold: float) -> float:
        """Simulate uniqueness improvement through duplicate removal."""
        if initial_uniqueness >= threshold:
            return 0.0
        
        max_improvement = threshold - initial_uniqueness
        # Higher aggressiveness = better duplicate detection
        improvement = max_improvement * aggressiveness * np.random.uniform(0.7, 1.0)
        
        return improvement
    
    def _simulate_validity_processing(self, initial_validity: float,
                                    strictness: float, threshold: float) -> float:
        """Simulate validity improvement through validation."""
        if initial_validity >= threshold:
            return 0.0
        
        max_improvement = threshold - initial_validity
        # Higher strictness = better validation
        improvement = max_improvement * strictness * np.random.uniform(0.6, 0.95)
        
        return improvement
    
    def _simulate_consistency_processing(self, initial_consistency: float,
                                       correction_level: float, threshold: float) -> float:
        """Simulate consistency improvement through format correction."""
        if initial_consistency >= threshold:
            return 0.0
        
        max_improvement = threshold - initial_consistency
        # Higher correction level = better consistency
        improvement = max_improvement * correction_level * np.random.uniform(0.5, 0.9)
        
        return improvement
    
    def _simulate_accuracy_processing(self, initial_accuracy: float,
                                    sensitivity: float, threshold: float) -> float:
        """Simulate accuracy improvement through outlier detection."""
        if initial_accuracy >= threshold:
            return 0.0
        
        max_improvement = threshold - initial_accuracy
        # Higher sensitivity = better outlier detection = better accuracy
        improvement = max_improvement * sensitivity * np.random.uniform(0.4, 0.8)
        
        return improvement
    
    def _reduce_quality_for_budget(self, processing_result: Dict[str, Any], 
                                 budget: float, current_cost: float) -> Dict[str, Any]:
        """Reduce quality processing to fit within budget constraints."""
        cost_reduction_ratio = budget / current_cost
        
        # Reduce quality improvements proportionally
        final_quality = processing_result["final_quality"]
        improvements = processing_result["improvements"]
        
        for quality_aspect in improvements:
            improvements[quality_aspect] *= cost_reduction_ratio
        
        # Recalculate final quality
        initial_quality = DataQualityMetrics(
            completeness=final_quality.completeness - improvements["completeness"],
            uniqueness=final_quality.uniqueness - improvements["uniqueness"],
            validity=final_quality.validity - improvements["validity"],
            consistency=final_quality.consistency - improvements["consistency"],
            accuracy=final_quality.accuracy - improvements["accuracy"]
        )
        
        processing_result["final_quality"] = DataQualityMetrics(
            completeness=initial_quality.completeness + improvements["completeness"],
            uniqueness=initial_quality.uniqueness + improvements["uniqueness"],
            validity=initial_quality.validity + improvements["validity"],
            consistency=initial_quality.consistency + improvements["consistency"],
            accuracy=initial_quality.accuracy + improvements["accuracy"]
        )
        
        processing_result["final_quality"].overall_score = np.mean([
            processing_result["final_quality"].completeness,
            processing_result["final_quality"].uniqueness,
            processing_result["final_quality"].validity,
            processing_result["final_quality"].consistency,
            processing_result["final_quality"].accuracy
        ])
        
        # Reduce processing time proportionally
        processing_result["processing_time"] *= cost_reduction_ratio
        
        return processing_result
    
    def _check_quality_requirements(self, final_quality: DataQualityMetrics, 
                                  requirements: Dict[str, float]) -> bool:
        """Check if final quality meets job requirements."""
        quality_mapping = {
            "completeness": final_quality.completeness,
            "uniqueness": final_quality.uniqueness,
            "validity": final_quality.validity,
            "consistency": final_quality.consistency,
            "accuracy": final_quality.accuracy
        }
        
        for requirement, threshold in requirements.items():
            if quality_mapping.get(requirement, 0.0) < threshold:
                return False
        
        return True
    
    def _calculate_reward(self, processing_results: Dict[str, Any]) -> float:
        """Calculate reward based on quality processing results."""
        reward = 0.0
        
        # Base reward for processing jobs
        jobs_processed = processing_results["jobs_processed"]
        reward += jobs_processed * 1.0
        
        # Reward for quality improvement
        quality_improvement = processing_results["average_quality_improvement"]
        reward += quality_improvement * 10.0  # Scale up quality improvements
        
        # Reward for meeting requirements
        jobs_meeting_requirements = processing_results["jobs_meeting_requirements"]
        reward += jobs_meeting_requirements * 2.0
        
        # Cost efficiency reward/penalty
        if jobs_processed > 0:
            average_cost_per_job = processing_results["total_cost"] / jobs_processed
            # Penalty for very high costs, reward for efficiency
            if average_cost_per_job > 5.0:
                reward -= (average_cost_per_job - 5.0) * 0.5
            elif average_cost_per_job < 2.0:
                reward += (2.0 - average_cost_per_job) * 0.3
        
        # Bonus for balanced quality parameters
        quality_balance = 1.0 - np.std(list(self.quality_thresholds.values()))
        reward += quality_balance * 0.5
        
        # Long-term performance bonus
        if len(self.completed_jobs) > 5:
            recent_jobs = self.completed_jobs[-5:]
            avg_requirements_met = np.mean([job["meets_requirements"] for job in recent_jobs])
            reward += avg_requirements_met * 1.0
        
        # Penalty for extreme parameter values (avoid overfitting)
        extreme_penalty = 0.0
        for param_value in self.processing_parameters.values():
            if param_value < 0.1 or param_value > 0.9:
                extreme_penalty += 0.2
        reward -= extreme_penalty
        
        return reward
    
    def _update_performance_metrics(self, processing_results: Dict[str, Any]):
        """Update overall performance metrics."""
        if processing_results["jobs_processed"] > 0:
            # Update total quality score
            for job_detail in processing_results["processing_details"]:
                self.total_quality_score += job_detail["final_quality"]
            
            # Update quality improvement rate
            quality_improvements = [job["quality_improvement"] for job in processing_results["processing_details"]]
            if quality_improvements:
                recent_improvement_rate = np.mean(quality_improvements)
                if self.quality_improvement_rate == 0.0:
                    self.quality_improvement_rate = recent_improvement_rate
                else:
                    # Exponential moving average
                    self.quality_improvement_rate = 0.7 * self.quality_improvement_rate + 0.3 * recent_improvement_rate
            
            # Update average processing time
            processing_times = [job["processing_time"] for job in processing_results["processing_details"]]
            if processing_times:
                if self.average_processing_time == 0.0:
                    self.average_processing_time = np.mean(processing_times)
                else:
                    self.average_processing_time = 0.8 * self.average_processing_time + 0.2 * np.mean(processing_times)
    
    def _create_observation(self) -> np.ndarray:
        """Create observation vector representing current environment state."""
        obs = np.zeros(25, dtype=np.float32)
        
        # Current quality thresholds (5 values)
        obs[0] = self.quality_thresholds["completeness_threshold"]
        obs[1] = self.quality_thresholds["uniqueness_threshold"]
        obs[2] = self.quality_thresholds["validity_threshold"]
        obs[3] = self.quality_thresholds["consistency_threshold"]
        obs[4] = self.quality_thresholds["accuracy_threshold"]
        
        # Current processing parameters (5 values)
        obs[5] = self.processing_parameters["missing_value_strategy"]
        obs[6] = self.processing_parameters["outlier_detection_sensitivity"]
        obs[7] = self.processing_parameters["duplicate_removal_aggressiveness"]
        obs[8] = self.processing_parameters["validation_strictness"]
        obs[9] = self.processing_parameters["format_correction_level"]
        
        # Job characteristics (8 values)
        obs[10] = len(self.current_jobs)  # Number of pending jobs
        obs[11] = len(self.completed_jobs)  # Number of completed jobs
        
        if self.current_jobs:
            # Average job characteristics
            obs[12] = np.mean([job.dataset_size_mb for job in self.current_jobs]) / 100.0  # Normalize
            obs[13] = np.mean([job.data_complexity for job in self.current_jobs])
            obs[14] = np.mean([job.business_priority for job in self.current_jobs]) / 10.0
            
            # Average quality requirements
            all_requirements = []
            for job in self.current_jobs:
                all_requirements.extend(job.quality_requirements.values())
            obs[15] = np.mean(all_requirements) if all_requirements else 0.0
            
            # Average current quality
            current_qualities = [job.current_quality.overall_score for job in self.current_jobs]
            obs[16] = np.mean(current_qualities)
            
            # Jobs with deadlines
            jobs_with_deadlines = sum(1 for job in self.current_jobs if job.deadline)
            obs[17] = jobs_with_deadlines / len(self.current_jobs)
        
        # Performance metrics (7 values)
        obs[18] = self.total_processing_cost / max(1.0, len(self.completed_jobs))  # Average cost per job
        obs[19] = self.total_quality_score / max(1.0, len(self.completed_jobs))   # Average quality score
        obs[20] = self.quality_improvement_rate
        obs[21] = self.average_processing_time / 10.0  # Normalize processing time
        
        # Success rate metrics
        if len(self.completed_jobs) > 0:
            success_rate = sum(1 for job in self.completed_jobs if job["meets_requirements"]) / len(self.completed_jobs)
            obs[22] = success_rate
        
        # Episode progress
        obs[23] = self.current_step / self.max_steps_per_episode
        obs[24] = self.episode_count / 100.0  # Normalize episode count
        
        # Ensure no NaN or infinite values
        obs = np.nan_to_num(obs, nan=0.0, posinf=1.0, neginf=-1.0)
        
        return obs
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary."""
        if not self.completed_jobs:
            return {"status": "no_data"}
        
        # Quality metrics
        quality_scores = [job["final_quality"] for job in self.completed_jobs]
        quality_improvements = [job["quality_improvement"] for job in self.completed_jobs]
        success_rate = sum(1 for job in self.completed_jobs if job["meets_requirements"]) / len(self.completed_jobs)
        
        # Cost metrics
        costs = [job["processing_cost"] for job in self.completed_jobs]
        processing_times = [job["processing_time"] for job in self.completed_jobs]
        
        return {
            "status": "success",
            "quality_metrics": {
                "average_final_quality": np.mean(quality_scores),
                "average_quality_improvement": np.mean(quality_improvements),
                "quality_consistency": 1.0 - np.std(quality_scores),
                "requirements_success_rate": success_rate
            },
            "cost_metrics": {
                "total_processing_cost": self.total_processing_cost,
                "average_cost_per_job": np.mean(costs),
                "cost_efficiency": np.mean(quality_improvements) / np.mean(costs) if np.mean(costs) > 0 else 0,
                "average_processing_time": np.mean(processing_times)
            },
            "parameter_settings": {
                "quality_thresholds": self.quality_thresholds.copy(),
                "processing_parameters": self.processing_parameters.copy()
            },
            "episode_info": {
                "current_episode": self.episode_count,
                "current_step": self.current_step,
                "jobs_completed": len(self.completed_jobs),
                "jobs_pending": len(self.current_jobs)
            }
        }