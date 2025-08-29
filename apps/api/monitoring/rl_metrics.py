"""
RL Optimization Prometheus Metrics
Collects and exports metrics for RL optimization monitoring
"""

import time
import psutil
from typing import Dict, Any, Optional
from prometheus_client import Counter, Histogram, Gauge, Info
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# RL Optimization Metrics
rl_sessions_total = Counter(
    'rl_optimization_sessions_total',
    'Total number of RL optimization sessions started',
    ['pipeline_id', 'strategy', 'objective', 'status']
)

rl_episode_duration = Histogram(
    'rl_episode_duration_seconds',
    'Time taken for each RL episode',
    ['session_id', 'strategy'],
    buckets=[1, 5, 10, 30, 60, 120, 300, 600]
)

rl_episode_reward = Histogram(
    'rl_episode_reward',
    'Reward achieved in each RL episode',
    ['session_id', 'strategy', 'objective'],
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

rl_session_performance = Gauge(
    'rl_session_best_performance',
    'Best performance achieved in RL session',
    ['session_id', 'pipeline_id', 'strategy']
)

rl_resource_utilization = Gauge(
    'rl_resource_utilization_percent',
    'Resource utilization during RL training',
    ['session_id', 'resource_type']
)

rl_convergence_episode = Gauge(
    'rl_convergence_episode_number',
    'Episode number where RL agent converged',
    ['session_id', 'strategy']
)

rl_training_time_total = Counter(
    'rl_training_time_seconds_total',
    'Total training time for RL sessions',
    ['pipeline_id', 'strategy', 'objective']
)

rl_hyperparameter_trials = Counter(
    'rl_hyperparameter_trials_total',
    'Total number of hyperparameter combinations tried',
    ['session_id', 'strategy']
)

rl_system_errors = Counter(
    'rl_system_errors_total',
    'Total number of RL system errors',
    ['error_type', 'component']
)

# Resource monitoring
rl_active_sessions = Gauge(
    'rl_active_sessions_count',
    'Number of currently active RL optimization sessions'
)

rl_queue_size = Gauge(
    'rl_optimization_queue_size',
    'Number of RL optimizations waiting in queue'
)

# Performance metrics
rl_model_accuracy = Gauge(
    'rl_optimized_model_accuracy',
    'Accuracy of models optimized by RL',
    ['session_id', 'pipeline_id', 'industry']
)

rl_optimization_improvement = Gauge(
    'rl_optimization_improvement_percent',
    'Performance improvement achieved by RL optimization',
    ['session_id', 'pipeline_id', 'metric_type']
)


class RLMetricsCollector:
    """Collects and manages RL optimization metrics"""
    
    def __init__(self):
        self.session_metrics = {}
        self.start_time = time.time()
    
    def record_session_start(
        self,
        session_id: str,
        pipeline_id: str,
        strategy: str,
        objective: str
    ):
        """Record the start of an RL optimization session"""
        try:
            rl_sessions_total.labels(
                pipeline_id=pipeline_id,
                strategy=strategy,
                objective=objective,
                status='started'
            ).inc()
            
            # Update active sessions count
            rl_active_sessions.inc()
            
            # Store session metadata
            self.session_metrics[session_id] = {
                'pipeline_id': pipeline_id,
                'strategy': strategy,
                'objective': objective,
                'start_time': time.time(),
                'episodes': 0,
                'best_performance': 0.0
            }
            
            logger.info(f"Started tracking metrics for RL session {session_id}")
            
        except Exception as e:
            logger.error(f"Error recording session start: {e}")
            rl_system_errors.labels(
                error_type='metrics_collection',
                component='session_start'
            ).inc()
    
    def record_episode_completion(
        self,
        session_id: str,
        episode_number: int,
        reward: float,
        duration: float,
        performance_metrics: Dict[str, float]
    ):
        """Record completion of an RL episode"""
        try:
            if session_id not in self.session_metrics:
                logger.warning(f"Session {session_id} not found in metrics")
                return
            
            session_data = self.session_metrics[session_id]
            
            # Record episode duration
            rl_episode_duration.labels(
                session_id=session_id,
                strategy=session_data['strategy']
            ).observe(duration)
            
            # Record episode reward
            rl_episode_reward.labels(
                session_id=session_id,
                strategy=session_data['strategy'],
                objective=session_data['objective']
            ).observe(reward)
            
            # Update best performance
            if reward > session_data['best_performance']:
                session_data['best_performance'] = reward
                rl_session_performance.labels(
                    session_id=session_id,
                    pipeline_id=session_data['pipeline_id'],
                    strategy=session_data['strategy']
                ).set(reward)
            
            # Update episode count
            session_data['episodes'] = episode_number
            
            # Record specific performance metrics
            for metric_name, metric_value in performance_metrics.items():
                if metric_name == 'accuracy':
                    rl_model_accuracy.labels(
                        session_id=session_id,
                        pipeline_id=session_data['pipeline_id'],
                        industry='general'  # This could be extracted from pipeline metadata
                    ).set(metric_value)
            
            # Record resource utilization
            self._record_resource_utilization(session_id)
            
        except Exception as e:
            logger.error(f"Error recording episode completion: {e}")
            rl_system_errors.labels(
                error_type='metrics_collection',
                component='episode_completion'
            ).inc()
    
    def record_session_completion(
        self,
        session_id: str,
        status: str,
        total_training_time: float,
        convergence_episode: Optional[int] = None,
        improvement_percent: Optional[float] = None
    ):
        """Record completion of an RL optimization session"""
        try:
            if session_id not in self.session_metrics:
                logger.warning(f"Session {session_id} not found in metrics")
                return
            
            session_data = self.session_metrics[session_id]
            
            # Record session completion
            rl_sessions_total.labels(
                pipeline_id=session_data['pipeline_id'],
                strategy=session_data['strategy'],
                objective=session_data['objective'],
                status=status
            ).inc()
            
            # Record total training time
            rl_training_time_total.labels(
                pipeline_id=session_data['pipeline_id'],
                strategy=session_data['strategy'],
                objective=session_data['objective']
            ).inc(total_training_time)
            
            # Record convergence episode if available
            if convergence_episode is not None:
                rl_convergence_episode.labels(
                    session_id=session_id,
                    strategy=session_data['strategy']
                ).set(convergence_episode)
            
            # Record improvement percentage if available
            if improvement_percent is not None:
                rl_optimization_improvement.labels(
                    session_id=session_id,
                    pipeline_id=session_data['pipeline_id'],
                    metric_type='performance'
                ).set(improvement_percent)
            
            # Update active sessions count
            rl_active_sessions.dec()
            
            # Clean up session data
            del self.session_metrics[session_id]
            
            logger.info(f"Completed tracking metrics for RL session {session_id}")
            
        except Exception as e:
            logger.error(f"Error recording session completion: {e}")
            rl_system_errors.labels(
                error_type='metrics_collection',
                component='session_completion'
            ).inc()
    
    def record_hyperparameter_trial(self, session_id: str, strategy: str):
        """Record a hyperparameter trial"""
        try:
            rl_hyperparameter_trials.labels(
                session_id=session_id,
                strategy=strategy
            ).inc()
        except Exception as e:
            logger.error(f"Error recording hyperparameter trial: {e}")
    
    def record_system_error(self, error_type: str, component: str):
        """Record a system error"""
        try:
            rl_system_errors.labels(
                error_type=error_type,
                component=component
            ).inc()
        except Exception as e:
            logger.error(f"Error recording system error: {e}")
    
    def update_queue_size(self, queue_size: int):
        """Update the optimization queue size"""
        try:
            rl_queue_size.set(queue_size)
        except Exception as e:
            logger.error(f"Error updating queue size: {e}")
    
    def _record_resource_utilization(self, session_id: str):
        """Record current resource utilization"""
        try:
            # CPU utilization
            cpu_percent = psutil.cpu_percent(interval=1)
            rl_resource_utilization.labels(
                session_id=session_id,
                resource_type='cpu'
            ).set(cpu_percent)
            
            # Memory utilization
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            rl_resource_utilization.labels(
                session_id=session_id,
                resource_type='memory'
            ).set(memory_percent)
            
            # Disk utilization
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            rl_resource_utilization.labels(
                session_id=session_id,
                resource_type='disk'
            ).set(disk_percent)
            
        except Exception as e:
            logger.error(f"Error recording resource utilization: {e}")
    
    def get_session_summary(self, session_id: str) -> Dict[str, Any]:
        """Get summary metrics for a session"""
        if session_id not in self.session_metrics:
            return {}
        
        session_data = self.session_metrics[session_id]
        current_time = time.time()
        
        return {
            'session_id': session_id,
            'pipeline_id': session_data['pipeline_id'],
            'strategy': session_data['strategy'],
            'objective': session_data['objective'],
            'runtime_seconds': current_time - session_data['start_time'],
            'episodes_completed': session_data['episodes'],
            'best_performance': session_data['best_performance']
        }
    
    def get_system_summary(self) -> Dict[str, Any]:
        """Get overall system metrics summary"""
        return {
            'active_sessions': len(self.session_metrics),
            'system_uptime_seconds': time.time() - self.start_time,
            'total_sessions_tracked': len(self.session_metrics)
        }


# Global metrics collector instance
metrics_collector = RLMetricsCollector()


def get_metrics_collector() -> RLMetricsCollector:
    """Get the global metrics collector instance"""
    return metrics_collector