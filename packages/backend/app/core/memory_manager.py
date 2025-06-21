"""
Advanced Memory Management System for Pollarbase
Dynamic resource allocation, monitoring, and optimization
"""

import asyncio
import gc
import psutil
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from contextlib import asynccontextmanager
import weakref
import tracemalloc
from functools import wraps
import logging

logger = logging.getLogger(__name__)

@dataclass
class MemoryThresholds:
    """Memory threshold configuration"""
    warning_percent: float = 75.0      # Warning at 75% usage
    critical_percent: float = 85.0     # Critical at 85% usage
    emergency_percent: float = 95.0    # Emergency cleanup at 95%
    
    warning_bytes: Optional[int] = None     # Absolute warning threshold
    critical_bytes: Optional[int] = None    # Absolute critical threshold
    emergency_bytes: Optional[int] = None   # Absolute emergency threshold

@dataclass
class MemorySnapshot:
    """Memory usage snapshot"""
    timestamp: datetime
    total_memory: int
    available_memory: int
    used_memory: int
    percent_used: float
    process_memory: int
    process_percent: float
    
    # Detailed process memory info
    rss: int  # Resident Set Size
    vms: int  # Virtual Memory Size
    shared: int
    text: int
    data: int
    
    # Python-specific memory info
    python_objects: int = 0
    gc_stats: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "timestamp": self.timestamp.isoformat(),
            "total_memory": self.total_memory,
            "available_memory": self.available_memory,
            "used_memory": self.used_memory,
            "percent_used": self.percent_used,
            "process_memory": self.process_memory,
            "process_percent": self.process_percent,
            "rss": self.rss,
            "vms": self.vms,
            "shared": self.shared,
            "text": self.text,
            "data": self.data,
            "python_objects": self.python_objects,
            "gc_stats": self.gc_stats
        }

@dataclass
class MemoryAlert:
    """Memory alert information"""
    level: str  # warning, critical, emergency
    message: str
    timestamp: datetime
    memory_percent: float
    process_percent: float
    recommendations: List[str] = field(default_factory=list)

class MemoryProfiler:
    """Memory profiling for function calls"""
    
    def __init__(self):
        self.active_profiles = {}
        self.profile_results = []
        self.max_results = 1000
    
    def profile_function(self, func_name: str = None):
        """Decorator to profile memory usage of functions"""
        def decorator(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                profile_name = func_name or f"{func.__module__}.{func.__name__}"
                
                # Start profiling
                snapshot_before = self._get_memory_snapshot()
                start_time = time.time()
                
                try:
                    if asyncio.iscoroutinefunction(func):
                        result = await func(*args, **kwargs)
                    else:
                        result = func(*args, **kwargs)
                    
                    return result
                finally:
                    # End profiling
                    end_time = time.time()
                    snapshot_after = self._get_memory_snapshot()
                    
                    memory_delta = snapshot_after.process_memory - snapshot_before.process_memory
                    duration = end_time - start_time
                    
                    profile_result = {
                        "function": profile_name,
                        "duration": duration,
                        "memory_before": snapshot_before.process_memory,
                        "memory_after": snapshot_after.process_memory,
                        "memory_delta": memory_delta,
                        "timestamp": datetime.utcnow()
                    }
                    
                    self.profile_results.append(profile_result)
                    if len(self.profile_results) > self.max_results:
                        self.profile_results.pop(0)
            
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                profile_name = func_name or f"{func.__module__}.{func.__name__}"
                
                snapshot_before = self._get_memory_snapshot()
                start_time = time.time()
                
                try:
                    result = func(*args, **kwargs)
                    return result
                finally:
                    end_time = time.time()
                    snapshot_after = self._get_memory_snapshot()
                    
                    memory_delta = snapshot_after.process_memory - snapshot_before.process_memory
                    duration = end_time - start_time
                    
                    profile_result = {
                        "function": profile_name,
                        "duration": duration,
                        "memory_before": snapshot_before.process_memory,
                        "memory_after": snapshot_after.process_memory,
                        "memory_delta": memory_delta,
                        "timestamp": datetime.utcnow()
                    }
                    
                    self.profile_results.append(profile_result)
                    if len(self.profile_results) > self.max_results:
                        self.profile_results.pop(0)
            
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper
        
        return decorator
    
    def _get_memory_snapshot(self) -> MemorySnapshot:
        """Get quick memory snapshot for profiling"""
        process = psutil.Process()
        memory_info = process.memory_info()
        system_memory = psutil.virtual_memory()
        
        return MemorySnapshot(
            timestamp=datetime.utcnow(),
            total_memory=system_memory.total,
            available_memory=system_memory.available,
            used_memory=system_memory.used,
            percent_used=system_memory.percent,
            process_memory=memory_info.rss,
            process_percent=process.memory_percent(),
            rss=memory_info.rss,
            vms=memory_info.vms,
            shared=getattr(memory_info, 'shared', 0),
            text=getattr(memory_info, 'text', 0),
            data=getattr(memory_info, 'data', 0)
        )
    
    def get_top_memory_functions(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get functions with highest memory usage"""
        if not self.profile_results:
            return []
        
        # Sort by memory delta (descending)
        sorted_results = sorted(
            self.profile_results,
            key=lambda x: x["memory_delta"],
            reverse=True
        )
        
        return sorted_results[:limit]

class MemoryCache:
    """Smart memory cache with automatic cleanup"""
    
    def __init__(self, max_size_mb: int = 512):
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.cache = {}
        self.access_times = {}
        self.item_sizes = {}
        self.current_size = 0
        self._lock = threading.RLock()
    
    def get(self, key: str) -> Any:
        """Get item from cache"""
        with self._lock:
            if key in self.cache:
                self.access_times[key] = time.time()
                return self.cache[key]
            return None
    
    def set(self, key: str, value: Any, size_estimate: int = None) -> bool:
        """Set item in cache with automatic cleanup"""
        with self._lock:
            # Estimate size if not provided
            if size_estimate is None:
                try:
                    import sys
                    size_estimate = sys.getsizeof(value)
                except:
                    size_estimate = 1024  # Default estimate
            
            # Check if we need to free space
            while (self.current_size + size_estimate) > self.max_size_bytes and self.cache:
                self._evict_lru()
            
            # Add to cache
            if key in self.cache:
                self.current_size -= self.item_sizes[key]
            
            self.cache[key] = value
            self.access_times[key] = time.time()
            self.item_sizes[key] = size_estimate
            self.current_size += size_estimate
            
            return True
    
    def _evict_lru(self):
        """Evict least recently used item"""
        if not self.cache:
            return
        
        # Find LRU item
        lru_key = min(self.access_times.keys(), key=lambda k: self.access_times[k])
        
        # Remove it
        self.current_size -= self.item_sizes[lru_key]
        del self.cache[lru_key]
        del self.access_times[lru_key]
        del self.item_sizes[lru_key]
    
    def clear(self):
        """Clear all cache"""
        with self._lock:
            self.cache.clear()
            self.access_times.clear()
            self.item_sizes.clear()
            self.current_size = 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            return {
                "items": len(self.cache),
                "size_bytes": self.current_size,
                "size_mb": self.current_size / 1024 / 1024,
                "max_size_mb": self.max_size_bytes / 1024 / 1024,
                "utilization_percent": (self.current_size / self.max_size_bytes) * 100
            }

class AdvancedMemoryManager:
    """Advanced memory management system"""
    
    def __init__(self, thresholds: MemoryThresholds = None):
        self.thresholds = thresholds or MemoryThresholds()
        self.monitoring = False
        self.snapshots: List[MemorySnapshot] = []
        self.alerts: List[MemoryAlert] = []
        self.cleanup_handlers: List[Callable] = []
        self.profiler = MemoryProfiler()
        
        # Smart cache
        self.cache = MemoryCache()
        
        # Monitoring configuration
        self.monitor_interval = 10.0  # seconds
        self.max_snapshots = 1000
        self.max_alerts = 100
        
        # Automatic cleanup settings
        self.auto_cleanup_enabled = True
        self.emergency_cleanup_enabled = True
        
        # Initialize tracemalloc if available
        try:
            tracemalloc.start()
            self.tracemalloc_enabled = True
        except:
            self.tracemalloc_enabled = False
            logger.warning("tracemalloc not available - some features disabled")
    
    def start_monitoring(self):
        """Start memory monitoring"""
        if self.monitoring:
            return
        
        self.monitoring = True
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info("Memory monitoring started")
    
    def stop_monitoring(self):
        """Stop memory monitoring"""
        if not self.monitoring:
            return
        
        self.monitoring = False
        if hasattr(self, '_monitor_task'):
            self._monitor_task.cancel()
        logger.info("Memory monitoring stopped")
    
    async def _monitor_loop(self):
        """Main monitoring loop"""
        while self.monitoring:
            try:
                snapshot = self.get_memory_snapshot()
                self.snapshots.append(snapshot)
                
                # Limit snapshot history
                if len(self.snapshots) > self.max_snapshots:
                    self.snapshots.pop(0)
                
                # Check for alerts
                alert = self._check_thresholds(snapshot)
                if alert:
                    self.alerts.append(alert)
                    if len(self.alerts) > self.max_alerts:
                        self.alerts.pop(0)
                    
                    # Handle alert
                    await self._handle_alert(alert)
                
                await asyncio.sleep(self.monitor_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in memory monitoring: {e}")
                await asyncio.sleep(self.monitor_interval)
    
    def get_memory_snapshot(self) -> MemorySnapshot:
        """Get comprehensive memory snapshot"""
        process = psutil.Process()
        memory_info = process.memory_info()
        system_memory = psutil.virtual_memory()
        
        # Get Python-specific info
        python_objects = 0
        gc_stats = {}
        
        try:
            python_objects = len(gc.get_objects())
            gc_stats = {
                "collections": gc.get_stats(),
                "counts": gc.get_count(),
                "thresholds": gc.get_threshold()
            }
        except Exception as e:
            logger.debug(f"Could not get Python GC stats: {e}")
        
        return MemorySnapshot(
            timestamp=datetime.utcnow(),
            total_memory=system_memory.total,
            available_memory=system_memory.available,
            used_memory=system_memory.used,
            percent_used=system_memory.percent,
            process_memory=memory_info.rss,
            process_percent=process.memory_percent(),
            rss=memory_info.rss,
            vms=memory_info.vms,
            shared=getattr(memory_info, 'shared', 0),
            text=getattr(memory_info, 'text', 0),
            data=getattr(memory_info, 'data', 0),
            python_objects=python_objects,
            gc_stats=gc_stats
        )
    
    def _check_thresholds(self, snapshot: MemorySnapshot) -> Optional[MemoryAlert]:
        """Check if memory usage exceeds thresholds"""
        recommendations = []
        
        # Check system memory
        if snapshot.percent_used >= self.thresholds.emergency_percent:
            level = "emergency"
            message = f"EMERGENCY: System memory at {snapshot.percent_used:.1f}%"
            recommendations = [
                "Immediate garbage collection needed",
                "Consider restarting application",
                "Review memory-intensive operations",
                "Scale up system resources"
            ]
        elif snapshot.percent_used >= self.thresholds.critical_percent:
            level = "critical"
            message = f"CRITICAL: System memory at {snapshot.percent_used:.1f}%"
            recommendations = [
                "Trigger garbage collection",
                "Clear caches",
                "Review running processes",
                "Consider scaling resources"
            ]
        elif snapshot.percent_used >= self.thresholds.warning_percent:
            level = "warning"
            message = f"WARNING: System memory at {snapshot.percent_used:.1f}%"
            recommendations = [
                "Monitor memory usage closely",
                "Consider cache cleanup",
                "Review memory allocation patterns"
            ]
        else:
            return None
        
        return MemoryAlert(
            level=level,
            message=message,
            timestamp=snapshot.timestamp,
            memory_percent=snapshot.percent_used,
            process_percent=snapshot.process_percent,
            recommendations=recommendations
        )
    
    async def _handle_alert(self, alert: MemoryAlert):
        """Handle memory alert"""
        logger.warning(f"Memory alert: {alert.message}")
        
        if alert.level == "emergency" and self.emergency_cleanup_enabled:
            await self.emergency_cleanup()
        elif alert.level == "critical" and self.auto_cleanup_enabled:
            await self.cleanup_memory()
        
        # Notify cleanup handlers
        for handler in self.cleanup_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(alert)
                else:
                    handler(alert)
            except Exception as e:
                logger.error(f"Error in cleanup handler: {e}")
    
    async def cleanup_memory(self):
        """Perform memory cleanup"""
        logger.info("Starting memory cleanup")
        
        # Clear internal caches
        self.cache.clear()
        
        # Force garbage collection
        gc.collect()
        
        # Clear old snapshots and alerts
        if len(self.snapshots) > 100:
            self.snapshots = self.snapshots[-100:]
        
        if len(self.alerts) > 50:
            self.alerts = self.alerts[-50:]
        
        logger.info("Memory cleanup completed")
    
    async def emergency_cleanup(self):
        """Emergency memory cleanup"""
        logger.warning("Starting EMERGENCY memory cleanup")
        
        # Aggressive cleanup
        await self.cleanup_memory()
        
        # Multiple GC passes
        for _ in range(3):
            gc.collect()
            await asyncio.sleep(0.1)
        
        # Clear profiler results
        self.profiler.profile_results = []
        
        logger.warning("Emergency memory cleanup completed")
    
    def register_cleanup_handler(self, handler: Callable):
        """Register a cleanup handler"""
        self.cleanup_handlers.append(handler)
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get comprehensive memory statistics"""
        if not self.snapshots:
            return {}
        
        latest = self.snapshots[-1]
        
        # Calculate trends if we have enough data
        trend_data = {}
        if len(self.snapshots) >= 10:
            recent_snapshots = self.snapshots[-10:]
            memory_values = [s.percent_used for s in recent_snapshots]
            
            trend_data = {
                "trend_direction": "increasing" if memory_values[-1] > memory_values[0] else "decreasing",
                "trend_rate": (memory_values[-1] - memory_values[0]) / len(memory_values),
                "avg_last_10": sum(memory_values) / len(memory_values),
                "max_last_10": max(memory_values),
                "min_last_10": min(memory_values)
            }
        
        return {
            "current": latest.to_dict(),
            "cache_stats": self.cache.get_stats(),
            "alert_summary": {
                "total_alerts": len(self.alerts),
                "recent_alerts": len([a for a in self.alerts if (datetime.utcnow() - a.timestamp).seconds < 3600]),
                "last_alert": self.alerts[-1].to_dict() if self.alerts else None
            },
            "monitoring": {
                "active": self.monitoring,
                "snapshots_collected": len(self.snapshots),
                "monitor_interval": self.monitor_interval
            },
            "trends": trend_data,
            "thresholds": {
                "warning": self.thresholds.warning_percent,
                "critical": self.thresholds.critical_percent,
                "emergency": self.thresholds.emergency_percent
            },
            "cleanup": {
                "auto_enabled": self.auto_cleanup_enabled,
                "emergency_enabled": self.emergency_cleanup_enabled,
                "handlers_registered": len(self.cleanup_handlers)
            }
        }
    
    @asynccontextmanager
    async def memory_context(self, cleanup_threshold: float = 85.0):
        """Context manager for automatic memory management"""
        start_snapshot = self.get_memory_snapshot()
        
        try:
            yield self
        finally:
            end_snapshot = self.get_memory_snapshot()
            
            # Check if cleanup is needed
            if end_snapshot.percent_used > cleanup_threshold:
                await self.cleanup_memory()
    
    def profile_memory(self, func_name: str = None):
        """Decorator for memory profiling"""
        return self.profiler.profile_function(func_name)

# Global memory manager instance
memory_manager = AdvancedMemoryManager()

# Convenience functions
def start_memory_monitoring():
    """Start global memory monitoring"""
    memory_manager.start_monitoring()

def stop_memory_monitoring():
    """Stop global memory monitoring"""
    memory_manager.stop_monitoring()

def get_memory_stats():
    """Get current memory statistics"""
    return memory_manager.get_memory_stats()

def profile_memory(func_name: str = None):
    """Memory profiling decorator"""
    return memory_manager.profile_memory(func_name)

@asynccontextmanager
async def memory_context(cleanup_threshold: float = 85.0):
    """Memory management context"""
    async with memory_manager.memory_context(cleanup_threshold):
        yield 