"""
Data Quality Optimization RL Agent

This agent optimizes data quality thresholds and processing parameters
to balance data quality requirements with processing costs and throughput.
"""

import logging
import json
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import pickle
import os

from stable_baselines3 import PPO, A2C, SAC
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.logger import configure

from ..environments.data_quality_env import DataQualityEnvironment, DataQualityMetrics
from ..models.rl_optimization_models import OptimizationStatus, OptimizationType

logger = logging.getLogger(__name__)


@dataclass
class DataQualityAgentConfig:
    """Configuration for Data Quality RL Agent."""
    agent_type: str = "ppo"
    learning_rate: float = 3e-4
    n_steps: int = 1024
    batch_size: int = 64
    n_epochs: int = 10
    gamma: float = 0.99
    max_episodes: int = 80
    max_training_time: int = 5400  # 1.5 hours
    early_stopping_patience: int = 12
    target_quality_score: float = 0.90
    enable_tensorboard: bool = True
    save_checkpoints: bool = True
    checkpoint_frequency: int = 10


class DataQualityMetricsCallback(BaseCallback):
    """Custom callback for logging data quality metrics."""
    
    def __init__(self, verbose: int = 0):
        super().__init__(verbose)
        self.episode_metrics = []
        
    def _on_step(self) -> bool:
        if self.locals.get("done"):
            info = self.locals.get("info", [{}])
            if info and isinstance(info, list) and len(info) > 0:
                episode_info = info[0]
                
                # Extract data quality metrics
                perf_metrics = episode_info.get("performance_metrics", {})
                current_params = episode_info.get("current_parameters", {})
                
                # Log quality parameters
                quality_thresholds = current_params.get("quality_thresholds", {})
                for param, value in quality_thresholds.items():
                    self.logger.record(f"quality_thresholds/{param}", value)
                
                # Log processing parameters
                processing_params = current_params.get("processing_parameters", {})
                for param, value in processing_params.items():
                    self.logger.record(f"processing_params/{param}", value)
                
                # Log performance metrics
                self.logger.record("performance/total_cost", perf_metrics.get("total_cost", 0))
                self.logger.record("performance/average_quality", perf_metrics.get("average_quality", 0))
                self.logger.record("performance/quality_improvement_rate", perf_metrics.get("quality_improvement_rate", 0))
                
                # Log job status
                jobs = episode_info.get("jobs_status", {})
                self.logger.record("jobs/pending", jobs.get("pending", 0))
                self.logger.record("jobs/completed", jobs.get("completed", 0))
                
        return True


class DataQualityAgent:
    """
    RL Agent for optimizing data quality processing parameters.
    
    Uses reinforcement learning to learn optimal quality thresholds and
    processing parameters that balance quality requirements with costs.
    """
    
    def __init__(self, 
                 config: Optional[DataQualityAgentConfig] = None,
                 cost_per_mb: float = 0.01):
        self.config = config or DataQualityAgentConfig()
        self.cost_per_mb = cost_per_mb
        
        # Initialize environment
        self.environment = None
        self.agent = None
        self.optimization_session = None
        
        # Performance tracking
        self.best_quality_score = -np.inf
        self.best_quality_config = None
        self.quality_history = []
        self.cost_history = []
        self.training_metrics = []
        
        # Early stopping
        self.no_improvement_episodes = 0
        self.convergence_threshold = 0.005
        
        logger.info(f"Initialized DataQualityAgent with {self.config.agent_type} algorithm")
    
    def optimize_quality_parameters(self, 
                                  data_processing_requirements: Dict[str, Any],
                                  optimization_objective: str = "balanced_quality_cost") -> Dict[str, Any]:
        """
        Optimize data quality processing parameters.
        
        Args:
            data_processing_requirements: Requirements for data quality processing
            optimization_objective: Optimization objective
            
        Returns:
            Optimization results with best quality configuration
        """
        logger.info("Starting data quality parameter optimization")
        start_time = datetime.now()
        
        try:
            # Create optimization session
            self.optimization_session = {
                "id": f"quality_opt_{int(start_time.timestamp())}",
                "type": OptimizationType.DATA_QUALITY,
                "start_time": start_time,
                "objective": optimization_objective,
                "requirements": data_processing_requirements,
                "status": OptimizationStatus.RUNNING
            }
            
            # Initialize environment
            self.environment = DataQualityEnvironment(
                optimization_objective=optimization_objective,
                simulation_mode=True,
                cost_per_mb_processed=self.cost_per_mb
            )
            
            # Initialize RL agent
            self._initialize_agent()
            
            # Run optimization
            optimization_result = self._run_optimization_loop()
            
            # Evaluate final configuration
            final_evaluation = self._evaluate_quality_configuration()
            
            # Generate recommendations
            recommendations = self._generate_quality_recommendations()
            
            # Combine results
            optimization_time = (datetime.now() - start_time).total_seconds()
            
            result = {
                "success": True,
                "optimization_time": optimization_time,
                "best_quality_score": self.best_quality_score,
                "best_quality_config": self.best_quality_config,
                "final_evaluation": final_evaluation,
                "recommendations": recommendations,
                "training_metrics": self.training_metrics,
                "quality_history": self.quality_history,
                "cost_history": self.cost_history,
                "convergence_info": {
                    "converged": self._check_convergence(),
                    "convergence_episode": self._find_convergence_episode(),
                    "episodes_trained": len(self.quality_history)
                },
                "quality_insights": self._generate_quality_insights()
            }
            
            self.optimization_session["status"] = OptimizationStatus.COMPLETED
            self.optimization_session["result"] = result
            
            logger.info(f"Data quality optimization completed. Best score: {self.best_quality_score:.4f}")
            return result
            
        except Exception as e:
            logger.error(f"Data quality optimization failed: {str(e)}")
            if self.optimization_session:
                self.optimization_session["status"] = OptimizationStatus.FAILED
                self.optimization_session["error"] = str(e)
            
            return {
                "success": False,
                "error": str(e),
                "optimization_time": (datetime.now() - start_time).total_seconds()
            }
    
    def _initialize_agent(self):
        """Initialize the RL agent."""
        # Create vectorized environment
        env = make_vec_env(lambda: self.environment, n_envs=1)
        
        # Configure logging
        log_path = f"./logs/data_quality/{self.optimization_session['id']}"
        os.makedirs(log_path, exist_ok=True)
        
        if self.config.enable_tensorboard:
            new_logger = configure(log_path, ["tensorboard"])
        
        # Initialize agent
        if self.config.agent_type.lower() == "ppo":
            self.agent = PPO(
                "MlpPolicy",
                env,
                learning_rate=self.config.learning_rate,
                n_steps=self.config.n_steps,
                batch_size=self.config.batch_size,
                n_epochs=self.config.n_epochs,
                gamma=self.config.gamma,
                verbose=1,
                tensorboard_log=log_path if self.config.enable_tensorboard else None
            )
        elif self.config.agent_type.lower() == "a2c":
            self.agent = A2C(
                "MlpPolicy",
                env,
                learning_rate=self.config.learning_rate,
                gamma=self.config.gamma,
                verbose=1,
                tensorboard_log=log_path if self.config.enable_tensorboard else None
            )
        elif self.config.agent_type.lower() == "sac":
            self.agent = SAC(
                "MlpPolicy",
                env,
                learning_rate=self.config.learning_rate,
                gamma=self.config.gamma,
                verbose=1,
                tensorboard_log=log_path if self.config.enable_tensorboard else None
            )
        else:
            raise ValueError(f"Unsupported agent type: {self.config.agent_type}")
        
        if self.config.enable_tensorboard:
            self.agent.set_logger(new_logger)
        
        logger.info(f"Initialized {self.config.agent_type.upper()} agent for data quality optimization")
    
    def _run_optimization_loop(self) -> Dict[str, Any]:
        """Run the main optimization training loop."""
        episode = 0
        start_time = datetime.now()
        
        # Setup callbacks
        callbacks = []
        if self.config.enable_tensorboard:
            callbacks.append(DataQualityMetricsCallback())
        
        while episode < self.config.max_episodes:
            episode += 1
            logger.info(f"Starting episode {episode}/{self.config.max_episodes}")
            
            # Train agent for one episode
            episode_start = datetime.now()
            
            self.agent.learn(
                total_timesteps=self.config.n_steps,
                callback=callbacks,
                reset_num_timesteps=False
            )
            
            episode_duration = (datetime.now() - episode_start).total_seconds()
            
            # Evaluate current policy
            quality_metrics = self._evaluate_current_policy()
            current_quality_score = quality_metrics["overall_score"]
            current_cost = quality_metrics["average_cost"]
            
            self.quality_history.append(current_quality_score)
            self.cost_history.append(current_cost)
            
            # Track training metrics
            self.training_metrics.append({
                "episode": episode,
                "quality_score": current_quality_score,
                "cost": current_cost,
                "duration": episode_duration,
                "quality_metrics": quality_metrics,
                "timestamp": datetime.now().isoformat()
            })
            
            # Update best configuration
            if current_quality_score > self.best_quality_score:
                self.best_quality_score = current_quality_score
                self.best_quality_config = self._extract_quality_config()
                self.no_improvement_episodes = 0
                logger.info(f"New best quality score: {self.best_quality_score:.4f}")
            else:
                self.no_improvement_episodes += 1
            
            # Check early stopping
            if self._should_stop_early():
                logger.info("Early stopping triggered")
                break
            
            # Check time limit
            elapsed_time = (datetime.now() - start_time).total_seconds()
            if elapsed_time > self.config.max_training_time:
                logger.info("Training time limit reached")
                break
            
            # Save checkpoint
            if self.config.save_checkpoints and episode % self.config.checkpoint_frequency == 0:
                self._save_checkpoint(episode)
        
        return {
            "episodes_trained": episode,
            "training_time": (datetime.now() - start_time).total_seconds(),
            "final_quality_score": current_quality_score,
            "best_quality_score": self.best_quality_score
        }
    
    def _evaluate_current_policy(self) -> Dict[str, Any]:
        """Evaluate the current RL policy."""
        num_eval_episodes = 3
        quality_scores = []
        costs = []
        success_rates = []
        
        for _ in range(num_eval_episodes):
            obs = self.environment.reset()
            episode_reward = 0
            done = False
            step_count = 0
            
            while not done and step_count < 100:
                action, _ = self.agent.predict(obs, deterministic=True)
                obs, reward, done, info = self.environment.step(action)
                episode_reward += reward
                step_count += 1
            
            # Get performance summary
            performance_summary = self.environment.get_performance_summary()
            if performance_summary["status"] == "success":
                quality_metrics = performance_summary["quality_metrics"]
                cost_metrics = performance_summary["cost_metrics"]
                
                quality_scores.append(quality_metrics["average_final_quality"])
                costs.append(cost_metrics["average_cost_per_job"])
                success_rates.append(quality_metrics["requirements_success_rate"])
        
        return {
            "overall_score": np.mean(quality_scores) if quality_scores else 0,
            "average_cost": np.mean(costs) if costs else 0,
            "success_rate": np.mean(success_rates) if success_rates else 0,
            "quality_consistency": 1.0 - np.std(quality_scores) if len(quality_scores) > 1 else 1.0,
            "cost_efficiency": (np.mean(quality_scores) / np.mean(costs)) if costs and np.mean(costs) > 0 else 0
        }
    
    def _extract_quality_config(self) -> Dict[str, Any]:
        """Extract the current quality configuration from the environment."""
        # Get current environment state
        if hasattr(self.environment, 'quality_thresholds') and hasattr(self.environment, 'processing_parameters'):
            return {
                "quality_thresholds": self.environment.quality_thresholds.copy(),
                "processing_parameters": self.environment.processing_parameters.copy(),
                "score": self.best_quality_score,
                "timestamp": datetime.now().isoformat(),
                "interpretation": self._interpret_quality_config()
            }
        
        return {"status": "configuration_not_available"}
    
    def _interpret_quality_config(self) -> Dict[str, Any]:
        """Interpret the quality configuration in human-readable terms."""
        if not hasattr(self.environment, 'quality_thresholds'):
            return {"status": "not_available"}
        
        thresholds = self.environment.quality_thresholds
        params = self.environment.processing_parameters
        
        # Classify quality approach
        avg_threshold = np.mean(list(thresholds.values()))
        threshold_variance = np.var(list(thresholds.values()))
        
        if avg_threshold > 0.95:
            quality_approach = "high_quality_focused"
        elif avg_threshold < 0.8:
            quality_approach = "cost_optimized"
        else:
            quality_approach = "balanced"
        
        # Classify processing approach
        avg_processing = np.mean(list(params.values()))
        if avg_processing > 0.8:
            processing_approach = "aggressive_cleaning"
        elif avg_processing < 0.4:
            processing_approach = "minimal_processing"
        else:
            processing_approach = "moderate_processing"
        
        return {
            "quality_approach": quality_approach,
            "processing_approach": processing_approach,
            "average_threshold": avg_threshold,
            "threshold_consistency": 1.0 - threshold_variance,
            "processing_intensity": avg_processing,
            "strongest_quality_focus": max(thresholds.items(), key=lambda x: x[1])[0],
            "weakest_quality_focus": min(thresholds.items(), key=lambda x: x[1])[0],
            "most_aggressive_processing": max(params.items(), key=lambda x: x[1])[0],
            "least_aggressive_processing": min(params.items(), key=lambda x: x[1])[0]
        }
    
    def _evaluate_quality_configuration(self) -> Dict[str, Any]:
        """Comprehensive evaluation of the final quality configuration."""
        logger.info("Evaluating final quality configuration")
        
        evaluation_results = []
        
        # Run multiple evaluation episodes
        for eval_episode in range(5):
            obs = self.environment.reset()
            episode_metrics = []
            done = False
            step_count = 0
            
            while not done and step_count < 100:
                action, _ = self.agent.predict(obs, deterministic=True)
                obs, reward, done, info = self.environment.step(action)
                
                episode_metrics.append({
                    "step": step_count,
                    "reward": reward,
                    "performance_metrics": info.get("performance_metrics", {}),
                    "current_parameters": info.get("current_parameters", {})
                })
                
                step_count += 1
            
            # Get final performance summary
            performance_summary = self.environment.get_performance_summary()
            evaluation_results.append({
                "episode": eval_episode,
                "steps": step_count,
                "final_performance": performance_summary,
                "episode_metrics": episode_metrics
            })
        
        # Aggregate evaluation results
        if evaluation_results:
            quality_scores = []
            costs = []
            success_rates = []
            
            for result in evaluation_results:
                perf = result["final_performance"]
                if perf["status"] == "success":
                    quality_scores.append(perf["quality_metrics"]["average_final_quality"])
                    costs.append(perf["cost_metrics"]["average_cost_per_job"])
                    success_rates.append(perf["quality_metrics"]["requirements_success_rate"])
            
            return {
                "evaluation_episodes": len(evaluation_results),
                "average_quality_score": np.mean(quality_scores) if quality_scores else 0,
                "average_cost": np.mean(costs) if costs else 0,
                "average_success_rate": np.mean(success_rates) if success_rates else 0,
                "performance_consistency": {
                    "quality_std": np.std(quality_scores) if quality_scores else 0,
                    "cost_std": np.std(costs) if costs else 0,
                    "success_rate_std": np.std(success_rates) if success_rates else 0
                },
                "cost_efficiency": np.mean(quality_scores) / np.mean(costs) if costs and np.mean(costs) > 0 else 0,
                "detailed_results": evaluation_results
            }
        
        return {"status": "evaluation_failed"}
    
    def _generate_quality_recommendations(self) -> List[str]:
        """Generate recommendations based on optimization results."""
        recommendations = []
        
        if not self.best_quality_config or "interpretation" not in self.best_quality_config:
            recommendations.append("Insufficient data for specific recommendations")
            return recommendations
        
        interpretation = self.best_quality_config["interpretation"]
        
        # Quality approach recommendations
        quality_approach = interpretation.get("quality_approach", "")
        if quality_approach == "high_quality_focused":
            recommendations.append("System optimized for high quality - monitor processing costs")
            recommendations.append("Consider relaxing quality thresholds if cost becomes a concern")
        elif quality_approach == "cost_optimized":
            recommendations.append("System optimized for cost efficiency - monitor data quality outcomes")
            recommendations.append("Consider increasing quality thresholds for critical data")
        
        # Processing approach recommendations
        processing_approach = interpretation.get("processing_approach", "")
        if processing_approach == "aggressive_cleaning":
            recommendations.append("Aggressive data cleaning enabled - ensure it doesn't remove valid data")
            recommendations.append("Monitor processing time and resource usage")
        elif processing_approach == "minimal_processing":
            recommendations.append("Minimal processing may leave quality issues unresolved")
            recommendations.append("Consider increasing processing parameters for better results")
        
        # Performance-based recommendations
        if self.best_quality_score < 0.7:
            recommendations.append("Quality score is below optimal - consider longer training or different parameters")
        
        if len(self.quality_history) > 10:
            recent_trend = np.mean(self.quality_history[-5:]) - np.mean(self.quality_history[-10:-5])
            if recent_trend < -0.05:
                recommendations.append("Quality performance declined recently - check for overfitting")
        
        # Cost efficiency recommendations
        if len(self.cost_history) > 0 and len(self.quality_history) > 0:
            avg_cost = np.mean(self.cost_history)
            avg_quality = np.mean(self.quality_history)
            efficiency = avg_quality / avg_cost if avg_cost > 0 else 0
            
            if efficiency < 10:
                recommendations.append("Cost efficiency is low - consider optimizing processing parameters")
        
        return recommendations
    
    def _should_stop_early(self) -> bool:
        """Check if early stopping criteria are met."""
        # Check patience
        if self.no_improvement_episodes >= self.config.early_stopping_patience:
            return True
        
        # Check target quality
        if self.best_quality_score >= self.config.target_quality_score:
            logger.info(f"Target quality score {self.config.target_quality_score} reached")
            return True
        
        # Check convergence
        if self._check_convergence():
            return True
        
        return False
    
    def _check_convergence(self) -> bool:
        """Check if training has converged."""
        if len(self.quality_history) < 10:
            return False
        
        # Check if quality score has stabilized
        recent_quality = self.quality_history[-10:]
        quality_std = np.std(recent_quality)
        
        return quality_std < self.convergence_threshold
    
    def _find_convergence_episode(self) -> Optional[int]:
        """Find the episode where training converged."""
        if not self._check_convergence():
            return None
        
        window_size = 5
        for i in range(window_size, len(self.quality_history)):
            window = self.quality_history[i-window_size:i]
            if np.std(window) < self.convergence_threshold:
                return i - window_size
        
        return None
    
    def _generate_quality_insights(self) -> Dict[str, Any]:
        """Generate insights about quality optimization patterns."""
        if not self.training_metrics:
            return {"status": "insufficient_data"}
        
        insights = {
            "training_insights": {
                "episodes_trained": len(self.training_metrics),
                "quality_improvement": self.best_quality_score - (self.quality_history[0] if self.quality_history else 0),
                "cost_trend": "increasing" if len(self.cost_history) > 1 and self.cost_history[-1] > self.cost_history[0] else "stable",
                "convergence_speed": self._find_convergence_episode() or len(self.quality_history),
                "training_stability": 1.0 - np.std(self.quality_history) if len(self.quality_history) > 1 else 1.0
            },
            "quality_patterns": self._analyze_quality_patterns(),
            "cost_efficiency_analysis": self._analyze_cost_efficiency(),
            "parameter_sensitivity": self._analyze_parameter_sensitivity()
        }
        
        return insights
    
    def _analyze_quality_patterns(self) -> Dict[str, Any]:
        """Analyze patterns in quality optimization."""
        if not self.training_metrics:
            return {"status": "no_data"}
        
        quality_scores = [m["quality_score"] for m in self.training_metrics]
        
        # Find quality improvement phases
        improvement_phases = []
        current_phase_start = 0
        
        for i in range(1, len(quality_scores)):
            if quality_scores[i] > quality_scores[i-1] + 0.05:  # Significant improvement
                if i - current_phase_start > 5:  # End of stable phase
                    improvement_phases.append({
                        "start_episode": current_phase_start + 1,
                        "end_episode": i,
                        "improvement": quality_scores[i] - quality_scores[current_phase_start]
                    })
                current_phase_start = i
        
        return {
            "peak_quality": max(quality_scores) if quality_scores else 0,
            "quality_variance": np.var(quality_scores) if quality_scores else 0,
            "improvement_phases": improvement_phases,
            "final_vs_initial": quality_scores[-1] - quality_scores[0] if len(quality_scores) > 1 else 0
        }
    
    def _analyze_cost_efficiency(self) -> Dict[str, Any]:
        """Analyze cost efficiency patterns."""
        if not self.training_metrics:
            return {"status": "no_data"}
        
        efficiencies = []
        for metric in self.training_metrics:
            quality = metric["quality_score"]
            cost = metric["cost"]
            if cost > 0:
                efficiencies.append(quality / cost)
        
        if not efficiencies:
            return {"status": "no_efficiency_data"}
        
        return {
            "average_efficiency": np.mean(efficiencies),
            "best_efficiency": max(efficiencies),
            "efficiency_trend": "improving" if len(efficiencies) > 1 and efficiencies[-1] > efficiencies[0] else "stable",
            "efficiency_consistency": 1.0 - np.std(efficiencies)
        }
    
    def _analyze_parameter_sensitivity(self) -> Dict[str, Any]:
        """Analyze sensitivity of different parameters."""
        if not self.training_metrics or len(self.training_metrics) < 10:
            return {"status": "insufficient_data"}
        
        # This would require tracking parameter changes over time
        # For now, return basic analysis
        return {
            "parameter_stability": "high",  # Placeholder
            "most_sensitive_parameter": "completeness_threshold",  # Placeholder
            "optimization_focus": "balanced_approach"  # Placeholder
        }
    
    def _save_checkpoint(self, episode: int):
        """Save training checkpoint."""
        checkpoint_dir = f"./checkpoints/data_quality/{self.optimization_session['id']}"
        os.makedirs(checkpoint_dir, exist_ok=True)
        
        checkpoint_path = f"{checkpoint_dir}/episode_{episode}"
        
        # Save agent
        self.agent.save(checkpoint_path)
        
        # Save additional state
        state_data = {
            "episode": episode,
            "best_quality_score": self.best_quality_score,
            "best_quality_config": self.best_quality_config,
            "quality_history": self.quality_history,
            "cost_history": self.cost_history,
            "training_metrics": self.training_metrics,
            "config": asdict(self.config)
        }
        
        with open(f"{checkpoint_path}_state.pkl", "wb") as f:
            pickle.dump(state_data, f)
        
        logger.info(f"Saved data quality checkpoint at episode {episode}")
    
    def get_optimization_summary(self) -> Dict[str, Any]:
        """Get comprehensive optimization summary."""
        return {
            "session_info": self.optimization_session,
            "best_performance": {
                "quality_score": self.best_quality_score,
                "quality_config": self.best_quality_config
            },
            "training_progress": {
                "episodes_completed": len(self.quality_history),
                "quality_history": self.quality_history,
                "cost_history": self.cost_history,
                "convergence_info": {
                    "converged": self._check_convergence(),
                    "convergence_episode": self._find_convergence_episode()
                }
            },
            "insights": self._generate_quality_insights(),
            "config": asdict(self.config)
        }