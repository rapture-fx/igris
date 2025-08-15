"""
Distributed tracing implementation for Schlep Engine
Uses OpenTelemetry for comprehensive request tracing across services
"""

import os
import time
import logging
from typing import Dict, Any, Optional, Callable
from contextlib import contextmanager

try:
    from opentelemetry import trace, baggage
    from opentelemetry.exporter.jaeger.thrift import JaegerExporter
    from opentelemetry.exporter.zipkin.json import ZipkinExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.requests import RequestsInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
    from opentelemetry.instrumentation.redis import RedisInstrumentor
    from opentelemetry.instrumentation.celery import CeleryInstrumentor
    from opentelemetry.propagate import inject, extract
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.semconv.resource import ResourceAttributes
    from opentelemetry.trace.status import Status, StatusCode
    OPENTELEMETRY_AVAILABLE = True
except ImportError:
    OPENTELEMETRY_AVAILABLE = False
    trace = None

from app.core.config import settings
from app.core.logging_config import (
    get_logger, set_trace_id, set_span_id, get_correlation_id,
    get_trace_id as get_current_trace_id, get_span_id as get_current_span_id
)

logger = get_logger("app.distributed_tracing")

class DistributedTracing:
    """Distributed tracing implementation using OpenTelemetry"""
    
    def __init__(self):
        self.is_enabled = OPENTELEMETRY_AVAILABLE and getattr(settings, 'ENABLE_TRACING', True)
        self.tracer = None
        self.service_name = "schlep-engine-api"
        self.service_version = getattr(settings, 'APP_VERSION', '1.0.0')
        self.environment = getattr(settings, 'ENVIRONMENT', 'development')
        
        if self.is_enabled:
            self._initialize_tracing()
    
    def _initialize_tracing(self):
        """Initialize OpenTelemetry tracing"""
        
        if not OPENTELEMETRY_AVAILABLE:
            logger.warning("OpenTelemetry not available - distributed tracing disabled")
            return
        
        try:
            # Create resource
            resource = Resource.create({
                ResourceAttributes.SERVICE_NAME: self.service_name,
                ResourceAttributes.SERVICE_VERSION: self.service_version,
                ResourceAttributes.DEPLOYMENT_ENVIRONMENT: self.environment,
                "service.namespace": "schlep-engine",
                "service.instance.id": os.getenv("HOSTNAME", "unknown"),
            })
            
            # Set up tracer provider
            trace.set_tracer_provider(TracerProvider(resource=resource))
            tracer_provider = trace.get_tracer_provider()
            
            # Configure exporters
            self._configure_exporters(tracer_provider)
            
            # Get tracer
            self.tracer = trace.get_tracer(
                self.service_name,
                self.service_version
            )
            
            # Auto-instrument libraries
            self._configure_auto_instrumentation()
            
            logger.info("Distributed tracing initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize distributed tracing: {str(e)}")
            self.is_enabled = False
    
    def _configure_exporters(self, tracer_provider):
        """Configure trace exporters (Jaeger, Zipkin, Console)"""
        
        # Console exporter for development
        if self.environment == "development":
            console_exporter = ConsoleSpanExporter()
            tracer_provider.add_span_processor(
                BatchSpanProcessor(console_exporter)
            )
        
        # Jaeger exporter
        jaeger_endpoint = os.getenv("JAEGER_ENDPOINT")
        if jaeger_endpoint:
            try:
                jaeger_exporter = JaegerExporter(
                    agent_host_name=jaeger_endpoint.split("://")[1].split(":")[0],
                    agent_port=int(jaeger_endpoint.split(":")[-1]),
                )
                tracer_provider.add_span_processor(
                    BatchSpanProcessor(jaeger_exporter)
                )
                logger.info(f"Jaeger exporter configured: {jaeger_endpoint}")
            except Exception as e:
                logger.warning(f"Failed to configure Jaeger exporter: {str(e)}")
        
        # Zipkin exporter
        zipkin_endpoint = os.getenv("ZIPKIN_ENDPOINT")
        if zipkin_endpoint:
            try:
                zipkin_exporter = ZipkinExporter(
                    endpoint=f"{zipkin_endpoint}/api/v2/spans"
                )
                tracer_provider.add_span_processor(
                    BatchSpanProcessor(zipkin_exporter)
                )
                logger.info(f"Zipkin exporter configured: {zipkin_endpoint}")
            except Exception as e:
                logger.warning(f"Failed to configure Zipkin exporter: {str(e)}")
    
    def _configure_auto_instrumentation(self):
        """Configure automatic instrumentation for common libraries"""
        
        try:
            # Instrument FastAPI
            FastAPIInstrumentor.instrument()
            
            # Instrument HTTP requests
            RequestsInstrumentor().instrument()
            
            # Instrument SQLAlchemy
            SQLAlchemyInstrumentor().instrument()
            
            # Instrument Redis
            RedisInstrumentor().instrument()
            
            # Instrument Celery
            CeleryInstrumentor().instrument()
            
            logger.info("Auto-instrumentation configured successfully")
            
        except Exception as e:
            logger.warning(f"Some auto-instrumentation failed: {str(e)}")
    
    @contextmanager
    def start_span(
        self,
        name: str,
        kind: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None,
        parent_context: Optional[Any] = None
    ):
        """Start a new span with context management"""
        
        if not self.is_enabled or not self.tracer:
            yield None
            return
        
        try:
            # Determine span kind
            span_kind = trace.SpanKind.INTERNAL
            if kind == "client":
                span_kind = trace.SpanKind.CLIENT
            elif kind == "server":
                span_kind = trace.SpanKind.SERVER
            elif kind == "producer":
                span_kind = trace.SpanKind.PRODUCER
            elif kind == "consumer":
                span_kind = trace.SpanKind.CONSUMER
            
            # Start span
            with self.tracer.start_as_current_span(
                name,
                kind=span_kind,
                context=parent_context
            ) as span:
                # Set attributes
                if attributes:
                    for key, value in attributes.items():
                        span.set_attribute(key, value)
                
                # Set correlation context
                correlation_id = get_correlation_id()
                if correlation_id:
                    span.set_attribute("correlation.id", correlation_id)
                
                # Update logging context
                span_context = span.get_span_context()
                if span_context.is_valid:
                    set_trace_id(format(span_context.trace_id, '032x'))
                    set_span_id(format(span_context.span_id, '016x'))
                
                yield span
                
        except Exception as e:
            logger.error(f"Error in span context: {str(e)}")
            yield None
    
    def add_span_event(
        self,
        span: Any,
        name: str,
        attributes: Optional[Dict[str, Any]] = None,
        timestamp: Optional[float] = None
    ):
        """Add an event to the current span"""
        
        if not self.is_enabled or not span:
            return
        
        try:
            event_attributes = attributes or {}
            event_timestamp = timestamp or time.time_ns()
            
            span.add_event(
                name,
                event_attributes,
                event_timestamp
            )
            
        except Exception as e:
            logger.error(f"Error adding span event: {str(e)}")
    
    def set_span_status(
        self,
        span: Any,
        status_code: str,
        description: Optional[str] = None
    ):
        """Set span status"""
        
        if not self.is_enabled or not span:
            return
        
        try:
            if status_code == "OK":
                span.set_status(Status(StatusCode.OK, description))
            elif status_code == "ERROR":
                span.set_status(Status(StatusCode.ERROR, description))
            else:
                span.set_status(Status(StatusCode.UNSET, description))
                
        except Exception as e:
            logger.error(f"Error setting span status: {str(e)}")
    
    def record_exception(
        self,
        span: Any,
        exception: Exception,
        attributes: Optional[Dict[str, Any]] = None
    ):
        """Record an exception in the span"""
        
        if not self.is_enabled or not span:
            return
        
        try:
            span.record_exception(
                exception,
                attributes=attributes or {}
            )
            self.set_span_status(span, "ERROR", str(exception))
            
        except Exception as e:
            logger.error(f"Error recording exception in span: {str(e)}")
    
    def inject_context_into_headers(self, headers: Dict[str, str]) -> Dict[str, str]:
        """Inject tracing context into HTTP headers for downstream services"""
        
        if not self.is_enabled:
            return headers
        
        try:
            inject(headers)
            return headers
            
        except Exception as e:
            logger.error(f"Error injecting context into headers: {str(e)}")
            return headers
    
    def extract_context_from_headers(self, headers: Dict[str, str]) -> Any:
        """Extract tracing context from HTTP headers"""
        
        if not self.is_enabled:
            return None
        
        try:
            return extract(headers)
            
        except Exception as e:
            logger.error(f"Error extracting context from headers: {str(e)}")
            return None
    
    def create_child_span(
        self,
        name: str,
        parent_span: Any = None,
        attributes: Optional[Dict[str, Any]] = None
    ):
        """Create a child span"""
        
        if not self.is_enabled or not self.tracer:
            return None
        
        try:
            if parent_span:
                with trace.use_span(parent_span):
                    return self.tracer.start_span(
                        name,
                        attributes=attributes or {}
                    )
            else:
                return self.tracer.start_span(
                    name,
                    attributes=attributes or {}
                )
                
        except Exception as e:
            logger.error(f"Error creating child span: {str(e)}")
            return None
    
    def trace_database_operation(
        self,
        operation: str,
        table: str,
        query: Optional[str] = None
    ):
        """Decorator for tracing database operations"""
        
        def decorator(func: Callable) -> Callable:
            def wrapper(*args, **kwargs):
                if not self.is_enabled:
                    return func(*args, **kwargs)
                
                with self.start_span(
                    f"db.{operation}",
                    kind="client",
                    attributes={
                        "db.operation": operation,
                        "db.table": table,
                        "db.system": "postgresql",
                        "db.query": query[:100] if query else None
                    }
                ) as span:
                    try:
                        start_time = time.time()
                        result = func(*args, **kwargs)
                        duration = time.time() - start_time
                        
                        if span:
                            span.set_attribute("db.duration_ms", duration * 1000)
                            self.set_span_status(span, "OK")
                        
                        return result
                        
                    except Exception as e:
                        if span:
                            self.record_exception(span, e)
                        raise
                        
            return wrapper
        return decorator
    
    def trace_external_api_call(
        self,
        service_name: str,
        endpoint: str,
        method: str = "GET"
    ):
        """Decorator for tracing external API calls"""
        
        def decorator(func: Callable) -> Callable:
            def wrapper(*args, **kwargs):
                if not self.is_enabled:
                    return func(*args, **kwargs)
                
                with self.start_span(
                    f"http.{method.lower()}",
                    kind="client",
                    attributes={
                        "http.method": method,
                        "http.url": endpoint,
                        "service.name": service_name,
                        "component": "http"
                    }
                ) as span:
                    try:
                        start_time = time.time()
                        result = func(*args, **kwargs)
                        duration = time.time() - start_time
                        
                        if span:
                            span.set_attribute("http.duration_ms", duration * 1000)
                            # Assume success if no exception
                            span.set_attribute("http.status_code", 200)
                            self.set_span_status(span, "OK")
                        
                        return result
                        
                    except Exception as e:
                        if span:
                            span.set_attribute("http.status_code", 500)
                            self.record_exception(span, e)
                        raise
                        
            return wrapper
        return decorator
    
    def trace_business_operation(
        self,
        operation_name: str,
        operation_type: str = "business"
    ):
        """Decorator for tracing business operations"""
        
        def decorator(func: Callable) -> Callable:
            def wrapper(*args, **kwargs):
                if not self.is_enabled:
                    return func(*args, **kwargs)
                
                with self.start_span(
                    f"{operation_type}.{operation_name}",
                    attributes={
                        "operation.name": operation_name,
                        "operation.type": operation_type,
                        "component": "business_logic"
                    }
                ) as span:
                    try:
                        start_time = time.time()
                        
                        # Add start event
                        self.add_span_event(
                            span,
                            f"{operation_name}.started",
                            {"timestamp": start_time}
                        )
                        
                        result = func(*args, **kwargs)
                        
                        end_time = time.time()
                        duration = end_time - start_time
                        
                        if span:
                            span.set_attribute("operation.duration_ms", duration * 1000)
                            self.add_span_event(
                                span,
                                f"{operation_name}.completed",
                                {
                                    "timestamp": end_time,
                                    "duration_ms": duration * 1000
                                }
                            )
                            self.set_span_status(span, "OK")
                        
                        return result
                        
                    except Exception as e:
                        if span:
                            self.add_span_event(
                                span,
                                f"{operation_name}.error",
                                {
                                    "error_type": type(e).__name__,
                                    "error_message": str(e)
                                }
                            )
                            self.record_exception(span, e)
                        raise
                        
            return wrapper
        return decorator
    
    def get_current_trace_context(self) -> Dict[str, str]:
        """Get current trace context for propagation"""
        
        if not self.is_enabled:
            return {}
        
        try:
            current_span = trace.get_current_span()
            if current_span and current_span.is_recording():
                span_context = current_span.get_span_context()
                return {
                    "trace_id": format(span_context.trace_id, '032x'),
                    "span_id": format(span_context.span_id, '016x'),
                    "trace_flags": format(span_context.trace_flags, '02x')
                }
            return {}
            
        except Exception as e:
            logger.error(f"Error getting trace context: {str(e)}")
            return {}

# Global distributed tracing instance
distributed_tracing = DistributedTracing()

# Convenience functions
def start_span(
    name: str,
    kind: Optional[str] = None,
    attributes: Optional[Dict[str, Any]] = None
):
    """Start a new span"""
    return distributed_tracing.start_span(name, kind, attributes)

def trace_database_operation(operation: str, table: str, query: Optional[str] = None):
    """Decorator for database operations"""
    return distributed_tracing.trace_database_operation(operation, table, query)

def trace_external_api_call(service_name: str, endpoint: str, method: str = "GET"):
    """Decorator for external API calls"""
    return distributed_tracing.trace_external_api_call(service_name, endpoint, method)

def trace_business_operation(operation_name: str, operation_type: str = "business"):
    """Decorator for business operations"""
    return distributed_tracing.trace_business_operation(operation_name, operation_type)

def get_current_trace_context() -> Dict[str, str]:
    """Get current trace context"""
    return distributed_tracing.get_current_trace_context()

def inject_context_into_headers(headers: Dict[str, str]) -> Dict[str, str]:
    """Inject context into headers"""
    return distributed_tracing.inject_context_into_headers(headers)

def extract_context_from_headers(headers: Dict[str, str]) -> Any:
    """Extract context from headers"""
    return distributed_tracing.extract_context_from_headers(headers)