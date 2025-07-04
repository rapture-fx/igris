"""
Schlep-engine Security Module

This module provides comprehensive enterprise-grade security features for the
Schlep-engine AI-Powered Data Intelligence platform. It implements defense-in-depth
security architecture with multiple layers of protection.

Core Security Components:
- Authentication: Multi-factor authentication, JWT management, session handling
- Access Control: Role-based access control (RBAC), permissions, resource protection
- Encryption: Data encryption at rest and in transit, key management
- Audit: Security event logging, compliance reporting, forensic analysis
- Compliance: SOC 2, GDPR, HIPAA compliance frameworks
- Monitoring: Real-time threat detection, security alerts, anomaly detection

Security Principles:
- Zero Trust Architecture
- Principle of Least Privilege
- Defense in Depth
- Continuous Monitoring
- Compliance by Design

Usage:
    from app.security import authentication, access_control, encryption
    
    # Example usage will be implemented in each submodule
"""

from typing import Dict, Any

__version__ = "1.0.0"
__author__ = "Schlep-engine Security Team"

# Module metadata
SECURITY_MODULES = {
    "authentication": "Multi-factor authentication and session management",
    "access_control": "Role-based access control and permissions",
    "encryption": "Data encryption and key management",
    "audit": "Security logging and compliance reporting", 
    "compliance": "Regulatory compliance frameworks",
    "monitoring": "Threat detection and security monitoring"
}

def get_security_status() -> Dict[str, Any]:
    """
    Get the overall security module status.
    
    Returns:
        Dict containing security module status and configuration
    """
    return {
        "version": __version__,
        "modules": SECURITY_MODULES,
        "status": "initialized"
    }

# Future imports will be added here as modules are implemented
# from .authentication import *
# from .access_control import *
# from .encryption import *
# from .audit import *
# from .compliance import *
# from .monitoring import * 