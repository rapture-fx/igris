"""
SSL/TLS Configuration

This module provides SSL/TLS configuration for secure communication
in production and staging environments.
"""

import os
import ssl
from pathlib import Path
from typing import Optional, Dict, Any
import logging

from app.core.unified_config import settings

logger = logging.getLogger(__name__)


class SSLConfig:
    """
    SSL/TLS configuration manager.
    
    Provides SSL certificate and key management for secure HTTPS communication.
    Supports both file-based certificates and cloud-managed certificates.
    """
    
    def __init__(self):
        self.ssl_enabled = self._should_enable_ssl()
        self.cert_path = os.getenv("SSL_CERT_PATH", "")
        self.key_path = os.getenv("SSL_KEY_PATH", "")
        self.ca_path = os.getenv("SSL_CA_PATH", "")
        
        if self.ssl_enabled:
            self._validate_ssl_config()
    
    def _should_enable_ssl(self) -> bool:
        """Determine if SSL should be enabled based on environment."""
        # Force SSL in production and staging
        if settings.ENVIRONMENT.value in ["production", "staging"]:
            return True
        
        # Allow SSL in development if certificates are provided
        if settings.ENVIRONMENT.value == "development":
            return bool(os.getenv("SSL_CERT_PATH") and os.getenv("SSL_KEY_PATH"))
        
        return False
    
    def _validate_ssl_config(self) -> None:
        """Validate SSL configuration."""
        if not self.cert_path or not self.key_path:
            raise ValueError(
                f"SSL is enabled for {settings.ENVIRONMENT.value} environment "
                "but SSL_CERT_PATH and SSL_KEY_PATH are not set"
            )
        
        # Check if certificate files exist
        if not Path(self.cert_path).exists():
            raise FileNotFoundError(f"SSL certificate not found: {self.cert_path}")
        
        if not Path(self.key_path).exists():
            raise FileNotFoundError(f"SSL private key not found: {self.key_path}")
        
        # Check CA certificate if provided
        if self.ca_path and not Path(self.ca_path).exists():
            raise FileNotFoundError(f"SSL CA certificate not found: {self.ca_path}")
        
        logger.info(f"SSL configuration validated for {settings.ENVIRONMENT.value} environment")
    
    def get_ssl_context(self) -> Optional[ssl.SSLContext]:
        """
        Get SSL context for the application.
        
        Returns:
            SSLContext if SSL is enabled, None otherwise
        """
        if not self.ssl_enabled:
            return None
        
        try:
            # Create SSL context
            ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
            
            # Load certificate and private key
            ssl_context.load_cert_chain(
                certfile=self.cert_path,
                keyfile=self.key_path
            )
            
            # Load CA certificate if provided
            if self.ca_path:
                ssl_context.load_verify_locations(cafile=self.ca_path)
            
            # Configure SSL context based on environment
            if settings.ENVIRONMENT.value == "production":
                # Maximum security for production
                ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
                ssl_context.maximum_version = ssl.TLSVersion.TLSv1_3
                ssl_context.set_ciphers('ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384')
                ssl_context.options |= ssl.OP_NO_SSLv2 | ssl.OP_NO_SSLv3 | ssl.OP_NO_TLSv1 | ssl.OP_NO_TLSv1_1
            elif settings.ENVIRONMENT.value == "staging":
                # Moderate security for staging
                ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
                ssl_context.set_ciphers('ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20')
            else:
                # Development - more permissive
                ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
            
            logger.info(f"SSL context created successfully for {settings.ENVIRONMENT.value}")
            return ssl_context
            
        except Exception as e:
            logger.error(f"Failed to create SSL context: {e}")
            raise
    
    def get_uvicorn_ssl_config(self) -> Dict[str, Any]:
        """
        Get SSL configuration for Uvicorn server.
        
        Returns:
            Dictionary with SSL configuration for Uvicorn
        """
        if not self.ssl_enabled:
            return {}
        
        ssl_config = {
            "ssl_certfile": self.cert_path,
            "ssl_keyfile": self.key_path,
        }
        
        if self.ca_path:
            ssl_config["ssl_ca_certs"] = self.ca_path
        
        # Add SSL configuration based on environment
        if settings.ENVIRONMENT.value == "production":
            ssl_config.update({
                "ssl_minimum_version": "TLSv1_2",
                "ssl_maximum_version": "TLSv1_3",
                "ssl_ciphers": "ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
            })
        elif settings.ENVIRONMENT.value == "staging":
            ssl_config.update({
                "ssl_minimum_version": "TLSv1_2",
                "ssl_ciphers": "ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20"
            })
        
        return ssl_config
    
    def get_nginx_ssl_config(self) -> str:
        """
        Generate Nginx SSL configuration.
        
        Returns:
            Nginx SSL configuration as a string
        """
        if not self.ssl_enabled:
            return ""
        
        config = f"""
# SSL Configuration for {settings.ENVIRONMENT.value}
ssl_certificate {self.cert_path};
ssl_certificate_key {self.key_path};
"""
        
        if self.ca_path:
            config += f"ssl_trusted_certificate {self.ca_path};\n"
        
        # Environment-specific SSL configuration
        if settings.ENVIRONMENT.value == "production":
            config += """
# Production SSL configuration - Maximum security
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
"""
        elif settings.ENVIRONMENT.value == "staging":
            config += """
# Staging SSL configuration - Moderate security
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
"""
        else:
            config += """
# Development SSL configuration - Basic security
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE+AESGCM:ECDHE+CHACHA20;
ssl_prefer_server_ciphers off;
"""
        
        return config
    
    def validate_certificate(self) -> Dict[str, Any]:
        """
        Validate SSL certificate.
        
        Returns:
            Dictionary with certificate information
        """
        if not self.ssl_enabled or not self.cert_path:
            return {"valid": False, "error": "SSL not enabled or certificate not configured"}
        
        try:
            import OpenSSL.crypto as crypto
            
            with open(self.cert_path, 'rb') as cert_file:
                cert_data = cert_file.read()
                cert = crypto.load_certificate(crypto.FILETYPE_PEM, cert_data)
            
            # Extract certificate information
            subject = dict(cert.get_subject().get_components())
            issuer = dict(cert.get_issuer().get_components())
            
            return {
                "valid": True,
                "subject": subject,
                "issuer": issuer,
                "not_before": cert.get_notBefore().decode(),
                "not_after": cert.get_notAfter().decode(),
                "serial_number": cert.get_serial_number(),
                "version": cert.get_version(),
                "signature_algorithm": cert.get_signature_algorithm().decode()
            }
            
        except Exception as e:
            return {"valid": False, "error": str(e)}


# Global SSL configuration instance
ssl_config = SSLConfig()


def get_ssl_context() -> Optional[ssl.SSLContext]:
    """Get SSL context for the application."""
    return ssl_config.get_ssl_context()


def get_uvicorn_ssl_config() -> Dict[str, Any]:
    """Get SSL configuration for Uvicorn server."""
    return ssl_config.get_uvicorn_ssl_config()


def get_nginx_ssl_config() -> str:
    """Get Nginx SSL configuration."""
    return ssl_config.get_nginx_ssl_config()


def validate_certificate() -> Dict[str, Any]:
    """Validate SSL certificate."""
    return ssl_config.validate_certificate() 