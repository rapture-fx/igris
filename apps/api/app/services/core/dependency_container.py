"""
DEPENDENCY INJECTION CONTAINER
============================

Solves circular import issues and provides clean dependency management.

This eliminates:
- ModuleNotFoundError: No module named 'app.services.ai_data_detective'
- Complex import chains
- Circular dependencies
- Service initialization issues
"""

from typing import Type, TypeVar, Dict, Any, Callable, Optional
import inspect
import logging
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')

class DependencyContainer:
    """
    Simple but powerful dependency injection container.
    
    Features:
    - Automatic dependency resolution
    - Singleton and transient service lifetimes
    - Factory method support
    - Circular dependency detection
    - Easy testing with mock services
    """
    
    def __init__(self):
        self._services: Dict[str, Any] = {}
        self._factories: Dict[str, Callable] = {}
        self._singletons: Dict[str, Any] = {}
        self._resolving: set = set()  # Track services being resolved (circular detection)
        
    def register_singleton(self, service_type: Type[T], instance: T = None, factory: Callable = None):
        """Register a singleton service (one instance per container)"""
        key = self._get_service_key(service_type)
        
        if instance is not None:
            self._singletons[key] = instance
            logger.debug(f"Registered singleton instance: {key}")
        elif factory is not None:
            self._factories[key] = ('singleton', factory)
            logger.debug(f"Registered singleton factory: {key}")
        else:
            # Auto-register with default constructor
            self._factories[key] = ('singleton', service_type)
            logger.debug(f"Auto-registered singleton: {key}")
    
    def register_transient(self, service_type: Type[T], factory: Callable = None):
        """Register a transient service (new instance each time)"""
        key = self._get_service_key(service_type)
        
        if factory is not None:
            self._factories[key] = ('transient', factory)
        else:
            self._factories[key] = ('transient', service_type)
        
        logger.debug(f"Registered transient service: {key}")
    
    def register_instance(self, service_type: Type[T], instance: T):
        """Register a specific instance"""
        key = self._get_service_key(service_type)
        self._services[key] = instance
        logger.debug(f"Registered instance: {key}")
    
    def get(self, service_type: Type[T]) -> T:
        """Get service instance with automatic dependency resolution"""
        key = self._get_service_key(service_type)
        
        # Check for circular dependencies
        if key in self._resolving:
            raise ValueError(f"Circular dependency detected for service: {key}")
        
        try:
            self._resolving.add(key)
            return self._resolve_service(service_type, key)
        finally:
            self._resolving.discard(key)
    
    def _resolve_service(self, service_type: Type[T], key: str) -> T:
        """Internal service resolution"""
        
        # Check direct instances first
        if key in self._services:
            return self._services[key]
        
        # Check singletons
        if key in self._singletons:
            return self._singletons[key]
        
        # Check factories
        if key in self._factories:
            lifetime, factory = self._factories[key]
            
            # Resolve dependencies
            instance = self._create_instance(factory)
            
            if lifetime == 'singleton':
                self._singletons[key] = instance
            
            return instance
        
        raise ValueError(f"Service not registered: {key}")
    
    def _create_instance(self, factory: Callable):
        """Create instance with dependency injection"""
        try:
            # Get constructor signature
            sig = inspect.signature(factory)
            kwargs = {}
            
            # Resolve dependencies
            for param_name, param in sig.parameters.items():
                if param.annotation != inspect.Parameter.empty:
                    try:
                        kwargs[param_name] = self.get(param.annotation)
                    except ValueError:
                        # If dependency not registered, skip (optional dependency)
                        if param.default == inspect.Parameter.empty:
                            logger.warning(f"Unresolved dependency: {param.annotation} for {factory}")
                        continue
            
            return factory(**kwargs)
            
        except Exception as e:
            logger.error(f"Failed to create instance of {factory}: {str(e)}")
            raise
    
    def _get_service_key(self, service_type: Type) -> str:
        """Generate service key from type"""
        return f"{service_type.__module__}.{service_type.__name__}"
    
    def clear(self):
        """Clear all registrations (useful for testing)"""
        self._services.clear()
        self._factories.clear()
        self._singletons.clear()
        self._resolving.clear()
    
    def get_registered_services(self) -> Dict[str, str]:
        """Get list of all registered services"""
        services = {}
        services.update({k: 'instance' for k in self._services.keys()})
        services.update({k: 'singleton' for k in self._singletons.keys()})
        services.update({k: v[0] for k, v in self._factories.items()})
        return services

# Global container instance
container = DependencyContainer()

def inject(*dependencies):
    """
    Decorator for automatic dependency injection in functions.
    
    Usage:
    @inject(SomeService, AnotherService)
    def my_function(service1: SomeService, service2: AnotherService):
        # services are automatically injected
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Inject dependencies
            sig = inspect.signature(func)
            for i, (param_name, param) in enumerate(sig.parameters.items()):
                if i < len(dependencies) and param_name not in kwargs:
                    kwargs[param_name] = container.get(dependencies[i])
            
            return func(*args, **kwargs)
        return wrapper
    return decorator

def requires(service_type: Type[T]):
    """
    Decorator to mark a class as requiring a specific service.
    
    Usage:
    @requires(DatabaseService)
    class MyService:
        def __init__(self, db: DatabaseService):
            self.db = db
    """
    def decorator(cls):
        # Mark class as requiring the service
        if not hasattr(cls, '_required_services'):
            cls._required_services = []
        cls._required_services.append(service_type)
        return cls
    return decorator

# Service registration helpers
def register_core_services():
    """Register all core application services"""
    
    # Import services here to avoid circular imports
    try:
        from .unified_processor import UnifiedDataProcessor
        from .config_manager import ProcessingConfig
        
        # Register configuration as singleton
        config = ProcessingConfig()
        container.register_singleton(ProcessingConfig, instance=config)
        
        # Register unified processor as singleton
        container.register_singleton(UnifiedDataProcessor)
        
        logger.info("Core services registered successfully")
        
    except ImportError as e:
        logger.error(f"Failed to register core services: {str(e)}")
        
    # Register other services
    try:
        from app.core.database import get_database_session
        from app.auth.unified_auth_service import UnifiedAuthService
        from app.services.monitoring_service import MonitoringService
        
        container.register_transient(get_database_session)
        container.register_singleton(UnifiedAuthService)
        container.register_singleton(MonitoringService)
        
        logger.info("Additional services registered")
        
    except ImportError as e:
        logger.warning(f"Some services not available: {str(e)}")

def get_service(service_type: Type[T]) -> T:
    """Convenience function to get service from global container"""
    return container.get(service_type)

# Auto-register core services on import
register_core_services()