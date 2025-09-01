"""
ML/RL Data Serialization Utilities for Frontend Integration
===========================================================

Provides optimized data serialization and formatting utilities for ML/RL operations
to ensure efficient data exchange between backend and frontend components.

Features:
- Efficient serialization of ML model results
- Data compression for large datasets
- Frontend-friendly data formatting
- Real-time streaming data optimization
- Memory-efficient data handling
"""

import json
import gzip
import base64
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from io import StringIO, BytesIO
import pickle

logger = logging.getLogger(__name__)


class SerializationFormat(Enum):
    """Supported serialization formats"""
    JSON = "json"
    JSON_COMPRESSED = "json_compressed"
    BINARY = "binary"
    CSV = "csv"
    PARQUET = "parquet"


class DataType(Enum):
    """ML/RL data types for optimal serialization"""
    TRAINING_METRICS = "training_metrics"
    PREDICTION_RESULTS = "prediction_results"
    MODEL_METADATA = "model_metadata"
    DATA_QUALITY_REPORT = "data_quality_report"
    RL_SESSION_DATA = "rl_session_data"
    TIME_SERIES_DATA = "time_series_data"
    FEATURE_IMPORTANCE = "feature_importance"
    CONFUSION_MATRIX = "confusion_matrix"
    HYPERPARAMETER_RESULTS = "hyperparameter_results"


@dataclass
class SerializedData:
    """Container for serialized ML/RL data"""
    data: Any
    format: SerializationFormat
    data_type: DataType
    metadata: Dict[str, Any]
    timestamp: datetime
    compression_ratio: Optional[float] = None
    size_bytes: Optional[int] = None


class MLDataSerializer:
    """
    High-performance data serializer for ML/RL operations optimized for frontend consumption
    """
    
    def __init__(self, 
                 default_compression_threshold: int = 1024,
                 max_array_size: int = 10000,
                 decimal_precision: int = 4):
        """
        Initialize the ML data serializer
        
        Args:
            default_compression_threshold: Minimum size in bytes to trigger compression
            max_array_size: Maximum array size before chunking
            decimal_precision: Decimal precision for floating point values
        """
        self.compression_threshold = default_compression_threshold
        self.max_array_size = max_array_size
        self.decimal_precision = decimal_precision
        
    def serialize_training_metrics(self, 
                                 metrics: Dict[str, Any],
                                 epoch: int,
                                 loss_history: List[float],
                                 validation_metrics: Optional[Dict[str, Any]] = None) -> SerializedData:
        """
        Serialize training metrics for real-time frontend visualization
        """
        try:
            # Optimize loss history for charting
            optimized_loss = self._optimize_time_series(loss_history)
            
            # Format metrics for frontend consumption
            formatted_metrics = {
                "epoch": epoch,
                "current_metrics": {k: round(v, self.decimal_precision) if isinstance(v, float) else v 
                                  for k, v in metrics.items()},
                "loss_history": optimized_loss,
                "validation_metrics": validation_metrics or {},
                "performance_trend": self._calculate_trend(loss_history[-10:] if len(loss_history) > 10 else loss_history),
                "training_stability": self._assess_stability(loss_history)
            }
            
            # Determine optimal serialization format
            data_size = len(json.dumps(formatted_metrics).encode('utf-8'))
            format_type = SerializationFormat.JSON_COMPRESSED if data_size > self.compression_threshold else SerializationFormat.JSON
            
            serialized_data = self._serialize_data(formatted_metrics, format_type)
            
            return SerializedData(
                data=serialized_data,
                format=format_type,
                data_type=DataType.TRAINING_METRICS,
                metadata={
                    "epoch": epoch,
                    "metrics_count": len(metrics),
                    "history_length": len(loss_history),
                    "has_validation": validation_metrics is not None
                },
                timestamp=datetime.utcnow(),
                size_bytes=data_size
            )
            
        except Exception as e:
            logger.error(f"Error serializing training metrics: {e}")
            raise
    
    def serialize_prediction_results(self,
                                   predictions: List[Any],
                                   confidence_scores: Optional[List[float]] = None,
                                   feature_importance: Optional[Dict[str, float]] = None,
                                   model_metadata: Optional[Dict[str, Any]] = None) -> SerializedData:
        """
        Serialize prediction results for frontend display
        """
        try:
            # Limit predictions for initial display (pagination)
            display_predictions = predictions[:1000]  # Show first 1000
            
            # Format prediction data
            formatted_data = {
                "predictions": display_predictions,
                "confidence_scores": confidence_scores[:1000] if confidence_scores else None,
                "feature_importance": feature_importance,
                "model_metadata": model_metadata,
                "total_predictions": len(predictions),
                "prediction_summary": self._generate_prediction_summary(predictions),
                "confidence_distribution": self._analyze_confidence_distribution(confidence_scores) if confidence_scores else None
            }
            
            # Choose optimal format
            format_type = SerializationFormat.JSON
            if len(predictions) > 1000:
                format_type = SerializationFormat.JSON_COMPRESSED
                
            serialized_data = self._serialize_data(formatted_data, format_type)
            
            return SerializedData(
                data=serialized_data,
                format=format_type,
                data_type=DataType.PREDICTION_RESULTS,
                metadata={
                    "total_predictions": len(predictions),
                    "displayed_predictions": len(display_predictions),
                    "has_confidence": confidence_scores is not None,
                    "has_importance": feature_importance is not None
                },
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error serializing prediction results: {e}")
            raise
    
    def serialize_rl_session_data(self,
                                session_id: str,
                                episodes: List[int],
                                rewards: List[float],
                                metrics: Dict[str, List[float]],
                                hyperparameters: Dict[str, Any]) -> SerializedData:
        """
        Serialize RL session data for training progress visualization
        """
        try:
            # Optimize data for charting
            chart_episodes = self._downsample_array(episodes, max_points=500)
            chart_rewards = self._downsample_array(rewards, max_points=500)
            
            # Calculate rolling statistics
            reward_stats = self._calculate_rolling_stats(rewards)
            
            formatted_data = {
                "session_id": session_id,
                "episodes": chart_episodes,
                "rewards": chart_rewards,
                "reward_statistics": reward_stats,
                "metrics": {k: self._downsample_array(v, max_points=500) for k, v in metrics.items()},
                "hyperparameters": hyperparameters,
                "performance_metrics": {
                    "best_reward": max(rewards) if rewards else 0,
                    "average_reward": sum(rewards) / len(rewards) if rewards else 0,
                    "reward_variance": np.var(rewards) if rewards else 0,
                    "convergence_status": self._assess_rl_convergence(rewards)
                },
                "training_progress": len(episodes) / hyperparameters.get("max_episodes", 1000) if episodes else 0
            }
            
            format_type = SerializationFormat.JSON_COMPRESSED if len(episodes) > 100 else SerializationFormat.JSON
            serialized_data = self._serialize_data(formatted_data, format_type)
            
            return SerializedData(
                data=serialized_data,
                format=format_type,
                data_type=DataType.RL_SESSION_DATA,
                metadata={
                    "session_id": session_id,
                    "total_episodes": len(episodes),
                    "chart_episodes": len(chart_episodes),
                    "metrics_count": len(metrics)
                },
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error serializing RL session data: {e}")
            raise
    
    def serialize_data_quality_report(self,
                                    quality_metrics: Dict[str, Any],
                                    data_issues: List[Dict[str, Any]],
                                    recommendations: List[str],
                                    data_sample: Optional[pd.DataFrame] = None) -> SerializedData:
        """
        Serialize data quality assessment results
        """
        try:
            # Prepare data sample for preview
            sample_data = None
            if data_sample is not None and not data_sample.empty:
                # Get a representative sample
                sample_size = min(100, len(data_sample))
                sample_data = {
                    "columns": data_sample.columns.tolist(),
                    "data_types": data_sample.dtypes.astype(str).to_dict(),
                    "sample_rows": data_sample.head(sample_size).to_dict('records'),
                    "total_rows": len(data_sample)
                }
            
            # Format quality report
            formatted_report = {
                "quality_score": quality_metrics.get("overall_score", 0),
                "quality_metrics": quality_metrics,
                "data_issues": data_issues[:50],  # Limit for initial display
                "recommendations": recommendations,
                "data_sample": sample_data,
                "issue_summary": self._summarize_issues(data_issues),
                "quality_categories": self._categorize_quality_metrics(quality_metrics)
            }
            
            format_type = SerializationFormat.JSON
            serialized_data = self._serialize_data(formatted_report, format_type)
            
            return SerializedData(
                data=serialized_data,
                format=format_type,
                data_type=DataType.DATA_QUALITY_REPORT,
                metadata={
                    "total_issues": len(data_issues),
                    "displayed_issues": min(50, len(data_issues)),
                    "quality_score": quality_metrics.get("overall_score", 0),
                    "has_sample": sample_data is not None
                },
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error serializing data quality report: {e}")
            raise
    
    def serialize_hyperparameter_results(self,
                                       trials: List[Dict[str, Any]],
                                       best_parameters: Dict[str, Any],
                                       optimization_history: List[float]) -> SerializedData:
        """
        Serialize hyperparameter optimization results
        """
        try:
            # Format trials for frontend visualization
            formatted_trials = []
            for i, trial in enumerate(trials[:200]):  # Limit for display
                formatted_trials.append({
                    "trial_number": i + 1,
                    "parameters": trial.get("parameters", {}),
                    "score": round(trial.get("score", 0), self.decimal_precision),
                    "duration": trial.get("duration", 0),
                    "status": trial.get("status", "completed")
                })
            
            # Optimization history for charting
            chart_history = self._optimize_time_series(optimization_history)
            
            formatted_data = {
                "trials": formatted_trials,
                "best_parameters": best_parameters,
                "best_score": max(optimization_history) if optimization_history else 0,
                "optimization_history": chart_history,
                "parameter_analysis": self._analyze_parameter_importance(trials),
                "convergence_analysis": {
                    "converged": self._check_convergence(optimization_history),
                    "improvement_rate": self._calculate_improvement_rate(optimization_history),
                    "stability_score": self._assess_stability(optimization_history)
                },
                "total_trials": len(trials)
            }
            
            format_type = SerializationFormat.JSON_COMPRESSED if len(trials) > 50 else SerializationFormat.JSON
            serialized_data = self._serialize_data(formatted_data, format_type)
            
            return SerializedData(
                data=serialized_data,
                format=format_type,
                data_type=DataType.HYPERPARAMETER_RESULTS,
                metadata={
                    "total_trials": len(trials),
                    "displayed_trials": len(formatted_trials),
                    "best_score": max(optimization_history) if optimization_history else 0
                },
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error serializing hyperparameter results: {e}")
            raise
    
    def deserialize_data(self, serialized: SerializedData) -> Any:
        """
        Deserialize data back to its original format
        """
        try:
            if serialized.format == SerializationFormat.JSON:
                return serialized.data
            elif serialized.format == SerializationFormat.JSON_COMPRESSED:
                return self._decompress_json(serialized.data)
            elif serialized.format == SerializationFormat.BINARY:
                return pickle.loads(base64.b64decode(serialized.data))
            else:
                raise ValueError(f"Unsupported format: {serialized.format}")
                
        except Exception as e:
            logger.error(f"Error deserializing data: {e}")
            raise
    
    def _serialize_data(self, data: Any, format_type: SerializationFormat) -> Any:
        """Internal method to serialize data based on format type"""
        if format_type == SerializationFormat.JSON:
            return data
        elif format_type == SerializationFormat.JSON_COMPRESSED:
            return self._compress_json(data)
        elif format_type == SerializationFormat.BINARY:
            return base64.b64encode(pickle.dumps(data)).decode('utf-8')
        else:
            return data
    
    def _compress_json(self, data: Any) -> str:
        """Compress JSON data using gzip"""
        json_str = json.dumps(data)
        compressed = gzip.compress(json_str.encode('utf-8'))
        return base64.b64encode(compressed).decode('utf-8')
    
    def _decompress_json(self, compressed_data: str) -> Any:
        """Decompress gzipped JSON data"""
        compressed_bytes = base64.b64decode(compressed_data.encode('utf-8'))
        json_str = gzip.decompress(compressed_bytes).decode('utf-8')
        return json.loads(json_str)
    
    def _optimize_time_series(self, values: List[float], max_points: int = 1000) -> List[Dict[str, Any]]:
        """Optimize time series data for frontend charting"""
        if len(values) <= max_points:
            return [{"x": i, "y": round(v, self.decimal_precision)} for i, v in enumerate(values)]
        
        # Downsample using LTTB (Largest Triangle Three Buckets) algorithm approximation
        return self._downsample_time_series(values, max_points)
    
    def _downsample_time_series(self, values: List[float], target_points: int) -> List[Dict[str, Any]]:
        """Downsample time series data while preserving important features"""
        if len(values) <= target_points:
            return [{"x": i, "y": round(v, self.decimal_precision)} for i, v in enumerate(values)]
        
        # Simple decimation - could be enhanced with proper LTTB algorithm
        step = len(values) // target_points
        downsampled = []
        
        for i in range(0, len(values), step):
            if i < len(values):
                downsampled.append({
                    "x": i,
                    "y": round(values[i], self.decimal_precision)
                })
        
        return downsampled
    
    def _downsample_array(self, array: List[Any], max_points: int) -> List[Any]:
        """Generic array downsampling"""
        if len(array) <= max_points:
            return array
        
        step = len(array) // max_points
        return [array[i] for i in range(0, len(array), step)]
    
    def _calculate_trend(self, recent_values: List[float]) -> str:
        """Calculate trend from recent values"""
        if len(recent_values) < 2:
            return "insufficient_data"
        
        # Simple linear trend
        x = list(range(len(recent_values)))
        trend = np.polyfit(x, recent_values, 1)[0]
        
        if trend < -0.01:
            return "decreasing"
        elif trend > 0.01:
            return "increasing"
        else:
            return "stable"
    
    def _assess_stability(self, values: List[float]) -> float:
        """Assess training stability based on variance in recent values"""
        if len(values) < 10:
            return 0.5
        
        recent_values = values[-10:]
        variance = np.var(recent_values)
        mean_value = np.mean(recent_values)
        
        # Coefficient of variation as stability metric
        if mean_value == 0:
            return 0.0
        
        stability = max(0.0, 1.0 - (variance / abs(mean_value)))
        return round(stability, 3)
    
    def _generate_prediction_summary(self, predictions: List[Any]) -> Dict[str, Any]:
        """Generate summary statistics for predictions"""
        try:
            # Handle different prediction types
            if all(isinstance(p, (int, float)) for p in predictions):
                # Numeric predictions
                return {
                    "type": "numeric",
                    "count": len(predictions),
                    "mean": round(np.mean(predictions), self.decimal_precision),
                    "std": round(np.std(predictions), self.decimal_precision),
                    "min": round(min(predictions), self.decimal_precision),
                    "max": round(max(predictions), self.decimal_precision)
                }
            else:
                # Categorical predictions
                from collections import Counter
                counts = Counter(predictions)
                return {
                    "type": "categorical",
                    "count": len(predictions),
                    "unique_values": len(counts),
                    "most_common": counts.most_common(5)
                }
        except Exception:
            return {"type": "unknown", "count": len(predictions)}
    
    def _analyze_confidence_distribution(self, confidence_scores: List[float]) -> Dict[str, Any]:
        """Analyze confidence score distribution"""
        if not confidence_scores:
            return {}
        
        return {
            "mean_confidence": round(np.mean(confidence_scores), self.decimal_precision),
            "low_confidence_count": sum(1 for c in confidence_scores if c < 0.5),
            "high_confidence_count": sum(1 for c in confidence_scores if c > 0.8),
            "confidence_histogram": self._create_histogram(confidence_scores, bins=10)
        }
    
    def _create_histogram(self, values: List[float], bins: int = 10) -> List[Dict[str, Any]]:
        """Create histogram data for frontend visualization"""
        hist, bin_edges = np.histogram(values, bins=bins)
        histogram = []
        
        for i in range(len(hist)):
            histogram.append({
                "bin_start": round(bin_edges[i], self.decimal_precision),
                "bin_end": round(bin_edges[i + 1], self.decimal_precision),
                "count": int(hist[i])
            })
        
        return histogram
    
    def _calculate_rolling_stats(self, values: List[float], window: int = 50) -> Dict[str, List[float]]:
        """Calculate rolling statistics for time series analysis"""
        if len(values) < window:
            window = len(values)
        
        rolling_mean = []
        rolling_std = []
        
        for i in range(len(values)):
            start_idx = max(0, i - window + 1)
            window_values = values[start_idx:i + 1]
            
            rolling_mean.append(round(np.mean(window_values), self.decimal_precision))
            rolling_std.append(round(np.std(window_values), self.decimal_precision))
        
        # Downsample for frontend
        return {
            "rolling_mean": self._downsample_array(rolling_mean, 500),
            "rolling_std": self._downsample_array(rolling_std, 500)
        }
    
    def _assess_rl_convergence(self, rewards: List[float]) -> str:
        """Assess RL training convergence status"""
        if len(rewards) < 50:
            return "insufficient_data"
        
        # Check if recent rewards are stable
        recent_rewards = rewards[-50:]
        variance = np.var(recent_rewards)
        mean_reward = np.mean(recent_rewards)
        
        if variance / abs(mean_reward) < 0.1:
            return "converged"
        elif self._calculate_trend(recent_rewards) == "increasing":
            return "improving"
        else:
            return "training"
    
    def _summarize_issues(self, issues: List[Dict[str, Any]]) -> Dict[str, int]:
        """Summarize data quality issues by category"""
        summary = {}
        for issue in issues:
            category = issue.get("category", "unknown")
            summary[category] = summary.get(category, 0) + 1
        return summary
    
    def _categorize_quality_metrics(self, metrics: Dict[str, Any]) -> Dict[str, List[str]]:
        """Categorize quality metrics for better visualization"""
        categories = {
            "completeness": ["missing_values", "null_percentage"],
            "validity": ["invalid_formats", "outliers"],
            "consistency": ["duplicates", "inconsistent_formats"],
            "accuracy": ["data_accuracy", "validation_errors"]
        }
        
        categorized = {}
        for category, metric_keys in categories.items():
            categorized[category] = []
            for key in metric_keys:
                if key in metrics:
                    categorized[category].append({
                        "metric": key,
                        "value": metrics[key]
                    })
        
        return categorized
    
    def _analyze_parameter_importance(self, trials: List[Dict[str, Any]]) -> Dict[str, float]:
        """Analyze hyperparameter importance from trials"""
        if not trials:
            return {}
        
        # Simple correlation analysis between parameters and scores
        parameter_importance = {}
        
        # Extract all parameter names
        all_params = set()
        for trial in trials:
            if "parameters" in trial:
                all_params.update(trial["parameters"].keys())
        
        # Calculate importance for each parameter
        for param in all_params:
            try:
                param_values = []
                scores = []
                
                for trial in trials:
                    if "parameters" in trial and param in trial["parameters"] and "score" in trial:
                        param_values.append(trial["parameters"][param])
                        scores.append(trial["score"])
                
                if len(param_values) > 1:
                    # Simple correlation coefficient
                    correlation = np.corrcoef(param_values, scores)[0, 1]
                    parameter_importance[param] = round(abs(correlation), 3)
                
            except Exception:
                parameter_importance[param] = 0.0
        
        return parameter_importance
    
    def _check_convergence(self, history: List[float]) -> bool:
        """Check if optimization has converged"""
        if len(history) < 20:
            return False
        
        # Check if recent improvements are minimal
        recent_values = history[-10:]
        return np.std(recent_values) < 0.01
    
    def _calculate_improvement_rate(self, history: List[float]) -> float:
        """Calculate improvement rate over optimization history"""
        if len(history) < 2:
            return 0.0
        
        # Simple improvement rate
        start_value = np.mean(history[:5]) if len(history) >= 5 else history[0]
        end_value = np.mean(history[-5:]) if len(history) >= 5 else history[-1]
        
        if start_value == 0:
            return 0.0
        
        improvement = (end_value - start_value) / abs(start_value)
        return round(improvement, 3)


# Global serializer instance
ml_data_serializer = MLDataSerializer()


# Utility functions for common serialization tasks
def serialize_for_frontend(data: Any, data_type: DataType, **kwargs) -> SerializedData:
    """
    Utility function to serialize various ML/RL data types for frontend consumption
    """
    if data_type == DataType.TRAINING_METRICS:
        return ml_data_serializer.serialize_training_metrics(
            metrics=data.get("metrics", {}),
            epoch=data.get("epoch", 0),
            loss_history=data.get("loss_history", []),
            validation_metrics=data.get("validation_metrics")
        )
    elif data_type == DataType.PREDICTION_RESULTS:
        return ml_data_serializer.serialize_prediction_results(
            predictions=data.get("predictions", []),
            confidence_scores=data.get("confidence_scores"),
            feature_importance=data.get("feature_importance"),
            model_metadata=data.get("model_metadata")
        )
    elif data_type == DataType.RL_SESSION_DATA:
        return ml_data_serializer.serialize_rl_session_data(
            session_id=data.get("session_id", ""),
            episodes=data.get("episodes", []),
            rewards=data.get("rewards", []),
            metrics=data.get("metrics", {}),
            hyperparameters=data.get("hyperparameters", {})
        )
    elif data_type == DataType.DATA_QUALITY_REPORT:
        return ml_data_serializer.serialize_data_quality_report(
            quality_metrics=data.get("quality_metrics", {}),
            data_issues=data.get("data_issues", []),
            recommendations=data.get("recommendations", []),
            data_sample=data.get("data_sample")
        )
    elif data_type == DataType.HYPERPARAMETER_RESULTS:
        return ml_data_serializer.serialize_hyperparameter_results(
            trials=data.get("trials", []),
            best_parameters=data.get("best_parameters", {}),
            optimization_history=data.get("optimization_history", [])
        )
    else:
        raise ValueError(f"Unsupported data type: {data_type}")


def create_frontend_response(data: Any, data_type: DataType, **metadata) -> Dict[str, Any]:
    """
    Create a complete frontend response with serialized data and metadata
    """
    try:
        serialized = serialize_for_frontend(data, data_type)
        
        return {
            "success": True,
            "data": serialized.data,
            "format": serialized.format.value,
            "data_type": serialized.data_type.value,
            "metadata": {
                **serialized.metadata,
                **metadata
            },
            "timestamp": serialized.timestamp.isoformat(),
            "size_bytes": serialized.size_bytes,
            "compression_ratio": serialized.compression_ratio
        }
        
    except Exception as e:
        logger.error(f"Error creating frontend response: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": None,
            "timestamp": datetime.utcnow().isoformat()
        }