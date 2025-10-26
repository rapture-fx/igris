"""
gRPC OpenTelemetry Interceptor for Schlep-Engine ML Service
Provides distributed tracing with trace context propagation
"""

import grpc
import logging
import os
from typing import Callable, Any
from concurrent import futures

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.instrumentation.grpc import GrpcInstrumentorServer
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.sdk.resources import Resource
from opentelemetry import propagate

logger = logging.getLogger(__name__)

# Global tracer instance
_tracer = None
_initialized = False


def init_tracing(service_name="schlep-python-ml", jaeger_endpoint=None):
    """
    Initialize OpenTelemetry tracing with Jaeger exporter

    Args:
        service_name: Name of the service for tracing
        jaeger_endpoint: Jaeger collector endpoint (e.g., "http://jaeger:14268/api/traces")

    Returns:
        Tracer instance
    """
    global _tracer, _initialized

    if _initialized:
        logger.info("Tracing already initialized")
        return _tracer

    # Get Jaeger endpoint from environment if not provided
    if jaeger_endpoint is None:
        jaeger_endpoint = os.getenv(
            'JAEGER_ENDPOINT',
            'http://localhost:14268/api/traces'
        )

    logger.info(f"Initializing OpenTelemetry tracing for {service_name}")
    logger.info(f"Jaeger endpoint: {jaeger_endpoint}")

    try:
        # Create resource with service name
        resource = Resource(attributes={
            "service.name": service_name,
            "service.version": "1.0.0",
            "deployment.environment": os.getenv("ENV", "development"),
        })

        # Create tracer provider
        provider = TracerProvider(resource=resource)

        # Create Jaeger exporter
        jaeger_exporter = JaegerExporter(
            collector_endpoint=jaeger_endpoint,
        )

        # Add batch span processor
        span_processor = BatchSpanProcessor(jaeger_exporter)
        provider.add_span_processor(span_processor)

        # Set global tracer provider
        trace.set_tracer_provider(provider)

        # Get tracer
        _tracer = trace.get_tracer(__name__)
        _initialized = True

        logger.info("✅ OpenTelemetry tracing initialized successfully")
        return _tracer

    except Exception as e:
        logger.error(f"Failed to initialize tracing: {e}")
        logger.warning("Tracing will be disabled")
        # Return no-op tracer
        _tracer = trace.get_tracer(__name__)
        return _tracer


def get_tracer():
    """Get the global tracer instance"""
    global _tracer
    if _tracer is None:
        # Initialize with defaults if not already initialized
        init_tracing()
    return _tracer


class OpenTelemetryInterceptor(grpc.ServerInterceptor):
    """
    gRPC Server Interceptor for OpenTelemetry distributed tracing

    This interceptor:
    1. Extracts trace context from incoming gRPC metadata
    2. Creates a new span for the RPC method
    3. Propagates context to downstream services
    4. Records method details and errors
    """

    def __init__(self, tracer=None):
        self.tracer = tracer or get_tracer()
        self.propagator = TraceContextTextMapPropagator()

    def intercept_service(self, continuation, handler_call_details):
        """
        Intercept incoming gRPC calls to add tracing
        """
        method = handler_call_details.method

        # Extract trace context from metadata
        metadata = dict(handler_call_details.invocation_metadata)
        ctx = self.propagator.extract(carrier=metadata)

        # Create span for this RPC
        with self.tracer.start_as_current_span(
            name=f"grpc.server{method}",
            context=ctx,
            kind=trace.SpanKind.SERVER,
        ) as span:
            # Add standard gRPC attributes
            span.set_attribute("rpc.system", "grpc")
            span.set_attribute("rpc.service", method.split('/')[1] if '/' in method else "unknown")
            span.set_attribute("rpc.method", method.split('/')[-1] if '/' in method else method)
            span.set_attribute("component", "python-ml-service")

            # Add custom attributes
            span.set_attribute("ml.service.type", "inference")

            try:
                # Continue with the RPC
                response = continuation(handler_call_details)

                # Record success
                span.set_attribute("rpc.grpc.status_code", 0)  # OK
                span.set_status(trace.Status(trace.StatusCode.OK))

                return response

            except grpc.RpcError as e:
                # Record gRPC error
                span.set_attribute("rpc.grpc.status_code", e.code().value[0])
                span.set_status(
                    trace.Status(
                        trace.StatusCode.ERROR,
                        description=str(e.details())
                    )
                )
                span.record_exception(e)
                raise

            except Exception as e:
                # Record generic error
                span.set_status(
                    trace.Status(
                        trace.StatusCode.ERROR,
                        description=str(e)
                    )
                )
                span.record_exception(e)
                logger.error(f"Error in RPC {method}: {e}")
                raise


class TracedMLServicer:
    """
    Wrapper for ML Service that adds tracing to individual methods
    """

    def __init__(self, servicer, tracer=None):
        self.servicer = servicer
        self.tracer = tracer or get_tracer()

    def Predict(self, request, context):
        """Wrapped Predict with tracing"""
        with self.tracer.start_as_current_span(
            "ml.predict",
            kind=trace.SpanKind.INTERNAL,
        ) as span:
            # Add inference-specific attributes
            span.set_attribute("ml.model_id", request.model_id or "default")
            span.set_attribute("ml.features.count", len(request.features))

            try:
                # Call actual implementation
                response = self.servicer.Predict(request, context)

                # Add response attributes
                span.set_attribute("ml.prediction", response.prediction)
                span.set_attribute("ml.confidence", response.confidence)

                return response

            except Exception as e:
                span.record_exception(e)
                span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                raise

    def HealthCheck(self, request, context):
        """Wrapped HealthCheck with tracing"""
        with self.tracer.start_as_current_span(
            "ml.health_check",
            kind=trace.SpanKind.INTERNAL,
        ) as span:
            try:
                response = self.servicer.HealthCheck(request, context)
                span.set_attribute("ml.health.status", response.status)
                span.set_attribute("ml.health.version", response.version)
                return response
            except Exception as e:
                span.record_exception(e)
                span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                raise


def create_traced_server(
    servicer,
    port=50051,
    max_workers=10,
    enable_tracing=True,
    jaeger_endpoint=None
):
    """
    Create a gRPC server with OpenTelemetry tracing

    Args:
        servicer: The gRPC servicer instance
        port: Port to listen on
        max_workers: Maximum number of worker threads
        enable_tracing: Whether to enable tracing
        jaeger_endpoint: Jaeger collector endpoint

    Returns:
        Configured gRPC server
    """
    import proto.ml_service_pb2_grpc as ml_pb2_grpc

    if enable_tracing:
        # Initialize tracing
        tracer = init_tracing(jaeger_endpoint=jaeger_endpoint)

        # Wrap servicer with tracing
        traced_servicer = TracedMLServicer(servicer, tracer)

        # Create interceptor
        otel_interceptor = OpenTelemetryInterceptor(tracer)

        # Create server with interceptor
        server = grpc.server(
            futures.ThreadPoolExecutor(max_workers=max_workers),
            interceptors=[otel_interceptor],
            options=[
                ('grpc.max_send_message_length', 50 * 1024 * 1024),  # 50MB
                ('grpc.max_receive_message_length', 50 * 1024 * 1024),
                ('grpc.keepalive_time_ms', 30000),
                ('grpc.keepalive_timeout_ms', 10000),
                ('grpc.http2.max_pings_without_data', 0),
                ('grpc.keepalive_permit_without_calls', 1),
            ]
        )

        # Add traced servicer
        ml_pb2_grpc.add_MLServiceServicer_to_server(traced_servicer, server)

        logger.info("🔭 OpenTelemetry tracing enabled for gRPC server")

    else:
        # Create server without tracing
        server = grpc.server(
            futures.ThreadPoolExecutor(max_workers=max_workers),
            options=[
                ('grpc.max_send_message_length', 50 * 1024 * 1024),
                ('grpc.max_receive_message_length', 50 * 1024 * 1024),
                ('grpc.keepalive_time_ms', 30000),
                ('grpc.keepalive_timeout_ms', 10000),
                ('grpc.http2.max_pings_without_data', 0),
                ('grpc.keepalive_permit_without_calls', 1),
            ]
        )

        # Add regular servicer
        ml_pb2_grpc.add_MLServiceServicer_to_server(servicer, server)

        logger.info("Tracing disabled for gRPC server")

    server.add_insecure_port(f'[::]:{port}')
    return server


def shutdown_tracing():
    """Shutdown tracing and flush remaining spans"""
    global _initialized

    if _initialized:
        try:
            # Get the global tracer provider
            provider = trace.get_tracer_provider()
            if hasattr(provider, 'shutdown'):
                provider.shutdown()
            logger.info("Tracing shutdown complete")
        except Exception as e:
            logger.error(f"Error during tracing shutdown: {e}")
        finally:
            _initialized = False


# Example usage and testing
if __name__ == "__main__":
    # Test tracing initialization
    tracer = init_tracing()

    with tracer.start_as_current_span("test-span") as span:
        span.set_attribute("test.attribute", "test-value")
        print("Test span created successfully")

    shutdown_tracing()
    print("Tracing test complete")
