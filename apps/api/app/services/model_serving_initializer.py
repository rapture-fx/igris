"""
Model Serving Platform Initializer
===================================

Initialization and integration service for the Advanced Model Serving Platform.
Handles startup tasks, service registration, and integration with the existing MLOps ecosystem.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.redis_client import get_redis_client
from app.services.advanced_model_serving import initialize_serving_engine, get_serving_engine
from app.services.model_deployment_manager import get_deployment_manager
from app.services.inference_engine import get_inference_engine, InferenceConfig
from app.services.auto_scaling_manager import get_auto_scaling_manager
from app.services.serving_metrics_collector import get_metrics_collector
from app.models.mlops import ServingEndpoint, ModelDeployment, MLModel
from app.core.config import settings


class ModelServingPlatform:
    """Advanced Model Serving Platform orchestrator."""
    
    def __init__(self):
        self.serving_engine = None
        self.deployment_manager = None
        self.inference_engine = None
        self.auto_scaling_manager = None
        self.metrics_collector = None
        self.background_tasks = []
        self.is_initialized = False
        
        logging.info("Model Serving Platform initializing...")
    
    async def initialize(self, db: Session = None) -> Dict[str, Any]:
        """Initialize the model serving platform."""
        try:
            if not db:
                db = next(get_db())
            
            initialization_results = {
                'timestamp': datetime.utcnow(),
                'platform_version': '1.0.0',
                'components': {},
                'status': 'initializing'
            }
            
            # Initialize Redis client
            redis_client = get_redis_client()
            initialization_results['components']['redis'] = {
                'status': 'connected' if redis_client else 'unavailable',
                'features': ['caching', 'rate_limiting'] if redis_client else []
            }
            
            # Initialize serving engine
            logging.info("Initializing serving engine...")
            self.serving_engine = await initialize_serving_engine(redis_client)
            framework_availability = self.serving_engine.get_framework_availability()
            initialization_results['components']['serving_engine'] = {
                'status': 'initialized',
                'framework_support': framework_availability,
                'loaded_models': len(self.serving_engine.get_loaded_models())
            }
            
            # Initialize inference engine
            logging.info("Initializing inference engine...")
            inference_config = InferenceConfig(
                batch_size=settings.DEFAULT_BATCH_SIZE if hasattr(settings, 'DEFAULT_BATCH_SIZE') else 32,
                optimization_level="basic",
                hardware_target="cpu",
                use_quantization=False,
                enable_profiling=settings.DEBUG if hasattr(settings, 'DEBUG') else False
            )
            self.inference_engine = get_inference_engine(inference_config)
            initialization_results['components']['inference_engine'] = {
                'status': 'initialized',
                'config': {
                    'batch_size': inference_config.batch_size,
                    'optimization_level': inference_config.optimization_level.value,
                    'hardware_target': inference_config.hardware_target.value
                }
            }
            
            # Initialize deployment manager
            logging.info("Initializing deployment manager...")
            self.deployment_manager = get_deployment_manager(db)
            initialization_results['components']['deployment_manager'] = {
                'status': 'initialized',
                'features': ['blue_green', 'canary', 'rolling', 'immediate']
            }
            
            # Initialize auto-scaling manager
            logging.info("Initializing auto-scaling manager...")
            self.auto_scaling_manager = get_auto_scaling_manager(db)
            initialization_results['components']['auto_scaling'] = {
                'status': 'initialized',
                'features': ['predictive_scaling', 'cost_optimization', 'health_monitoring']
            }
            
            # Initialize metrics collector
            logging.info("Initializing metrics collector...")
            self.metrics_collector = get_metrics_collector(db)
            initialization_results['components']['metrics_collector'] = {
                'status': 'initialized',
                'collection_interval': self.metrics_collector.collection_interval,
                'features': ['real_time_metrics', 'anomaly_detection', 'alerting']
            }
            
            # Load existing active endpoints
            await self._load_existing_endpoints(db)
            active_endpoints = db.query(ServingEndpoint).filter(
                ServingEndpoint.status == "active"
            ).count()
            initialization_results['existing_endpoints'] = active_endpoints
            
            # Start background services
            await self._start_background_services()
            initialization_results['background_services'] = len(self.background_tasks)
            
            # Final status
            initialization_results['status'] = 'completed'
            initialization_results['ready'] = True
            self.is_initialized = True
            
            logging.info(f"Model Serving Platform initialized successfully with {active_endpoints} active endpoints")
            return initialization_results
            
        except Exception as e:
            logging.error(f"Model serving platform initialization failed: {e}")
            initialization_results.update({
                'status': 'failed',
                'error': str(e),
                'ready': False
            })
            return initialization_results
    
    async def _load_existing_endpoints(self, db: Session):
        """Load existing active endpoints into serving engines."""
        try:
            # Get all active endpoints
            active_endpoints = db.query(ServingEndpoint).filter(
                ServingEndpoint.status == "active"
            ).all()
            
            loaded_count = 0
            
            for endpoint in active_endpoints:
                try:
                    # Get associated model info
                    model = db.query(MLModel).filter(
                        MLModel.model_id == endpoint.model_id
                    ).first()
                    
                    if not model:
                        logging.warning(f"Model not found for endpoint {endpoint.endpoint_id}")
                        continue
                    
                    # Mock model path - in production, this would come from model registry
                    model_path = f"/models/{endpoint.model_id}"
                    
                    # Load model in serving engine
                    success = await self.serving_engine.load_model(
                        model_id=endpoint.endpoint_id,
                        model_path=model_path,
                        framework=model.framework.value,
                        model_config=endpoint.configuration or {}
                    )
                    
                    if success:
                        loaded_count += 1
                        logging.info(f"Loaded existing endpoint: {endpoint.endpoint_id}")
                    else:
                        logging.error(f"Failed to load endpoint: {endpoint.endpoint_id}")
                        # Update endpoint status to indicate loading failure
                        endpoint.status = "failed"
                        db.commit()
                
                except Exception as e:
                    logging.error(f"Failed to load endpoint {endpoint.endpoint_id}: {e}")
            
            logging.info(f"Loaded {loaded_count} existing active endpoints")
            
        except Exception as e:
            logging.error(f"Failed to load existing endpoints: {e}")
    
    async def _start_background_services(self):
        """Start background monitoring and management services."""
        try:
            # Start metrics collection loop
            metrics_task = asyncio.create_task(
                self.metrics_collector.run_metrics_collection_loop(self.serving_engine)
            )
            self.background_tasks.append(metrics_task)
            logging.info("Started metrics collection service")
            
            # Start auto-scaling loop
            auto_scaling_task = asyncio.create_task(
                self.auto_scaling_manager.run_auto_scaling_loop(
                    self.serving_engine, 
                    check_interval=120  # Check every 2 minutes
                )
            )
            self.background_tasks.append(auto_scaling_task)
            logging.info("Started auto-scaling service")
            
            # Start health monitoring (placeholder for future implementation)
            # health_task = asyncio.create_task(self._run_health_monitoring())
            # self.background_tasks.append(health_task)
            
        except Exception as e:
            logging.error(f"Failed to start background services: {e}")
    
    async def shutdown(self):
        """Graceful shutdown of the model serving platform."""
        try:
            logging.info("Shutting down Model Serving Platform...")
            
            # Stop metrics collection
            if self.metrics_collector:
                self.metrics_collector.stop_collection()
            
            # Cancel background tasks
            for task in self.background_tasks:
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
            
            # Unload all models from serving engine
            if self.serving_engine:
                loaded_models = self.serving_engine.get_loaded_models()
                for model_id in loaded_models:
                    self.serving_engine.unload_model(model_id)
                logging.info(f"Unloaded {len(loaded_models)} models")
            
            self.is_initialized = False
            logging.info("Model Serving Platform shutdown completed")
            
        except Exception as e:
            logging.error(f"Error during platform shutdown: {e}")
    
    def get_platform_status(self) -> Dict[str, Any]:
        """Get current platform status."""
        try:
            status = {
                'initialized': self.is_initialized,
                'timestamp': datetime.utcnow(),
                'components': {
                    'serving_engine': {
                        'loaded_models': len(self.serving_engine.get_loaded_models()) if self.serving_engine else 0,
                        'framework_availability': self.serving_engine.get_framework_availability() if self.serving_engine else {}
                    },
                    'background_services': {
                        'active_tasks': len([t for t in self.background_tasks if not t.done()]),
                        'total_tasks': len(self.background_tasks)
                    }
                }
            }
            
            # Add component health status
            if self.serving_engine:
                status['components']['serving_engine']['healthy'] = True
            if self.deployment_manager:
                status['components']['deployment_manager'] = {'healthy': True}
            if self.auto_scaling_manager:
                status['components']['auto_scaling'] = {'healthy': True}
            if self.metrics_collector:
                status['components']['metrics_collector'] = {
                    'healthy': True,
                    'collecting': self.metrics_collector.is_running
                }
            
            return status
            
        except Exception as e:
            return {
                'initialized': False,
                'error': str(e),
                'timestamp': datetime.utcnow()
            }
    
    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check of all components."""
        try:
            health_status = {
                'overall_status': 'healthy',
                'timestamp': datetime.utcnow(),
                'components': {}
            }
            
            unhealthy_components = 0
            
            # Check serving engine
            if self.serving_engine:
                serving_health = await self.serving_engine.health_check()
                health_status['components']['serving_engine'] = serving_health
                if not serving_health.get('total_loaded_models', 0) >= 0:  # Basic sanity check
                    unhealthy_components += 1
            else:
                health_status['components']['serving_engine'] = {'status': 'not_initialized'}
                unhealthy_components += 1
            
            # Check deployment manager
            if self.deployment_manager:
                try:
                    active_canaries = await self.deployment_manager.list_active_canaries()
                    health_status['components']['deployment_manager'] = {
                        'status': 'healthy',
                        'active_canaries': len(active_canaries)
                    }
                except Exception as e:
                    health_status['components']['deployment_manager'] = {
                        'status': 'unhealthy',
                        'error': str(e)
                    }
                    unhealthy_components += 1
            else:
                health_status['components']['deployment_manager'] = {'status': 'not_initialized'}
                unhealthy_components += 1
            
            # Check background services
            active_tasks = len([t for t in self.background_tasks if not t.done()])
            health_status['components']['background_services'] = {
                'status': 'healthy' if active_tasks > 0 else 'degraded',
                'active_tasks': active_tasks,
                'total_tasks': len(self.background_tasks)
            }
            
            if active_tasks == 0 and len(self.background_tasks) > 0:
                unhealthy_components += 1
            
            # Determine overall status
            if unhealthy_components == 0:
                health_status['overall_status'] = 'healthy'
            elif unhealthy_components <= 1:
                health_status['overall_status'] = 'degraded'
            else:
                health_status['overall_status'] = 'unhealthy'
            
            health_status['unhealthy_components'] = unhealthy_components
            return health_status
            
        except Exception as e:
            return {
                'overall_status': 'error',
                'error': str(e),
                'timestamp': datetime.utcnow()
            }


# Global platform instance
_platform = None


def get_model_serving_platform() -> ModelServingPlatform:
    """Get the global model serving platform instance."""
    global _platform
    if _platform is None:
        _platform = ModelServingPlatform()
    return _platform


async def initialize_model_serving_platform(db: Session = None) -> Dict[str, Any]:
    """Initialize the model serving platform."""
    platform = get_model_serving_platform()
    return await platform.initialize(db)


async def shutdown_model_serving_platform():
    """Shutdown the model serving platform."""
    platform = get_model_serving_platform()
    await platform.shutdown()


def get_platform_status() -> Dict[str, Any]:
    """Get platform status."""
    platform = get_model_serving_platform()
    return platform.get_platform_status()


async def platform_health_check() -> Dict[str, Any]:
    """Platform health check."""
    platform = get_model_serving_platform()
    return await platform.health_check()