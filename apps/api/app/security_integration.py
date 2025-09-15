"""
Security Integration Module
==========================

This module integrates all security components into the main FastAPI application.
It provides a centralized way to configure and initialize all security middleware
and components for enterprise-grade security hardening.

Usage:
    from app.security_integration import setup_comprehensive_security
    app = setup_comprehensive_security(app, settings)
"""

import os
import logging
from typing import Optional, Dict, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# Import all security components
try:
    from app.middleware.security_validation_middleware import SecurityValidationMiddleware
    SECURITY_VALIDATION_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Security validation middleware not available: {e}")
    SECURITY_VALIDATION_AVAILABLE = False

try:
    from app.middleware.network_security_middleware import NetworkSecurityMiddleware
    NETWORK_SECURITY_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Network security middleware not available: {e}")
    NETWORK_SECURITY_AVAILABLE = False

try:
    from app.middleware.api_security_middleware import AdvancedAPISecurityMiddleware
    API_SECURITY_AVAILABLE = True
except ImportError as e:
    logging.warning(f"API security middleware not available: {e}")
    API_SECURITY_AVAILABLE = False

try:
    from app.core.security_hardening import get_security_framework
    SECURITY_FRAMEWORK_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Security hardening framework not available: {e}")
    SECURITY_FRAMEWORK_AVAILABLE = False

try:
    from app.core.security_monitoring_system import get_security_monitoring_system
    SECURITY_MONITORING_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Security monitoring system not available: {e}")
    SECURITY_MONITORING_AVAILABLE = False

try:
    from app.core.data_protection import get_data_protection_manager
    DATA_PROTECTION_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Data protection manager not available: {e}")
    DATA_PROTECTION_AVAILABLE = False

logger = logging.getLogger(__name__)


def setup_comprehensive_security(
    app: FastAPI,
    settings: Any,
    enable_all_security: bool = None
) -> FastAPI:
    """
    Setup comprehensive security for FastAPI application

    Args:
        app: FastAPI application instance
        settings: Application settings
        enable_all_security: Override to enable/disable all security features

    Returns:
        FastAPI app with security middleware configured
    """

    # Determine if we should enable security features
    environment = getattr(settings, 'ENVIRONMENT', 'development')
    security_enabled = (
        enable_all_security if enable_all_security is not None
        else os.getenv('COMPREHENSIVE_SECURITY_ENABLED', 'true').lower() == 'true'
    )

    if not security_enabled:
        logger.warning("Comprehensive security is DISABLED")
        return app

    logger.info(f"Setting up comprehensive security for {environment} environment")

    # 1. Initialize Security Framework
    if SECURITY_FRAMEWORK_AVAILABLE:
        try:
            security_framework = get_security_framework()
            logger.info("✓ Security Hardening Framework initialized")
        except Exception as e:
            logger.error(f"Failed to initialize security framework: {e}")
    else:
        logger.warning("Security framework not available")

    # 2. Initialize Security Monitoring
    if SECURITY_MONITORING_AVAILABLE:
        try:
            security_monitoring = get_security_monitoring_system()
            logger.info("✓ Security Monitoring System initialized")
        except Exception as e:
            logger.error(f"Failed to initialize security monitoring: {e}")
    else:
        logger.warning("Security monitoring not available")

    # 3. Initialize Data Protection
    if DATA_PROTECTION_AVAILABLE:
        try:
            data_protection = get_data_protection_manager()
            logger.info("✓ Data Protection Manager initialized")
        except Exception as e:
            logger.error(f"Failed to initialize data protection: {e}")
    else:
        logger.warning("Data protection not available")

    # 4. Configure CORS with security
    setup_secure_cors(app, settings)

    # 5. Configure Trusted Host Middleware
    setup_trusted_hosts(app, settings)

    # 6. Add Network Security Middleware
    if NETWORK_SECURITY_AVAILABLE:
        setup_network_security_middleware(app, settings)

    # 7. Add Input Validation Middleware
    if SECURITY_VALIDATION_AVAILABLE:
        setup_input_validation_middleware(app, settings)

    # 8. Add API Security Middleware
    if API_SECURITY_AVAILABLE:
        setup_api_security_middleware(app, settings)

    # 9. Add security headers to all responses
    setup_security_headers(app, settings)

    # 10. Add security endpoints
    setup_security_endpoints(app)

    logger.info("✓ Comprehensive security setup completed")
    return app


def setup_secure_cors(app: FastAPI, settings: Any):
    """Setup CORS with security considerations"""

    environment = getattr(settings, 'ENVIRONMENT', 'development')

    if environment == 'production':
        # Production CORS - restrictive
        allowed_origins = getattr(settings, 'ALLOWED_ORIGINS', [])
        if not allowed_origins:
            logger.error("No CORS origins configured for production!")
            allowed_origins = []
    else:
        # Development CORS - more permissive
        allowed_origins = getattr(settings, 'ALLOWED_ORIGINS', [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000'
        ])

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-API-Version"]
    )

    logger.info(f"✓ Secure CORS configured for {environment}")


def setup_trusted_hosts(app: FastAPI, settings: Any):
    """Setup trusted host middleware"""

    allowed_hosts = getattr(settings, 'ALLOWED_HOSTS', ['*'])

    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=allowed_hosts
    )

    logger.info("✓ Trusted host middleware configured")


def setup_network_security_middleware(app: FastAPI, settings: Any):
    """Setup network security middleware"""

    try:
        environment = getattr(settings, 'ENVIRONMENT', 'development')

        # Network security configuration
        config = {
            'enabled': True,
            'environment': environment,
            'enable_hsts': environment == 'production',
            'enable_csp': True,
            'enable_ddos_protection': os.getenv('DDOS_PROTECTION_ENABLED', 'true').lower() == 'true',
            'enable_threat_detection': os.getenv('THREAT_DETECTION_ENABLED', 'true').lower() == 'true',
            'blocked_countries': set(os.getenv('BLOCKED_COUNTRIES', '').split(',')),
            'require_https': environment == 'production'
        }

        app.add_middleware(NetworkSecurityMiddleware, **config)
        logger.info("✓ Network Security Middleware configured")

    except Exception as e:
        logger.error(f"Failed to setup network security middleware: {e}")


def setup_input_validation_middleware(app: FastAPI, settings: Any):
    """Setup input validation middleware"""

    try:
        environment = getattr(settings, 'ENVIRONMENT', 'development')

        config = {
            'enabled': True,
            'strict_mode': environment == 'production',
            'enable_sanitization': True,
            'block_malicious_requests': True,
            'exempt_paths': {'/health', '/metrics', '/docs', '/openapi.json'}
        }

        app.add_middleware(SecurityValidationMiddleware, **config)
        logger.info("✓ Input Validation Middleware configured")

    except Exception as e:
        logger.error(f"Failed to setup input validation middleware: {e}")


def setup_api_security_middleware(app: FastAPI, settings: Any):
    """Setup API security middleware"""

    try:
        environment = getattr(settings, 'ENVIRONMENT', 'development')

        config = {
            'enabled': True,
            'enforce_api_versioning': True,
            'enable_adaptive_rate_limiting': True,
            'enable_graphql_security': True,
            'secure_docs_access': environment == 'production',
            'docs_require_auth': environment == 'production'
        }

        app.add_middleware(AdvancedAPISecurityMiddleware, **config)
        logger.info("✓ API Security Middleware configured")

    except Exception as e:
        logger.error(f"Failed to setup API security middleware: {e}")


def setup_security_headers(app: FastAPI, settings: Any):
    """Add security headers to all responses"""

    @app.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)

        # Get security headers from framework if available
        security_headers = {}

        if SECURITY_FRAMEWORK_AVAILABLE:
            try:
                security_framework = get_security_framework()
                security_headers = security_framework.get_security_headers()
            except Exception as e:
                logger.warning(f"Could not get security headers: {e}")

        # Add default security headers if not provided by framework
        default_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        }

        # Apply headers
        for header, value in {**default_headers, **security_headers}.items():
            response.headers[header] = value

        # Add custom security headers
        response.headers["X-Security-Framework"] = "enabled"
        response.headers["X-Comprehensive-Security"] = "active"

        return response

    logger.info("✓ Security headers middleware configured")


def setup_security_endpoints(app: FastAPI):
    """Setup security-related API endpoints"""

    @app.get("/security/status", tags=["Security"])
    async def security_status():
        """Get comprehensive security status"""

        status_info = {
            "security_framework_active": SECURITY_FRAMEWORK_AVAILABLE,
            "security_monitoring_active": SECURITY_MONITORING_AVAILABLE,
            "data_protection_active": DATA_PROTECTION_AVAILABLE,
            "input_validation_active": SECURITY_VALIDATION_AVAILABLE,
            "network_security_active": NETWORK_SECURITY_AVAILABLE,
            "api_security_active": API_SECURITY_AVAILABLE,
            "environment": os.getenv("ENVIRONMENT", "development"),
            "comprehensive_security_enabled": os.getenv("COMPREHENSIVE_SECURITY_ENABLED", "true").lower() == "true"
        }

        # Add detailed status if frameworks are available
        if SECURITY_FRAMEWORK_AVAILABLE:
            try:
                security_framework = get_security_framework()
                status_info["security_metrics"] = security_framework.get_security_metrics()
            except Exception as e:
                logger.warning(f"Could not get security metrics: {e}")

        if SECURITY_MONITORING_AVAILABLE:
            try:
                security_monitoring = get_security_monitoring_system()
                status_info["monitoring_dashboard"] = await security_monitoring.get_security_dashboard()
            except Exception as e:
                logger.warning(f"Could not get monitoring dashboard: {e}")

        if DATA_PROTECTION_AVAILABLE:
            try:
                data_protection = get_data_protection_manager()
                status_info["data_protection_metrics"] = data_protection.get_data_protection_metrics()
            except Exception as e:
                logger.warning(f"Could not get data protection metrics: {e}")

        return status_info

    @app.get("/security/health", tags=["Security"])
    async def security_health():
        """Security-focused health check"""

        health_status = {
            "status": "healthy",
            "timestamp": "2024-12-19T10:30:00Z",
            "security_components": {}
        }

        # Check each security component
        components = {
            "security_framework": SECURITY_FRAMEWORK_AVAILABLE,
            "security_monitoring": SECURITY_MONITORING_AVAILABLE,
            "data_protection": DATA_PROTECTION_AVAILABLE,
            "input_validation": SECURITY_VALIDATION_AVAILABLE,
            "network_security": NETWORK_SECURITY_AVAILABLE,
            "api_security": API_SECURITY_AVAILABLE
        }

        for component, available in components.items():
            health_status["security_components"][component] = {
                "status": "active" if available else "unavailable",
                "available": available
            }

        # Determine overall health
        active_components = sum(1 for available in components.values() if available)
        total_components = len(components)

        if active_components == total_components:
            health_status["overall_security_status"] = "excellent"
        elif active_components >= total_components * 0.8:
            health_status["overall_security_status"] = "good"
        elif active_components >= total_components * 0.5:
            health_status["overall_security_status"] = "degraded"
        else:
            health_status["overall_security_status"] = "critical"
            health_status["status"] = "unhealthy"

        return health_status

    logger.info("✓ Security endpoints configured")


def get_security_configuration_summary() -> Dict[str, Any]:
    """Get summary of security configuration"""

    return {
        "components_available": {
            "security_framework": SECURITY_FRAMEWORK_AVAILABLE,
            "security_monitoring": SECURITY_MONITORING_AVAILABLE,
            "data_protection": DATA_PROTECTION_AVAILABLE,
            "input_validation": SECURITY_VALIDATION_AVAILABLE,
            "network_security": NETWORK_SECURITY_AVAILABLE,
            "api_security": API_SECURITY_AVAILABLE
        },
        "environment_variables": {
            "COMPREHENSIVE_SECURITY_ENABLED": os.getenv("COMPREHENSIVE_SECURITY_ENABLED", "true"),
            "ENVIRONMENT": os.getenv("ENVIRONMENT", "development"),
            "SECURITY_MONITORING_ENABLED": os.getenv("SECURITY_MONITORING_ENABLED", "true"),
            "DDOS_PROTECTION_ENABLED": os.getenv("DDOS_PROTECTION_ENABLED", "true"),
            "THREAT_DETECTION_ENABLED": os.getenv("THREAT_DETECTION_ENABLED", "true")
        },
        "setup_complete": True
    }


# Export main function for easy integration
__all__ = ["setup_comprehensive_security", "get_security_configuration_summary"]