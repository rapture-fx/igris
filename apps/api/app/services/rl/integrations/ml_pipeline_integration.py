"""
ML Pipeline Integration for RL Optimization System

This module provides integration between the RL optimization system and existing
ML pipelines, enabling automatic optimization of pipeline configurations, 
hyperparameters, and resource allocation.
"""

import logging
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from ..models.rl_optimization_models import RLOptimizationDatabase, OptimizationType
from ..agents.hyperparameter_optimizer import HyperparameterOptimizerFactory
from ..agents.resource_allocation_agent import ResourceAllocationAgent
from ..agents.data_quality_agent import DataQualityAgent
from ...ml.models import ManufacturingPredictorModel, EcommerceRecommendationModel, FinancialRareEventModel
from ...ml.pipelines import ManufacturingPipeline, EcommercePipeline, FinancialPipeline, PipelineFactory
from ...database.models import get_db_session

logger = logging.getLogger(__name__)


class IntegrationType(str, Enum):
    """Types of pipeline integrations."""
    AUTOMATIC = "automatic"
    SCHEDULED = "scheduled" 
    MANUAL = "manual"
    TRIGGERED = "triggered"


class OptimizationTrigger(str, Enum):
    """Triggers for automatic optimization."""
    PERFORMANCE_DEGRADATION = "performance_degradation"
    RESOURCE_THRESHOLD = "resource_threshold"
    DATA_DRIFT = "data_drift"
    SCHEDULED_TIME = "scheduled_time"
    MANUAL_REQUEST = "manual_request"


@dataclass
class PipelineOptimizationConfig:
    """Configuration for pipeline optimization integration."""
    pipeline_id: str
    pipeline_type: str
    optimization_types: List[str]
    integration_type: IntegrationType
    triggers: List[OptimizationTrigger]
    performance_thresholds: Dict[str, float]
    optimization_schedule: Optional[str] = None  # Cron expression
    resource_constraints: Optional[Dict[str, Any]] = None
    notification_settings: Optional[Dict[str, Any]] = None


class MLPipelineIntegrationService:
    """
    Service for integrating RL optimization with existing ML pipelines.
    
    Provides automatic optimization triggers, pipeline monitoring, and
    seamless integration with existing ML infrastructure.
    """
    
    def __init__(self):
        self.pipeline_configs: Dict[str, PipelineOptimizationConfig] = {}
        self.active_optimizations: Dict[str, Dict[str, Any]] = {}
        self.pipeline_performance_history: Dict[str, List[Dict[str, Any]]] = {}
        
        logger.info("Initialized ML Pipeline Integration Service")
    
    def register_pipeline_for_optimization(self, config: PipelineOptimizationConfig) -> Dict[str, Any]:
        """
        Register a pipeline for RL optimization integration.
        
        Args:
            config: Pipeline optimization configuration
            
        Returns:
            Registration result
        """
        try:
            logger.info(f"Registering pipeline {config.pipeline_id} for optimization")
            
            # Validate configuration
            validation_result = self._validate_pipeline_config(config)
            if not validation_result["valid"]:
                return {
                    "success": False,
                    "error": "Invalid pipeline configuration",
                    "issues": validation_result["issues"]
                }
            
            # Store configuration
            self.pipeline_configs[config.pipeline_id] = config
            
            # Initialize performance history
            self.pipeline_performance_history[config.pipeline_id] = []
            
            # Set up monitoring if automatic integration
            if config.integration_type == IntegrationType.AUTOMATIC:
                self._setup_automatic_monitoring(config)
            
            # Schedule optimizations if needed
            if config.optimization_schedule:
                self._schedule_optimization(config)
            
            logger.info(f"Successfully registered pipeline {config.pipeline_id}")
            
            return {
                "success": True,
                "pipeline_id": config.pipeline_id,
                "integration_type": config.integration_type,
                "optimization_types": config.optimization_types,
                "triggers": config.triggers,
                "monitoring_enabled": config.integration_type == IntegrationType.AUTOMATIC
            }
        
        except Exception as e:
            logger.error(f"Failed to register pipeline {config.pipeline_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def trigger_optimization(self, 
                           pipeline_id: str, 
                           trigger: OptimizationTrigger,
                           optimization_type: Optional[str] = None,
                           additional_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Trigger optimization for a registered pipeline.
        
        Args:
            pipeline_id: Pipeline identifier
            trigger: Optimization trigger
            optimization_type: Specific optimization type (if None, uses config default)
            additional_context: Additional context information
            
        Returns:
            Optimization trigger result
        """
        try:
            if pipeline_id not in self.pipeline_configs:
                return {
                    "success": False,
                    "error": f"Pipeline {pipeline_id} not registered for optimization"
                }
            
            config = self.pipeline_configs[pipeline_id]
            
            # Check if trigger is allowed
            if trigger not in config.triggers:
                return {
                    "success": False,
                    "error": f"Trigger {trigger} not configured for pipeline {pipeline_id}"
                }
            
            # Determine optimization type
            if not optimization_type:
                optimization_type = self._select_optimization_type(config, trigger, additional_context)
            
            # Check if optimization is already running
            if self._is_optimization_running(pipeline_id):
                return {
                    "success": False,
                    "error": f"Optimization already running for pipeline {pipeline_id}"
                }
            
            # Start optimization based on type
            optimization_result = self._start_pipeline_optimization(
                config, optimization_type, trigger, additional_context
            )
            
            if optimization_result["success"]:
                # Track active optimization
                self.active_optimizations[pipeline_id] = {
                    "session_id": optimization_result["session_id"],
                    "optimization_type": optimization_type,
                    "trigger": trigger,
                    "started_at": datetime.now(),
                    "context": additional_context
                }
                
                logger.info(f"Started {optimization_type} optimization for pipeline {pipeline_id}")
            
            return optimization_result
        
        except Exception as e:
            logger.error(f"Failed to trigger optimization for pipeline {pipeline_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def update_pipeline_performance(self, pipeline_id: str, performance_metrics: Dict[str, Any]):
        """Update performance metrics for a pipeline and check for optimization triggers."""
        try:
            if pipeline_id not in self.pipeline_configs:
                logger.warning(f"Performance update for unregistered pipeline: {pipeline_id}")
                return
            
            config = self.pipeline_configs[pipeline_id]
            
            # Record performance metrics
            performance_record = {
                "timestamp": datetime.now(),
                "metrics": performance_metrics,
                "trigger_checks": {}
            }
            
            self.pipeline_performance_history[pipeline_id].append(performance_record)
            
            # Keep only recent history (last 100 records)
            if len(self.pipeline_performance_history[pipeline_id]) > 100:
                self.pipeline_performance_history[pipeline_id] = self.pipeline_performance_history[pipeline_id][-100:]
            
            # Check for automatic triggers
            if config.integration_type == IntegrationType.AUTOMATIC:
                self._check_optimization_triggers(pipeline_id, performance_metrics)
        
        except Exception as e:
            logger.error(f"Failed to update performance for pipeline {pipeline_id}: {str(e)}")
    
    def get_pipeline_optimization_status(self, pipeline_id: str) -> Dict[str, Any]:
        """Get optimization status for a pipeline."""
        try:
            if pipeline_id not in self.pipeline_configs:
                return {
                    "success": False,
                    "error": "Pipeline not registered"
                }
            
            config = self.pipeline_configs[pipeline_id]
            
            # Get active optimization info
            active_optimization = self.active_optimizations.get(pipeline_id)
            
            # Get performance history
            recent_performance = self.pipeline_performance_history.get(pipeline_id, [])[-10:]
            
            # Get optimization history from database
            with get_db_session() as db_session:
                db = RLOptimizationDatabase(db_session)
                optimization_history = db.get_optimization_history(pipeline_id, limit=5)
            
            return {
                "success": True,
                "pipeline_id": pipeline_id,
                "config": {
                    "pipeline_type": config.pipeline_type,
                    "integration_type": config.integration_type,
                    "optimization_types": config.optimization_types,
                    "triggers": config.triggers
                },
                "active_optimization": active_optimization,
                "recent_performance": [
                    {
                        "timestamp": p["timestamp"].isoformat(),
                        "metrics": p["metrics"]
                    }
                    for p in recent_performance
                ],
                "optimization_history": optimization_history,
                "recommendations": self._generate_optimization_recommendations(pipeline_id)
            }
        
        except Exception as e:
            logger.error(f"Failed to get optimization status for pipeline {pipeline_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def integrate_with_existing_pipeline(self, pipeline_instance, optimization_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Integrate RL optimization directly with an existing pipeline instance.
        
        Args:
            pipeline_instance: Instance of a pipeline (ManufacturingPipeline, etc.)
            optimization_config: Configuration for optimization integration
            
        Returns:
            Integration result
        """
        try:
            # Determine pipeline type
            pipeline_type = self._detect_pipeline_type(pipeline_instance)
            
            if not pipeline_type:
                return {
                    "success": False,
                    "error": "Unsupported pipeline type"
                }
            
            # Extract pipeline configuration
            pipeline_config = self._extract_pipeline_configuration(pipeline_instance, pipeline_type)
            
            # Set up optimization integration
            integration_config = PipelineOptimizationConfig(
                pipeline_id=optimization_config.get("pipeline_id", f"integrated_{id(pipeline_instance)}"),
                pipeline_type=pipeline_type,
                optimization_types=optimization_config.get("optimization_types", ["hyperparameter"]),
                integration_type=IntegrationType.AUTOMATIC,
                triggers=optimization_config.get("triggers", [OptimizationTrigger.PERFORMANCE_DEGRADATION]),
                performance_thresholds=optimization_config.get("performance_thresholds", {}),
                resource_constraints=optimization_config.get("resource_constraints")
            )
            
            # Register for optimization
            registration_result = self.register_pipeline_for_optimization(integration_config)
            
            if registration_result["success"]:
                # Add optimization hooks to pipeline
                self._add_optimization_hooks(pipeline_instance, integration_config.pipeline_id)
                
                logger.info(f"Successfully integrated pipeline of type {pipeline_type}")
                
                return {
                    "success": True,
                    "pipeline_id": integration_config.pipeline_id,
                    "pipeline_type": pipeline_type,
                    "configuration": pipeline_config,
                    "optimization_integration": registration_result
                }
            else:
                return registration_result
        
        except Exception as e:
            logger.error(f"Failed to integrate pipeline: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _validate_pipeline_config(self, config: PipelineOptimizationConfig) -> Dict[str, Any]:
        """Validate pipeline optimization configuration."""
        issues = []
        
        # Check required fields
        if not config.pipeline_id:
            issues.append("Pipeline ID is required")
        
        if not config.pipeline_type:
            issues.append("Pipeline type is required")
        
        if not config.optimization_types:
            issues.append("At least one optimization type is required")
        
        # Validate optimization types
        valid_opt_types = [OptimizationType.HYPERPARAMETER, OptimizationType.RESOURCE_ALLOCATION, OptimizationType.DATA_QUALITY]
        for opt_type in config.optimization_types:
            if opt_type not in valid_opt_types:
                issues.append(f"Invalid optimization type: {opt_type}")
        
        # Validate triggers
        for trigger in config.triggers:
            if not isinstance(trigger, OptimizationTrigger):
                issues.append(f"Invalid trigger type: {trigger}")
        
        # Validate performance thresholds
        if config.performance_thresholds:
            for metric, threshold in config.performance_thresholds.items():
                if not isinstance(threshold, (int, float)):
                    issues.append(f"Invalid threshold for {metric}: must be numeric")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues
        }
    
    def _setup_automatic_monitoring(self, config: PipelineOptimizationConfig):
        """Set up automatic monitoring for a pipeline."""
        # This would integrate with the existing monitoring system
        # For now, we'll just log the setup
        logger.info(f"Setting up automatic monitoring for pipeline {config.pipeline_id}")
    
    def _schedule_optimization(self, config: PipelineOptimizationConfig):
        """Schedule periodic optimizations for a pipeline."""
        # This would integrate with Celery beat for scheduling
        # For now, we'll just log the scheduling
        logger.info(f"Scheduling optimizations for pipeline {config.pipeline_id}: {config.optimization_schedule}")
    
    def _select_optimization_type(self, config: PipelineOptimizationConfig, 
                                trigger: OptimizationTrigger, 
                                context: Optional[Dict[str, Any]]) -> str:
        """Select the most appropriate optimization type based on trigger and context."""
        # Simple selection logic - can be enhanced with ML-based selection
        if trigger == OptimizationTrigger.PERFORMANCE_DEGRADATION:
            return OptimizationType.HYPERPARAMETER
        elif trigger == OptimizationTrigger.RESOURCE_THRESHOLD:
            return OptimizationType.RESOURCE_ALLOCATION
        elif trigger == OptimizationTrigger.DATA_DRIFT:
            return OptimizationType.DATA_QUALITY
        else:
            return config.optimization_types[0]  # Default to first configured type
    
    def _is_optimization_running(self, pipeline_id: str) -> bool:
        """Check if optimization is currently running for a pipeline."""
        return pipeline_id in self.active_optimizations
    
    def _start_pipeline_optimization(self, config: PipelineOptimizationConfig,
                                   optimization_type: str,
                                   trigger: OptimizationTrigger,
                                   context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Start optimization for a pipeline based on type."""
        try:
            if optimization_type == OptimizationType.HYPERPARAMETER:
                return self._start_hyperparameter_optimization(config, trigger, context)
            elif optimization_type == OptimizationType.RESOURCE_ALLOCATION:
                return self._start_resource_optimization(config, trigger, context)
            elif optimization_type == OptimizationType.DATA_QUALITY:
                return self._start_data_quality_optimization(config, trigger, context)
            else:
                return {
                    "success": False,
                    "error": f"Unsupported optimization type: {optimization_type}"
                }
        
        except Exception as e:
            logger.error(f"Failed to start {optimization_type} optimization: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _start_hyperparameter_optimization(self, config: PipelineOptimizationConfig,
                                         trigger: OptimizationTrigger,
                                         context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Start hyperparameter optimization for a pipeline."""
        # Use the existing hyperparameter optimization task
        from ...tasks.rl_optimization_tasks import optimize_hyperparameters_task
        
        # Determine data paths based on pipeline type and context
        data_paths = self._get_data_paths_for_pipeline(config, context)
        
        # Configure optimization based on pipeline type
        optimization_config = self._get_hyperparameter_config_for_pipeline_type(config.pipeline_type)
        
        # Start task
        task = optimize_hyperparameters_task.delay(
            session_id=f"integrated_{config.pipeline_id}_{int(datetime.now().timestamp())}",
            pipeline_id=config.pipeline_id,
            training_data_path=data_paths.get("training"),
            validation_data_path=data_paths.get("validation"),
            optimization_config=optimization_config
        )
        
        return {
            "success": True,
            "session_id": task.id,
            "task_id": task.id,
            "optimization_type": OptimizationType.HYPERPARAMETER,
            "trigger": trigger
        }
    
    def _start_resource_optimization(self, config: PipelineOptimizationConfig,
                                   trigger: OptimizationTrigger,
                                   context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Start resource allocation optimization for a pipeline."""
        from ...tasks.rl_optimization_tasks import optimize_resource_allocation_task
        
        # Create pipeline configurations for resource optimization
        pipeline_configs = self._get_resource_pipeline_configs(config, context)
        
        # Start task
        task = optimize_resource_allocation_task.delay(
            session_id=f"resource_{config.pipeline_id}_{int(datetime.now().timestamp())}",
            pipeline_configs=pipeline_configs,
            resource_constraints=config.resource_constraints,
            optimization_config={"objective": "balanced_efficiency"}
        )
        
        return {
            "success": True,
            "session_id": task.id,
            "task_id": task.id,
            "optimization_type": OptimizationType.RESOURCE_ALLOCATION,
            "trigger": trigger
        }
    
    def _start_data_quality_optimization(self, config: PipelineOptimizationConfig,
                                       trigger: OptimizationTrigger,
                                       context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Start data quality optimization for a pipeline."""
        from ...tasks.rl_optimization_tasks import optimize_data_quality_task
        
        # Create data quality requirements based on pipeline type
        data_requirements = self._get_data_quality_requirements(config, context)
        
        # Start task
        task = optimize_data_quality_task.delay(
            session_id=f"quality_{config.pipeline_id}_{int(datetime.now().timestamp())}",
            data_processing_requirements=data_requirements,
            optimization_config={"objective": "balanced_quality_cost"}
        )
        
        return {
            "success": True,
            "session_id": task.id,
            "task_id": task.id,
            "optimization_type": OptimizationType.DATA_QUALITY,
            "trigger": trigger
        }
    
    def _check_optimization_triggers(self, pipeline_id: str, performance_metrics: Dict[str, Any]):
        """Check if performance metrics trigger optimization."""
        config = self.pipeline_configs[pipeline_id]
        
        # Performance degradation check
        if OptimizationTrigger.PERFORMANCE_DEGRADATION in config.triggers:
            if self._detect_performance_degradation(pipeline_id, performance_metrics):
                logger.info(f"Performance degradation detected for pipeline {pipeline_id}")
                self.trigger_optimization(
                    pipeline_id, 
                    OptimizationTrigger.PERFORMANCE_DEGRADATION,
                    additional_context={"performance_metrics": performance_metrics}
                )
        
        # Resource threshold check
        if OptimizationTrigger.RESOURCE_THRESHOLD in config.triggers:
            if self._detect_resource_threshold_breach(pipeline_id, performance_metrics):
                logger.info(f"Resource threshold breach detected for pipeline {pipeline_id}")
                self.trigger_optimization(
                    pipeline_id,
                    OptimizationTrigger.RESOURCE_THRESHOLD,
                    additional_context={"performance_metrics": performance_metrics}
                )
    
    def _detect_performance_degradation(self, pipeline_id: str, current_metrics: Dict[str, Any]) -> bool:
        """Detect if pipeline performance has degraded."""
        history = self.pipeline_performance_history.get(pipeline_id, [])
        config = self.pipeline_configs[pipeline_id]
        
        if len(history) < 5:  # Need some history for comparison
            return False
        
        # Compare with historical average
        for metric_name, threshold in config.performance_thresholds.items():
            if metric_name in current_metrics:
                current_value = current_metrics[metric_name]
                historical_values = [h["metrics"].get(metric_name) for h in history[-10:] 
                                   if metric_name in h["metrics"]]
                
                if historical_values:
                    avg_historical = sum(historical_values) / len(historical_values)
                    
                    # Check if current performance is significantly worse
                    if current_value < avg_historical * (1 - threshold):
                        return True
        
        return False
    
    def _detect_resource_threshold_breach(self, pipeline_id: str, performance_metrics: Dict[str, Any]) -> bool:
        """Detect if resource usage has breached thresholds."""
        resource_metrics = ["cpu_usage", "memory_usage", "processing_time"]
        
        for metric in resource_metrics:
            if metric in performance_metrics:
                value = performance_metrics[metric]
                # Simple threshold check (could be made configurable)
                if metric == "cpu_usage" and value > 0.8:
                    return True
                elif metric == "memory_usage" and value > 0.85:
                    return True
                elif metric == "processing_time" and value > 3600:  # 1 hour
                    return True
        
        return False
    
    def _detect_pipeline_type(self, pipeline_instance) -> Optional[str]:
        """Detect the type of pipeline instance."""
        if isinstance(pipeline_instance, ManufacturingPipeline):
            return "manufacturing"
        elif isinstance(pipeline_instance, EcommercePipeline):
            return "ecommerce"
        elif isinstance(pipeline_instance, FinancialPipeline):
            return "financial"
        else:
            return None
    
    def _extract_pipeline_configuration(self, pipeline_instance, pipeline_type: str) -> Dict[str, Any]:
        """Extract configuration from a pipeline instance."""
        config = {
            "pipeline_type": pipeline_type,
            "pipeline_class": pipeline_instance.__class__.__name__
        }
        
        if hasattr(pipeline_instance, 'config'):
            config.update(pipeline_instance.config)
        
        if hasattr(pipeline_instance, 'get_pipeline_info'):
            config.update(pipeline_instance.get_pipeline_info())
        
        return config
    
    def _add_optimization_hooks(self, pipeline_instance, pipeline_id: str):
        """Add optimization hooks to a pipeline instance."""
        # This would modify the pipeline to report performance metrics
        # For demonstration, we'll add a simple callback
        
        original_process = getattr(pipeline_instance, 'process', None)
        if original_process:
            def hooked_process(*args, **kwargs):
                result = original_process(*args, **kwargs)
                
                # Extract performance metrics from result
                if isinstance(result, dict) and 'performance_metrics' in result:
                    self.update_pipeline_performance(pipeline_id, result['performance_metrics'])
                
                return result
            
            setattr(pipeline_instance, 'process', hooked_process)
    
    def _get_data_paths_for_pipeline(self, config: PipelineOptimizationConfig, context: Optional[Dict[str, Any]]) -> Dict[str, str]:
        """Get data paths for a pipeline based on type and context."""
        # This would be configured based on the specific pipeline
        # For now, return default paths
        return {
            "training": f"/data/{config.pipeline_type}/training.csv",
            "validation": f"/data/{config.pipeline_type}/validation.csv"
        }
    
    def _get_hyperparameter_config_for_pipeline_type(self, pipeline_type: str) -> Dict[str, Any]:
        """Get hyperparameter optimization configuration for pipeline type."""
        configs = {
            "manufacturing": {
                "strategy": "ppo",
                "max_episodes": 30,
                "objective": "balanced_performance"
            },
            "ecommerce": {
                "strategy": "sac", 
                "max_episodes": 25,
                "objective": "accuracy"
            },
            "financial": {
                "strategy": "ppo",
                "max_episodes": 40,
                "objective": "f1_score"
            }
        }
        
        return configs.get(pipeline_type, {
            "strategy": "ppo",
            "max_episodes": 30,
            "objective": "balanced_performance"
        })
    
    def _get_resource_pipeline_configs(self, config: PipelineOptimizationConfig, context: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Get resource pipeline configurations for optimization."""
        # This would be based on actual pipeline resource requirements
        return [
            {
                "pipeline_id": config.pipeline_id,
                "pipeline_type": config.pipeline_type,
                "estimated_cpu_hours": 2.0,
                "estimated_memory_gb": 8.0,
                "estimated_storage_gb": 10.0,
                "priority": 5
            }
        ]
    
    def _get_data_quality_requirements(self, config: PipelineOptimizationConfig, context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Get data quality requirements for pipeline type."""
        requirements = {
            "manufacturing": {
                "completeness": 0.95,
                "accuracy": 0.90,
                "consistency": 0.85
            },
            "ecommerce": {
                "completeness": 0.90,
                "accuracy": 0.85,
                "uniqueness": 0.95
            },
            "financial": {
                "completeness": 0.98,
                "accuracy": 0.95,
                "consistency": 0.90,
                "validity": 0.95
            }
        }
        
        return requirements.get(config.pipeline_type, {
            "completeness": 0.90,
            "accuracy": 0.85,
            "consistency": 0.80
        })
    
    def _generate_optimization_recommendations(self, pipeline_id: str) -> List[str]:
        """Generate optimization recommendations for a pipeline."""
        recommendations = []
        
        config = self.pipeline_configs.get(pipeline_id)
        if not config:
            return recommendations
        
        # Check recent performance
        recent_performance = self.pipeline_performance_history.get(pipeline_id, [])[-5:]
        
        if not recent_performance:
            recommendations.append("Enable performance monitoring to get optimization recommendations")
            return recommendations
        
        # Analyze performance trends
        if len(recent_performance) >= 3:
            latest_metrics = recent_performance[-1]["metrics"]
            earlier_metrics = recent_performance[0]["metrics"]
            
            for metric_name in latest_metrics:
                if metric_name in earlier_metrics:
                    current = latest_metrics[metric_name]
                    earlier = earlier_metrics[metric_name]
                    
                    if current < earlier * 0.9:  # 10% degradation
                        recommendations.append(f"Consider hyperparameter optimization - {metric_name} has degraded")
            
            # Resource usage recommendations
            if any("cpu_usage" in p["metrics"] and p["metrics"]["cpu_usage"] > 0.8 for p in recent_performance):
                recommendations.append("High CPU usage detected - consider resource allocation optimization")
            
            if any("memory_usage" in p["metrics"] and p["metrics"]["memory_usage"] > 0.85 for p in recent_performance):
                recommendations.append("High memory usage detected - consider resource allocation optimization")
        
        # Type-specific recommendations
        if config.pipeline_type == "manufacturing":
            recommendations.append("Consider data quality optimization for sensor data accuracy")
        elif config.pipeline_type == "ecommerce":
            recommendations.append("Consider resource allocation optimization for recommendation serving")
        elif config.pipeline_type == "financial":
            recommendations.append("Consider data quality optimization for compliance requirements")
        
        return recommendations if recommendations else ["No specific recommendations at this time"]