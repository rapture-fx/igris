"""
ML-optimized Redis cache manager for Railway deployment
Handles model caching, feature caching, and session management
"""
import json
import pickle
import hashlib
import logging
from typing import Any, Optional, Dict, List, Union
from datetime import datetime, timedelta
import redis
import numpy as np
import pandas as pd
from functools import wraps
import asyncio
import aioredis

logger = logging.getLogger(__name__)

class MLCacheManager:
    """Enhanced Redis cache manager optimized for ML workloads"""
    
    def __init__(self, redis_client: redis.Redis):
        self.client = redis_client
        self.prefix = "schlep:ml:"
        
        # Cache TTL settings based on validation results
        self.ttl_config = {
            "model_cache": 3600,      # 1 hour - validated models
            "feature_cache": 1800,    # 30 minutes - processed features  
            "prediction_cache": 300,  # 5 minutes - prediction results
            "dataset_cache": 7200,    # 2 hours - processed datasets
            "session_cache": 1800,    # 30 minutes - user sessions
            "metrics_cache": 600,     # 10 minutes - performance metrics
        }
        
        # Memory limits for different cache types
        self.memory_limits = {
            "model_cache": "200MB",
            "feature_cache": "150MB", 
            "prediction_cache": "100MB",
            "dataset_cache": "300MB",
            "session_cache": "50MB",
            "metrics_cache": "20MB",
        }
    
    def _make_key(self, cache_type: str, identifier: str) -> str:
        """Generate cache key with namespace"""
        return f"{self.prefix}{cache_type}:{identifier}"
    
    def _serialize_data(self, data: Any) -> bytes:
        """Serialize data based on type for optimal storage"""
        if isinstance(data, (np.ndarray, pd.DataFrame)):
            # Use pickle for numpy/pandas objects
            return pickle.dumps(data, protocol=pickle.HIGHEST_PROTOCOL)
        elif isinstance(data, dict):
            # Use JSON for dictionaries
            return json.dumps(data, separators=(',', ':')).encode('utf-8')
        else:
            # Default to pickle
            return pickle.dumps(data, protocol=pickle.HIGHEST_PROTOCOL)
    
    def _deserialize_data(self, data: bytes, data_type: str = "auto") -> Any:
        """Deserialize data based on type"""
        try:
            if data_type == "json":
                return json.loads(data.decode('utf-8'))
            else:
                return pickle.loads(data)
        except Exception as e:
            logger.error(f"Failed to deserialize data: {e}")
            return None
    
    def _calculate_memory_usage(self, data: bytes) -> int:
        """Calculate memory usage of cached data"""
        return len(data)
    
    # Model Caching (for validated ML models)
    def cache_ml_model(self, model_id: str, model_data: Any, metadata: Dict = None) -> bool:
        """Cache trained ML model with metadata"""
        try:
            key = self._make_key("model", model_id)
            
            # Prepare cache entry
            cache_entry = {
                "model_data": model_data,
                "metadata": metadata or {},
                "cached_at": datetime.utcnow().isoformat(),
                "version": "1.0"
            }
            
            serialized = self._serialize_data(cache_entry)
            memory_usage = self._calculate_memory_usage(serialized)
            
            # Check memory limit
            if memory_usage > 50 * 1024 * 1024:  # 50MB limit per model
                logger.warning(f"Model {model_id} exceeds memory limit: {memory_usage} bytes")
                return False
            
            # Cache with TTL
            success = self.client.setex(
                key, 
                self.ttl_config["model_cache"],
                serialized
            )
            
            if success:
                # Track model cache metrics
                self._track_cache_operation("model_cache", "set", model_id, memory_usage)
                logger.info(f"Cached ML model {model_id} ({memory_usage} bytes)")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to cache ML model {model_id}: {e}")
            return False
    
    def get_ml_model(self, model_id: str) -> Optional[Any]:
        """Retrieve cached ML model"""
        try:
            key = self._make_key("model", model_id)
            data = self.client.get(key)
            
            if data:
                cache_entry = self._deserialize_data(data)
                self._track_cache_operation("model_cache", "hit", model_id)
                return cache_entry.get("model_data") if cache_entry else None
            
            self._track_cache_operation("model_cache", "miss", model_id)
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve ML model {model_id}: {e}")
            return None
    
    # Feature Caching (for processed datasets)
    def cache_features(self, dataset_id: str, features: Union[np.ndarray, pd.DataFrame], feature_names: List[str] = None) -> bool:
        """Cache processed features from validation pipeline"""
        try:
            key = self._make_key("features", dataset_id)
            
            cache_entry = {
                "features": features,
                "feature_names": feature_names or [],
                "shape": features.shape if hasattr(features, 'shape') else None,
                "cached_at": datetime.utcnow().isoformat(),
                "processing_version": "2.0"  # Based on Phase 2 validation
            }
            
            serialized = self._serialize_data(cache_entry)
            memory_usage = self._calculate_memory_usage(serialized)
            
            success = self.client.setex(
                key,
                self.ttl_config["feature_cache"],
                serialized
            )
            
            if success:
                self._track_cache_operation("feature_cache", "set", dataset_id, memory_usage)
                logger.info(f"Cached features for dataset {dataset_id} ({memory_usage} bytes)")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to cache features for {dataset_id}: {e}")
            return False
    
    def get_features(self, dataset_id: str) -> Optional[Dict]:
        """Retrieve cached features"""
        try:
            key = self._make_key("features", dataset_id)
            data = self.client.get(key)
            
            if data:
                cache_entry = self._deserialize_data(data)
                self._track_cache_operation("feature_cache", "hit", dataset_id)
                return cache_entry
            
            self._track_cache_operation("feature_cache", "miss", dataset_id)
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve features for {dataset_id}: {e}")
            return None
    
    # Prediction Caching (for API responses)
    def cache_prediction(self, input_hash: str, prediction_result: Dict, model_version: str = "1.0") -> bool:
        """Cache prediction results for faster API responses"""
        try:
            key = self._make_key("prediction", input_hash)
            
            cache_entry = {
                "prediction": prediction_result,
                "model_version": model_version,
                "cached_at": datetime.utcnow().isoformat(),
                "accuracy_score": prediction_result.get("accuracy", 0)
            }
            
            serialized = self._serialize_data(cache_entry)
            
            success = self.client.setex(
                key,
                self.ttl_config["prediction_cache"],
                serialized
            )
            
            if success:
                self._track_cache_operation("prediction_cache", "set", input_hash)
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to cache prediction {input_hash}: {e}")
            return False
    
    def get_prediction(self, input_hash: str) -> Optional[Dict]:
        """Retrieve cached prediction"""
        try:
            key = self._make_key("prediction", input_hash)
            data = self.client.get(key)
            
            if data:
                cache_entry = self._deserialize_data(data, "auto")
                self._track_cache_operation("prediction_cache", "hit", input_hash)
                return cache_entry.get("prediction") if cache_entry else None
            
            self._track_cache_operation("prediction_cache", "miss", input_hash)
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve prediction {input_hash}: {e}")
            return None
    
    # Session Management
    def cache_session(self, session_id: str, session_data: Dict) -> bool:
        """Cache user session data"""
        try:
            key = self._make_key("session", session_id)
            
            session_entry = {
                **session_data,
                "last_accessed": datetime.utcnow().isoformat(),
                "cache_version": "1.0"
            }
            
            serialized = self._serialize_data(session_entry)
            
            success = self.client.setex(
                key,
                self.ttl_config["session_cache"],
                serialized
            )
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to cache session {session_id}: {e}")
            return False
    
    def get_session(self, session_id: str) -> Optional[Dict]:
        """Retrieve user session"""
        try:
            key = self._make_key("session", session_id)
            data = self.client.get(key)
            
            if data:
                return self._deserialize_data(data, "auto")
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve session {session_id}: {e}")
            return None
    
    # Performance Metrics Caching
    def cache_metrics(self, metrics_type: str, metrics_data: Dict) -> bool:
        """Cache performance metrics for dashboard"""
        try:
            key = self._make_key("metrics", metrics_type)
            
            metrics_entry = {
                "metrics": metrics_data,
                "timestamp": datetime.utcnow().isoformat(),
                "collection_version": "2.0"
            }
            
            serialized = self._serialize_data(metrics_entry)
            
            success = self.client.setex(
                key,
                self.ttl_config["metrics_cache"],
                serialized
            )
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to cache metrics {metrics_type}: {e}")
            return False
    
    def get_metrics(self, metrics_type: str) -> Optional[Dict]:
        """Retrieve cached metrics"""
        try:
            key = self._make_key("metrics", metrics_type)
            data = self.client.get(key)
            
            if data:
                metrics_entry = self._deserialize_data(data, "auto")
                return metrics_entry.get("metrics") if metrics_entry else None
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve metrics {metrics_type}: {e}")
            return None
    
    # Cache Management
    def _track_cache_operation(self, cache_type: str, operation: str, identifier: str, size: int = 0):
        """Track cache operations for monitoring"""
        try:
            metric_key = f"{self.prefix}stats:{cache_type}:{operation}"
            self.client.incr(metric_key)
            self.client.expire(metric_key, 3600)  # 1 hour stats retention
            
            if size > 0:
                size_key = f"{self.prefix}stats:{cache_type}:total_size"
                self.client.incrby(size_key, size)
                self.client.expire(size_key, 3600)
                
        except Exception as e:
            logger.error(f"Failed to track cache operation: {e}")
    
    def get_cache_stats(self) -> Dict:
        """Get cache performance statistics"""
        try:
            stats = {}
            
            for cache_type in self.ttl_config.keys():
                stats[cache_type] = {
                    "hits": int(self.client.get(f"{self.prefix}stats:{cache_type}:hit") or 0),
                    "misses": int(self.client.get(f"{self.prefix}stats:{cache_type}:miss") or 0),
                    "sets": int(self.client.get(f"{self.prefix}stats:{cache_type}:set") or 0),
                    "total_size": int(self.client.get(f"{self.prefix}stats:{cache_type}:total_size") or 0)
                }
                
                # Calculate hit ratio
                total_requests = stats[cache_type]["hits"] + stats[cache_type]["misses"]
                if total_requests > 0:
                    stats[cache_type]["hit_ratio"] = stats[cache_type]["hits"] / total_requests
                else:
                    stats[cache_type]["hit_ratio"] = 0
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {}
    
    def clear_cache_type(self, cache_type: str) -> int:
        """Clear all cache entries of a specific type"""
        try:
            pattern = self._make_key(cache_type, "*")
            keys = self.client.keys(pattern)
            
            if keys:
                deleted = self.client.delete(*keys)
                logger.info(f"Cleared {deleted} entries from {cache_type} cache")
                return deleted
            
            return 0
            
        except Exception as e:
            logger.error(f"Failed to clear {cache_type} cache: {e}")
            return 0
    
    def health_check(self) -> Dict:
        """Check Redis health and cache performance"""
        try:
            # Basic connectivity
            start_time = datetime.utcnow()
            self.client.ping()
            ping_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Memory usage
            memory_info = self.client.info("memory")
            memory_used = memory_info.get("used_memory_human", "unknown")
            memory_peak = memory_info.get("used_memory_peak_human", "unknown")
            
            # Connection info
            connection_info = self.client.info("clients")
            connected_clients = connection_info.get("connected_clients", 0)
            
            # Cache statistics
            cache_stats = self.get_cache_stats()
            
            return {
                "status": "healthy",
                "ping_time_ms": ping_time,
                "memory_used": memory_used,
                "memory_peak": memory_peak,
                "connected_clients": connected_clients,
                "cache_stats": cache_stats,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

# Decorator for automatic caching
def cache_ml_result(cache_manager: MLCacheManager, cache_type: str, ttl: int = None):
    """Decorator to automatically cache ML function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            key_data = f"{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"
            cache_key = hashlib.md5(key_data.encode()).hexdigest()
            
            # Try to get from cache first
            if cache_type == "prediction":
                cached_result = cache_manager.get_prediction(cache_key)
            elif cache_type == "features":
                cached_result = cache_manager.get_features(cache_key)
            else:
                return func(*args, **kwargs)  # No caching for unknown types
            
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            
            if cache_type == "prediction" and isinstance(result, dict):
                cache_manager.cache_prediction(cache_key, result)
            elif cache_type == "features":
                # Assume result is features data
                cache_manager.cache_features(cache_key, result)
            
            return result
        return wrapper
    return decorator

# Global cache manager instance
_cache_manager = None

def get_ml_cache_manager(redis_client: redis.Redis = None) -> MLCacheManager:
    """Get global ML cache manager instance"""
    global _cache_manager
    
    if _cache_manager is None and redis_client:
        _cache_manager = MLCacheManager(redis_client)
    
    return _cache_manager