"""
Advanced Input Sanitization System
==================================

Production-ready input sanitization with comprehensive validation,
encoding, and threat detection capabilities.
"""

import re
import html
import urllib.parse
import logging
from typing import Any, Dict, List, Optional, Union, Callable
from dataclasses import dataclass
from enum import Enum
import unicodedata

logger = logging.getLogger(__name__)

class SanitizationLevel(Enum):
    """Sanitization levels"""
    BASIC = "basic"
    STRICT = "strict"
    PARANOID = "paranoid"

class InputType(Enum):
    """Input data types"""
    EMAIL = "email"
    URL = "url"
    FILENAME = "filename"
    USERNAME = "username"
    PASSWORD = "password"
    TEXT = "text"
    HTML = "html"
    JSON = "json"
    SQL = "sql"
    NUMERIC = "numeric"
    PHONE = "phone"

@dataclass
class SanitizationResult:
    """Result of input sanitization"""
    sanitized_value: Any
    original_value: Any
    is_safe: bool
    threats_detected: List[str]
    modifications_made: List[str]
    validation_errors: List[str]

class AdvancedInputSanitizer:
    """Advanced input sanitization with threat detection"""
    
    def __init__(self):
        # Dangerous patterns for different attack types
        self.sql_injection_patterns = [
            r"(\bunion\b.*\bselect\b)",
            r"(\bselect\b.*\bfrom\b)",
            r"(\binsert\b.*\binto\b)",
            r"(\bdelete\b.*\bfrom\b)",
            r"(\bdrop\b.*\btable\b)",
            r"(\bupdate\b.*\bset\b)",
            r"(--|\#|\/\*|\*\/)",
            r"(\bexec\b|\bexecute\b)",
            r"(\bsp_\w+)",
            r"(\bxp_\w+)",
            r"(\bor\b.*\b1\s*=\s*1\b)",
            r"(\band\b.*\b1\s*=\s*1\b)",
        ]
        
        self.xss_patterns = [
            r"<script[^>]*>.*?</script>",
            r"javascript:",
            r"vbscript:",
            r"data:text/html",
            r"onload\s*=",
            r"onerror\s*=",
            r"onclick\s*=",
            r"onmouseover\s*=",
            r"onmouseout\s*=",
            r"onfocus\s*=",
            r"onblur\s*=",
            r"<iframe[^>]*>",
            r"<object[^>]*>",
            r"<embed[^>]*>",
            r"<form[^>]*>",
            r"<input[^>]*>",
        ]
        
        self.command_injection_patterns = [
            r"(\;|\||&|\$\(|\`)",
            r"(nc|netcat|wget|curl)(\s|$)",
            r"(chmod|chown|rm|kill)(\s|$)",
            r"(/bin/|/usr/bin/|/sbin/)",
            r"(sudo|su)(\s|$)",
            r"(\$\{.*\})",
            r"(\$\(.*\))",
            r"(`.*`)",
        ]
        
        self.path_traversal_patterns = [
            r"\.\.\/",
            r"\.\.\%2f",
            r"\.\.\%5c",
            r"%2e%2e%2f",
            r"%2e%2e%5c",
            r"\.\.\\",
        ]
        
        # Allowed characters for different input types
        self.allowed_chars = {
            InputType.USERNAME: r'^[a-zA-Z0-9._-]+$',
            InputType.EMAIL: r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
            InputType.FILENAME: r'^[a-zA-Z0-9._-]+\.[a-zA-Z0-9]+$',
            InputType.NUMERIC: r'^[0-9.+-]+$',
            InputType.PHONE: r'^[\+]?[0-9\s\-\(\)]+$',
        }
        
        # Maximum lengths for different input types
        self.max_lengths = {
            InputType.USERNAME: 50,
            InputType.EMAIL: 254,
            InputType.FILENAME: 255,
            InputType.TEXT: 10000,
            InputType.URL: 2048,
            InputType.PASSWORD: 128,
            InputType.PHONE: 20,
        }
    
    def sanitize_input(
        self,
        value: Any,
        input_type: InputType = InputType.TEXT,
        level: SanitizationLevel = SanitizationLevel.STRICT,
        custom_rules: Optional[List[Callable]] = None
    ) -> SanitizationResult:
        """Comprehensive input sanitization"""
        
        if value is None:
            return SanitizationResult(
                sanitized_value=None,
                original_value=None,
                is_safe=True,
                threats_detected=[],
                modifications_made=[],
                validation_errors=[]
            )
        
        original_value = value
        sanitized_value = value
        threats_detected = []
        modifications_made = []
        validation_errors = []
        
        try:
            # Convert to string for processing
            if not isinstance(sanitized_value, str):
                sanitized_value = str(sanitized_value)
                modifications_made.append("converted_to_string")
            
            # Unicode normalization
            sanitized_value = unicodedata.normalize('NFKC', sanitized_value)
            if sanitized_value != str(original_value):
                modifications_made.append("unicode_normalized")
            
            # Length validation
            max_length = self.max_lengths.get(input_type, 10000)
            if len(sanitized_value) > max_length:
                sanitized_value = sanitized_value[:max_length]
                modifications_made.append(f"truncated_to_{max_length}")
            
            # Threat detection
            threats = self._detect_threats(sanitized_value)
            threats_detected.extend(threats)
            
            # Type-specific sanitization
            sanitized_value = self._sanitize_by_type(sanitized_value, input_type, level)
            
            # Level-specific sanitization
            if level == SanitizationLevel.PARANOID:
                sanitized_value = self._paranoid_sanitization(sanitized_value)
            elif level == SanitizationLevel.STRICT:
                sanitized_value = self._strict_sanitization(sanitized_value)
            else:  # BASIC
                sanitized_value = self._basic_sanitization(sanitized_value)
            
            # Custom rules
            if custom_rules:
                for rule in custom_rules:
                    try:
                        sanitized_value = rule(sanitized_value)
                        modifications_made.append(f"custom_rule_{rule.__name__}")
                    except Exception as e:
                        logger.warning(f"Custom sanitization rule failed: {e}")
            
            # Final validation
            validation_result = self._validate_sanitized_input(sanitized_value, input_type)
            validation_errors.extend(validation_result)
            
            # Determine if input is safe
            is_safe = len(threats_detected) == 0 and len(validation_errors) == 0
            
            # Track modifications
            if sanitized_value != str(original_value):
                modifications_made.append("content_modified")
            
            return SanitizationResult(
                sanitized_value=sanitized_value,
                original_value=original_value,
                is_safe=is_safe,
                threats_detected=threats_detected,
                modifications_made=modifications_made,
                validation_errors=validation_errors
            )
            
        except Exception as e:
            logger.error(f"Sanitization error: {e}")
            return SanitizationResult(
                sanitized_value="",
                original_value=original_value,
                is_safe=False,
                threats_detected=["sanitization_error"],
                modifications_made=["error_occurred"],
                validation_errors=[f"Sanitization failed: {str(e)}"]
            )
    
    def _detect_threats(self, value: str) -> List[str]:
        """Detect security threats in input"""
        threats = []
        value_lower = value.lower()
        
        # SQL Injection detection
        for pattern in self.sql_injection_patterns:
            if re.search(pattern, value_lower, re.IGNORECASE | re.DOTALL):
                threats.append("sql_injection")
                break
        
        # XSS detection
        for pattern in self.xss_patterns:
            if re.search(pattern, value_lower, re.IGNORECASE | re.DOTALL):
                threats.append("xss")
                break
        
        # Command injection detection
        for pattern in self.command_injection_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                threats.append("command_injection")
                break
        
        # Path traversal detection
        for pattern in self.path_traversal_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                threats.append("path_traversal")
                break
        
        # LDAP injection detection
        ldap_chars = ['(', ')', '*', '\\', '/', '\x00']
        if any(char in value for char in ldap_chars):
            threats.append("ldap_injection")
        
        # NoSQL injection detection
        nosql_patterns = [r'\$where', r'\$ne', r'\$gt', r'\$lt', r'\$regex']
        for pattern in nosql_patterns:
            if re.search(pattern, value_lower):
                threats.append("nosql_injection")
                break
        
        return threats
    
    def _sanitize_by_type(self, value: str, input_type: InputType, level: SanitizationLevel) -> str:
        """Type-specific sanitization"""
        
        if input_type == InputType.EMAIL:
            return self._sanitize_email(value)
        elif input_type == InputType.URL:
            return self._sanitize_url(value)
        elif input_type == InputType.FILENAME:
            return self._sanitize_filename(value)
        elif input_type == InputType.USERNAME:
            return self._sanitize_username(value)
        elif input_type == InputType.HTML:
            return self._sanitize_html(value, level)
        elif input_type == InputType.JSON:
            return self._sanitize_json(value)
        elif input_type == InputType.NUMERIC:
            return self._sanitize_numeric(value)
        elif input_type == InputType.PHONE:
            return self._sanitize_phone(value)
        else:  # TEXT
            return self._sanitize_text(value, level)
    
    def _sanitize_email(self, value: str) -> str:
        """Sanitize email address"""
        # Remove dangerous characters
        value = re.sub(r'[<>"\'\x00-\x1f\x7f-\x9f]', '', value)
        
        # Basic email format validation
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value):
            return ""  # Return empty if invalid format
        
        return value.lower().strip()
    
    def _sanitize_url(self, value: str) -> str:
        """Sanitize URL"""
        # Remove dangerous characters
        value = re.sub(r'[<>"\'`\x00-\x1f\x7f-\x9f]', '', value)
        
        # Only allow safe protocols
        if not value.startswith(('http://', 'https://', 'ftp://', 'mailto:')):
            return ""
        
        try:
            # Parse and reconstruct URL to normalize it
            parsed = urllib.parse.urlparse(value)
            return urllib.parse.urlunparse(parsed)
        except:
            return ""
    
    def _sanitize_filename(self, value: str) -> str:
        """Sanitize filename"""
        # Remove path separators and dangerous characters
        value = re.sub(r'[<>:"/\\|?*\x00-\x1f\x7f-\x9f]', '', value)
        
        # Remove leading/trailing dots and spaces
        value = value.strip('. ')
        
        # Ensure filename is not empty and has valid extension
        if not value or '.' not in value:
            return "sanitized_file.txt"
        
        return value
    
    def _sanitize_username(self, value: str) -> str:
        """Sanitize username"""
        # Only allow alphanumeric, dots, underscores, and hyphens
        value = re.sub(r'[^a-zA-Z0-9._-]', '', value)
        
        # Remove leading/trailing dots and hyphens
        value = value.strip('.-')
        
        return value
    
    def _sanitize_html(self, value: str, level: SanitizationLevel) -> str:
        """Sanitize HTML content"""
        if level == SanitizationLevel.PARANOID:
            # Strip all HTML tags
            value = re.sub(r'<[^>]*>', '', value)
        else:
            # HTML encode dangerous characters
            value = html.escape(value, quote=True)
        
        return value
    
    def _sanitize_json(self, value: str) -> str:
        """Sanitize JSON string"""
        import json
        
        try:
            # Parse and re-serialize to ensure valid JSON
            parsed = json.loads(value)
            return json.dumps(parsed)
        except:
            # If invalid JSON, escape as string
            return json.dumps(value)
    
    def _sanitize_numeric(self, value: str) -> str:
        """Sanitize numeric input"""
        # Only allow digits, decimal point, plus/minus
        value = re.sub(r'[^0-9.+-]', '', value)
        
        # Ensure valid number format
        try:
            float(value)
            return value
        except ValueError:
            return "0"
    
    def _sanitize_phone(self, value: str) -> str:
        """Sanitize phone number"""
        # Only allow digits, spaces, hyphens, parentheses, and plus
        value = re.sub(r'[^0-9\s\-\(\)\+]', '', value)
        return value.strip()
    
    def _sanitize_text(self, value: str, level: SanitizationLevel) -> str:
        """Sanitize general text"""
        if level == SanitizationLevel.PARANOID:
            # Remove all non-printable characters
            value = ''.join(char for char in value if char.isprintable())
            # Remove dangerous characters
            value = re.sub(r'[<>"\'\x00-\x1f\x7f-\x9f]', '', value)
        
        return value.strip()
    
    def _basic_sanitization(self, value: str) -> str:
        """Basic sanitization level"""
        # Remove null bytes and control characters
        value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', value)
        return value
    
    def _strict_sanitization(self, value: str) -> str:
        """Strict sanitization level"""
        value = self._basic_sanitization(value)
        
        # HTML encode dangerous characters
        dangerous_chars = {'<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;'}
        for char, encoded in dangerous_chars.items():
            value = value.replace(char, encoded)
        
        return value
    
    def _paranoid_sanitization(self, value: str) -> str:
        """Paranoid sanitization level"""
        value = self._strict_sanitization(value)
        
        # Remove/encode additional dangerous characters
        additional_dangerous = {'(': '&#40;', ')': '&#41;', '[': '&#91;', ']': '&#93;', 
                               '{': '&#123;', '}': '&#125;', '`': '&#96;', '$': '&#36;'}
        for char, encoded in additional_dangerous.items():
            value = value.replace(char, encoded)
        
        return value
    
    def _validate_sanitized_input(self, value: str, input_type: InputType) -> List[str]:
        """Validate sanitized input against type requirements"""
        errors = []
        
        if input_type in self.allowed_chars:
            pattern = self.allowed_chars[input_type]
            if not re.match(pattern, value):
                errors.append(f"Input doesn't match required pattern for {input_type.value}")
        
        return errors
    
    def sanitize_dict(self, data: Dict[str, Any], 
                     field_types: Optional[Dict[str, InputType]] = None,
                     level: SanitizationLevel = SanitizationLevel.STRICT) -> Dict[str, Any]:
        """Sanitize all values in a dictionary"""
        sanitized = {}
        
        for key, value in data.items():
            input_type = field_types.get(key, InputType.TEXT) if field_types else InputType.TEXT
            
            if isinstance(value, dict):
                sanitized[key] = self.sanitize_dict(value, field_types, level)
            elif isinstance(value, list):
                sanitized[key] = [
                    self.sanitize_input(item, input_type, level).sanitized_value 
                    for item in value
                ]
            else:
                result = self.sanitize_input(value, input_type, level)
                sanitized[key] = result.sanitized_value
                
                # Log threats if detected
                if result.threats_detected:
                    logger.warning(f"Threats detected in field '{key}': {result.threats_detected}")
        
        return sanitized

# Global sanitizer instance
input_sanitizer = AdvancedInputSanitizer()

def get_input_sanitizer() -> AdvancedInputSanitizer:
    """Get the global input sanitizer"""
    return input_sanitizer

def sanitize_input(value: Any, input_type: InputType = InputType.TEXT, 
                  level: SanitizationLevel = SanitizationLevel.STRICT) -> SanitizationResult:
    """Convenience function for input sanitization"""
    return input_sanitizer.sanitize_input(value, input_type, level)

def require_safe_input(value: Any, input_type: InputType = InputType.TEXT) -> Any:
    """FastAPI dependency to require safe input"""
    result = sanitize_input(value, input_type, SanitizationLevel.STRICT)
    
    if not result.is_safe:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Input validation failed: {'; '.join(result.threats_detected + result.validation_errors)}"
        )
    
    return result.sanitized_value