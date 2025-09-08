"""
MLOps Model Registry Service
============================

Advanced model registry service providing comprehensive model lifecycle management
for AI companies. Handles model versioning, metadata tracking, lineage, and artifact storage.

Features:
- Advanced model versioning and lineage tracking
- Metadata management with rich search capabilities
- Model performance tracking across versions
- Artifact storage with integrity checks
- Model approval workflows and governance
- Integration with existing ML pipeline infrastructure
"""

import os
import json
import asyncio
import hashlib
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple
from pathlib import Path
import logging

import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Import MLOps core components
from app.ml.mlops_platform import (
    MLOpsModelRegistry, ModelMetadata, ModelStatus, ModelFramework,
    create_mlops_platform
)

# Import existing ML capabilities  
try:
    from app.ml.advanced_modeling_engine import AdvancedMLModelingEngine
    from app.core.database import get_db_session
    from app.core.security_utils import hash_sensitive_data
except ImportError as e:
    logging.warning(f"Some imports not available: {e}")


logger = logging.getLogger(__name__)


class EnhancedModelRegistry(MLOpsModelRegistry):
    """Enhanced model registry with additional enterprise features."""
    
    def __init__(self, storage_path: str = "./mlops_storage", db_session: Session = None):
        super().__init__(storage_path)
        self.db_session = db_session
        self._model_checksums: Dict[str, str] = {}
        self._approval_workflows: Dict[str, Dict[str, Any]] = {}
        self._performance_history: Dict[str, List[Dict[str, Any]]] = {}
        
        # Load additional metadata
        self._load_enhanced_metadata()
    
    def _load_enhanced_metadata(self):
        """Load enhanced metadata from storage."""
        try:
            # Load checksums
            checksum_file = os.path.join(self.metadata_path, "model_checksums.json")
            if os.path.exists(checksum_file):
                with open(checksum_file, 'r') as f:
                    self._model_checksums = json.load(f)
            
            # Load approval workflows
            approval_file = os.path.join(self.metadata_path, "approval_workflows.json")
            if os.path.exists(approval_file):
                with open(approval_file, 'r') as f:
                    self._approval_workflows = json.load(f)
            
            # Load performance history
            perf_file = os.path.join(self.metadata_path, "performance_history.json")
            if os.path.exists(perf_file):
                with open(perf_file, 'r') as f:
                    self._performance_history = json.load(f)
        
        except Exception as e:
            logger.warning(f"Could not load enhanced metadata: {e}")
    
    def register_model_with_validation(self,
                                     model: Any,
                                     validation_data: pd.DataFrame,
                                     validation_target: str,
                                     approval_required: bool = False,
                                     **kwargs) -> str:
        """Register model with validation and optional approval workflow."""
        
        # Validate model performance
        validation_results = self._validate_model_performance(
            model, validation_data, validation_target
        )
        
        # Add validation metrics to kwargs
        kwargs['validation_metrics'] = validation_results
        
        # Register model
        model_id = self.register_model(model=model, **kwargs)
        
        # Calculate and store model checksum
        model_checksum = self._calculate_model_checksum(model)
        self._model_checksums[model_id] = model_checksum
        self._save_enhanced_metadata()
        
        # Initialize approval workflow if required
        if approval_required:
            self._initialize_approval_workflow(model_id, kwargs.get('author', 'system'))
        
        logger.info(f"Registered model {model_id} with validation (checksum: {model_checksum[:8]})")
        return model_id
    
    def _validate_model_performance(self, 
                                   model: Any, 
                                   validation_data: pd.DataFrame,
                                   validation_target: str) -> Dict[str, float]:
        """Validate model performance on validation dataset."""
        try:
            X_val = validation_data.drop(columns=[validation_target])
            y_val = validation_data[validation_target]
            
            # Make predictions
            if hasattr(model, 'predict'):
                predictions = model.predict(X_val)
            else:
                raise ValueError("Model does not have predict method")
            
            # Calculate metrics based on task type
            unique_values = len(np.unique(y_val))
            is_classification = unique_values < 20 and unique_values / len(y_val) < 0.1
            
            if is_classification:
                from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
                
                metrics = {
                    'accuracy': accuracy_score(y_val, predictions),
                    'precision': precision_score(y_val, predictions, average='macro', zero_division=0),
                    'recall': recall_score(y_val, predictions, average='macro', zero_division=0),
                    'f1_score': f1_score(y_val, predictions, average='macro', zero_division=0)
                }
            else:
                from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
                
                metrics = {
                    'mse': mean_squared_error(y_val, predictions),
                    'mae': mean_absolute_error(y_val, predictions),
                    'r2_score': r2_score(y_val, predictions)
                }
            
            return metrics
        
        except Exception as e:
            logger.error(f"Model validation failed: {e}")
            return {'validation_error': str(e)}
    
    def _calculate_model_checksum(self, model: Any) -> str:
        """Calculate checksum for model artifact integrity."""
        try:
            # Create temporary file to calculate checksum
            with tempfile.NamedTemporaryFile() as tmp_file:
                import pickle
                pickle.dump(model, tmp_file)
                tmp_file.seek(0)
                
                # Calculate SHA-256 hash
                sha256_hash = hashlib.sha256()
                for chunk in iter(lambda: tmp_file.read(4096), b""):
                    sha256_hash.update(chunk)
                
                return sha256_hash.hexdigest()
        
        except Exception as e:
            logger.error(f"Could not calculate model checksum: {e}")
            return "unknown"
    
    def verify_model_integrity(self, model_id: str) -> Dict[str, Any]:
        """Verify model artifact integrity."""
        if model_id not in self._model_checksums:
            return {'status': 'unknown', 'message': 'No checksum available'}
        
        try:
            # Load model and recalculate checksum
            model, _ = self.get_model(model_id)
            current_checksum = self._calculate_model_checksum(model)
            stored_checksum = self._model_checksums[model_id]
            
            if current_checksum == stored_checksum:
                return {'status': 'valid', 'checksum': current_checksum}
            else:
                return {
                    'status': 'corrupted',
                    'stored_checksum': stored_checksum,
                    'current_checksum': current_checksum
                }
        
        except Exception as e:
            return {'status': 'error', 'message': str(e)}
    
    def _initialize_approval_workflow(self, model_id: str, requester: str):
        """Initialize approval workflow for model."""
        workflow = {
            'model_id': model_id,
            'requester': requester,
            'status': 'pending_approval',
            'created_at': datetime.utcnow().isoformat(),
            'approvals': [],
            'required_approvals': 2,  # Configurable
            'comments': []
        }
        
        self._approval_workflows[model_id] = workflow
        self._save_enhanced_metadata()
        
        logger.info(f"Initialized approval workflow for model {model_id}")
    
    def approve_model(self, model_id: str, approver: str, comment: str = ""):
        """Approve model for deployment."""
        if model_id not in self._approval_workflows:
            raise ValueError(f"No approval workflow found for model {model_id}")
        
        workflow = self._approval_workflows[model_id]
        
        # Check if already approved by this user
        existing_approval = next(
            (a for a in workflow['approvals'] if a['approver'] == approver), 
            None
        )
        
        if existing_approval:
            raise ValueError(f"Model already approved by {approver}")
        
        # Add approval
        approval = {
            'approver': approver,
            'approved_at': datetime.utcnow().isoformat(),
            'comment': comment
        }
        workflow['approvals'].append(approval)
        
        # Check if enough approvals
        if len(workflow['approvals']) >= workflow['required_approvals']:
            workflow['status'] = 'approved'
            
            # Update model status
            self.update_model_status(model_id, ModelStatus.VALIDATED)
        
        self._save_enhanced_metadata()
        logger.info(f"Model {model_id} approved by {approver}")
    
    def reject_model(self, model_id: str, rejector: str, reason: str):
        """Reject model deployment."""
        if model_id not in self._approval_workflows:
            raise ValueError(f"No approval workflow found for model {model_id}")
        
        workflow = self._approval_workflows[model_id]
        workflow['status'] = 'rejected'
        workflow['rejection'] = {
            'rejector': rejector,
            'rejected_at': datetime.utcnow().isoformat(),
            'reason': reason
        }
        
        # Update model status
        self.update_model_status(model_id, ModelStatus.DEPRECATED)
        
        self._save_enhanced_metadata()
        logger.info(f"Model {model_id} rejected by {rejector}: {reason}")
    
    def track_model_performance(self, 
                               model_id: str, 
                               metrics: Dict[str, float],
                               dataset_name: str = "production",
                               timestamp: datetime = None):
        """Track model performance over time."""
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        performance_entry = {
            'timestamp': timestamp.isoformat(),
            'dataset': dataset_name,
            'metrics': metrics,
            'model_version': self._models[model_id].version if model_id in self._models else "unknown"
        }
        
        if model_id not in self._performance_history:
            self._performance_history[model_id] = []
        
        self._performance_history[model_id].append(performance_entry)
        self._save_enhanced_metadata()
        
        logger.info(f"Tracked performance for model {model_id} on {dataset_name}")
    
    def get_model_performance_history(self, 
                                     model_id: str,
                                     days_back: int = 30) -> List[Dict[str, Any]]:
        """Get model performance history."""
        if model_id not in self._performance_history:
            return []
        
        # Filter by date if specified
        if days_back > 0:
            cutoff_date = datetime.utcnow() - timedelta(days=days_back)
            filtered_history = []
            
            for entry in self._performance_history[model_id]:
                entry_date = datetime.fromisoformat(entry['timestamp'])
                if entry_date >= cutoff_date:
                    filtered_history.append(entry)
            
            return filtered_history
        
        return self._performance_history[model_id]
    
    def compare_models(self, model_ids: List[str], metric: str = None) -> Dict[str, Any]:
        """Compare multiple models across metrics."""
        comparison = {
            'models': {},
            'comparison_timestamp': datetime.utcnow().isoformat(),
            'requested_metric': metric
        }
        
        for model_id in model_ids:
            if model_id not in self._models:
                comparison['models'][model_id] = {'error': 'Model not found'}
                continue
            
            metadata = self._models[model_id]
            model_info = {
                'name': metadata.name,
                'version': metadata.version,
                'framework': metadata.framework.value,
                'status': metadata.status.value,
                'training_metrics': metadata.training_metrics,
                'validation_metrics': metadata.validation_metrics
            }
            
            # Add performance history summary
            if model_id in self._performance_history:
                recent_performance = self.get_model_performance_history(model_id, days_back=7)
                if recent_performance:
                    latest = recent_performance[-1]
                    model_info['latest_production_metrics'] = latest['metrics']
                    model_info['latest_performance_date'] = latest['timestamp']
            
            comparison['models'][model_id] = model_info
        
        # Add comparison insights
        if metric and len([m for m in comparison['models'].values() if 'error' not in m]) > 1:
            comparison['insights'] = self._generate_comparison_insights(comparison['models'], metric)
        
        return comparison
    
    def _generate_comparison_insights(self, models: Dict[str, Any], metric: str) -> Dict[str, Any]:
        """Generate insights from model comparison."""
        valid_models = {k: v for k, v in models.items() if 'error' not in v}
        
        if len(valid_models) < 2:
            return {'message': 'Not enough valid models for comparison'}
        
        metric_values = {}
        for model_id, model_info in valid_models.items():
            # Try to find metric in different places
            value = None
            
            if model_info.get('training_metrics') and metric in model_info['training_metrics']:
                value = model_info['training_metrics'][metric]
            elif model_info.get('validation_metrics') and metric in model_info['validation_metrics']:
                value = model_info['validation_metrics'][metric]
            elif model_info.get('latest_production_metrics') and metric in model_info['latest_production_metrics']:
                value = model_info['latest_production_metrics'][metric]
            
            if value is not None:
                metric_values[model_id] = value
        
        if not metric_values:
            return {'message': f'Metric {metric} not found in any model'}
        
        # Generate insights
        best_model_id = max(metric_values.keys(), key=lambda k: metric_values[k])
        worst_model_id = min(metric_values.keys(), key=lambda k: metric_values[k])
        
        insights = {
            'best_model': {
                'model_id': best_model_id,
                'value': metric_values[best_model_id]
            },
            'worst_model': {
                'model_id': worst_model_id,
                'value': metric_values[worst_model_id]
            },
            'metric_range': {
                'min': min(metric_values.values()),
                'max': max(metric_values.values()),
                'std': np.std(list(metric_values.values())) if len(metric_values) > 1 else 0
            }
        }
        
        return insights
    
    def search_models(self, 
                     query: str = None,
                     frameworks: List[ModelFramework] = None,
                     min_score: float = None,
                     score_metric: str = 'accuracy',
                     date_range: Tuple[datetime, datetime] = None,
                     tags: List[str] = None) -> List[ModelMetadata]:
        """Advanced model search with multiple filters."""
        models = list(self._models.values())
        
        # Text search in name and description
        if query:
            models = [
                m for m in models 
                if query.lower() in m.name.lower() or query.lower() in m.description.lower()
            ]
        
        # Framework filter
        if frameworks:
            models = [m for m in models if m.framework in frameworks]
        
        # Minimum score filter
        if min_score is not None:
            filtered_models = []
            for model in models:
                score = None
                
                # Look for score in training metrics
                if model.training_metrics and score_metric in model.training_metrics:
                    score = model.training_metrics[score_metric]
                elif model.validation_metrics and score_metric in model.validation_metrics:
                    score = model.validation_metrics[score_metric]
                
                if score is not None and score >= min_score:
                    filtered_models.append(model)
            
            models = filtered_models
        
        # Date range filter
        if date_range:
            start_date, end_date = date_range
            models = [
                m for m in models 
                if start_date <= m.created_at <= end_date
            ]
        
        # Tags filter
        if tags:
            models = [
                m for m in models 
                if any(tag in m.tags for tag in tags)
            ]
        
        return sorted(models, key=lambda x: x.created_at, reverse=True)
    
    def get_registry_statistics(self) -> Dict[str, Any]:
        """Get comprehensive registry statistics."""
        models = list(self._models.values())
        
        stats = {
            'total_models': len(models),
            'models_by_status': {},
            'models_by_framework': {},
            'models_by_type': {},
            'approval_workflows': {
                'pending': len([w for w in self._approval_workflows.values() if w['status'] == 'pending_approval']),
                'approved': len([w for w in self._approval_workflows.values() if w['status'] == 'approved']),
                'rejected': len([w for w in self._approval_workflows.values() if w['status'] == 'rejected'])
            },
            'performance_tracking': {
                'models_with_history': len(self._performance_history),
                'total_performance_entries': sum(len(history) for history in self._performance_history.values())
            }
        }
        
        # Calculate status distribution
        for model in models:
            status = model.status.value
            stats['models_by_status'][status] = stats['models_by_status'].get(status, 0) + 1
        
        # Calculate framework distribution
        for model in models:
            framework = model.framework.value
            stats['models_by_framework'][framework] = stats['models_by_framework'].get(framework, 0) + 1
        
        # Calculate type distribution
        for model in models:
            model_type = model.model_type
            stats['models_by_type'][model_type] = stats['models_by_type'].get(model_type, 0) + 1
        
        return stats
    
    def _save_enhanced_metadata(self):
        """Save enhanced metadata to storage."""
        try:
            # Save checksums
            checksum_file = os.path.join(self.metadata_path, "model_checksums.json")
            with open(checksum_file, 'w') as f:
                json.dump(self._model_checksums, f, indent=2)
            
            # Save approval workflows
            approval_file = os.path.join(self.metadata_path, "approval_workflows.json")
            with open(approval_file, 'w') as f:
                json.dump(self._approval_workflows, f, indent=2)
            
            # Save performance history
            perf_file = os.path.join(self.metadata_path, "performance_history.json")
            with open(perf_file, 'w') as f:
                json.dump(self._performance_history, f, indent=2, default=str)
        
        except Exception as e:
            logger.error(f"Could not save enhanced metadata: {e}")


class ModelRegistryService:
    """Service layer for model registry operations."""
    
    def __init__(self, storage_path: str = "./mlops_storage"):
        self.registry = EnhancedModelRegistry(storage_path)
        self._monitoring_tasks: Dict[str, asyncio.Task] = {}
    
    async def register_model_async(self, **kwargs) -> str:
        """Async wrapper for model registration."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.registry.register_model_with_validation, **kwargs)
    
    async def batch_register_models(self, model_configs: List[Dict[str, Any]]) -> List[str]:
        """Register multiple models in batch."""
        tasks = []
        for config in model_configs:
            task = self.register_model_async(**config)
            tasks.append(task)
        
        model_ids = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions and log them
        successful_ids = []
        for i, result in enumerate(model_ids):
            if isinstance(result, Exception):
                logger.error(f"Failed to register model {i}: {result}")
            else:
                successful_ids.append(result)
        
        return successful_ids
    
    async def start_performance_monitoring(self, 
                                          model_id: str,
                                          monitoring_config: Dict[str, Any]):
        """Start performance monitoring for a model."""
        if model_id in self._monitoring_tasks:
            logger.warning(f"Performance monitoring already active for model {model_id}")
            return
        
        async def monitor_model():
            """Monitoring coroutine."""
            interval = monitoring_config.get('interval_minutes', 60)
            
            while True:
                try:
                    # This is a placeholder - in production, you'd integrate with actual monitoring systems
                    # For example, query production metrics from monitoring dashboards
                    
                    # Simulate performance tracking
                    await asyncio.sleep(interval * 60)
                    
                    # In a real implementation, you'd:
                    # 1. Query actual production metrics
                    # 2. Compare against baseline thresholds
                    # 3. Send alerts if performance degraded
                    # 4. Log performance data
                    
                    logger.info(f"Performance monitoring check for model {model_id}")
                    
                except asyncio.CancelledError:
                    logger.info(f"Performance monitoring cancelled for model {model_id}")
                    break
                except Exception as e:
                    logger.error(f"Error in performance monitoring for model {model_id}: {e}")
        
        # Start monitoring task
        task = asyncio.create_task(monitor_model())
        self._monitoring_tasks[model_id] = task
        
        logger.info(f"Started performance monitoring for model {model_id}")
    
    async def stop_performance_monitoring(self, model_id: str):
        """Stop performance monitoring for a model."""
        if model_id not in self._monitoring_tasks:
            logger.warning(f"No active monitoring for model {model_id}")
            return
        
        task = self._monitoring_tasks[model_id]
        task.cancel()
        
        try:
            await task
        except asyncio.CancelledError:
            pass
        
        del self._monitoring_tasks[model_id]
        logger.info(f"Stopped performance monitoring for model {model_id}")
    
    def get_model_health_report(self, model_id: str) -> Dict[str, Any]:
        """Generate comprehensive model health report."""
        try:
            # Get basic model info
            _, metadata = self.registry.get_model(model_id)
            
            # Check integrity
            integrity_result = self.registry.verify_model_integrity(model_id)
            
            # Get performance history
            performance_history = self.registry.get_model_performance_history(model_id, days_back=30)
            
            # Get approval status
            approval_status = self.registry._approval_workflows.get(model_id, {})
            
            report = {
                'model_id': model_id,
                'model_name': metadata.name,
                'model_version': metadata.version,
                'status': metadata.status.value,
                'health_score': self._calculate_health_score(metadata, integrity_result, performance_history),
                'integrity': integrity_result,
                'performance_trend': self._analyze_performance_trend(performance_history),
                'approval_status': approval_status.get('status', 'no_workflow'),
                'last_updated': metadata.updated_at.isoformat(),
                'recommendations': self._generate_health_recommendations(metadata, performance_history)
            }
            
            return report
            
        except Exception as e:
            logger.error(f"Error generating health report for model {model_id}: {e}")
            return {
                'model_id': model_id,
                'error': str(e),
                'health_score': 0
            }
    
    def _calculate_health_score(self, 
                               metadata: ModelMetadata,
                               integrity_result: Dict[str, Any],
                               performance_history: List[Dict[str, Any]]) -> float:
        """Calculate overall model health score (0-100)."""
        score = 0.0
        
        # Base score based on status
        status_scores = {
            ModelStatus.DEPLOYED: 90,
            ModelStatus.VALIDATED: 80,
            ModelStatus.TRAINED: 70,
            ModelStatus.REGISTERED: 50,
            ModelStatus.TRAINING: 40,
            ModelStatus.DEPRECATED: 20,
            ModelStatus.ARCHIVED: 10
        }
        score += status_scores.get(metadata.status, 30)
        
        # Integrity check
        if integrity_result['status'] == 'valid':
            score += 10
        elif integrity_result['status'] == 'corrupted':
            score -= 30
        
        # Performance history
        if performance_history:
            # Recent activity is good
            recent_entries = [
                entry for entry in performance_history
                if datetime.fromisoformat(entry['timestamp']) > datetime.utcnow() - timedelta(days=7)
            ]
            if recent_entries:
                score += 10
            
            # Consistent performance is good
            if len(performance_history) > 5:
                # This is simplified - in production you'd do more sophisticated trend analysis
                score += 5
        
        return min(100.0, max(0.0, score))
    
    def _analyze_performance_trend(self, performance_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze performance trends."""
        if len(performance_history) < 2:
            return {'status': 'insufficient_data'}
        
        # Sort by timestamp
        sorted_history = sorted(performance_history, key=lambda x: x['timestamp'])
        
        # For simplicity, analyze the first available metric
        if not sorted_history[0]['metrics']:
            return {'status': 'no_metrics'}
        
        metric_name = list(sorted_history[0]['metrics'].keys())[0]
        values = []
        timestamps = []
        
        for entry in sorted_history:
            if metric_name in entry['metrics']:
                values.append(entry['metrics'][metric_name])
                timestamps.append(entry['timestamp'])
        
        if len(values) < 2:
            return {'status': 'insufficient_metric_data'}
        
        # Simple trend analysis
        recent_avg = np.mean(values[-3:]) if len(values) >= 3 else values[-1]
        older_avg = np.mean(values[:3]) if len(values) >= 6 else values[0]
        
        trend = 'stable'
        if recent_avg > older_avg * 1.05:
            trend = 'improving'
        elif recent_avg < older_avg * 0.95:
            trend = 'degrading'
        
        return {
            'status': 'analyzed',
            'metric': metric_name,
            'trend': trend,
            'recent_average': recent_avg,
            'older_average': older_avg,
            'total_data_points': len(values)
        }
    
    def _generate_health_recommendations(self, 
                                        metadata: ModelMetadata,
                                        performance_history: List[Dict[str, Any]]) -> List[str]:
        """Generate health recommendations."""
        recommendations = []
        
        # Status-based recommendations
        if metadata.status == ModelStatus.DEPRECATED:
            recommendations.append("Consider archiving or replacing this deprecated model")
        elif metadata.status == ModelStatus.REGISTERED:
            recommendations.append("Model is registered but not trained - consider starting training")
        
        # Performance-based recommendations
        if not performance_history:
            recommendations.append("No performance history available - consider setting up monitoring")
        elif len(performance_history) < 5:
            recommendations.append("Limited performance data - consider collecting more metrics")
        
        # Age-based recommendations
        age_days = (datetime.utcnow() - metadata.created_at).days
        if age_days > 90:
            recommendations.append(f"Model is {age_days} days old - consider retraining with fresh data")
        
        return recommendations


# Factory function
def create_model_registry_service(storage_path: str = "./mlops_storage") -> ModelRegistryService:
    """Factory function to create model registry service."""
    return ModelRegistryService(storage_path)