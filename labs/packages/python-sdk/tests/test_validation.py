"""
Tests for input validation utilities
"""

import pytest
from pathlib import Path
from tempfile import NamedTemporaryFile

from schlep_engine.utils.validation import InputValidator, validate_file_for_api
from schlep_engine.exceptions.base import ValidationError


class TestInputValidator:
    """Tests for InputValidator class."""
    
    def test_sanitize_string_valid(self):
        """Test string sanitization with valid input."""
        result = InputValidator.sanitize_string("Hello World")
        assert result == "Hello World"
        
        result = InputValidator.sanitize_string("  Trimmed  ")
        assert result == "Trimmed"
    
    def test_sanitize_string_html_escape(self):
        """Test HTML escaping in string sanitization."""
        result = InputValidator.sanitize_string("<script>alert('xss')</script>")
        assert result == "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
    
    def test_sanitize_string_control_chars(self):
        """Test removal of control characters."""
        result = InputValidator.sanitize_string("Hello\x00\x01World\n\t")
        assert result == "HelloWorld\n\t"
    
    def test_sanitize_string_max_length(self):
        """Test string length validation."""
        long_string = "a" * 1000
        result = InputValidator.sanitize_string(long_string, max_length=100)
        # Should raise validation error
        with pytest.raises(ValidationError, match="exceeds maximum length"):
            InputValidator.sanitize_string(long_string, max_length=100)
    
    def test_sanitize_string_invalid_type(self):
        """Test sanitization with invalid input types."""
        # Should handle numbers
        result = InputValidator.sanitize_string(123)
        assert result == "123"
        
        # Should handle None
        result = InputValidator.sanitize_string(None)
        assert result == ""
        
        # Should raise error for complex types
        with pytest.raises(ValidationError):
            InputValidator.sanitize_string({"key": "value"})
    
    def test_validate_email_valid(self):
        """Test email validation with valid emails."""
        valid_emails = [
            "test@example.com",
            "user.name+tag@domain.co.uk",
            "test123@sub.example.org"
        ]
        
        for email in valid_emails:
            result = InputValidator.validate_email(email)
            assert result == email.lower()
    
    def test_validate_email_invalid(self):
        """Test email validation with invalid emails."""
        invalid_emails = [
            "",
            "invalid",
            "@example.com",
            "test@",
            "test..test@example.com",
            "test@example",
            "a" * 250 + "@example.com"  # Too long
        ]
        
        for email in invalid_emails:
            with pytest.raises(ValidationError):
                InputValidator.validate_email(email)
    
    def test_validate_username_valid(self):
        """Test username validation with valid usernames."""
        valid_usernames = ["user", "user123", "user_name", "user-name", "abc"]
        
        for username in valid_usernames:
            result = InputValidator.validate_username(username)
            assert result == username
    
    def test_validate_username_invalid(self):
        """Test username validation with invalid usernames."""
        invalid_usernames = [
            "",
            "ab",  # Too short
            "a" * 31,  # Too long
            "user name",  # Space
            "user@name",  # Special char
            "123",  # Numbers only
            "user.name"  # Dot
        ]
        
        for username in invalid_usernames:
            with pytest.raises(ValidationError):
                InputValidator.validate_username(username)
    
    def test_validate_api_key_valid(self):
        """Test API key validation with valid keys."""
        valid_keys = [
            "a" * 20,  # Minimum length
            "a" * 64,  # Medium length
            "a" * 128,  # Maximum length
            "abc123_-" * 10  # Valid characters
        ]
        
        for key in valid_keys:
            result = InputValidator.validate_api_key(key)
            assert result == key
    
    def test_validate_api_key_invalid(self):
        """Test API key validation with invalid keys."""
        invalid_keys = [
            "",
            "a" * 19,  # Too short
            "a" * 129,  # Too long
            "key with spaces",
            "key@with#special",
            "key.with.dots"
        ]
        
        for key in invalid_keys:
            with pytest.raises(ValidationError):
                InputValidator.validate_api_key(key)
    
    def test_validate_uuid_valid(self):
        """Test UUID validation with valid UUIDs."""
        valid_uuids = [
            "12345678-1234-1234-1234-123456789012",
            "ABCDEF12-3456-7890-ABCD-EF1234567890",
            "abcdef12-3456-7890-abcd-ef1234567890"
        ]
        
        for uuid_str in valid_uuids:
            result = InputValidator.validate_uuid(uuid_str)
            assert result == uuid_str.lower()
    
    def test_validate_uuid_invalid(self):
        """Test UUID validation with invalid UUIDs."""
        invalid_uuids = [
            "",
            "12345678-1234-1234-1234-12345678901",  # Too short
            "12345678-1234-1234-1234-1234567890123",  # Too long
            "12345678-1234-1234-123-123456789012",  # Wrong format
            "ggggggg-1234-1234-1234-123456789012"  # Invalid chars
        ]
        
        for uuid_str in invalid_uuids:
            with pytest.raises(ValidationError):
                InputValidator.validate_uuid(uuid_str)
    
    def test_validate_url_valid(self):
        """Test URL validation with valid URLs."""
        valid_urls = [
            "http://example.com",
            "https://sub.example.com/path",
            "https://example.com:8080/api/v1",
            "http://localhost:3000"
        ]
        
        for url in valid_urls:
            result = InputValidator.validate_url(url)
            assert result == url
    
    def test_validate_url_invalid(self):
        """Test URL validation with invalid URLs."""
        invalid_urls = [
            "",
            "not-a-url",
            "ftp://example.com",  # Wrong scheme
            "example.com",  # No scheme
            "http://",  # No netloc
            "a" * 3000  # Too long
        ]
        
        for url in invalid_urls:
            with pytest.raises(ValidationError):
                InputValidator.validate_url(url)
    
    def test_validate_file_upload_valid(self):
        """Test file upload validation with valid files."""
        with NamedTemporaryFile(suffix='.txt') as temp_file:
            temp_file.write(b"test content")
            temp_file.flush()
            
            result = InputValidator.validate_file_upload(temp_file.name)
            assert isinstance(result, Path)
            assert result.exists()
    
    def test_validate_file_upload_nonexistent(self):
        """Test file upload validation with non-existent file."""
        with pytest.raises(ValidationError, match="does not exist"):
            InputValidator.validate_file_upload("/path/to/nonexistent/file.txt")
    
    def test_validate_file_upload_wrong_extension(self):
        """Test file upload validation with wrong extension."""
        with NamedTemporaryFile(suffix='.exe') as temp_file:
            temp_file.write(b"test content")
            temp_file.flush()
            
            allowed_extensions = {'.txt', '.pdf'}
            with pytest.raises(ValidationError, match="not allowed"):
                InputValidator.validate_file_upload(
                    temp_file.name, 
                    allowed_extensions=allowed_extensions
                )
    
    def test_validate_pagination_params_valid(self):
        """Test pagination parameter validation with valid inputs."""
        page, page_size = InputValidator.validate_pagination_params()
        assert page == 1
        assert page_size == 50
        
        page, page_size = InputValidator.validate_pagination_params(2, 25)
        assert page == 2
        assert page_size == 25
    
    def test_validate_pagination_params_invalid(self):
        """Test pagination parameter validation with invalid inputs."""
        with pytest.raises(ValidationError, match="positive integer"):
            InputValidator.validate_pagination_params(0)
        
        with pytest.raises(ValidationError, match="positive integer"):
            InputValidator.validate_pagination_params(-1)
        
        with pytest.raises(ValidationError, match="between 1 and 1000"):
            InputValidator.validate_pagination_params(1, 0)
        
        with pytest.raises(ValidationError, match="between 1 and 1000"):
            InputValidator.validate_pagination_params(1, 1001)
    
    def test_validate_dict_params_basic(self):
        """Test basic dictionary parameter validation."""
        params = {
            "name": "John Doe",
            "age": 30,
            "active": True,
            "tags": ["tag1", "tag2"],
            "metadata": {"key": "value"}
        }
        
        result = InputValidator.validate_dict_params(params)
        
        assert "name" in result
        assert result["age"] == 30
        assert result["active"] is True
        assert isinstance(result["tags"], list)
        assert isinstance(result["metadata"], dict)
    
    def test_validate_dict_params_required_keys(self):
        """Test dictionary validation with required keys."""
        params = {"name": "John"}
        
        # Should succeed with required key present
        result = InputValidator.validate_dict_params(params, required_keys=["name"])
        assert "name" in result
        
        # Should fail with missing required key
        with pytest.raises(ValidationError, match="Missing required parameters"):
            InputValidator.validate_dict_params(params, required_keys=["name", "email"])
    
    def test_validate_dict_params_allowed_keys(self):
        """Test dictionary validation with allowed keys filter."""
        params = {
            "name": "John",
            "age": 30,
            "secret": "hidden"
        }
        
        result = InputValidator.validate_dict_params(
            params, 
            allowed_keys=["name", "age"]
        )
        
        assert "name" in result
        assert "age" in result
        assert "secret" not in result
    
    def test_validate_json_data_various_types(self):
        """Test JSON data validation with various types."""
        # String
        result = InputValidator.validate_json_data("test string")
        assert isinstance(result, str)
        
        # Number
        result = InputValidator.validate_json_data(42)
        assert result == 42
        
        # Boolean
        result = InputValidator.validate_json_data(True)
        assert result is True
        
        # None
        result = InputValidator.validate_json_data(None)
        assert result is None
        
        # List
        result = InputValidator.validate_json_data(["a", "b", "c"])
        assert isinstance(result, list)
        
        # Dict
        result = InputValidator.validate_json_data({"key": "value"})
        assert isinstance(result, dict)
    
    def test_validate_json_data_invalid_type(self):
        """Test JSON data validation with invalid types."""
        with pytest.raises(ValidationError, match="Unsupported JSON data type"):
            InputValidator.validate_json_data(set([1, 2, 3]))


class TestFileValidation:
    """Tests for file validation helper functions."""
    
    def test_validate_file_for_api_image(self):
        """Test file validation for image type."""
        with NamedTemporaryFile(suffix='.jpg') as temp_file:
            temp_file.write(b"fake image data")
            temp_file.flush()
            
            result = validate_file_for_api(temp_file.name, "image")
            assert isinstance(result, Path)
    
    def test_validate_file_for_api_document(self):
        """Test file validation for document type."""
        with NamedTemporaryFile(suffix='.pdf') as temp_file:
            temp_file.write(b"fake PDF data")
            temp_file.flush()
            
            result = validate_file_for_api(temp_file.name, "document")
            assert isinstance(result, Path)
    
    def test_validate_file_for_api_data(self):
        """Test file validation for data type."""
        with NamedTemporaryFile(suffix='.csv') as temp_file:
            temp_file.write(b"col1,col2\nval1,val2")
            temp_file.flush()
            
            result = validate_file_for_api(temp_file.name, "data")
            assert isinstance(result, Path)
    
    def test_validate_file_for_api_general(self):
        """Test file validation for general type."""
        with NamedTemporaryFile(suffix='.txt') as temp_file:
            temp_file.write(b"test content")
            temp_file.flush()
            
            result = validate_file_for_api(temp_file.name, "general")
            assert isinstance(result, Path)
    
    def test_validate_file_for_api_wrong_type(self):
        """Test file validation with wrong file type."""
        with NamedTemporaryFile(suffix='.exe') as temp_file:
            temp_file.write(b"executable content")
            temp_file.flush()
            
            with pytest.raises(ValidationError, match="not allowed"):
                validate_file_for_api(temp_file.name, "image")