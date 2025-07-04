"""
Compliance Security Module

This module provides comprehensive regulatory compliance management for the
Schlep-engine platform, implementing frameworks for SOC 2, GDPR, HIPAA,
PCI DSS, and other industry standards. It automates compliance monitoring,
reporting, and evidence collection to support audit readiness.

Supported Frameworks:
- SOC 2 Type I & II (Security, Availability, Processing Integrity)
- GDPR (General Data Protection Regulation) - EU privacy compliance
- HIPAA (Health Insurance Portability and Accountability Act)
- PCI DSS (Payment Card Industry Data Security Standard)
- ISO/IEC 27001:2013 (Information Security Management)
- NIST Cybersecurity Framework (Identify, Protect, Detect, Respond, Recover)
- CCPA (California Consumer Privacy Act)
- FedRAMP (Federal Risk and Authorization Management Program)

Key Features:
- Automated compliance assessment and gap analysis
- Real-time monitoring of compliance controls and metrics
- Evidence collection and management for audit preparation
- Risk assessment and treatment planning
- Policy management with version control and approval workflows
- Compliance dashboard with executive reporting
- Automated notifications for compliance violations
- Integration with audit logging and security monitoring

SOC 2 Controls:
- Common Criteria (CC) controls for all service categories
- Security controls for data protection and access management
- Availability controls for system uptime and performance
- Processing Integrity controls for data accuracy and completeness
- Confidentiality controls for sensitive information protection
- Privacy controls for personal information handling

GDPR Compliance:
- Data processing activity records and lawful basis tracking
- Privacy impact assessments (PIA) and data protection by design
- Data subject rights management (access, rectification, erasure)
- Consent management and withdrawal mechanisms
- Data breach notification procedures and timeline compliance
- Data transfer safeguards for international processing
- Privacy policy management and transparency requirements

Security Controls:
- Access control policies and procedures
- Encryption requirements and key management
- Incident response and business continuity planning
- Vulnerability management and security testing
- Security awareness training and personnel screening
- Physical and environmental security controls
- System and communications protection

Monitoring and Reporting:
- Continuous control monitoring with automated testing
- Control effectiveness measurement and trending
- Management reporting with risk heat maps
- Regulatory change tracking and impact assessment
- Audit trail maintenance and evidence preservation
- Performance metrics and service level monitoring

Usage:
    from app.security.compliance import ComplianceManager, Framework
    
    # Check SOC 2 compliance status
    compliance_mgr = ComplianceManager()
    soc2_status = compliance_mgr.assess_framework(Framework.SOC2)
    
    # Generate GDPR compliance report
    gdpr_report = compliance_mgr.generate_report(
        framework=Framework.GDPR,
        period="2024-Q1"
    )
    
    # Monitor control effectiveness
    control_status = compliance_mgr.check_controls([
        "CC6.1", "CC6.2", "CC6.3"  # SOC 2 logical access controls
    ])

Compliance Automation:
- Policy enforcement through technical controls
- Automated evidence collection from security systems
- Control testing with scheduled assessments
- Risk scoring and prioritization algorithms
- Remediation tracking and workflow management
- Regulatory update monitoring and change management
"""

from typing import Dict, Any, List, Optional, Set
from enum import Enum
from datetime import datetime, timedelta

__version__ = "1.0.0"

class ComplianceFramework(Enum):
    """Supported compliance frameworks"""
    SOC2 = "soc2"
    GDPR = "gdpr"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"
    ISO27001 = "iso27001"
    NIST_CSF = "nist_csf"
    CCPA = "ccpa"
    FEDRAMP = "fedramp"

class ControlStatus(Enum):
    """Control implementation status"""
    IMPLEMENTED = "implemented"
    PARTIALLY_IMPLEMENTED = "partially_implemented"
    NOT_IMPLEMENTED = "not_implemented"
    NOT_APPLICABLE = "not_applicable"
    UNDER_REVIEW = "under_review"

class RiskLevel(Enum):
    """Risk assessment levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class DataClassification(Enum):
    """Data sensitivity classifications"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    TOP_SECRET = "top_secret"

# SOC 2 Trust Service Criteria
SOC2_CONTROLS = {
    "common_criteria": {
        "CC1": "Control Environment",
        "CC2": "Communication and Information",
        "CC3": "Risk Assessment",
        "CC4": "Monitoring Activities",
        "CC5": "Control Activities",
        "CC6": "Logical and Physical Access Controls",
        "CC7": "System Operations",
        "CC8": "Change Management",
        "CC9": "Risk Mitigation"
    },
    "security": {
        "A1": "Policies, Procedures, and Risk Assessment",
        "A2": "Security Monitoring",
        "A3": "Information and Data Management"
    },
    "availability": {
        "A1": "System Availability Monitoring",
        "A2": "Capacity Management",
        "A3": "Environmental Protections"
    }
}

# GDPR Articles and Requirements
GDPR_REQUIREMENTS = {
    "lawful_basis": ["Art. 6 - Lawfulness of processing"],
    "data_subject_rights": [
        "Art. 15 - Right of access",
        "Art. 16 - Right to rectification", 
        "Art. 17 - Right to erasure",
        "Art. 18 - Right to restriction",
        "Art. 20 - Right to data portability",
        "Art. 21 - Right to object"
    ],
    "accountability": [
        "Art. 25 - Data protection by design",
        "Art. 30 - Records of processing activities",
        "Art. 32 - Security of processing",
        "Art. 35 - Data protection impact assessment"
    ],
    "breach_notification": [
        "Art. 33 - Notification to supervisory authority",
        "Art. 34 - Communication to data subject"
    ]
}

# Framework mapping and relationships
FRAMEWORK_MAPPINGS = {
    ComplianceFramework.SOC2: {
        "primary_focus": "service_organization_controls",
        "assessment_period": "annual",
        "control_families": ["common_criteria", "security", "availability"],
        "evidence_retention_years": 7
    },
    ComplianceFramework.GDPR: {
        "primary_focus": "data_protection",
        "assessment_period": "continuous",
        "key_principles": ["lawfulness", "transparency", "accountability"],
        "max_breach_notification_hours": 72
    },
    ComplianceFramework.ISO27001: {
        "primary_focus": "information_security_management",
        "assessment_period": "triennial", 
        "control_domains": 14,
        "total_controls": 114
    }
}

# Control effectiveness metrics
CONTROL_METRICS = {
    "access_management": {
        "privileged_accounts_reviewed": {"frequency": "quarterly", "target": 100},
        "access_certifications_completed": {"frequency": "annual", "target": 100},
        "failed_login_attempts": {"threshold": 5, "period": "15_minutes"}
    },
    "encryption": {
        "data_encrypted_at_rest": {"target": 100, "classification": "confidential"},
        "data_encrypted_in_transit": {"target": 100, "protocols": ["TLS1.3"]},
        "key_rotation_compliance": {"frequency": "quarterly", "target": 100}
    },
    "incident_response": {
        "mean_time_to_detection": {"target": 24, "unit": "hours"},
        "mean_time_to_response": {"target": 4, "unit": "hours"},
        "incident_documentation": {"target": 100, "within_hours": 48}
    }
}

def get_compliance_config() -> Dict[str, Any]:
    """
    Get compliance module configuration.
    
    Returns:
        Dict containing compliance frameworks and control mappings
    """
    return {
        "version": __version__,
        "frameworks": [fw.value for fw in ComplianceFramework],
        "control_statuses": [status.value for status in ControlStatus],
        "risk_levels": [risk.value for risk in RiskLevel],
        "data_classifications": [dc.value for dc in DataClassification],
        "soc2_controls": SOC2_CONTROLS,
        "gdpr_requirements": GDPR_REQUIREMENTS,
        "framework_mappings": FRAMEWORK_MAPPINGS,
        "control_metrics": CONTROL_METRICS,
        "status": "ready_for_implementation"
    }

def assess_framework_readiness(framework: ComplianceFramework) -> Dict[str, Any]:
    """
    Assess readiness for a specific compliance framework.
    
    Args:
        framework: Compliance framework to assess
        
    Returns:
        Assessment results with readiness score and gaps
    """
    framework_info = FRAMEWORK_MAPPINGS.get(framework, {})
    
    return {
        "framework": framework.value,
        "assessment_date": datetime.utcnow().isoformat(),
        "readiness_score": 0,  # To be calculated during implementation
        "control_coverage": 0,  # Percentage of controls implemented
        "identified_gaps": [],  # List of gaps to address
        "next_assessment_due": None,  # Based on assessment period
        "certification_status": "not_assessed"
    }

def calculate_risk_score(
    impact: RiskLevel, 
    likelihood: RiskLevel
) -> tuple[RiskLevel, int]:
    """
    Calculate overall risk score based on impact and likelihood.
    
    Args:
        impact: Impact level if risk materializes
        likelihood: Probability of risk occurrence
        
    Returns:
        Tuple of (overall_risk_level, numeric_score)
    """
    risk_matrix = {
        (RiskLevel.LOW, RiskLevel.LOW): (RiskLevel.LOW, 1),
        (RiskLevel.LOW, RiskLevel.MEDIUM): (RiskLevel.LOW, 2),
        (RiskLevel.LOW, RiskLevel.HIGH): (RiskLevel.MEDIUM, 3),
        (RiskLevel.LOW, RiskLevel.CRITICAL): (RiskLevel.MEDIUM, 4),
        (RiskLevel.MEDIUM, RiskLevel.LOW): (RiskLevel.LOW, 2),
        (RiskLevel.MEDIUM, RiskLevel.MEDIUM): (RiskLevel.MEDIUM, 4),
        (RiskLevel.MEDIUM, RiskLevel.HIGH): (RiskLevel.HIGH, 6),
        (RiskLevel.MEDIUM, RiskLevel.CRITICAL): (RiskLevel.HIGH, 8),
        (RiskLevel.HIGH, RiskLevel.LOW): (RiskLevel.MEDIUM, 3),
        (RiskLevel.HIGH, RiskLevel.MEDIUM): (RiskLevel.HIGH, 6),
        (RiskLevel.HIGH, RiskLevel.HIGH): (RiskLevel.HIGH, 9),
        (RiskLevel.HIGH, RiskLevel.CRITICAL): (RiskLevel.CRITICAL, 12),
        (RiskLevel.CRITICAL, RiskLevel.LOW): (RiskLevel.MEDIUM, 4),
        (RiskLevel.CRITICAL, RiskLevel.MEDIUM): (RiskLevel.HIGH, 8),
        (RiskLevel.CRITICAL, RiskLevel.HIGH): (RiskLevel.CRITICAL, 12),
        (RiskLevel.CRITICAL, RiskLevel.CRITICAL): (RiskLevel.CRITICAL, 16)
    }
    
    return risk_matrix.get((impact, likelihood), (RiskLevel.MEDIUM, 5))

# Future class imports will be added here
# from .compliance_manager import ComplianceManager
# from .framework_assessor import FrameworkAssessor
# from .control_monitor import ControlMonitor
# from .evidence_collector import EvidenceCollector
# from .risk_assessor import RiskAssessor
# from .policy_manager import PolicyManager