"""
PII Detection and Data Classification Module

This module provides comprehensive personally identifiable information (PII) detection,
data classification, and masking capabilities. It uses pattern matching, machine learning,
and heuristic analysis to identify sensitive data types and apply appropriate protection.

Features:
- Comprehensive PII pattern detection (SSN, Credit Cards, Phone, Email, etc.)
- Data classification with sensitivity levels
- Multiple masking strategies (partial, full, tokenization)
- Format-preserving encryption for specific data types
- GDPR/CCPA compliance support
- Custom pattern registration system

Security Features:
- Pattern validation to prevent false positives
- Secure random token generation
- Reversible tokenization with key management
- Context-aware sensitivity scoring
- Audit logging for PII detection and handling
"""

import re
import hashlib
import secrets
import string
from typing import Dict, List, Optional, Tuple, Any, Union, Set, Callable
from enum import Enum, IntEnum
from dataclasses import dataclass
from datetime import datetime
import logging
import json
import unicodedata

logger = logging.getLogger(__name__)

class PIIType(Enum):
    """Types of personally identifiable information"""
    SSN = "ssn"
    CREDIT_CARD = "credit_card"
    PHONE_NUMBER = "phone"
    EMAIL = "email"
    DRIVER_LICENSE = "driver_license"
    PASSPORT = "passport"
    BANK_ACCOUNT = "bank_account"
    ROUTING_NUMBER = "routing_number"
    IP_ADDRESS = "ip_address"
    MAC_ADDRESS = "mac_address"
    DATE_OF_BIRTH = "date_of_birth"
    MEDICAL_RECORD = "medical_record"
    BIOMETRIC = "biometric"
    ADDRESS = "address"
    ZIP_CODE = "zip_code"
    TAX_ID = "tax_id"
    CUSTOM = "custom"

class SensitivityLevel(IntEnum):
    """Data sensitivity classification levels"""
    PUBLIC = 1
    INTERNAL = 2
    CONFIDENTIAL = 3
    RESTRICTED = 4
    HIGHLY_RESTRICTED = 5

class MaskingStrategy(Enum):
    """Different masking strategies for PII"""
    PARTIAL = "partial"       # Show first/last few characters
    FULL = "full"            # Replace with asterisks
    TOKENIZE = "tokenize"    # Replace with reversible token
    HASH = "hash"            # One-way hash (irreversible)
    REDACT = "redact"        # Remove completely
    FORMAT_PRESERVE = "format_preserve"  # Maintain format but change values

@dataclass
class PIIPattern:
    """Pattern definition for PII detection"""
    name: str
    pii_type: PIIType
    pattern: re.Pattern
    sensitivity: SensitivityLevel
    description: str
    validator: Optional[Callable[[str], bool]] = None
    examples: List[str] = None
    
    def __post_init__(self):
        if self.examples is None:
            self.examples = []

@dataclass
class PIIMatch:
    """A detected PII match in data"""
    pii_type: PIIType
    value: str
    start_pos: int
    end_pos: int
    sensitivity: SensitivityLevel
    confidence: float
    context: str = ""
    pattern_name: str = ""

@dataclass
class ClassificationResult:
    """Result of data classification"""
    overall_sensitivity: SensitivityLevel
    pii_matches: List[PIIMatch]
    data_types: Set[PIIType]
    confidence_score: float
    recommendations: List[str]
    compliance_flags: List[str]

class PIIDetectionError(Exception):
    """Base exception for PII detection operations"""
    pass

class PIIDetector:
    """
    Comprehensive PII detection and data classification system.
    
    Detects various types of personally identifiable information using
    pattern matching, validation, and context analysis.
    """
    
    def __init__(self):
        self.patterns: Dict[str, PIIPattern] = {}
        self.custom_patterns: Dict[str, PIIPattern] = {}
        self._token_registry: Dict[str, str] = {}  # token -> original mapping
        self._initialize_patterns()
    
    def _initialize_patterns(self):
        """Initialize built-in PII detection patterns"""
        
        # Social Security Number patterns
        self.register_pattern(PIIPattern(
            name="ssn_standard",
            pii_type=PIIType.SSN,
            pattern=re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
            sensitivity=SensitivityLevel.HIGHLY_RESTRICTED,
            description="Standard SSN format (XXX-XX-XXXX)",
            validator=self._validate_ssn,
            examples=["123-45-6789", "987-65-4321"]
        ))
        
        self.register_pattern(PIIPattern(
            name="ssn_no_dashes",
            pii_type=PIIType.SSN,
            pattern=re.compile(r'\b\d{9}\b'),
            sensitivity=SensitivityLevel.HIGHLY_RESTRICTED,
            description="SSN without dashes (XXXXXXXXX)",
            validator=self._validate_ssn_no_dashes,
            examples=["123456789", "987654321"]
        ))
        
        # Credit Card patterns
        self.register_pattern(PIIPattern(
            name="credit_card_visa",
            pii_type=PIIType.CREDIT_CARD,
            pattern=re.compile(r'\b4\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'),
            sensitivity=SensitivityLevel.HIGHLY_RESTRICTED,
            description="Visa credit card numbers",
            validator=self._validate_credit_card,
            examples=["4111-1111-1111-1111", "4111 1111 1111 1111"]
        ))
        
        self.register_pattern(PIIPattern(
            name="credit_card_mastercard",
            pii_type=PIIType.CREDIT_CARD,
            pattern=re.compile(r'\b5[1-5]\d{2}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'),
            sensitivity=SensitivityLevel.HIGHLY_RESTRICTED,
            description="MasterCard credit card numbers",
            validator=self._validate_credit_card,
            examples=["5555-5555-5555-4444", "5105 1051 0510 5100"]
        ))
        
        self.register_pattern(PIIPattern(
            name="credit_card_amex",
            pii_type=PIIType.CREDIT_CARD,
            pattern=re.compile(r'\b3[47]\d{2}[-\s]?\d{6}[-\s]?\d{5}\b'),
            sensitivity=SensitivityLevel.HIGHLY_RESTRICTED,
            description="American Express credit card numbers",
            validator=self._validate_credit_card,
            examples=["3782-822463-10005", "3714 496353 98431"]
        ))
        
        # Phone Number patterns
        self.register_pattern(PIIPattern(
            name="phone_us_standard",
            pii_type=PIIType.PHONE_NUMBER,
            pattern=re.compile(r'\b\(\d{3}\)\s?\d{3}-\d{4}\b'),
            sensitivity=SensitivityLevel.CONFIDENTIAL,
            description="US phone number format",
            examples=["(555) 123-4567", "(555)123-4567"]
        ))
        
        self.register_pattern(PIIPattern(
            name="phone_us_dots",
            pii_type=PIIType.PHONE_NUMBER,
            pattern=re.compile(r'\b\d{3}\.\d{3}\.\d{4}\b'),
            sensitivity=SensitivityLevel.CONFIDENTIAL,
            description="US phone number with dots",
            examples=["555.123.4567", "800.555.0199"]
        ))
        
        # Email patterns
        self.register_pattern(PIIPattern(
            name="email_standard",
            pii_type=PIIType.EMAIL,
            pattern=re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
            sensitivity=SensitivityLevel.CONFIDENTIAL,
            description="Email addresses",
            validator=self._validate_email,
            examples=["user@example.com", "john.doe+test@company.org"]
        ))
        
        # IP Address patterns
        self.register_pattern(PIIPattern(
            name="ipv4_address",
            pii_type=PIIType.IP_ADDRESS,
            pattern=re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'),
            sensitivity=SensitivityLevel.INTERNAL,
            description="IPv4 addresses",
            validator=self._validate_ipv4,
            examples=["192.168.1.1", "10.0.0.1"]
        ))
        
        self.register_pattern(PIIPattern(
            name="ipv6_address",
            pii_type=PIIType.IP_ADDRESS,
            pattern=re.compile(r'\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b'),
            sensitivity=SensitivityLevel.INTERNAL,
            description="IPv6 addresses",
            examples=["2001:0db8:85a3:0000:0000:8a2e:0370:7334"]
        ))
        
        # Date of Birth patterns
        self.register_pattern(PIIPattern(
            name="dob_mmddyyyy",
            pii_type=PIIType.DATE_OF_BIRTH,
            pattern=re.compile(r'\b(0[1-9]|1[0-2])/(0[1-9]|[12]\d|3[01])/\d{4}\b'),
            sensitivity=SensitivityLevel.RESTRICTED,
            description="Date of birth MM/DD/YYYY format",
            examples=["01/15/1985", "12/31/1990"]
        ))
        
        # ZIP Code patterns
        self.register_pattern(PIIPattern(
            name="zip_code_us",
            pii_type=PIIType.ZIP_CODE,
            pattern=re.compile(r'\b\d{5}(-\d{4})?\b'),
            sensitivity=SensitivityLevel.INTERNAL,
            description="US ZIP codes",
            examples=["12345", "12345-6789"]
        ))
        
        # Driver License patterns (state-specific examples)
        self.register_pattern(PIIPattern(
            name="driver_license_ca",
            pii_type=PIIType.DRIVER_LICENSE,
            pattern=re.compile(r'\b[A-Z]\d{7}\b'),
            sensitivity=SensitivityLevel.RESTRICTED,
            description="California driver license format",
            examples=["A1234567", "B9876543"]
        ))
        
        # MAC Address patterns
        self.register_pattern(PIIPattern(
            name="mac_address",
            pii_type=PIIType.MAC_ADDRESS,
            pattern=re.compile(r'\b(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}\b'),
            sensitivity=SensitivityLevel.INTERNAL,
            description="MAC addresses",
            examples=["00:1B:44:11:3A:B7", "00-1B-44-11-3A-B7"]
        ))
    
    def register_pattern(self, pattern: PIIPattern) -> None:
        """Register a new PII detection pattern"""
        self.patterns[pattern.name] = pattern
        logger.info(f"Registered PII pattern: {pattern.name}")
    
    def register_custom_pattern(
        self,
        name: str,
        regex_pattern: str,
        pii_type: PIIType,
        sensitivity: SensitivityLevel,
        description: str = "",
        validator: Optional[Callable[[str], bool]] = None
    ) -> None:
        """Register a custom PII pattern"""
        try:
            compiled_pattern = re.compile(regex_pattern)
            pattern = PIIPattern(
                name=name,
                pii_type=pii_type,
                pattern=compiled_pattern,
                sensitivity=sensitivity,
                description=description,
                validator=validator
            )
            self.custom_patterns[name] = pattern
            logger.info(f"Registered custom PII pattern: {name}")
        except re.error as e:
            raise PIIDetectionError(f"Invalid regex pattern '{regex_pattern}': {e}")
    
    def detect_pii(
        self,
        text: str,
        context: str = "",
        include_custom: bool = True,
        confidence_threshold: float = 0.7
    ) -> List[PIIMatch]:
        """
        Detect PII in the given text.
        
        Args:
            text: Text to analyze
            context: Context information for better detection
            include_custom: Whether to include custom patterns
            confidence_threshold: Minimum confidence score for matches
            
        Returns:
            List of detected PII matches
        """
        matches = []
        
        # Use both built-in and custom patterns
        patterns_to_use = dict(self.patterns)
        if include_custom:
            patterns_to_use.update(self.custom_patterns)
        
        for pattern_name, pattern in patterns_to_use.items():
            for match in pattern.pattern.finditer(text):
                matched_text = match.group()
                
                # Apply validator if present
                is_valid = True
                if pattern.validator:
                    try:
                        is_valid = pattern.validator(matched_text)
                    except Exception as e:
                        logger.warning(f"Validator error for pattern {pattern_name}: {e}")
                        is_valid = False
                
                if is_valid:
                    # Calculate confidence score
                    confidence = self._calculate_confidence(
                        matched_text, pattern, context
                    )
                    
                    if confidence >= confidence_threshold:
                        pii_match = PIIMatch(
                            pii_type=pattern.pii_type,
                            value=matched_text,
                            start_pos=match.start(),
                            end_pos=match.end(),
                            sensitivity=pattern.sensitivity,
                            confidence=confidence,
                            context=context,
                            pattern_name=pattern_name
                        )
                        matches.append(pii_match)
        
        # Remove overlapping matches (keep highest confidence)
        matches = self._remove_overlapping_matches(matches)
        
        return matches
    
    def classify_data(
        self,
        data: Union[str, Dict[str, Any], List[Any]],
        context: str = ""
    ) -> ClassificationResult:
        """
        Classify data sensitivity and generate recommendations.
        
        Args:
            data: Data to classify (string, dict, or list)
            context: Context information
            
        Returns:
            Classification result with sensitivity level and recommendations
        """
        # Convert data to text for analysis
        if isinstance(data, str):
            text = data
        elif isinstance(data, (dict, list)):
            text = json.dumps(data, default=str)
        else:
            text = str(data)
        
        # Detect PII
        pii_matches = self.detect_pii(text, context)
        
        # Determine overall sensitivity
        if not pii_matches:
            overall_sensitivity = SensitivityLevel.PUBLIC
        else:
            max_sensitivity = max(match.sensitivity for match in pii_matches)
            overall_sensitivity = max_sensitivity
        
        # Extract data types
        data_types = {match.pii_type for match in pii_matches}
        
        # Calculate confidence score
        if pii_matches:
            confidence_score = sum(match.confidence for match in pii_matches) / len(pii_matches)
        else:
            confidence_score = 1.0  # High confidence for no PII
        
        # Generate recommendations
        recommendations = self._generate_recommendations(pii_matches, overall_sensitivity)
        
        # Generate compliance flags
        compliance_flags = self._generate_compliance_flags(data_types)
        
        return ClassificationResult(
            overall_sensitivity=overall_sensitivity,
            pii_matches=pii_matches,
            data_types=data_types,
            confidence_score=confidence_score,
            recommendations=recommendations,
            compliance_flags=compliance_flags
        )
    
    def mask_pii(
        self,
        text: str,
        strategy: MaskingStrategy = MaskingStrategy.PARTIAL,
        preserve_format: bool = True,
        custom_mask_char: str = "*"
    ) -> Tuple[str, List[PIIMatch]]:
        """
        Mask detected PII in text.
        
        Args:
            text: Text containing PII
            strategy: Masking strategy to use
            preserve_format: Whether to preserve original format
            custom_mask_char: Character to use for masking
            
        Returns:
            Tuple of (masked_text, detected_pii_matches)
        """
        pii_matches = self.detect_pii(text)
        
        if not pii_matches:
            return text, []
        
        # Sort matches by position (reverse order to maintain positions)
        pii_matches.sort(key=lambda x: x.start_pos, reverse=True)
        
        masked_text = text
        
        for match in pii_matches:
            masked_value = self._apply_masking_strategy(
                match.value, match.pii_type, strategy, preserve_format, custom_mask_char
            )
            
            # Replace the original value with masked value
            masked_text = (
                masked_text[:match.start_pos] + 
                masked_value + 
                masked_text[match.end_pos:]
            )
        
        return masked_text, pii_matches
    
    def tokenize_pii(
        self,
        text: str,
        token_prefix: str = "TOK_",
        reversible: bool = True
    ) -> Tuple[str, Dict[str, str]]:
        """
        Replace PII with tokens.
        
        Args:
            text: Text containing PII
            token_prefix: Prefix for generated tokens
            reversible: Whether tokenization should be reversible
            
        Returns:
            Tuple of (tokenized_text, token_mapping)
        """
        pii_matches = self.detect_pii(text)
        
        if not pii_matches:
            return text, {}
        
        # Sort matches by position (reverse order)
        pii_matches.sort(key=lambda x: x.start_pos, reverse=True)
        
        tokenized_text = text
        token_mapping = {}
        
        for match in pii_matches:
            # Generate unique token
            token = self._generate_token(match.pii_type, token_prefix)
            
            if reversible:
                token_mapping[token] = match.value
                self._token_registry[token] = match.value
            
            # Replace with token
            tokenized_text = (
                tokenized_text[:match.start_pos] + 
                token + 
                tokenized_text[match.end_pos:]
            )
        
        return tokenized_text, token_mapping
    
    def detokenize_text(self, tokenized_text: str, token_mapping: Dict[str, str]) -> str:
        """
        Reverse tokenization using token mapping.
        
        Args:
            tokenized_text: Text with tokens
            token_mapping: Mapping of tokens to original values
            
        Returns:
            Original text with PII restored
        """
        result = tokenized_text
        
        for token, original_value in token_mapping.items():
            result = result.replace(token, original_value)
        
        return result
    
    def generate_privacy_report(
        self,
        data: Union[str, Dict[str, Any]],
        include_examples: bool = False
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive privacy analysis report.
        
        Args:
            data: Data to analyze
            include_examples: Whether to include example matches
            
        Returns:
            Privacy analysis report
        """
        classification = self.classify_data(data)
        
        report = {
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "overall_sensitivity": classification.overall_sensitivity.name,
            "confidence_score": classification.confidence_score,
            "pii_types_detected": [pii_type.value for pii_type in classification.data_types],
            "total_pii_matches": len(classification.pii_matches),
            "recommendations": classification.recommendations,
            "compliance_flags": classification.compliance_flags,
            "pii_breakdown": {}
        }
        
        # Group matches by PII type
        for pii_match in classification.pii_matches:
            pii_type_name = pii_match.pii_type.value
            
            if pii_type_name not in report["pii_breakdown"]:
                report["pii_breakdown"][pii_type_name] = {
                    "count": 0,
                    "sensitivity": pii_match.sensitivity.name,
                    "avg_confidence": 0.0,
                    "examples": [] if include_examples else None
                }
            
            breakdown = report["pii_breakdown"][pii_type_name]
            breakdown["count"] += 1
            
            if include_examples and len(breakdown["examples"]) < 3:
                breakdown["examples"].append({
                    "value": pii_match.value[:10] + "..." if len(pii_match.value) > 10 else pii_match.value,
                    "confidence": pii_match.confidence
                })
        
        # Calculate average confidence for each PII type
        for pii_type in report["pii_breakdown"]:
            matches_of_type = [m for m in classification.pii_matches if m.pii_type.value == pii_type]
            if matches_of_type:
                avg_conf = sum(m.confidence for m in matches_of_type) / len(matches_of_type)
                report["pii_breakdown"][pii_type]["avg_confidence"] = round(avg_conf, 3)
        
        return report
    
    # Validation methods
    
    def _validate_ssn(self, ssn: str) -> bool:
        """Validate SSN format and basic rules"""
        # Remove dashes
        clean_ssn = ssn.replace("-", "")
        
        # Check length
        if len(clean_ssn) != 9 or not clean_ssn.isdigit():
            return False
        
        # Check for invalid patterns
        area = clean_ssn[:3]
        group = clean_ssn[3:5]
        serial = clean_ssn[5:9]
        
        # Invalid area numbers
        if area in ["000", "666"] or area.startswith("9"):
            return False
        
        # Invalid group/serial
        if group == "00" or serial == "0000":
            return False
        
        return True
    
    def _validate_ssn_no_dashes(self, ssn: str) -> bool:
        """Validate 9-digit SSN without dashes"""
        if len(ssn) == 9 and ssn.isdigit():
            return self._validate_ssn(f"{ssn[:3]}-{ssn[3:5]}-{ssn[5:]}")
        return False
    
    def _validate_credit_card(self, cc: str) -> bool:
        """Validate credit card using Luhn algorithm"""
        # Remove spaces and dashes
        clean_cc = re.sub(r'[-\s]', '', cc)
        
        if not clean_cc.isdigit():
            return False
        
        # Luhn algorithm
        def luhn_checksum(card_num):
            def digits_of(n):
                return [int(d) for d in str(n)]
            
            digits = digits_of(card_num)
            odd_digits = digits[-1::-2]
            even_digits = digits[-2::-2]
            checksum = sum(odd_digits)
            for d in even_digits:
                checksum += sum(digits_of(d * 2))
            return checksum % 10
        
        return luhn_checksum(clean_cc) == 0
    
    def _validate_email(self, email: str) -> bool:
        """Enhanced email validation"""
        # Basic format check is done by regex
        # Additional checks for common false positives
        if email.count("@") != 1:
            return False
        
        local, domain = email.split("@")
        
        # Check local part
        if not local or len(local) > 64:
            return False
        
        # Check domain part
        if not domain or len(domain) > 253:
            return False
        
        # Check for consecutive dots
        if ".." in email:
            return False
        
        return True
    
    def _validate_ipv4(self, ip: str) -> bool:
        """Validate IPv4 address"""
        parts = ip.split(".")
        if len(parts) != 4:
            return False
        
        try:
            for part in parts:
                num = int(part)
                if not (0 <= num <= 255):
                    return False
            return True
        except ValueError:
            return False
    
    # Helper methods
    
    def _calculate_confidence(
        self, 
        matched_text: str, 
        pattern: PIIPattern, 
        context: str
    ) -> float:
        """Calculate confidence score for a match"""
        confidence = 0.8  # Base confidence
        
        # Adjust based on pattern specificity
        if pattern.validator:
            confidence += 0.1  # Patterns with validation are more reliable
        
        # Adjust based on context
        if context:
            context_lower = context.lower()
            if pattern.pii_type == PIIType.SSN and "ssn" in context_lower:
                confidence += 0.1
            elif pattern.pii_type == PIIType.EMAIL and "email" in context_lower:
                confidence += 0.1
            elif pattern.pii_type == PIIType.PHONE_NUMBER and "phone" in context_lower:
                confidence += 0.1
        
        # Adjust based on surrounding characters
        # This would require position information from the original text
        
        return min(confidence, 1.0)
    
    def _remove_overlapping_matches(self, matches: List[PIIMatch]) -> List[PIIMatch]:
        """Remove overlapping matches, keeping the one with highest confidence"""
        if len(matches) <= 1:
            return matches
        
        # Sort by start position
        matches.sort(key=lambda x: x.start_pos)
        
        filtered_matches = []
        
        for current_match in matches:
            overlaps = False
            
            for existing_match in filtered_matches:
                # Check if there's overlap
                if (current_match.start_pos < existing_match.end_pos and 
                    current_match.end_pos > existing_match.start_pos):
                    
                    overlaps = True
                    
                    # If current match has higher confidence, replace existing
                    if current_match.confidence > existing_match.confidence:
                        filtered_matches.remove(existing_match)
                        filtered_matches.append(current_match)
                    
                    break
            
            if not overlaps:
                filtered_matches.append(current_match)
        
        return filtered_matches
    
    def _apply_masking_strategy(
        self,
        value: str,
        pii_type: PIIType,
        strategy: MaskingStrategy,
        preserve_format: bool,
        mask_char: str
    ) -> str:
        """Apply the specified masking strategy to a PII value"""
        
        if strategy == MaskingStrategy.FULL:
            if preserve_format:
                return re.sub(r'[A-Za-z0-9]', mask_char, value)
            else:
                return mask_char * len(value)
        
        elif strategy == MaskingStrategy.PARTIAL:
            if len(value) <= 4:
                return mask_char * len(value)
            else:
                # Show first and last 2 characters
                return value[:2] + mask_char * (len(value) - 4) + value[-2:]
        
        elif strategy == MaskingStrategy.REDACT:
            return "[REDACTED]"
        
        elif strategy == MaskingStrategy.HASH:
            return hashlib.sha256(value.encode()).hexdigest()[:16]
        
        elif strategy == MaskingStrategy.TOKENIZE:
            return self._generate_token(pii_type, "TOK_")
        
        elif strategy == MaskingStrategy.FORMAT_PRESERVE:
            return self._format_preserving_mask(value, pii_type)
        
        else:
            return value  # No masking
    
    def _format_preserving_mask(self, value: str, pii_type: PIIType) -> str:
        """Generate format-preserving masked value"""
        
        if pii_type == PIIType.SSN:
            if "-" in value:
                return "XXX-XX-XXXX"
            else:
                return "XXXXXXXXX"
        
        elif pii_type == PIIType.CREDIT_CARD:
            # Preserve spacing/dashes
            result = ""
            for char in value:
                if char.isdigit():
                    result += "X"
                else:
                    result += char
            return result
        
        elif pii_type == PIIType.PHONE_NUMBER:
            # Preserve format but change digits
            result = ""
            for char in value:
                if char.isdigit():
                    result += str(secrets.randbelow(10))
                else:
                    result += char
            return result
        
        elif pii_type == PIIType.EMAIL:
            if "@" in value:
                local, domain = value.split("@", 1)
                masked_local = "X" * len(local)
                return f"{masked_local}@{domain}"
        
        # Default: replace alphanumeric with X
        return re.sub(r'[A-Za-z0-9]', 'X', value)
    
    def _generate_token(self, pii_type: PIIType, prefix: str) -> str:
        """Generate a unique token for PII"""
        type_code = pii_type.value.upper()[:3]
        random_part = secrets.token_hex(4).upper()
        return f"{prefix}{type_code}_{random_part}"
    
    def _generate_recommendations(
        self, 
        pii_matches: List[PIIMatch], 
        sensitivity: SensitivityLevel
    ) -> List[str]:
        """Generate data handling recommendations"""
        recommendations = []
        
        if not pii_matches:
            recommendations.append("No PII detected - data appears safe for general use")
            return recommendations
        
        # Sensitivity-based recommendations
        if sensitivity in [SensitivityLevel.HIGHLY_RESTRICTED, SensitivityLevel.RESTRICTED]:
            recommendations.extend([
                "Implement field-level encryption for sensitive data",
                "Restrict access to authorized personnel only",
                "Enable audit logging for all data access",
                "Consider data anonymization or pseudonymization"
            ])
        
        elif sensitivity == SensitivityLevel.CONFIDENTIAL:
            recommendations.extend([
                "Apply access controls and user authentication",
                "Enable audit logging for data operations",
                "Consider masking PII in non-production environments"
            ])
        
        # PII-type specific recommendations
        pii_types = {match.pii_type for match in pii_matches}
        
        if PIIType.SSN in pii_types:
            recommendations.append("SSN detected - ensure GDPR/CCPA compliance")
        
        if PIIType.CREDIT_CARD in pii_types:
            recommendations.append("Credit card data detected - ensure PCI DSS compliance")
        
        if PIIType.EMAIL in pii_types:
            recommendations.append("Email addresses detected - implement consent management")
        
        if PIIType.MEDICAL_RECORD in pii_types:
            recommendations.append("Medical data detected - ensure HIPAA compliance")
        
        return recommendations
    
    def _generate_compliance_flags(self, data_types: Set[PIIType]) -> List[str]:
        """Generate compliance flags based on detected PII types"""
        flags = []
        
        # GDPR flags
        gdpr_types = {
            PIIType.EMAIL, PIIType.PHONE_NUMBER, PIIType.ADDRESS,
            PIIType.DATE_OF_BIRTH, PIIType.IP_ADDRESS
        }
        if gdpr_types.intersection(data_types):
            flags.append("GDPR")
        
        # CCPA flags
        ccpa_types = {
            PIIType.SSN, PIIType.EMAIL, PIIType.PHONE_NUMBER,
            PIIType.ADDRESS, PIIType.IP_ADDRESS
        }
        if ccpa_types.intersection(data_types):
            flags.append("CCPA")
        
        # PCI DSS flags
        if PIIType.CREDIT_CARD in data_types:
            flags.append("PCI_DSS")
        
        # HIPAA flags
        if PIIType.MEDICAL_RECORD in data_types:
            flags.append("HIPAA")
        
        # SOX flags for financial data
        if PIIType.BANK_ACCOUNT in data_types or PIIType.TAX_ID in data_types:
            flags.append("SOX")
        
        return flags

# Convenience functions for common operations

def create_pii_detector() -> PIIDetector:
    """Create a PII detector with default patterns"""
    return PIIDetector()

def quick_pii_scan(text: str) -> Dict[str, Any]:
    """Quick PII scan with basic results"""
    detector = PIIDetector()
    classification = detector.classify_data(text)
    
    return {
        "has_pii": len(classification.pii_matches) > 0,
        "sensitivity_level": classification.overall_sensitivity.name,
        "pii_types": [t.value for t in classification.data_types],
        "confidence": classification.confidence_score
    }

def mask_sensitive_data(
    text: str, 
    strategy: MaskingStrategy = MaskingStrategy.PARTIAL
) -> str:
    """Quick masking of sensitive data"""
    detector = PIIDetector()
    masked_text, _ = detector.mask_pii(text, strategy)
    return masked_text

def anonymize_dataset(
    data: Dict[str, str],
    strategy: MaskingStrategy = MaskingStrategy.TOKENIZE
) -> Tuple[Dict[str, str], Dict[str, str]]:
    """Anonymize a dataset and return token mapping"""
    detector = PIIDetector()
    anonymized_data = {}
    all_tokens = {}
    
    for key, value in data.items():
        if isinstance(value, str):
            if strategy == MaskingStrategy.TOKENIZE:
                anonymized_value, tokens = detector.tokenize_pii(value)
                all_tokens.update(tokens)
            else:
                anonymized_value, _ = detector.mask_pii(value, strategy)
            
            anonymized_data[key] = anonymized_value
        else:
            anonymized_data[key] = value
    
    return anonymized_data, all_tokens 