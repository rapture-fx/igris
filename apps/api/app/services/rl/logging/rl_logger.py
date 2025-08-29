"""
TensorBoard-free RL Logging System

Provides comprehensive logging and metrics collection for RL training
without requiring TensorBoard or other external logging dependencies.
"""

import logging
import json
import csv
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from pathlib import Path
import os
from collections import defaultdict, deque
import math

logger = logging.getLogger(__name__)


@dataclass
class LogEntry:
    """Single log entry for RL training"""
    timestamp: datetime
    step: int
    episode: int
    metric_name: str
    value: float
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class MetricSummary:
    """Summary statistics for a metric"""
    name: str
    count: int
    mean: float
    std: float
    min_value: float
    max_value: float
    latest: float
    trend: str  # 'increasing', 'decreasing', 'stable'


class RLLogger:
    """
    Comprehensive RL logging system that works without TensorBoard
    
    Features:
    - Metric collection and aggregation
    - JSON and CSV export
    - Real-time statistics
    - Training progress tracking
    - Performance visualization data
    """
    
    def __init__(self, log_dir: Union[str, Path] = "./rl_logs", run_name: str = None):
        self.log_dir = Path(log_dir)
        self.run_name = run_name or f"rl_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.run_dir = self.log_dir / self.run_name
        
        # Create directories
        self.run_dir.mkdir(parents=True, exist_ok=True)
        (self.run_dir / "metrics").mkdir(exist_ok=True)
        (self.run_dir / "checkpoints").mkdir(exist_ok=True)
        (self.run_dir / "plots").mkdir(exist_ok=True)
        
        # Logging state
        self.logs: List[LogEntry] = []
        self.metrics: Dict[str, List[float]] = defaultdict(list)
        self.metric_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.start_time = datetime.now()
        self.step_count = 0
        self.episode_count = 0
        
        # File handles
        self._json_file = None
        self._csv_file = None
        self._csv_writer = None
        
        self._initialize_files()
        
        logger.info(f"Initialized RL logger: {self.run_dir}")
    
    def _initialize_files(self):
        """Initialize output files"""
        # JSON file for structured logging
        self._json_file = open(self.run_dir / "training_log.json", 'w')
        self._json_file.write("[\n")
        
        # CSV file for metrics
        csv_path = self.run_dir / "metrics.csv"
        self._csv_file = open(csv_path, 'w', newline='')
        self._csv_writer = csv.writer(self._csv_file)
        self._csv_writer.writerow(['timestamp', 'step', 'episode', 'metric_name', 'value', 'tags'])
        
        # Write run metadata
        metadata = {
            "run_name": self.run_name,
            "start_time": self.start_time.isoformat(),
            "log_dir": str(self.run_dir),
            "version": "1.0"
        }
        
        with open(self.run_dir / "run_metadata.json", 'w') as f:
            json.dump(metadata, f, indent=2)
    
    def log_scalar(self, name: str, value: float, step: Optional[int] = None, 
                   episode: Optional[int] = None, tags: Optional[Dict[str, str]] = None):
        """Log a scalar metric"""
        if step is None:
            step = self.step_count
        if episode is None:
            episode = self.episode_count
        if tags is None:
            tags = {}
        
        # Create log entry
        entry = LogEntry(
            timestamp=datetime.now(),
            step=step,
            episode=episode,
            metric_name=name,
            value=value,
            tags=tags
        )
        
        # Store in memory
        self.logs.append(entry)
        self.metrics[name].append(value)
        self.metric_history[name].append(value)
        
        # Write to files
        self._write_entry(entry)
        
        # Update counters
        self.step_count = max(self.step_count, step)
        self.episode_count = max(self.episode_count, episode)
    
    def log_metrics(self, metrics: Dict[str, float], step: Optional[int] = None, 
                   episode: Optional[int] = None, tags: Optional[Dict[str, str]] = None):
        """Log multiple metrics at once"""
        for name, value in metrics.items():
            self.log_scalar(name, value, step, episode, tags)
    
    def log_episode_summary(self, episode: int, episode_reward: float, 
                           episode_length: int, **kwargs):
        """Log episode summary metrics"""
        base_tags = {"type": "episode_summary"}
        
        self.log_scalar("episode_reward", episode_reward, episode=episode, tags=base_tags)
        self.log_scalar("episode_length", episode_length, episode=episode, tags=base_tags)
        
        # Log additional metrics
        for key, value in kwargs.items():
            self.log_scalar(f"episode_{key}", value, episode=episode, tags=base_tags)
    
    def log_training_metrics(self, step: int, policy_loss: float, value_loss: float,
                            entropy: float, learning_rate: float, **kwargs):
        """Log training-specific metrics"""
        base_tags = {"type": "training"}
        
        self.log_scalar("policy_loss", policy_loss, step=step, tags=base_tags)
        self.log_scalar("value_loss", value_loss, step=step, tags=base_tags)
        self.log_scalar("entropy", entropy, step=step, tags=base_tags)
        self.log_scalar("learning_rate", learning_rate, step=step, tags=base_tags)
        
        # Log additional metrics
        for key, value in kwargs.items():
            self.log_scalar(f"training_{key}", value, step=step, tags=base_tags)
    
    def _write_entry(self, entry: LogEntry):
        """Write log entry to files"""
        # JSON format
        if self._json_file:
            entry_dict = asdict(entry)
            entry_dict['timestamp'] = entry.timestamp.isoformat()
            json_line = json.dumps(entry_dict, indent=2)
            self._json_file.write(json_line + ",\n")
            self._json_file.flush()
        
        # CSV format
        if self._csv_writer:
            tags_str = json.dumps(entry.tags) if entry.tags else "{}"
            self._csv_writer.writerow([
                entry.timestamp.isoformat(),
                entry.step,
                entry.episode,
                entry.metric_name,
                entry.value,
                tags_str
            ])
            self._csv_file.flush()
    
    def get_metric_summary(self, metric_name: str) -> Optional[MetricSummary]:
        """Get summary statistics for a metric"""
        if metric_name not in self.metrics or not self.metrics[metric_name]:
            return None
        
        values = self.metrics[metric_name]
        count = len(values)
        mean_val = sum(values) / count
        
        # Calculate standard deviation
        if count > 1:
            variance = sum((x - mean_val) ** 2 for x in values) / (count - 1)
            std_val = math.sqrt(variance)
        else:
            std_val = 0.0
        
        min_val = min(values)
        max_val = max(values)
        latest = values[-1]
        
        # Calculate trend
        if count >= 10:
            recent = values[-10:]
            early = recent[:5]
            late = recent[5:]
            early_mean = sum(early) / len(early)
            late_mean = sum(late) / len(late)
            
            if late_mean > early_mean * 1.05:
                trend = "increasing"
            elif late_mean < early_mean * 0.95:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "insufficient_data"
        
        return MetricSummary(
            name=metric_name,
            count=count,
            mean=mean_val,
            std=std_val,
            min_value=min_val,
            max_value=max_val,
            latest=latest,
            trend=trend
        )
    
    def get_all_summaries(self) -> Dict[str, MetricSummary]:
        """Get summary statistics for all metrics"""
        summaries = {}
        for metric_name in self.metrics:
            summary = self.get_metric_summary(metric_name)
            if summary:
                summaries[metric_name] = summary
        return summaries
    
    def get_training_progress(self) -> Dict[str, Any]:
        """Get overall training progress report"""
        runtime = datetime.now() - self.start_time
        
        # Key metrics summaries
        key_metrics = ['episode_reward', 'policy_loss', 'value_loss', 'entropy']
        metric_summaries = {}
        
        for metric in key_metrics:
            summary = self.get_metric_summary(metric)
            if summary:
                metric_summaries[metric] = {
                    "latest": summary.latest,
                    "mean": summary.mean,
                    "trend": summary.trend,
                    "count": summary.count
                }
        
        return {
            "run_name": self.run_name,
            "runtime_seconds": runtime.total_seconds(),
            "runtime_formatted": str(runtime),
            "total_steps": self.step_count,
            "total_episodes": self.episode_count,
            "metrics_collected": len(self.metrics),
            "log_entries": len(self.logs),
            "key_metrics": metric_summaries,
            "log_dir": str(self.run_dir)
        }
    
    def export_metrics(self, format: str = "json") -> Path:
        """Export all metrics to file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if format.lower() == "json":
            export_path = self.run_dir / f"metrics_export_{timestamp}.json"
            export_data = {
                "metadata": {
                    "run_name": self.run_name,
                    "export_time": datetime.now().isoformat(),
                    "total_entries": len(self.logs)
                },
                "summaries": {name: asdict(summary) for name, summary in self.get_all_summaries().items()},
                "raw_metrics": {name: values for name, values in self.metrics.items()},
                "training_progress": self.get_training_progress()
            }
            
            with open(export_path, 'w') as f:
                json.dump(export_data, f, indent=2, default=str)
        
        elif format.lower() == "csv":
            export_path = self.run_dir / f"metrics_summary_{timestamp}.csv"
            
            with open(export_path, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['metric_name', 'count', 'mean', 'std', 'min', 'max', 'latest', 'trend'])
                
                for summary in self.get_all_summaries().values():
                    writer.writerow([
                        summary.name, summary.count, summary.mean, summary.std,
                        summary.min_value, summary.max_value, summary.latest, summary.trend
                    ])
        
        else:
            raise ValueError(f"Unsupported export format: {format}")
        
        logger.info(f"Exported metrics to {export_path}")
        return export_path
    
    def generate_plot_data(self, metric_name: str) -> Optional[Dict[str, Any]]:
        """Generate data for plotting (without actually creating plots)"""
        if metric_name not in self.metrics:
            return None
        
        # Get all entries for this metric
        entries = [entry for entry in self.logs if entry.metric_name == metric_name]
        if not entries:
            return None
        
        # Extract data for plotting
        steps = [entry.step for entry in entries]
        episodes = [entry.episode for entry in entries]
        values = [entry.value for entry in entries]
        timestamps = [entry.timestamp for entry in entries]
        
        # Calculate moving average
        window_size = min(10, len(values))
        moving_avg = []
        for i in range(len(values)):
            start_idx = max(0, i - window_size + 1)
            window_values = values[start_idx:i+1]
            moving_avg.append(sum(window_values) / len(window_values))
        
        return {
            "metric_name": metric_name,
            "steps": steps,
            "episodes": episodes,
            "values": values,
            "moving_average": moving_avg,
            "timestamps": [ts.isoformat() for ts in timestamps],
            "summary": asdict(self.get_metric_summary(metric_name))
        }
    
    def close(self):
        """Close logger and finalize files"""
        # Close JSON file
        if self._json_file:
            self._json_file.write("\n]")
            self._json_file.close()
            self._json_file = None
        
        # Close CSV file
        if self._csv_file:
            self._csv_file.close()
            self._csv_file = None
            self._csv_writer = None
        
        # Write final summary
        final_summary = self.get_training_progress()
        with open(self.run_dir / "final_summary.json", 'w') as f:
            json.dump(final_summary, f, indent=2, default=str)
        
        logger.info(f"Closed RL logger. Final summary saved to {self.run_dir}")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class RLLoggerCallback:
    """Callback class for integration with RL training loops"""
    
    def __init__(self, logger: RLLogger, log_interval: int = 10):
        self.logger = logger
        self.log_interval = log_interval
        self.episode_rewards = []
        self.episode_lengths = []
        self.current_episode_reward = 0
        self.current_episode_length = 0
    
    def on_step(self, step: int, reward: float, done: bool, info: Dict[str, Any] = None):
        """Called at each environment step"""
        self.current_episode_reward += reward
        self.current_episode_length += 1
        
        if done:
            # Log episode completion
            episode = len(self.episode_rewards)
            self.logger.log_episode_summary(
                episode=episode,
                episode_reward=self.current_episode_reward,
                episode_length=self.current_episode_length
            )
            
            # Store for batch logging
            self.episode_rewards.append(self.current_episode_reward)
            self.episode_lengths.append(self.current_episode_length)
            
            # Reset counters
            self.current_episode_reward = 0
            self.current_episode_length = 0
            
            # Log additional info
            if info:
                for key, value in info.items():
                    if isinstance(value, (int, float)):
                        self.logger.log_scalar(f"info_{key}", value, step=step, episode=episode)
    
    def on_training_step(self, step: int, training_metrics: Dict[str, float]):
        """Called after training updates"""
        if step % self.log_interval == 0:
            self.logger.log_training_metrics(step=step, **training_metrics)


# Factory functions
def create_rl_logger(log_dir: str = "./rl_logs", run_name: str = None) -> RLLogger:
    """Factory function to create RL logger"""
    return RLLogger(log_dir, run_name)


def create_logger_callback(logger: RLLogger, log_interval: int = 10) -> RLLoggerCallback:
    """Factory function to create logger callback"""
    return RLLoggerCallback(logger, log_interval)


# Example usage
if __name__ == "__main__":
    # Test the logging system
    with create_rl_logger(run_name="test_run") as rl_logger:
        # Simulate training
        for episode in range(100):
            episode_reward = 50 + episode * 2 + np.random.normal(0, 10)
            episode_length = 200 + np.random.randint(-50, 50)
            
            rl_logger.log_episode_summary(
                episode=episode,
                episode_reward=episode_reward,
                episode_length=episode_length
            )
            
            # Training metrics
            if episode % 5 == 0:
                rl_logger.log_training_metrics(
                    step=episode * 200,
                    policy_loss=1.0 / (1 + episode * 0.01),
                    value_loss=0.5 / (1 + episode * 0.005),
                    entropy=0.1 * np.exp(-episode * 0.01),
                    learning_rate=3e-4 * (0.99 ** episode)
                )
        
        # Get progress report
        progress = rl_logger.get_training_progress()
        print(f"Training Progress: {json.dumps(progress, indent=2, default=str)}")
        
        # Export metrics
        export_path = rl_logger.export_metrics("json")
        print(f"Exported to: {export_path}")
        
        # Generate plot data
        plot_data = rl_logger.generate_plot_data("episode_reward")
        if plot_data:
            print(f"Plot data available for {len(plot_data['values'])} points")