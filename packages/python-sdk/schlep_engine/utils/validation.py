"""
Input validation and sanitization utilities for Schlep-engine SDK
"""

import re
import html
from typing import Any, Dict, Optional, Union, List, Tuple
from pathlib import Path
from urllib.parse import urlparse

from ..exceptions.base import ValidationError


class InputValidator:
    """
    Comprehensive input validation and sanitization for API parameters.
    """
    
    # Regular expressions for validation
    EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_-]{3,30}$')
    API_KEY_REGEX = re.compile(r'^[a-zA-Z0-9_-]{20,128}$')
    UUID_REGEX = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    
    # File type validations
    ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'}
    ALLOWED_DOCUMENT_EXTENSIONS = {'.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'}
    ALLOWED_DATA_EXTENSIONS = {'.csv', '.json', '.xml', '.xlsx', '.xls'}
    
    # Size limits (in bytes)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    MAX_STRING_LENGTH = 10000
    MAX_LIST_LENGTH = 1000
    
    @staticmethod
    def sanitize_string(value: Any, max_length: Optional[int] = None) -> str:
        """
        Sanitize string input by removing dangerous characters and limiting length.
        
        Args:
            value: Input value to sanitize
            max_length: Maximum allowed length (default: MAX_STRING_LENGTH)
            
        Returns:
            Sanitized string
            
        Raises:
            ValidationError: If input is invalid
        """
        if value is None:
            return ""
        
        if not isinstance(value, (str, int, float)):
            raise ValidationError(f"Expected string-like value, got {type(value).__name__}")
        
        # Convert to string
        sanitized = str(value).strip()
        
        # HTML escape to prevent injection
        sanitized = html.escape(sanitized)
        
        # Remove null bytes and control characters (except newlines and tabs)
        sanitized = ''.join(char for char in sanitized 
                          if ord(char) >= 32 or char in '\n\t')
        
        # Check length
        max_len = max_length or InputValidator.MAX_STRING_LENGTH
        if len(sanitized) > max_len:
            raise ValidationError(f"String exceeds maximum length of {max_len} characters")
        
        return sanitized
    
    @staticmethod
    def validate_email(email: str) -> str:
        """
        Validate and sanitize email address.
        
        Args:
            email: Email address to validate
            
        Returns:
            Validated email address
            
        Raises:
            ValidationError: If email is invalid
        """
        if not email:
            raise ValidationError("Email address cannot be empty")
        
        email = InputValidator.sanitize_string(email, 254).lower()
        
        if not InputValidator.EMAIL_REGEX.match(email):
            raise ValidationError("Invalid email address format")
        
        return email
    
    @staticmethod
    def validate_username(username: str) -> str:
        """
        Validate username format.
        
        Args:
            username: Username to validate
            
        Returns:
            Validated username
            
        Raises:
            ValidationError: If username is invalid
        """
        if not username:
            raise ValidationError("Username cannot be empty")
        
        username = InputValidator.sanitize_string(username, 30)
        
        if not InputValidator.USERNAME_REGEX.match(username):
            raise ValidationError(
                "Username must be 3-30 characters and contain only letters, numbers, hyphens, and underscores"
            )
        
        return username
    
    @staticmethod
    def validate_api_key(api_key: str) -> str:
        """
        Validate API key format.
        
        Args:
            api_key: API key to validate
            
        Returns:
            Validated API key
            
        Raises:
            ValidationError: If API key is invalid
        """
        if not api_key:
            raise ValidationError("API key cannot be empty")
        
        # Don't sanitize API keys, just validate format
        if not InputValidator.API_KEY_REGEX.match(api_key):
            raise ValidationError("Invalid API key format")
        
        return api_key
    
    @staticmethod
    def validate_uuid(uuid_str: str) -> str:
        """
        Validate UUID format.
        
        Args:
            uuid_str: UUID string to validate
            
        Returns:
            Validated UUID string
            
        Raises:
            ValidationError: If UUID is invalid
        """
        if not uuid_str:
            raise ValidationError("UUID cannot be empty")
        
        uuid_str = uuid_str.strip().lower()
        
        if not InputValidator.UUID_REGEX.match(uuid_str):
            raise ValidationError("Invalid UUID format")
        
        return uuid_str
    
    @staticmethod
    def validate_url(url: str) -> str:
        """
        Validate URL format and scheme.
        
        Args:
            url: URL to validate
            
        Returns:
            Validated URL
            
        Raises:
            ValidationError: If URL is invalid
        """
        if not url:
            raise ValidationError("URL cannot be empty")
        
        url = InputValidator.sanitize_string(url, 2048)
        
        try:
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                raise ValidationError("Invalid URL format")
            
            if parsed.scheme not in ('http', 'https'):
                raise ValidationError("Only HTTP and HTTPS URLs are allowed")
            
        except Exception as e:
            raise ValidationError(f"Invalid URL: {str(e)}")
        
        return url
    
    @staticmethod
    def validate_file_upload(file_path: Union[str, Path], 
                           allowed_extensions: Optional[set] = None,
                           max_size: Optional[int] = None) -> Path:
        """
        Validate file for upload.
        
        Args:
            file_path: Path to file
            allowed_extensions: Set of allowed file extensions
            max_size: Maximum file size in bytes
            
        Returns:
            Validated Path object
            
        Raises:
            ValidationError: If file is invalid
        """
        if not file_path:
            raise ValidationError("File path cannot be empty")
        
        path = Path(file_path)
        
        # Check if file exists
        if not path.exists():
            raise ValidationError(f"File does not exist: {file_path}")
        
        if not path.is_file():
            raise ValidationError(f"Path is not a file: {file_path}")
        
        # Check file size
        max_file_size = max_size or InputValidator.MAX_FILE_SIZE
        file_size = path.stat().st_size
        if file_size > max_file_size:
            raise ValidationError(
                f"File size ({file_size} bytes) exceeds maximum allowed size ({max_file_size} bytes)"
            )
        
        # Check file extension
        if allowed_extensions:
            extension = path.suffix.lower()
            if extension not in allowed_extensions:
                raise ValidationError(
                    f"File extension '{extension}' not allowed. "
                    f"Allowed extensions: {', '.join(sorted(allowed_extensions))}"
                )
        
        return path
    
    @staticmethod
    def validate_pagination_params(page: Optional[int] = None, 
                                 page_size: Optional[int] = None) -> Tuple[int, int]:
        """
        Validate pagination parameters.
        
        Args:
            page: Page number (1-based)
            page_size: Number of items per page
            
        Returns:
            Tuple of (validated_page, validated_page_size)
            
        Raises:
            ValidationError: If parameters are invalid
        """
        validated_page = 1
        validated_page_size = 50  # Default
        
        if page is not None:
            if not isinstance(page, int) or page < 1:
                raise ValidationError("Page must be a positive integer starting from 1")
            validated_page = page
        
        if page_size is not None:
            if not isinstance(page_size, int) or page_size < 1 or page_size > 1000:
                raise ValidationError("Page size must be between 1 and 1000")
            validated_page_size = page_size
        
        return validated_page, validated_page_size
    
    @staticmethod
    def validate_dict_params(params: Dict[str, Any], 
                           required_keys: Optional[List[str]] = None,
                           allowed_keys: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Validate dictionary parameters.
        
        Args:
            params: Parameters dictionary
            required_keys: List of required keys
            allowed_keys: List of allowed keys (if specified, others will be filtered)
            
        Returns:
            Validated and sanitized parameters dictionary
            
        Raises:
            ValidationError: If parameters are invalid
        """
        if not isinstance(params, dict):
            raise ValidationError("Parameters must be a dictionary")
        
        validated_params = {}
        
        # Check required keys
        if required_keys:
            missing_keys = set(required_keys) - set(params.keys())
            if missing_keys:
                raise ValidationError(f"Missing required parameters: {', '.join(missing_keys)}")
        
        # Process parameters
        for key, value in params.items():
            # Filter allowed keys if specified
            if allowed_keys and key not in allowed_keys:
                continue
            
            # Sanitize key
            sanitized_key = InputValidator.sanitize_string(key, 100)
            if not sanitized_key:
                continue
            
            # Sanitize value based on type
            if isinstance(value, str):
                validated_params[sanitized_key] = InputValidator.sanitize_string(value)
            elif isinstance(value, (int, float, bool)):
                validated_params[sanitized_key] = value
            elif isinstance(value, list):
                if len(value) > InputValidator.MAX_LIST_LENGTH:
                    raise ValidationError(f"List exceeds maximum length of {InputValidator.MAX_LIST_LENGTH}")
                validated_params[sanitized_key] = [
                    InputValidator.sanitize_string(item) if isinstance(item, str) else item
                    for item in value
                ]
            elif isinstance(value, dict):
                validated_params[sanitized_key] = InputValidator.validate_dict_params(value)
            elif value is None:
                validated_params[sanitized_key] = None
            else:
                # For other types, convert to string and sanitize
                validated_params[sanitized_key] = InputValidator.sanitize_string(str(value))
        
        return validated_params
    
    @staticmethod
    def validate_json_data(data: Any) -> Any:
        """
        Validate JSON data for API requests.
        
        Args:
            data: JSON data to validate
            
        Returns:
            Validated JSON data
            
        Raises:
            ValidationError: If data is invalid
        """
        if data is None:
            return None
        
        if isinstance(data, dict):
            return InputValidator.validate_dict_params(data)
        elif isinstance(data, list):
            if len(data) > InputValidator.MAX_LIST_LENGTH:
                raise ValidationError(f"List exceeds maximum length of {InputValidator.MAX_LIST_LENGTH}")
            return [InputValidator.validate_json_data(item) for item in data]
        elif isinstance(data, str):
            return InputValidator.sanitize_string(data)
        elif isinstance(data, (int, float, bool)):
            return data
        else:
            raise ValidationError(f"Unsupported JSON data type: {type(data).__name__}")


def validate_file_for_api(file_path: Union[str, Path], 
                         file_type: str = "general") -> Path:
    """
    Convenience function to validate files for different API endpoints.
    
    Args:
        file_path: Path to file
        file_type: Type of file ("image", "document", "data", or "general")
        
    Returns:
        Validated Path object
        
    Raises:
        ValidationError: If file is invalid
    """
    allowed_extensions = None
    
    if file_type == "image":
        allowed_extensions = InputValidator.ALLOWED_IMAGE_EXTENSIONS
    elif file_type == "document":
        allowed_extensions = InputValidator.ALLOWED_DOCUMENT_EXTENSIONS
    elif file_type == "data":
        allowed_extensions = InputValidator.ALLOWED_DATA_EXTENSIONS
    
    return InputValidator.validate_file_upload(file_path, allowed_extensions)