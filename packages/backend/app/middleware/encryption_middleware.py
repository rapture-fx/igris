"""
Encryption Middleware

This middleware provides automatic encryption of sensitive response data using
the existing encryption infrastructure with decorator-based implementation.

Features:
- Automatic response encryption for sensitive data
- Field-level encryption for specific attributes
- Integration with existing PII detection
- Configurable encryption policies
- Minimal changes to existing endpoints
- Support for multiple encryption levels
- Key rotation and management

Usage:
    @encrypt_response
    @router.get("/user-profile")
    async def get_user_profile():
        return {"name": "John", "ssn": "123-45-6789"}
        
    @encrypt_response(
        encryption_level="high",
        encrypt_fields=["ssn", "credit_card", "password"],
        detection_enabled=True
    )
    @router.post("/payment-info")
    async def process_payment():
        return {"status": "success", "card": "4111-1111-1111-1111"}
"""

import json
import asyncio
from typing import Optional, Dict, List, Any, Callable, Set, Union
from functools import wraps
from dataclasses import dataclass, asdict, field
from enum import Enum
import logging

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

# Import existing encryption functionality
from app.security.encryption.field_encryption import field_encryptor
from app.security.encryption.pii_detector import pii_detector, PIIType, SensitivityLevel, MaskingStrategy
from app.auth.enhanced_security import enhanced_security, SecurityLevel

logger = logging.getLogger(__name__)

class EncryptionLevel(Enum):
    """Encryption levels for different data sensitivity"""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class EncryptionPolicy(Enum):
    """Encryption policies for response handling"""
    ENCRYPT_ALL = "encrypt_all"
    ENCRYPT_SENSITIVE_ONLY = "encrypt_sensitive_only"
    ENCRYPT_FIELDS_ONLY = "encrypt_fields_only"
    DETECT_AND_ENCRYPT = "detect_and_encrypt"

@dataclass
class EncryptionConfig:
    """Configuration for the encryption middleware."""
    enabled: bool = True
    log_level: str = "INFO"
    default_sensitivity: SensitivityLevel = SensitivityLevel.CONFIDENTIAL
    pii_detection_confidence: float = 0.8
    masking_strategy: MaskingStrategy = MaskingStrategy.TOKENIZE
    encrypted_fields: Dict[str, str] = field(default_factory=lambda: {
        "user.email": "email",
        "payment.credit_card_number": "credit_card"
    })
    encryption_level: EncryptionLevel = EncryptionLevel.MEDIUM
    encryption_policy: EncryptionPolicy = EncryptionPolicy.DETECT_AND_ENCRYPT
    encrypt_fields: Set[str] = None
    exclude_fields: Set[str] = None
    pii_detection_enabled: bool = True
    minimum_sensitivity: SensitivityLevel = SensitivityLevel.CONFIDENTIAL
    preserve_structure: bool = True
    add_encryption_metadata: bool = True
    request_pii_check_fields: List[str] = field(default_factory=lambda: ["query", "headers", "body"])
    response_pii_check_fields: List[str] = field(default_factory=lambda: ["data"])

class ResponseEncryptor:
    """Handles encryption of response data"""
    
    def __init__(self):
        self.default_config = EncryptionConfig()
        self._encryption_cache = {}
    
    def _should_encrypt_field(
        self, 
        field_name: str, 
        field_value: Any, 
        config: EncryptionConfig,
        pii_results: Dict[str, Any] = None
    ) -> bool:
        """Determine if a field should be encrypted"""
        field_lower = field_name.lower()
        
        # Check exclusion list first
        if config.exclude_fields and any(
            excluded.lower() in field_lower for excluded in config.exclude_fields
        ):
            return False
        
        # Check explicit encryption fields
        if config.encrypt_fields and any(
            encrypt_field.lower() in field_lower for encrypt_field in config.encrypt_fields
        ):
            return True
        
        # Check PII detection results
        if config.pii_detection_enabled and pii_results:
            field_pii = pii_results.get('field_analysis', {}).get(field_name, {})
            if field_pii.get('contains_pii', False):
                sensitivity = field_pii.get('sensitivity_level', SensitivityLevel.PUBLIC)
                return sensitivity.value >= config.minimum_sensitivity.value
        
        # Check encryption policy
        if config.encryption_policy == EncryptionPolicy.ENCRYPT_ALL:
            return True
        elif config.encryption_policy == EncryptionPolicy.ENCRYPT_FIELDS_ONLY:
            return False  # Only encrypt if in explicit fields list
        
        # Default sensitive field patterns
        sensitive_patterns = [
            'password', 'secret', 'token', 'key', 'auth', 'ssn', 'social',
            'credit_card', 'card_number', 'cvv', 'bank', 'account', 'routing',
            'tax_id', 'passport', 'license', 'birth_date', 'address'
        ]
        
        return any(pattern in field_lower for pattern in sensitive_patterns)
    
    def _get_encryption_context(self, config: EncryptionConfig, user_context: Dict[str, Any]) -> str:
        """Generate encryption context based on configuration and user"""
        context_parts = [
            config.encryption_level.value,
            user_context.get('user_id', 'anonymous'),
            user_context.get('security_level', '2')
        ]
        return ':'.join(str(part) for part in context_parts)
    
    def _encrypt_value(
        self, 
        value: Any, 
        field_name: str, 
        context: str,
        config: EncryptionConfig
    ) -> Dict[str, Any]:
        """Encrypt a single value"""
        try:
            # Convert value to string for encryption
            value_str = json.dumps(value) if not isinstance(value, str) else value
            
            # Choose encryption method based on level
            if config.encryption_level == EncryptionLevel.CRITICAL:
                encrypted_data = field_encryptor.encrypt_field(
                    value_str, context, encryption_level='maximum'
                )
            elif config.encryption_level == EncryptionLevel.HIGH:
                encrypted_data = field_encryptor.encrypt_field(
                    value_str, context, encryption_level='high'
                )
            else:
                encrypted_data = field_encryptor.encrypt_field(
                    value_str, context, encryption_level='standard'
                )
            
            result = {
                "encrypted_value": encrypted_data['encrypted_data'],
                "field_type": type(value).__name__
            }
            
            if config.add_encryption_metadata:
                result.update({
                    "encryption_version": encrypted_data.get('version', '1.0'),
                    "encryption_algorithm": encrypted_data.get('algorithm', 'AES-256-GCM'),
                    "field_name": field_name,
                    "encrypted_at": encrypted_data.get('timestamp')
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to encrypt field {field_name}: {e}")
            # Fallback to masking if encryption fails
            if config.masking_strategy == MaskingStrategy.REDACTION:
                return {"encrypted_value": "[REDACTED]", "field_type": type(value).__name__}
            else:
                return {"encrypted_value": "***ENCRYPTED***", "field_type": type(value).__name__}
    
    def _process_data_structure(
        self, 
        data: Any, 
        config: EncryptionConfig,
        context: str,
        pii_results: Dict[str, Any] = None,
        path: str = ""
    ) -> Any:
        """Recursively process data structure for encryption"""
        if isinstance(data, dict):
            result = {}
            for key, value in data.items():
                field_path = f"{path}.{key}" if path else key
                
                if self._should_encrypt_field(key, value, config, pii_results):
                    result[key] = self._encrypt_value(value, key, context, config)
                else:
                    # Recursively process nested structures
                    result[key] = self._process_data_structure(
                        value, config, context, pii_results, field_path
                    )
            return result
            
        elif isinstance(data, list):
            return [
                self._process_data_structure(
                    item, config, context, pii_results, f"{path}[{i}]"
                ) for i, item in enumerate(data)
            ]
        else:
            return data
    
    def encrypt_response_data(
        self, 
        data: Any, 
        config: EncryptionConfig,
        user_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Encrypt response data according to configuration"""
        if user_context is None:
            user_context = {}
        
        # Skip encryption for certain policies
        if config.encryption_policy == EncryptionPolicy.ENCRYPT_ALL and config.encryption_level == EncryptionLevel.NONE:
            return {"data": data, "encrypted": False}
        
        # Detect PII if enabled
        pii_results = None
        if config.pii_detection_enabled:
            try:
                data_str = json.dumps(data) if not isinstance(data, str) else data
                detection_result = pii_detector.detect_pii_comprehensive(data_str)
                pii_results = detection_result
            except Exception as e:
                logger.warning(f"PII detection failed: {e}")
        
        # Generate encryption context
        encryption_context = self._get_encryption_context(config, user_context)
        
        # Process the data
        processed_data = self._process_data_structure(
            data, config, encryption_context, pii_results
        )
        
        # Prepare response
        response = {
            "data": processed_data,
            "encrypted": True,
            "encryption_level": config.encryption_level.value,
            "encryption_policy": config.encryption_policy.value
        }
        
        if config.add_encryption_metadata:
            response["encryption_metadata"] = {
                "algorithm": "AES-256-GCM",
                "key_version": field_encryptor.get_current_key_version(),
                "context": encryption_context[:8] + "...",  # Partial context for debugging
                "timestamp": field_encryptor._get_timestamp().isoformat()
            }
            
            if pii_results:
                response["pii_summary"] = {
                    "pii_detected": pii_results.get('contains_pii', False),
                    "pii_count": len(pii_results.get('matches', [])),
                    "highest_sensitivity": pii_results.get('overall_classification', {}).get('sensitivity_level', 'PUBLIC'),
                    "compliance_flags": pii_results.get('privacy_report', {}).get('compliance_flags', [])
                }
        
        return response

# Global response encryptor instance
response_encryptor = ResponseEncryptor()

def extract_user_context_for_encryption(request: Request) -> Dict[str, Any]:
    """Extract user context for encryption purposes"""
    context = {
        "user_id": "anonymous",
        "security_level": "2",
        "session_id": None
    }
    
    try:
        # Extract from Authorization header
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            payload = enhanced_security.enhanced_verify_token(token)
            if payload:
                context["user_id"] = payload.get("sub", "anonymous")
                context["session_id"] = payload.get("session_id")
                context["security_level"] = str(payload.get("security_level", 2))
    except Exception as e:
        logger.debug(f"Could not extract user context for encryption: {e}")
    
    return context

# Decorator for response encryption
def encrypt_response(
    encryption_level: EncryptionLevel = EncryptionLevel.MEDIUM,
    encryption_policy: EncryptionPolicy = EncryptionPolicy.DETECT_AND_ENCRYPT,
    encrypt_fields: Set[str] = None,
    exclude_fields: Set[str] = None,
    pii_detection_enabled: bool = True,
    masking_strategy: MaskingStrategy = MaskingStrategy.TOKENIZE,
    minimum_sensitivity: SensitivityLevel = SensitivityLevel.CONFIDENTIAL,
    preserve_structure: bool = True,
    add_encryption_metadata: bool = True
):
    """
    Decorator to encrypt response data from API endpoints.
    
    Args:
        encryption_level: Level of encryption to apply
        encryption_policy: Policy for determining what to encrypt
        encrypt_fields: Specific fields to encrypt
        exclude_fields: Fields to exclude from encryption
        pii_detection_enabled: Whether to detect PII automatically
        masking_strategy: Strategy for masking detected PII
        minimum_sensitivity: Minimum sensitivity level to encrypt
        preserve_structure: Whether to preserve original data structure
        add_encryption_metadata: Whether to add encryption metadata
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Execute the original function
            result = await func(*args, **kwargs)
            
            # Extract request for user context
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                request = kwargs.get('request')
            
            # Skip encryption if no request context (internal calls)
            if not request:
                return result
            
            # Create encryption configuration
            config = EncryptionConfig(
                encryption_level=encryption_level,
                encryption_policy=encryption_policy,
                encrypt_fields=encrypt_fields,
                exclude_fields=exclude_fields,
                pii_detection_enabled=pii_detection_enabled,
                masking_strategy=masking_strategy,
                minimum_sensitivity=minimum_sensitivity,
                preserve_structure=preserve_structure,
                add_encryption_metadata=add_encryption_metadata
            )
            
            # Extract user context
            user_context = extract_user_context_for_encryption(request)
            
            try:
                # Handle different response types
                if isinstance(result, dict):
                    encrypted_result = response_encryptor.encrypt_response_data(
                        result, config, user_context
                    )
                    return JSONResponse(content=encrypted_result)
                elif isinstance(result, list):
                    encrypted_result = response_encryptor.encrypt_response_data(
                        result, config, user_context
                    )
                    return JSONResponse(content=encrypted_result)
                elif isinstance(result, JSONResponse):
                    # Extract content from JSONResponse
                    if hasattr(result, 'body'):
                        content = json.loads(result.body.decode())
                        encrypted_content = response_encryptor.encrypt_response_data(
                            content, config, user_context
                        )
                        return JSONResponse(content=encrypted_content, status_code=result.status_code)
                
                # For other response types, return as-is
                return result
                
            except Exception as e:
                logger.error(f"Response encryption failed: {e}")
                # Return original result if encryption fails
                return result
        
        return wrapper
    return decorator

# Specialized encryption decorators
def encrypt_sensitive_data(
    encrypt_fields: Set[str] = None,
    exclude_fields: Set[str] = None
):
    """Decorator for endpoints returning sensitive data"""
    return encrypt_response(
        encryption_level=EncryptionLevel.HIGH,
        encryption_policy=EncryptionPolicy.DETECT_AND_ENCRYPT,
        encrypt_fields=encrypt_fields,
        exclude_fields=exclude_fields,
        pii_detection_enabled=True,
        minimum_sensitivity=SensitivityLevel.CONFIDENTIAL
    )

def encrypt_pii_data(
    masking_strategy: MaskingStrategy = MaskingStrategy.TOKENIZE
):
    """Decorator for endpoints that may contain PII"""
    return encrypt_response(
        encryption_level=EncryptionLevel.HIGH,
        encryption_policy=EncryptionPolicy.DETECT_AND_ENCRYPT,
        pii_detection_enabled=True,
        masking_strategy=masking_strategy,
        minimum_sensitivity=SensitivityLevel.CONFIDENTIAL
    )

def encrypt_financial_data():
    """Decorator for endpoints returning financial data"""
    return encrypt_response(
        encryption_level=EncryptionLevel.CRITICAL,
        encryption_policy=EncryptionPolicy.ENCRYPT_ALL,
        encrypt_fields={
            'account_number', 'routing_number', 'credit_card', 'card_number',
            'cvv', 'bank_account', 'financial_data', 'payment_info'
        },
        pii_detection_enabled=True,
        minimum_sensitivity=SensitivityLevel.HIGHLY_RESTRICTED
    )

def encrypt_admin_data():
    """Decorator for administrative endpoints"""
    return encrypt_response(
        encryption_level=EncryptionLevel.HIGH,
        encryption_policy=EncryptionPolicy.ENCRYPT_SENSITIVE_ONLY,
        pii_detection_enabled=True,
        add_encryption_metadata=True,
        minimum_sensitivity=SensitivityLevel.RESTRICTED
    )

# Middleware for automatic response encryption
class EncryptionMiddleware(BaseHTTPMiddleware):
    """
    Middleware for automatic response encryption based on path patterns.
    
    This provides baseline encryption for sensitive endpoints, while the decorator
    provides fine-grained control for specific endpoints.
    """
    
    def __init__(
        self,
        app,
        enabled: bool = True,
        auto_encrypt_paths: Set[str] = None,
        encryption_config: EncryptionConfig = None
    ):
        super().__init__(app)
        self.enabled = enabled
        self.auto_encrypt_paths = auto_encrypt_paths or {
            '/api/v1/user', '/api/v1/profile', '/api/v1/account',
            '/api/v1/payment', '/api/v1/billing', '/api/v1/admin'
        }
        self.encryption_config = encryption_config or EncryptionConfig()
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        if not self.enabled:
            return response
        
        # Check if path should be auto-encrypted
        should_encrypt = any(
            path in request.url.path for path in self.auto_encrypt_paths
        )
        
        if should_encrypt and isinstance(response, JSONResponse):
            try:
                # Extract user context
                user_context = extract_user_context_for_encryption(request)
                
                # Get response content
                if hasattr(response, 'body'):
                    content = json.loads(response.body.decode())
                    
                    # Encrypt the content
                    encrypted_content = response_encryptor.encrypt_response_data(
                        content, self.encryption_config, user_context
                    )
                    
                    # Create new response with encrypted content
                    return JSONResponse(
                        content=encrypted_content,
                        status_code=response.status_code,
                        headers=dict(response.headers)
                    )
            except Exception as e:
                logger.error(f"Middleware encryption failed: {e}")
        
        return response

# Response decryption utility for client-side
class ResponseDecryptor:
    """Utility for decrypting encrypted responses (for testing and debugging)"""
    
    @staticmethod
    def decrypt_response_data(encrypted_response: Dict[str, Any], context: str) -> Any:
        """Decrypt encrypted response data"""
        if not encrypted_response.get('encrypted', False):
            return encrypted_response.get('data')
        
        try:
            data = encrypted_response['data']
            return ResponseDecryptor._decrypt_structure(data, context)
        except Exception as e:
            logger.error(f"Response decryption failed: {e}")
            return None
    
    @staticmethod
    def _decrypt_structure(data: Any, context: str) -> Any:
        """Recursively decrypt data structure"""
        if isinstance(data, dict):
            if 'encrypted_value' in data:
                # This is an encrypted field
                try:
                    decrypted = field_encryptor.decrypt_field(
                        data['encrypted_value'], context
                    )
                    
                    # Try to restore original type
                    field_type = data.get('field_type', 'str')
                    if field_type == 'dict' or field_type == 'list':
                        return json.loads(decrypted['decrypted_data'])
                    else:
                        return decrypted['decrypted_data']
                except Exception as e:
                    logger.error(f"Field decryption failed: {e}")
                    return "[DECRYPTION_FAILED]"
            else:
                # Regular dict, process recursively
                return {
                    key: ResponseDecryptor._decrypt_structure(value, context)
                    for key, value in data.items()
                }
        elif isinstance(data, list):
            return [
                ResponseDecryptor._decrypt_structure(item, context)
                for item in data
            ]
        else:
            return data

# Export encryption components
__all__ = [
    'response_encryptor',
    'encrypt_response',
    'encrypt_sensitive_data',
    'encrypt_pii_data',
    'encrypt_financial_data',
    'encrypt_admin_data',
    'EncryptionMiddleware',
    'ResponseDecryptor',
    'EncryptionLevel',
    'EncryptionPolicy',
    'EncryptionConfig'
] 