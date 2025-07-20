"""
Third-Party Processor Management System
======================================

Comprehensive management system for third-party processors and sub-processors
in compliance with GDPR Article 28 and other regulatory requirements.

Features:
- Sub-processor registration and approval workflows
- Third-party compliance monitoring and auditing
- Data transfer agreement management
- Risk assessment and scoring
- Automated compliance reporting
- Contract lifecycle management
- Security certification tracking
- International transfer monitoring

GDPR Compliance:
- Article 28: Processor obligations and sub-processing
- Article 30: Records of processing activities
- Article 32: Security of processing
- Article 44-50: International transfers
- Standard Contractual Clauses (SCCs) management
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from dataclasses import dataclass, asdict
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.security.audit import AuditLogger, SecurityEventType
from app.security.compliance import ComplianceFramework

logger = logging.getLogger(__name__)

class ProcessorStatus(Enum):
    """Processor status"""
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"
    UNDER_REVIEW = "under_review"

class RiskLevel(Enum):
    """Risk levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class TransferMechanism(Enum):
    """Data transfer mechanisms"""
    ADEQUACY_DECISION = "adequacy_decision"
    STANDARD_CONTRACTUAL_CLAUSES = "sccs"
    BINDING_CORPORATE_RULES = "bcr"
    APPROVED_CODES_OF_CONDUCT = "codes_of_conduct"
    APPROVED_CERTIFICATION_MECHANISMS = "certification"
    DEROGATIONS = "derogations"

@dataclass
class SecurityCertification:
    """Security certification information"""
    certification_id: str
    certification_type: str
    issuing_body: str
    issue_date: datetime
    expiry_date: datetime
    scope: str
    status: str
    certificate_url: Optional[str]

@dataclass
class ComplianceAssessment:
    """Compliance assessment results"""
    assessment_id: str
    assessment_date: datetime
    framework: ComplianceFramework
    compliance_score: float
    findings: List[Dict[str, Any]]
    recommendations: List[str]
    next_assessment_date: datetime
    assessor: str
    status: str

@dataclass
class DataTransferAgreement:
    """Data transfer agreement details"""
    agreement_id: str
    processor_id: str
    transfer_mechanism: TransferMechanism
    source_country: str
    destination_country: str
    data_categories: List[str]
    processing_purposes: List[str]
    security_measures: List[str]
    agreement_date: datetime
    expiry_date: datetime
    status: str
    scc_modules: List[str]  # For Standard Contractual Clauses
    adequacy_decision_reference: Optional[str]

@dataclass
class ThirdPartyProcessor:
    """Third-party processor information"""
    processor_id: str
    name: str
    legal_entity: str
    registration_number: str
    country_of_establishment: str
    contact_info: Dict[str, str]
    processor_type: str
    processing_purposes: List[str]
    data_categories: List[str]
    data_subjects: List[str]
    security_certifications: List[SecurityCertification]
    compliance_assessments: List[ComplianceAssessment]
    data_transfer_agreements: List[DataTransferAgreement]
    risk_assessment: Dict[str, Any]
    status: ProcessorStatus
    approval_date: Optional[datetime]
    review_frequency: str
    last_review_date: Optional[datetime]
    next_review_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime

class ThirdPartyProcessorManager:
    """
    Third-party processor management system
    """
    
    def __init__(self, audit_logger: Optional[AuditLogger] = None):
        self.audit_logger = audit_logger or AuditLogger()
        self.processors: Dict[str, ThirdPartyProcessor] = {}
        self.risk_assessment_criteria = self._load_risk_criteria()
        
    def _load_risk_criteria(self) -> Dict[str, Any]:
        """Load risk assessment criteria"""
        return {
            "data_sensitivity": {
                "low": {"score": 1, "description": "Non-sensitive data"},
                "medium": {"score": 2, "description": "Personal data"},
                "high": {"score": 3, "description": "Sensitive personal data"},
                "critical": {"score": 4, "description": "Special category data"}
            },
            "processing_volume": {
                "low": {"score": 1, "description": "< 1,000 records"},
                "medium": {"score": 2, "description": "1,000 - 100,000 records"},
                "high": {"score": 3, "description": "100,000 - 1,000,000 records"},
                "critical": {"score": 4, "description": "> 1,000,000 records"}
            },
            "geographic_scope": {
                "local": {"score": 1, "description": "Single country"},
                "regional": {"score": 2, "description": "Multiple countries in region"},
                "global": {"score": 3, "description": "Multiple regions"},
                "worldwide": {"score": 4, "description": "Worldwide processing"}
            },
            "security_maturity": {
                "basic": {"score": 4, "description": "Basic security measures"},
                "standard": {"score": 3, "description": "Standard security measures"},
                "advanced": {"score": 2, "description": "Advanced security measures"},
                "enterprise": {"score": 1, "description": "Enterprise-grade security"}
            },
            "compliance_history": {
                "excellent": {"score": 1, "description": "No compliance issues"},
                "good": {"score": 2, "description": "Minor compliance issues"},
                "fair": {"score": 3, "description": "Some compliance issues"},
                "poor": {"score": 4, "description": "Significant compliance issues"}
            }
        }
    
    async def register_processor(
        self,
        processor_info: Dict[str, Any],
        security_certifications: List[Dict[str, Any]] = None,
        compliance_frameworks: List[str] = None
    ) -> ThirdPartyProcessor:
        """
        Register a new third-party processor
        
        Args:
            processor_info: Processor information
            security_certifications: Security certifications
            compliance_frameworks: Compliance frameworks
            
        Returns:
            Registered processor
        """
        processor_id = f"PROC-{uuid.uuid4().hex[:8].upper()}"
        
        # Create security certifications
        certifications = []
        if security_certifications:
            for cert_info in security_certifications:
                cert = SecurityCertification(
                    certification_id=f"CERT-{uuid.uuid4().hex[:8].upper()}",
                    certification_type=cert_info["type"],
                    issuing_body=cert_info["issuing_body"],
                    issue_date=datetime.fromisoformat(cert_info["issue_date"]),
                    expiry_date=datetime.fromisoformat(cert_info["expiry_date"]),
                    scope=cert_info["scope"],
                    status=cert_info["status"],
                    certificate_url=cert_info.get("certificate_url")
                )
                certifications.append(cert)
        
        # Perform risk assessment
        risk_assessment = await self._perform_risk_assessment(processor_info)
        
        # Create processor
        processor = ThirdPartyProcessor(
            processor_id=processor_id,
            name=processor_info["name"],
            legal_entity=processor_info["legal_entity"],
            registration_number=processor_info["registration_number"],
            country_of_establishment=processor_info["country_of_establishment"],
            contact_info=processor_info["contact_info"],
            processor_type=processor_info["processor_type"],
            processing_purposes=processor_info["processing_purposes"],
            data_categories=processor_info["data_categories"],
            data_subjects=processor_info["data_subjects"],
            security_certifications=certifications,
            compliance_assessments=[],
            data_transfer_agreements=[],
            risk_assessment=risk_assessment,
            status=ProcessorStatus.PENDING_APPROVAL,
            approval_date=None,
            review_frequency=processor_info.get("review_frequency", "annually"),
            last_review_date=None,
            next_review_date=datetime.utcnow() + timedelta(days=365),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Store processor
        self.processors[processor_id] = processor
        
        # Log registration
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="third_party_processor_registered",
            actor_id="system",
            resource=f"processor:{processor_id}",
            result="success",
            context={
                "processor_name": processor.name,
                "risk_level": risk_assessment["overall_risk"],
                "processing_purposes": processor.processing_purposes
            }
        )
        
        return processor
    
    async def approve_processor(
        self,
        processor_id: str,
        approver_id: str,
        approval_conditions: List[str] = None
    ) -> Dict[str, Any]:
        """
        Approve a third-party processor
        
        Args:
            processor_id: Processor ID
            approver_id: ID of the approver
            approval_conditions: Conditions for approval
            
        Returns:
            Approval result
        """
        if processor_id not in self.processors:
            raise ValueError(f"Processor not found: {processor_id}")
        
        processor = self.processors[processor_id]
        
        if processor.status != ProcessorStatus.PENDING_APPROVAL:
            raise ValueError(f"Processor is not pending approval: {processor_id}")
        
        # Update processor status
        processor.status = ProcessorStatus.APPROVED
        processor.approval_date = datetime.utcnow()
        processor.updated_at = datetime.utcnow()
        
        # Log approval
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="third_party_processor_approved",
            actor_id=approver_id,
            resource=f"processor:{processor_id}",
            result="success",
            context={
                "processor_name": processor.name,
                "approval_conditions": approval_conditions or [],
                "risk_level": processor.risk_assessment["overall_risk"]
            }
        )
        
        return {
            "processor_id": processor_id,
            "status": "approved",
            "approval_date": processor.approval_date.isoformat(),
            "approval_conditions": approval_conditions or []
        }
    
    async def add_data_transfer_agreement(
        self,
        processor_id: str,
        transfer_info: Dict[str, Any]
    ) -> DataTransferAgreement:
        """
        Add a data transfer agreement for a processor
        
        Args:
            processor_id: Processor ID
            transfer_info: Transfer agreement information
            
        Returns:
            Data transfer agreement
        """
        if processor_id not in self.processors:
            raise ValueError(f"Processor not found: {processor_id}")
        
        agreement_id = f"DTA-{uuid.uuid4().hex[:8].upper()}"
        
        agreement = DataTransferAgreement(
            agreement_id=agreement_id,
            processor_id=processor_id,
            transfer_mechanism=TransferMechanism(transfer_info["transfer_mechanism"]),
            source_country=transfer_info["source_country"],
            destination_country=transfer_info["destination_country"],
            data_categories=transfer_info["data_categories"],
            processing_purposes=transfer_info["processing_purposes"],
            security_measures=transfer_info["security_measures"],
            agreement_date=datetime.fromisoformat(transfer_info["agreement_date"]),
            expiry_date=datetime.fromisoformat(transfer_info["expiry_date"]),
            status="active",
            scc_modules=transfer_info.get("scc_modules", []),
            adequacy_decision_reference=transfer_info.get("adequacy_decision_reference")
        )
        
        # Add to processor
        processor = self.processors[processor_id]
        processor.data_transfer_agreements.append(agreement)
        processor.updated_at = datetime.utcnow()
        
        # Log agreement addition
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="data_transfer_agreement_added",
            actor_id="system",
            resource=f"processor:{processor_id}",
            result="success",
            context={
                "agreement_id": agreement_id,
                "transfer_mechanism": agreement.transfer_mechanism.value,
                "source_country": agreement.source_country,
                "destination_country": agreement.destination_country
            }
        )
        
        return agreement
    
    async def conduct_compliance_assessment(
        self,
        processor_id: str,
        framework: ComplianceFramework,
        assessor_id: str,
        assessment_data: Dict[str, Any]
    ) -> ComplianceAssessment:
        """
        Conduct a compliance assessment for a processor
        
        Args:
            processor_id: Processor ID
            framework: Compliance framework
            assessor_id: ID of the assessor
            assessment_data: Assessment details
            
        Returns:
            Compliance assessment
        """
        if processor_id not in self.processors:
            raise ValueError(f"Processor not found: {processor_id}")
        
        assessment_id = f"ASSESS-{uuid.uuid4().hex[:8].upper()}"
        
        assessment = ComplianceAssessment(
            assessment_id=assessment_id,
            assessment_date=datetime.utcnow(),
            framework=framework,
            compliance_score=assessment_data["compliance_score"],
            findings=assessment_data.get("findings", []),
            recommendations=assessment_data.get("recommendations", []),
            next_assessment_date=datetime.utcnow() + timedelta(days=365),
            assessor=assessor_id,
            status="completed"
        )
        
        # Add to processor
        processor = self.processors[processor_id]
        processor.compliance_assessments.append(assessment)
        processor.last_review_date = datetime.utcnow()
        processor.next_review_date = assessment.next_assessment_date
        processor.updated_at = datetime.utcnow()
        
        # Log assessment
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="compliance_assessment_conducted",
            actor_id=assessor_id,
            resource=f"processor:{processor_id}",
            result="success",
            context={
                "assessment_id": assessment_id,
                "framework": framework.value,
                "compliance_score": assessment.compliance_score,
                "findings_count": len(assessment.findings)
            }
        )
        
        return assessment
    
    async def _perform_risk_assessment(self, processor_info: Dict[str, Any]) -> Dict[str, Any]:
        """Perform risk assessment for a processor"""
        risk_scores = {}
        total_score = 0
        max_score = 0
        
        # Assess data sensitivity
        data_sensitivity = processor_info.get("data_sensitivity", "medium")
        risk_scores["data_sensitivity"] = self.risk_assessment_criteria["data_sensitivity"][data_sensitivity]
        total_score += risk_scores["data_sensitivity"]["score"]
        max_score += 4
        
        # Assess processing volume
        processing_volume = processor_info.get("processing_volume", "medium")
        risk_scores["processing_volume"] = self.risk_assessment_criteria["processing_volume"][processing_volume]
        total_score += risk_scores["processing_volume"]["score"]
        max_score += 4
        
        # Assess geographic scope
        geographic_scope = processor_info.get("geographic_scope", "local")
        risk_scores["geographic_scope"] = self.risk_assessment_criteria["geographic_scope"][geographic_scope]
        total_score += risk_scores["geographic_scope"]["score"]
        max_score += 4
        
        # Assess security maturity
        security_maturity = processor_info.get("security_maturity", "standard")
        risk_scores["security_maturity"] = self.risk_assessment_criteria["security_maturity"][security_maturity]
        total_score += risk_scores["security_maturity"]["score"]
        max_score += 4
        
        # Assess compliance history
        compliance_history = processor_info.get("compliance_history", "good")
        risk_scores["compliance_history"] = self.risk_assessment_criteria["compliance_history"][compliance_history]
        total_score += risk_scores["compliance_history"]["score"]
        max_score += 4
        
        # Calculate overall risk
        risk_percentage = (total_score / max_score) * 100
        
        if risk_percentage <= 25:
            overall_risk = RiskLevel.LOW
        elif risk_percentage <= 50:
            overall_risk = RiskLevel.MEDIUM
        elif risk_percentage <= 75:
            overall_risk = RiskLevel.HIGH
        else:
            overall_risk = RiskLevel.CRITICAL
        
        return {
            "overall_risk": overall_risk.value,
            "risk_percentage": risk_percentage,
            "risk_scores": risk_scores,
            "assessment_date": datetime.utcnow().isoformat(),
            "recommendations": self._generate_risk_recommendations(risk_scores, overall_risk)
        }
    
    def _generate_risk_recommendations(self, risk_scores: Dict[str, Any], overall_risk: RiskLevel) -> List[str]:
        """Generate risk-based recommendations"""
        recommendations = []
        
        if overall_risk == RiskLevel.CRITICAL:
            recommendations.append("Immediate review required - consider alternative processor")
            recommendations.append("Enhanced monitoring and frequent audits required")
        elif overall_risk == RiskLevel.HIGH:
            recommendations.append("Regular monitoring and quarterly audits required")
            recommendations.append("Consider additional security measures")
        elif overall_risk == RiskLevel.MEDIUM:
            recommendations.append("Standard monitoring and annual audits required")
        else:
            recommendations.append("Standard monitoring and periodic reviews")
        
        # Specific recommendations based on risk factors
        if risk_scores["data_sensitivity"]["score"] >= 3:
            recommendations.append("Implement enhanced data protection measures")
        
        if risk_scores["geographic_scope"]["score"] >= 3:
            recommendations.append("Review international transfer mechanisms")
        
        if risk_scores["security_maturity"]["score"] >= 3:
            recommendations.append("Require security improvements before approval")
        
        return recommendations
    
    async def get_processor_summary(self, processor_id: str) -> Dict[str, Any]:
        """Get comprehensive processor summary"""
        if processor_id not in self.processors:
            raise ValueError(f"Processor not found: {processor_id}")
        
        processor = self.processors[processor_id]
        
        # Calculate compliance metrics
        active_assessments = [a for a in processor.compliance_assessments if a.status == "completed"]
        avg_compliance_score = sum(a.compliance_score for a in active_assessments) / len(active_assessments) if active_assessments else 0
        
        # Check for expiring agreements
        expiring_agreements = [
            dta for dta in processor.data_transfer_agreements
            if dta.expiry_date <= datetime.utcnow() + timedelta(days=90)
        ]
        
        # Check for expiring certifications
        expiring_certifications = [
            cert for cert in processor.security_certifications
            if cert.expiry_date <= datetime.utcnow() + timedelta(days=90)
        ]
        
        return {
            "processor_id": processor.processor_id,
            "name": processor.name,
            "status": processor.status.value,
            "risk_assessment": processor.risk_assessment,
            "compliance_metrics": {
                "average_compliance_score": avg_compliance_score,
                "total_assessments": len(processor.compliance_assessments),
                "active_assessments": len(active_assessments),
                "last_assessment_date": processor.last_review_date.isoformat() if processor.last_review_date else None,
                "next_review_date": processor.next_review_date.isoformat() if processor.next_review_date else None
            },
            "data_transfers": {
                "total_agreements": len(processor.data_transfer_agreements),
                "active_agreements": len([dta for dta in processor.data_transfer_agreements if dta.status == "active"]),
                "expiring_agreements": len(expiring_agreements)
            },
            "security_certifications": {
                "total_certifications": len(processor.security_certifications),
                "active_certifications": len([c for c in processor.security_certifications if c.status == "active"]),
                "expiring_certifications": len(expiring_certifications)
            },
            "processing_activities": {
                "purposes": processor.processing_purposes,
                "data_categories": processor.data_categories,
                "data_subjects": processor.data_subjects
            }
        }
    
    async def generate_compliance_report(self, framework: ComplianceFramework = None) -> Dict[str, Any]:
        """Generate comprehensive compliance report for all processors"""
        report = {
            "report_id": f"REPORT-{uuid.uuid4().hex[:8].upper()}",
            "generated_at": datetime.utcnow().isoformat(),
            "framework": framework.value if framework else "all",
            "summary": {
                "total_processors": len(self.processors),
                "approved_processors": len([p for p in self.processors.values() if p.status == ProcessorStatus.APPROVED]),
                "pending_approval": len([p for p in self.processors.values() if p.status == ProcessorStatus.PENDING_APPROVAL]),
                "suspended_processors": len([p for p in self.processors.values() if p.status == ProcessorStatus.SUSPENDED])
            },
            "risk_distribution": {
                "low_risk": len([p for p in self.processors.values() if p.risk_assessment["overall_risk"] == "low"]),
                "medium_risk": len([p for p in self.processors.values() if p.risk_assessment["overall_risk"] == "medium"]),
                "high_risk": len([p for p in self.processors.values() if p.risk_assessment["overall_risk"] == "high"]),
                "critical_risk": len([p for p in self.processors.values() if p.risk_assessment["overall_risk"] == "critical"])
            },
            "compliance_status": {
                "compliant": 0,
                "non_compliant": 0,
                "under_review": 0
            },
            "processors": []
        }
        
        for processor in self.processors.values():
            processor_summary = await self.get_processor_summary(processor.processor_id)
            report["processors"].append(processor_summary)
            
            # Update compliance status counts
            if processor_summary["compliance_metrics"]["average_compliance_score"] >= 90:
                report["compliance_status"]["compliant"] += 1
            elif processor_summary["compliance_metrics"]["average_compliance_score"] >= 70:
                report["compliance_status"]["under_review"] += 1
            else:
                report["compliance_status"]["non_compliant"] += 1
        
        return report 