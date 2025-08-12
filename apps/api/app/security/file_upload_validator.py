"""
Secure File Upload Validation System
====================================

Production-ready file upload security with comprehensive validation, content scanning,
and malware detection capabilities.
"""

import os
import magic
import hashlib
import tempfile
import logging
from datetime import datetime
from typing import Dict, List, Set, Optional, Tuple, Any
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import mimetypes
import re

from fastapi import UploadFile, HTTPException, status

logger = logging.getLogger(__name__)

class ThreatLevel(Enum):
    """File threat levels"""
    SAFE = "safe"
    SUSPICIOUS = "suspicious"
    DANGEROUS = "dangerous"
    BLOCKED = "blocked"

class ValidationResult(Enum):
    """Validation result status"""
    ALLOWED = "allowed"
    REJECTED = "rejected"
    QUARANTINED = "quarantined"

@dataclass
class FileValidationResult:
    """File validation result with detailed information"""
    status: ValidationResult
    threat_level: ThreatLevel
    file_type: str
    mime_type: str
    size_bytes: int
    hash_sha256: str
    warnings: List[str]
    errors: List[str]
    metadata: Dict[str, Any]

class SecureFileUploadValidator:
    """Comprehensive file upload security validator"""
    
    def __init__(self):
        # Maximum file sizes by type (in bytes)
        self.max_file_sizes = {
            'text/csv': 500 * 1024 * 1024,      # 500MB for CSV
            'application/json': 100 * 1024 * 1024,  # 100MB for JSON
            'application/vnd.ms-excel': 100 * 1024 * 1024,  # 100MB for Excel
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 100 * 1024 * 1024,
            'text/plain': 50 * 1024 * 1024,     # 50MB for plain text
            'application/pdf': 50 * 1024 * 1024,  # 50MB for PDF
            'default': 10 * 1024 * 1024          # 10MB default
        }
        
        # Allowed MIME types with security considerations
        self.allowed_mime_types = {
            # Data files
            'text/csv': {'extensions': ['.csv'], 'risk': 'low'},
            'application/json': {'extensions': ['.json'], 'risk': 'medium'},
            'text/plain': {'extensions': ['.txt', '.tsv'], 'risk': 'low'},
            
            # Excel files
            'application/vnd.ms-excel': {'extensions': ['.xls'], 'risk': 'high'},
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                'extensions': ['.xlsx'], 'risk': 'high'
            },
            
            # Documents
            'application/pdf': {'extensions': ['.pdf'], 'risk': 'medium'},
            
            # Compressed data
            'application/x-parquet': {'extensions': ['.parquet'], 'risk': 'low'},
        }
        
        # Dangerous file patterns and signatures
        self.dangerous_patterns = [
            # Executable file signatures
            b'MZ',  # Windows PE
            b'\x7fELF',  # Linux ELF
            b'\xca\xfe\xba\xbe',  # Java class
            b'PK\x03\x04',  # ZIP (could contain executables)
            
            # Script patterns in text files
            rb'<script[^>]*>',
            rb'javascript:',
            rb'vbscript:',
            rb'data:text/html',
            rb'<?php',
            rb'#!/bin/',
            rb'PowerShell',
            rb'cmd\.exe',
        ]
        
        # Suspicious filename patterns
        self.suspicious_filename_patterns = [
            r'\.exe$',
            r'\.bat$',
            r'\.cmd$',
            r'\.ps1$',
            r'\.vbs$',
            r'\.js$',
            r'\.jar$',
            r'\.com$',
            r'\.scr$',
            r'\.dll$',
            r'\.so$',
            r'\.dylib$',
            r'\.(php|asp|jsp)$',
        ]
        
        # Content validation patterns for CSV
        self.csv_malicious_patterns = [
            rb'=cmd\|',
            rb'=system\(',
            rb'@SUM\(',
            rb'=HYPERLINK\(',
            rb'=IMPORTDATA\(',
            rb'=IMPORTFEED\(',
            rb'=IMPORTHTML\(',
            rb'=IMPORTRANGE\(',
            rb'=IMPORTXML\(',
        ]
    
    async def validate_file(self, file: UploadFile) -> FileValidationResult:
        """Comprehensive file validation"""
        warnings = []
        errors = []
        metadata = {}
        
        try:
            # Read file content for analysis
            content = await file.read()
            await file.seek(0)  # Reset file pointer
            
            # Basic validations
            file_size = len(content)
            if file_size == 0:
                errors.append("File is empty")
                return FileValidationResult(
                    status=ValidationResult.REJECTED,
                    threat_level=ThreatLevel.BLOCKED,
                    file_type="unknown",
                    mime_type="unknown",
                    size_bytes=0,
                    hash_sha256="",
                    warnings=warnings,
                    errors=errors,
                    metadata=metadata
                )
            
            # Calculate file hash
            file_hash = hashlib.sha256(content).hexdigest()
            
            # Detect actual file type using magic numbers
            detected_mime = magic.from_buffer(content, mime=True)
            
            # Validate filename and extension
            filename_validation = self._validate_filename(file.filename)
            if filename_validation['errors']:
                errors.extend(filename_validation['errors'])
            warnings.extend(filename_validation['warnings'])
            
            # Validate file size
            size_validation = self._validate_file_size(file_size, detected_mime)
            if size_validation['error']:
                errors.append(size_validation['error'])
            
            # Validate MIME type
            mime_validation = self._validate_mime_type(detected_mime, file.filename)
            if mime_validation['error']:
                errors.append(mime_validation['error'])
            warnings.extend(mime_validation['warnings'])
            
            # Content-based security scanning
            content_scan = await self._scan_file_content(content, detected_mime)
            errors.extend(content_scan['errors'])
            warnings.extend(content_scan['warnings'])
            
            # Determine threat level and final status
            threat_level = self._assess_threat_level(errors, warnings, detected_mime)
            status = self._determine_final_status(threat_level, errors)
            
            metadata.update({
                'original_filename': file.filename,
                'detected_mime': detected_mime,
                'declared_mime': file.content_type,
                'file_extension': Path(file.filename).suffix.lower() if file.filename else '',
                'scan_timestamp': datetime.utcnow().isoformat(),
                'validation_version': '2.0'
            })
            
            return FileValidationResult(
                status=status,
                threat_level=threat_level,
                file_type=detected_mime,
                mime_type=detected_mime,
                size_bytes=file_size,
                hash_sha256=file_hash,
                warnings=warnings,
                errors=errors,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"File validation error: {e}")
            return FileValidationResult(
                status=ValidationResult.REJECTED,
                threat_level=ThreatLevel.DANGEROUS,
                file_type="unknown",
                mime_type="unknown",
                size_bytes=0,
                hash_sha256="",
                warnings=[],
                errors=[f"Validation failed: {str(e)}"],
                metadata={}
            )
    
    def _validate_filename(self, filename: Optional[str]) -> Dict[str, List[str]]:
        """Validate filename for security issues"""
        errors = []
        warnings = []
        
        if not filename:
            errors.append("Filename is required")
            return {'errors': errors, 'warnings': warnings}
        
        # Check for path traversal attempts
        if '..' in filename or '/' in filename or '\\' in filename:
            errors.append("Filename contains path traversal characters")
        
        # Check for suspicious filename patterns
        filename_lower = filename.lower()
        for pattern in self.suspicious_filename_patterns:
            if re.search(pattern, filename_lower):
                errors.append(f"Filename matches dangerous pattern: {pattern}")
        
        # Check for hidden files
        if filename.startswith('.'):
            warnings.append("Hidden file detected")
        
        # Check filename length
        if len(filename) > 255:
            errors.append("Filename too long (max 255 characters)")
        
        # Check for non-ASCII characters
        if not filename.isascii():
            warnings.append("Filename contains non-ASCII characters")
        
        return {'errors': errors, 'warnings': warnings}
    
    def _validate_file_size(self, size: int, mime_type: str) -> Dict[str, Optional[str]]:
        """Validate file size against limits"""
        max_size = self.max_file_sizes.get(mime_type, self.max_file_sizes['default'])
        
        if size > max_size:
            return {
                'error': f"File size {size} exceeds maximum allowed size {max_size} for type {mime_type}"
            }
        
        return {'error': None}
    
    def _validate_mime_type(self, detected_mime: str, filename: Optional[str]) -> Dict[str, Any]:
        """Validate MIME type and check for spoofing"""
        errors = []
        warnings = []
        
        # Check if MIME type is allowed
        if detected_mime not in self.allowed_mime_types:
            errors.append(f"File type {detected_mime} is not allowed")
            return {'error': errors[0], 'warnings': warnings}
        
        # Check filename extension matches MIME type
        if filename:
            file_ext = Path(filename).suffix.lower()
            expected_extensions = self.allowed_mime_types[detected_mime]['extensions']
            
            if file_ext not in expected_extensions:
                warnings.append(f"File extension {file_ext} doesn't match detected type {detected_mime}")
        
        # Check risk level
        risk_level = self.allowed_mime_types[detected_mime]['risk']
        if risk_level == 'high':
            warnings.append(f"High-risk file type detected: {detected_mime}")
        elif risk_level == 'medium':
            warnings.append(f"Medium-risk file type detected: {detected_mime}")
        
        return {'error': None, 'warnings': warnings}
    
    async def _scan_file_content(self, content: bytes, mime_type: str) -> Dict[str, List[str]]:
        """Scan file content for malicious patterns"""
        errors = []
        warnings = []
        
        # Check for dangerous file signatures
        for pattern in self.dangerous_patterns:
            if pattern in content:
                errors.append(f"Dangerous file signature detected")
                break
        
        # CSV-specific content validation
        if mime_type == 'text/csv':
            for pattern in self.csv_malicious_patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    errors.append("Potentially malicious CSV formula detected")
                    break
        
        # Check for embedded scripts in text files
        if mime_type.startswith('text/'):
            script_patterns = [rb'<script', rb'javascript:', rb'vbscript:', rb'<?php']
            for pattern in script_patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    warnings.append("Embedded script content detected")
                    break
        
        # Check for excessive null bytes (sign of binary content in text files)
        if mime_type.startswith('text/'):
            null_count = content.count(b'\x00')
            if null_count > len(content) * 0.01:  # More than 1% null bytes
                warnings.append("Excessive null bytes detected in text file")
        
        return {'errors': errors, 'warnings': warnings}
    
    def _assess_threat_level(self, errors: List[str], warnings: List[str], mime_type: str) -> ThreatLevel:
        """Assess overall threat level"""
        if errors:
            return ThreatLevel.BLOCKED
        
        warning_count = len(warnings)
        risk_level = self.allowed_mime_types.get(mime_type, {}).get('risk', 'medium')
        
        if warning_count >= 3 or risk_level == 'high':
            return ThreatLevel.DANGEROUS
        elif warning_count >= 1 or risk_level == 'medium':
            return ThreatLevel.SUSPICIOUS
        else:
            return ThreatLevel.SAFE
    
    def _determine_final_status(self, threat_level: ThreatLevel, errors: List[str]) -> ValidationResult:
        """Determine final validation status"""
        if errors or threat_level == ThreatLevel.BLOCKED:
            return ValidationResult.REJECTED
        elif threat_level == ThreatLevel.DANGEROUS:
            return ValidationResult.QUARANTINED
        else:
            return ValidationResult.ALLOWED

# Global validator instance
file_upload_validator = SecureFileUploadValidator()

def get_file_upload_validator() -> SecureFileUploadValidator:
    """Get the global file upload validator"""
    return file_upload_validator

async def validate_uploaded_file(file: UploadFile) -> FileValidationResult:
    """Convenience function to validate an uploaded file"""
    validator = get_file_upload_validator()
    return await validator.validate_file(file)

def require_safe_file_upload(file: UploadFile) -> FileValidationResult:
    """FastAPI dependency to require safe file uploads"""
    import asyncio
    
    # Run validation
    result = asyncio.run(validate_uploaded_file(file))
    
    # Reject unsafe files
    if result.status == ValidationResult.REJECTED:
        error_details = "; ".join(result.errors)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File upload rejected: {error_details}"
        )
    
    # Warn about quarantined files
    if result.status == ValidationResult.QUARANTINED:
        warning_details = "; ".join(result.warnings)
        logger.warning(f"Quarantined file upload: {warning_details}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File quarantined due to security concerns: {warning_details}"
        )
    
    return result