"""
Resource Allocation RL Agent for Pipeline Optimization

This agent optimizes the allocation of computational resources (CPU, memory, storage)
across multiple data processing pipelines to maximize system efficiency and throughput.
"""

import logging
import json
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import pickle
import os

from stable_baselines3 import PPO, A2C, SAC, DDPG
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.logger import configure

from ..environments.resource_allocation_env import ResourceAllocationEnvironment, ResourceConfig
from ..models.rl_optimization_models import RLOptimizationSession, OptimizationStatus, OptimizationType

logger = logging.getLogger(__name__)


@dataclass
class ResourceAgentConfig:
    """Configuration for Resource Allocation RL Agent."""
    agent_type: str = "ppo"
    learning_rate: float = 3e-4
    n_steps: int = 2048
    batch_size: int = 64
    n_epochs: int = 10
    gamma: float = 0.99
    gae_lambda: float = 0.95
    max_episodes: int = 100
    max_training_time: int = 7200  # 2 hours
    early_stopping_patience: int = 15
    target_efficiency: float = 0.85
    enable_tensorboard: bool = True
    save_checkpoints: bool = True
    checkpoint_frequency: int = 10


class ResourceMetricsCallback(BaseCallback):
    """Custom callback for logging resource allocation metrics."""
    
    def __init__(self, verbose: int = 0):
        super().__init__(verbose)
        self.episode_metrics = []
        
    def _on_step(self) -> bool:
        # Log metrics when episode ends
        if self.locals.get("done"):
            info = self.locals.get("info", [{}])
            if info and isinstance(info, list) and len(info) > 0:
                episode_info = info[0]
                
                # Extract resource allocation metrics
                utilization = episode_info.get("utilization", {})
                jobs = episode_info.get("jobs", {})
                
                # Log to TensorBoard
                self.logger.record("resource/cpu_utilization", utilization.get("cpu", 0))
                self.logger.record("resource/memory_utilization", utilization.get("memory", 0))
                self.logger.record("resource/storage_utilization", utilization.get("storage", 0))
                self.logger.record("jobs/completed", jobs.get("completed", 0))
                self.logger.record("jobs/running", jobs.get("running", 0))
                self.logger.record("jobs/pending", jobs.get("pending", 0))
                self.logger.record("performance/throughput", episode_info.get("throughput", 0))
                self.logger.record("performance/deadline_misses", episode_info.get("deadline_misses", 0))
                
        return True


class ResourceAllocationAgent:
    """
    RL Agent for optimizing resource allocation across data processing pipelines.
    
    Uses reinforcement learning to learn optimal resource allocation strategies
    that maximize system throughput while minimizing costs and meeting deadlines.
    """
    
    def __init__(self, 
                 config: Optional[ResourceAgentConfig] = None,
                 resource_config: Optional[ResourceConfig] = None):
        self.config = config or ResourceAgentConfig()
        self.resource_config = resource_config or ResourceConfig()
        
        # Initialize environment
        self.environment = None
        self.agent = None
        self.optimization_session = None
        
        # Performance tracking
        self.best_efficiency = -np.inf
        self.best_allocation_strategy = None
        self.efficiency_history = []
        self.training_metrics = []
        
        # Early stopping
        self.no_improvement_episodes = 0
        self.convergence_threshold = 0.01
        
        logger.info(f"Initialized ResourceAllocationAgent with {self.config.agent_type} algorithm")
    
    def optimize_allocation(self, 
                          pipeline_configs: List[Dict[str, Any]],
                          optimization_objective: str = "balanced_efficiency",
                          simulation_duration_hours: int = 24) -> Dict[str, Any]:
        """
        Optimize resource allocation for given pipeline configurations.
        
        Args:
            pipeline_configs: List of pipeline configuration dictionaries
            optimization_objective: Optimization objective ("throughput", "cost", "balanced_efficiency")
            simulation_duration_hours: How long to simulate in hours
            
        Returns:
            Optimization results with best allocation strategy
        """
        logger.info(f"Starting resource allocation optimization for {len(pipeline_configs)} pipelines")
        start_time = datetime.now()
        
        try:
            # Create optimization session
            self.optimization_session = {
                "id": f"resource_opt_{int(start_time.timestamp())}",
                "type": OptimizationType.RESOURCE_ALLOCATION,
                "start_time": start_time,
                "objective": optimization_objective,
                "pipeline_configs": pipeline_configs,
                "status": OptimizationStatus.RUNNING
            }
            
            # Initialize environment
            self.environment = ResourceAllocationEnvironment(
                resource_config=self.resource_config,
                simulation_mode=True,
                optimization_objective=optimization_objective
            )
            
            # Initialize RL agent
            self._initialize_agent()
            
            # Run optimization
            optimization_result = self._run_optimization_loop()
            
            # Evaluate final strategy
            final_evaluation = self._evaluate_allocation_strategy()
            
            # Combine results
            optimization_time = (datetime.now() - start_time).total_seconds()
            
            result = {
                "success": True,
                "optimization_time": optimization_time,
                "best_efficiency": self.best_efficiency,
                "best_allocation_strategy": self.best_allocation_strategy,
                "final_evaluation": final_evaluation,
                "training_metrics": self.training_metrics,
                "efficiency_history": self.efficiency_history,
                "convergence_info": {
                    "converged": self._check_convergence(),
                    "convergence_episode": self._find_convergence_episode(),
                    "final_episodes_trained": len(self.efficiency_history)
                },
                "resource_insights": self._generate_resource_insights()
            }
            
            self.optimization_session["status"] = OptimizationStatus.COMPLETED
            self.optimization_session["result"] = result
            
            logger.info(f"Resource allocation optimization completed. Best efficiency: {self.best_efficiency:.4f}")
            return result
            
        except Exception as e:
            logger.error(f"Resource allocation optimization failed: {str(e)}")
            if self.optimization_session:
                self.optimization_session["status"] = OptimizationStatus.FAILED
                self.optimization_session["error"] = str(e)
            
            return {
                "success": False,
                "error": str(e),
                "optimization_time": (datetime.now() - start_time).total_seconds()
            }
    
    def _initialize_agent(self):
        """Initialize the RL agent with specified algorithm."""
        # Create vectorized environment
        env = make_vec_env(lambda: self.environment, n_envs=1)
        
        # Configure logging
        log_path = f"./logs/resource_allocation/{self.optimization_session['id']}"
        os.makedirs(log_path, exist_ok=True)
        
        if self.config.enable_tensorboard:
            new_logger = configure(log_path, ["tensorboard"])
        
        # Initialize agent based on algorithm type
        if self.config.agent_type.lower() == "ppo":
            self.agent = PPO(
                "MlpPolicy",
                env,
                learning_rate=self.config.learning_rate,
                n_steps=self.config.n_steps,
                batch_size=self.config.batch_size,
                n_epochs=self.config.n_epochs,
                gamma=self.config.gamma,
                gae_lambda=self.config.gae_lambda,
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
        elif self.config.agent_type.lower() == "ddpg":
            self.agent = DDPG(
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
        
        logger.info(f"Initialized {self.config.agent_type.upper()} agent")
    
    def _run_optimization_loop(self) -> Dict[str, Any]:
        """Run the main optimization training loop."""
        episode = 0
        start_time = datetime.now()
        
        # Setup callbacks
        callbacks = []
        if self.config.enable_tensorboard:
            callbacks.append(ResourceMetricsCallback())
        
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
            current_efficiency = self._evaluate_current_policy()
            self.efficiency_history.append(current_efficiency)
            
            # Track training metrics
            self.training_metrics.append({
                "episode": episode,
                "efficiency": current_efficiency,
                "duration": episode_duration,
                "timestamp": datetime.now().isoformat()
            })
            
            # Update best strategy
            if current_efficiency > self.best_efficiency:
                self.best_efficiency = current_efficiency
                self.best_allocation_strategy = self._extract_allocation_strategy()
                self.no_improvement_episodes = 0
                logger.info(f"New best efficiency: {self.best_efficiency:.4f}")
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
            "final_efficiency": current_efficiency,
            "best_efficiency": self.best_efficiency
        }
    
    def _evaluate_current_policy(self) -> float:
        """Evaluate the current RL policy by running episodes."""
        num_eval_episodes = 3
        efficiency_scores = []
        
        for _ in range(num_eval_episodes):
            obs = self.environment.reset()
            episode_reward = 0
            done = False
            step_count = 0
            
            while not done and step_count < 200:  # Max steps per evaluation episode
                action, _ = self.agent.predict(obs, deterministic=True)
                obs, reward, done, info = self.environment.step(action)
                episode_reward += reward
                step_count += 1
            
            # Calculate efficiency from final environment state
            performance_summary = self.environment.get_performance_summary()
            if performance_summary["status"] == "success":
                # Combined efficiency score
                job_metrics = performance_summary["job_metrics"]
                resource_metrics = performance_summary["resource_metrics"]
                efficiency_metrics = performance_summary["efficiency_metrics"]
                
                throughput_score = min(1.0, job_metrics["throughput_jobs_per_step"] * 10)
                utilization_score = resource_metrics.get("average_cpu_utilization", 0) * 0.4 + \
                                 resource_metrics.get("average_memory_utilization", 0) * 0.4 + \
                                 resource_metrics.get("utilization_stability", 0) * 0.2
                deadline_penalty = job_metrics.get("deadline_miss_rate", 0)
                
                efficiency = (throughput_score + utilization_score) / 2 - deadline_penalty
                efficiency_scores.append(max(0, efficiency))
            else:
                efficiency_scores.append(0.0)
        
        return np.mean(efficiency_scores)
    
    def _extract_allocation_strategy(self) -> Dict[str, Any]:
        """Extract the current allocation strategy from the trained agent."""
        # Sample multiple states and actions to understand the strategy
        strategy_samples = []
        
        for _ in range(10):
            obs = self.environment.reset()
            action, _ = self.agent.predict(obs, deterministic=True)
            
            strategy_samples.append({
                "observation": obs.tolist(),
                "action": action.tolist(),
                "interpretation": self._interpret_action(action)
            })
        
        # Analyze patterns in the strategy
        strategy_analysis = self._analyze_strategy_patterns(strategy_samples)
        
        return {
            "samples": strategy_samples,
            "analysis": strategy_analysis,
            "efficiency": self.best_efficiency,
            "timestamp": datetime.now().isoformat()
        }
    
    def _interpret_action(self, action: np.ndarray) -> Dict[str, Any]:
        """Interpret a raw RL action into human-readable resource allocation decisions."""
        return {
            "cpu_allocation_ratio": float(action[0]),
            "memory_allocation_ratio": float(action[1]),
            "storage_allocation_ratio": float(action[2]),
            "priority_weight": float(action[3]),
            "urgency_weight": float(action[4]),
            "allocation_strategy": self._classify_allocation_strategy(action)
        }
    
    def _classify_allocation_strategy(self, action: np.ndarray) -> str:
        """Classify the allocation strategy based on action values."""
        cpu_ratio = action[0]
        memory_ratio = action[1]
        priority_weight = action[3]
        urgency_weight = action[4]
        
        if priority_weight > 0.7:
            if urgency_weight > 0.7:
                return "priority_urgent_balanced"
            else:
                return "priority_focused"
        elif urgency_weight > 0.7:
            return "urgency_focused"
        elif cpu_ratio > 0.8 and memory_ratio > 0.8:
            return "resource_intensive"
        elif cpu_ratio < 0.3 and memory_ratio < 0.3:
            return "resource_conservative"
        else:
            return "balanced"
    
    def _analyze_strategy_patterns(self, strategy_samples: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze patterns in the allocation strategy."""
        strategies = [sample["interpretation"]["allocation_strategy"] for sample in strategy_samples]
        actions = [sample["action"] for sample in strategy_samples]
        
        # Most common strategy
        strategy_counts = {}
        for strategy in strategies:
            strategy_counts[strategy] = strategy_counts.get(strategy, 0) + 1
        
        dominant_strategy = max(strategy_counts.items(), key=lambda x: x[1])
        
        # Average action values
        if actions:
            avg_action = np.mean(actions, axis=0)
            action_std = np.std(actions, axis=0)
            
            return {
                "dominant_strategy": dominant_strategy[0],
                "strategy_consistency": dominant_strategy[1] / len(strategies),
                "average_actions": avg_action.tolist(),
                "action_variability": action_std.tolist(),
                "resource_preferences": {
                    "cpu_preference": float(avg_action[0]),
                    "memory_preference": float(avg_action[1]),
                    "storage_preference": float(avg_action[2]),
                    "priority_importance": float(avg_action[3]),
                    "urgency_importance": float(avg_action[4])
                }
            }
        
        return {"dominant_strategy": "unknown", "strategy_consistency": 0.0}
    
    def _evaluate_allocation_strategy(self) -> Dict[str, Any]:
        """Evaluate the final allocation strategy comprehensively."""
        logger.info("Evaluating final allocation strategy")
        
        evaluation_results = []
        
        # Run multiple evaluation episodes
        for eval_episode in range(5):
            obs = self.environment.reset()
            episode_metrics = []
            done = False
            step_count = 0
            
            while not done and step_count < 200:
                action, _ = self.agent.predict(obs, deterministic=True)
                obs, reward, done, info = self.environment.step(action)
                
                episode_metrics.append({
                    "step": step_count,
                    "reward": reward,
                    "resource_utilization": info.get("utilization", {}),
                    "job_status": info.get("jobs", {}),
                    "throughput": info.get("throughput", 0)
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
            throughputs = []
            utilizations = []
            deadline_miss_rates = []
            
            for result in evaluation_results:
                perf = result["final_performance"]
                if perf["status"] == "success":
                    throughputs.append(perf["job_metrics"]["throughput_jobs_per_step"])
                    utilizations.append(perf["resource_metrics"].get("average_cpu_utilization", 0))
                    deadline_miss_rates.append(perf["job_metrics"]["deadline_miss_rate"])
            
            return {
                "evaluation_episodes": len(evaluation_results),
                "average_throughput": np.mean(throughputs) if throughputs else 0,
                "average_utilization": np.mean(utilizations) if utilizations else 0,
                "average_deadline_miss_rate": np.mean(deadline_miss_rates) if deadline_miss_rates else 0,
                "performance_consistency": {
                    "throughput_std": np.std(throughputs) if throughputs else 0,
                    "utilization_std": np.std(utilizations) if utilizations else 0
                },
                "detailed_results": evaluation_results
            }
        
        return {"status": "evaluation_failed"}
    
    def _should_stop_early(self) -> bool:
        """Check if early stopping criteria are met."""
        # Check patience
        if self.no_improvement_episodes >= self.config.early_stopping_patience:
            return True
        
        # Check target efficiency
        if self.best_efficiency >= self.config.target_efficiency:
            logger.info(f"Target efficiency {self.config.target_efficiency} reached")
            return True
        
        # Check convergence
        if self._check_convergence():
            return True
        
        return False
    
    def _check_convergence(self) -> bool:
        """Check if the training has converged."""
        if len(self.efficiency_history) < 10:
            return False
        
        # Check if efficiency has stabilized in recent episodes
        recent_efficiency = self.efficiency_history[-10:]
        efficiency_std = np.std(recent_efficiency)
        
        return efficiency_std < self.convergence_threshold
    
    def _find_convergence_episode(self) -> Optional[int]:
        """Find the episode where training converged."""
        if not self._check_convergence():
            return None
        
        # Look for when efficiency variance dropped below threshold
        window_size = 5
        for i in range(window_size, len(self.efficiency_history)):
            window = self.efficiency_history[i-window_size:i]
            if np.std(window) < self.convergence_threshold:
                return i - window_size
        
        return None
    
    def _generate_resource_insights(self) -> Dict[str, Any]:
        """Generate insights about resource allocation patterns."""
        if not self.best_allocation_strategy or not self.training_metrics:
            return {"status": "insufficient_data"}
        
        insights = {
            "training_insights": {
                "episodes_trained": len(self.training_metrics),
                "efficiency_improvement": self.best_efficiency - (self.efficiency_history[0] if self.efficiency_history else 0),
                "convergence_speed": self._find_convergence_episode() or len(self.efficiency_history),
                "training_stability": 1.0 - np.std(self.efficiency_history) if len(self.efficiency_history) > 1 else 0
            },
            "allocation_insights": self.best_allocation_strategy.get("analysis", {}),
            "performance_characteristics": {
                "best_efficiency_achieved": self.best_efficiency,
                "consistency_score": 1.0 - np.std(self.efficiency_history[-10:]) if len(self.efficiency_history) >= 10 else 0,
                "improvement_trend": "increasing" if len(self.efficiency_history) > 1 and 
                                   self.efficiency_history[-1] > self.efficiency_history[0] else "stable"
            },
            "recommendations": self._generate_recommendations()
        }
        
        return insights
    
    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on optimization results."""
        recommendations = []
        
        if self.best_efficiency < 0.6:
            recommendations.append("Consider increasing training episodes for better performance")
            recommendations.append("Review resource constraints - they might be too restrictive")
        
        if self.no_improvement_episodes > 10:
            recommendations.append("Training may have converged - consider different hyperparameters")
        
        if self.best_allocation_strategy:
            analysis = self.best_allocation_strategy.get("analysis", {})
            dominant_strategy = analysis.get("dominant_strategy", "")
            
            if dominant_strategy == "resource_conservative":
                recommendations.append("System tends to under-utilize resources - consider allowing higher allocation ratios")
            elif dominant_strategy == "resource_intensive":
                recommendations.append("System tends to over-allocate resources - monitor for resource contention")
            elif analysis.get("strategy_consistency", 0) < 0.5:
                recommendations.append("Allocation strategy is inconsistent - consider longer training")
        
        if len(self.efficiency_history) > 1:
            recent_trend = np.mean(self.efficiency_history[-5:]) - np.mean(self.efficiency_history[:5])
            if recent_trend < 0:
                recommendations.append("Performance decreased during training - check for overfitting")
        
        return recommendations
    
    def _save_checkpoint(self, episode: int):
        """Save training checkpoint."""
        checkpoint_dir = f"./checkpoints/resource_allocation/{self.optimization_session['id']}"
        os.makedirs(checkpoint_dir, exist_ok=True)
        
        checkpoint_path = f"{checkpoint_dir}/episode_{episode}"
        
        # Save agent
        self.agent.save(checkpoint_path)
        
        # Save additional state
        state_data = {
            "episode": episode,
            "best_efficiency": self.best_efficiency,
            "best_allocation_strategy": self.best_allocation_strategy,
            "efficiency_history": self.efficiency_history,
            "training_metrics": self.training_metrics,
            "config": asdict(self.config)
        }
        
        with open(f"{checkpoint_path}_state.pkl", "wb") as f:
            pickle.dump(state_data, f)
        
        logger.info(f"Saved checkpoint at episode {episode}")
    
    def load_checkpoint(self, checkpoint_path: str):
        """Load a training checkpoint."""
        if not os.path.exists(checkpoint_path):
            raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")
        
        # Load agent
        self.agent = PPO.load(checkpoint_path)
        
        # Load additional state
        state_path = f"{checkpoint_path}_state.pkl"
        if os.path.exists(state_path):
            with open(state_path, "rb") as f:
                state_data = pickle.load(f)
            
            self.best_efficiency = state_data["best_efficiency"]
            self.best_allocation_strategy = state_data["best_allocation_strategy"]
            self.efficiency_history = state_data["efficiency_history"]
            self.training_metrics = state_data["training_metrics"]
        
        logger.info(f"Loaded checkpoint from {checkpoint_path}")
    
    def get_optimization_summary(self) -> Dict[str, Any]:
        """Get comprehensive optimization summary."""
        return {
            "session_info": self.optimization_session,
            "best_performance": {
                "efficiency": self.best_efficiency,
                "allocation_strategy": self.best_allocation_strategy
            },
            "training_progress": {
                "episodes_completed": len(self.efficiency_history),
                "efficiency_history": self.efficiency_history,
                "convergence_info": {
                    "converged": self._check_convergence(),
                    "convergence_episode": self._find_convergence_episode()
                }
            },
            "insights": self._generate_resource_insights(),
            "config": asdict(self.config)
        }