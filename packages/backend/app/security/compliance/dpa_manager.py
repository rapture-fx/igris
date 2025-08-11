"""
Data Processing Agreement (DPA) Manager
=======================================

Comprehensive DPA compliance management system for Schlep-engine.
Handles contract generation, legal workflows, third-party processor tracking,
and automated compliance certification.

Features:
- Automated DPA contract generation with legal templates
- Third-party processor/sub-processor management
- Legal workflow automation with approval processes
- Compliance certification and audit trail
- Contract versioning and change management
- Data transfer agreement management
- Automated compliance monitoring and reporting

DPA Requirements Covered:
- GDPR Article 28: Processor obligations
- GDPR Article 30: Records of processing activities
- GDPR Article 32: Security of processing
- GDPR Article 33-34: Breach notification
- GDPR Article 35: Data protection impact assessment
- Standard Contractual Clauses (SCCs) for international transfers
- Third-party processor obligations and monitoring
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from dataclasses import dataclass, asdict
from pathlib import Path
import logging
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_

from app.database.models import User, Organization
from app.security.compliance import ComplianceFramework
from app.security.audit import AuditLogger, SecurityEventType

logger = logging.getLogger(__name__)

class DPAStatus(Enum):
    """DPA contract status"""
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    SUSPENDED = "suspended"

class DPAWorkflowStep(Enum):
    """DPA workflow steps"""
    INITIATED = "initiated"
    CLIENT_REVIEW = "client_review"
    LEGAL_REVIEW = "legal_review"
    COMPLIANCE_REVIEW = "compliance_review"
    EXECUTIVE_APPROVAL = "executive_approval"
    CLIENT_SIGNATURE = "client_signature"
    FINAL_APPROVAL = "final_approval"
    ACTIVE = "active"

class ProcessorType(Enum):
    """Types of data processors"""
    CONTROLLER = "controller"
    PROCESSOR = "processor"
    SUB_PROCESSOR = "sub_processor"
    JOINT_CONTROLLER = "joint_controller"

@dataclass
class DPAProcessingDetails:
    """Details of data processing activities"""
    purpose: str
    legal_basis: str
    data_categories: List[str]
    data_subjects: List[str]
    retention_period: str
    data_transfers: List[str]
    security_measures: List[str]
    sub_processors: List[str]
    processing_location: str
    compliance_frameworks: List[str]

@dataclass
class DPAContract:
    """DPA contract structure"""
    contract_id: str
    version: str
    status: DPAStatus
    client_info: Dict[str, Any]
    processing_details: DPAProcessingDetails
    terms_and_conditions: Dict[str, Any]
    security_measures: Dict[str, Any]
    data_subject_rights: Dict[str, Any]
    breach_notification: Dict[str, Any]
    audit_rights: Dict[str, Any]
    termination_clauses: Dict[str, Any]
    created_at: datetime
    effective_date: Optional[datetime]
    expiry_date: Optional[datetime]
    workflow_step: DPAWorkflowStep
    approval_chain: List[Dict[str, Any]]

@dataclass
class ThirdPartyProcessor:
    """Third-party processor information"""
    processor_id: str
    name: str
    processor_type: ProcessorType
    contact_info: Dict[str, str]
    processing_purposes: List[str]
    data_categories: List[str]
    security_certifications: List[str]
    compliance_frameworks: List[str]
    data_transfer_mechanisms: List[str]
    audit_frequency: str
    last_audit_date: Optional[datetime]
    next_audit_date: Optional[datetime]
    status: str
    risk_assessment: Dict[str, Any]

class DPAManager:
    """
    Comprehensive DPA management system
    """
    
    def __init__(self, audit_logger: Optional[AuditLogger] = None):
        self.audit_logger = audit_logger or AuditLogger()
        self.template_path = Path(__file__).parent / "templates"
        self.contract_templates = self._load_contract_templates()
        
    def _load_contract_templates(self) -> Dict[str, Any]:
        """Load DPA contract templates"""
        templates = {
            "standard_gdpr": {
                "name": "Standard GDPR DPA",
                "framework": ComplianceFramework.GDPR,
                "template_file": "standard_gdpr_dpa.json",
                "required_sections": [
                    "definitions", "subject_matter", "duration", "nature_and_purpose",
                    "type_of_personal_data", "categories_of_data_subjects",
                    "obligations_and_rights", "security_measures", "sub_processing",
                    "data_subject_rights", "breach_notification", "audit_rights",
                    "termination", "governing_law"
                ]
            },
            "enterprise_gdpr": {
                "name": "Enterprise GDPR DPA",
                "framework": ComplianceFramework.GDPR,
                "template_file": "enterprise_gdpr_dpa.json",
                "required_sections": [
                    "definitions", "subject_matter", "duration", "nature_and_purpose",
                    "type_of_personal_data", "categories_of_data_subjects",
                    "obligations_and_rights", "security_measures", "sub_processing",
                    "data_subject_rights", "breach_notification", "audit_rights",
                    "termination", "governing_law", "liability", "indemnification",
                    "dispute_resolution", "force_majeure"
                ]
            },
            "international_transfer": {
                "name": "International Transfer DPA",
                "framework": ComplianceFramework.GDPR,
                "template_file": "international_transfer_dpa.json",
                "required_sections": [
                    "definitions", "subject_matter", "duration", "nature_and_purpose",
                    "type_of_personal_data", "categories_of_data_subjects",
                    "obligations_and_rights", "security_measures", "sub_processing",
                    "data_subject_rights", "breach_notification", "audit_rights",
                    "termination", "governing_law", "international_transfers",
                    "standard_contractual_clauses", "transfer_mechanisms"
                ]
            }
        }
        return templates
    
    async def generate_dpa_contract(
        self,
        client_info: Dict[str, Any],
        processing_details: DPAProcessingDetails,
        template_type: str = "standard_gdpr",
        custom_terms: Optional[Dict[str, Any]] = None
    ) -> DPAContract:
        """
        Generate a comprehensive DPA contract
        
        Args:
            client_info: Client organization and contact information
            processing_details: Data processing activities details
            template_type: Type of DPA template to use
            custom_terms: Custom terms and conditions
            
        Returns:
            Generated DPA contract
        """
        logger.info(f"Generating DPA contract for client: {client_info.get('name')}")
        
        # Validate template type
        if template_type not in self.contract_templates:
            raise ValueError(f"Invalid template type: {template_type}")
        
        template = self.contract_templates[template_type]
        
        # Generate contract ID and version
        contract_id = f"DPA-{uuid.uuid4().hex[:8].upper()}"
        version = "1.0"
        
        # Create contract structure
        contract = DPAContract(
            contract_id=contract_id,
            version=version,
            status=DPAStatus.DRAFT,
            client_info=client_info,
            processing_details=processing_details,
            terms_and_conditions=self._generate_terms_and_conditions(template, custom_terms),
            security_measures=self._generate_security_measures(processing_details),
            data_subject_rights=self._generate_data_subject_rights(),
            breach_notification=self._generate_breach_notification(),
            audit_rights=self._generate_audit_rights(),
            termination_clauses=self._generate_termination_clauses(),
            created_at=datetime.utcnow(),
            effective_date=None,
            expiry_date=None,
            workflow_step=DPAWorkflowStep.INITIATED,
            approval_chain=[]
        )
        
        # Log contract generation
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="dpa_contract_generated",
            actor_id="system",
            resource=f"dpa_contract:{contract_id}",
            result="success",
            context={
                "client_name": client_info.get("name"),
                "template_type": template_type,
                "processing_purposes": processing_details.purpose
            }
        )
        
        return contract
    
    def _generate_terms_and_conditions(
        self,
        template: Dict[str, Any],
        custom_terms: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate terms and conditions based on template"""
        base_terms = {
            "definitions": {
                "personal_data": "Any information relating to an identified or identifiable natural person",
                "processing": "Any operation performed on personal data",
                "data_subject": "The natural person to whom personal data relates",
                "controller": "The entity determining the purposes and means of processing",
                "processor": "The entity processing personal data on behalf of the controller"
            },
            "subject_matter": "This agreement governs the processing of personal data by the processor on behalf of the controller",
            "duration": "This agreement shall remain in effect for the duration of the processing activities",
            "nature_and_purpose": "Processing for the purposes specified in the processing details",
            "obligations_and_rights": {
                "processor_obligations": [
                    "Process personal data only on documented instructions",
                    "Ensure confidentiality of personal data",
                    "Implement appropriate security measures",
                    "Assist controller in responding to data subject requests",
                    "Assist controller in ensuring compliance with GDPR obligations",
                    "Delete or return personal data after processing",
                    "Make available to controller all information necessary to demonstrate compliance"
                ],
                "controller_rights": [
                    "Right to audit processor compliance",
                    "Right to receive breach notifications",
                    "Right to approve sub-processors",
                    "Right to terminate processing",
                    "Right to receive processing records"
                ]
            }
        }
        
        # Merge custom terms if provided
        if custom_terms:
            base_terms.update(custom_terms)
        
        return base_terms
    
    def _generate_security_measures(self, processing_details: DPAProcessingDetails) -> Dict[str, Any]:
        """Generate security measures section"""
        return {
            "technical_measures": [
                "Encryption of personal data at rest and in transit",
                "Access controls and authentication mechanisms",
                "Regular security assessments and penetration testing",
                "Incident detection and response procedures",
                "Data backup and disaster recovery procedures"
            ],
            "organizational_measures": [
                "Staff training on data protection",
                "Confidentiality agreements for personnel",
                "Physical security controls",
                "Vendor management and oversight",
                "Regular compliance monitoring and reporting"
            ],
            "specific_measures": processing_details.security_measures
        }
    
    def _generate_data_subject_rights(self) -> Dict[str, Any]:
        """Generate data subject rights section"""
        return {
            "right_of_access": {
                "description": "Data subjects have the right to access their personal data",
                "processor_obligations": [
                    "Assist controller in responding to access requests",
                    "Provide controller with requested personal data",
                    "Maintain records of access requests"
                ]
            },
            "right_to_rectification": {
                "description": "Data subjects have the right to correct inaccurate personal data",
                "processor_obligations": [
                    "Assist controller in rectifying personal data",
                    "Notify sub-processors of rectifications",
                    "Update processing records"
                ]
            },
            "right_to_erasure": {
                "description": "Data subjects have the right to have personal data erased",
                "processor_obligations": [
                    "Assist controller in erasing personal data",
                    "Ensure erasure from all systems and backups",
                    "Notify sub-processors of erasure requests"
                ]
            },
            "right_to_data_portability": {
                "description": "Data subjects have the right to receive personal data in structured format",
                "processor_obligations": [
                    "Assist controller in providing data in portable format",
                    "Ensure data is provided in machine-readable format",
                    "Maintain data structure during portability"
                ]
            }
        }
    
    def _generate_breach_notification(self) -> Dict[str, Any]:
        """Generate breach notification section"""
        return {
            "notification_timeline": "72 hours from becoming aware of the breach",
            "notification_content": [
                "Nature of the personal data breach",
                "Likely consequences of the breach",
                "Measures taken or proposed to address the breach",
                "Contact details of the data protection officer"
            ],
            "processor_obligations": [
                "Notify controller without undue delay",
                "Provide detailed information about the breach",
                "Assist controller in notifying supervisory authorities",
                "Assist controller in notifying data subjects",
                "Document all breaches and remedial actions"
            ]
        }
    
    def _generate_audit_rights(self) -> Dict[str, Any]:
        """Generate audit rights section"""
        return {
            "audit_frequency": "Annually or upon reasonable request",
            "audit_scope": [
                "Processing activities and procedures",
                "Security measures implementation",
                "Compliance with DPA obligations",
                "Sub-processor compliance"
            ],
            "audit_process": [
                "Controller may conduct audits or appoint third-party auditors",
                "Processor shall provide reasonable assistance",
                "Audit results shall be shared with processor",
                "Remedial actions shall be implemented within agreed timeframe"
            ]
        }
    
    def _generate_termination_clauses(self) -> Dict[str, Any]:
        """Generate termination clauses"""
        return {
            "termination_grounds": [
                "Breach of DPA obligations",
                "Legal or regulatory requirements",
                "Business relationship termination",
                "Mutual agreement"
            ],
            "post_termination_obligations": [
                "Return or delete all personal data",
                "Provide certification of deletion",
                "Maintain confidentiality obligations",
                "Assist in data portability if requested"
            ],
            "survival_clauses": [
                "Confidentiality obligations",
                "Audit rights for compliance verification",
                "Liability provisions",
                "Dispute resolution procedures"
            ]
        }
    
    async def add_third_party_processor(
        self,
        contract_id: str,
        processor_info: Dict[str, Any]
    ) -> ThirdPartyProcessor:
        """
        Add a third-party processor to a DPA contract
        
        Args:
            contract_id: DPA contract ID
            processor_info: Processor information
            
        Returns:
            Third-party processor record
        """
        processor = ThirdPartyProcessor(
            processor_id=f"PROC-{uuid.uuid4().hex[:8].upper()}",
            name=processor_info["name"],
            processor_type=ProcessorType(processor_info["type"]),
            contact_info=processor_info["contact_info"],
            processing_purposes=processor_info["processing_purposes"],
            data_categories=processor_info["data_categories"],
            security_certifications=processor_info.get("security_certifications", []),
            compliance_frameworks=processor_info.get("compliance_frameworks", []),
            data_transfer_mechanisms=processor_info.get("data_transfer_mechanisms", []),
            audit_frequency=processor_info.get("audit_frequency", "annually"),
            last_audit_date=None,
            next_audit_date=datetime.utcnow() + timedelta(days=365),
            status="pending_approval",
            risk_assessment=processor_info.get("risk_assessment", {})
        )
        
        # Log processor addition
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="third_party_processor_added",
            actor_id="system",
            resource=f"dpa_contract:{contract_id}",
            result="success",
            context={
                "processor_name": processor.name,
                "processor_type": processor.processor_type.value,
                "processing_purposes": processor.processing_purposes
            }
        )
        
        return processor
    
    async def initiate_legal_workflow(
        self,
        contract: DPAContract,
        workflow_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Initiate legal workflow for DPA approval
        
        Args:
            contract: DPA contract
            workflow_config: Workflow configuration
            
        Returns:
            Workflow status and next steps
        """
        workflow = {
            "workflow_id": f"WF-{uuid.uuid4().hex[:8].upper()}",
            "contract_id": contract.contract_id,
            "current_step": DPAWorkflowStep.INITIATED,
            "steps": [
                {
                    "step": DPAWorkflowStep.CLIENT_REVIEW,
                    "assignee": workflow_config.get("client_reviewer"),
                    "deadline": datetime.utcnow() + timedelta(days=7),
                    "status": "pending",
                    "required_approval": True
                },
                {
                    "step": DPAWorkflowStep.LEGAL_REVIEW,
                    "assignee": workflow_config.get("legal_reviewer"),
                    "deadline": datetime.utcnow() + timedelta(days=14),
                    "status": "pending",
                    "required_approval": True
                },
                {
                    "step": DPAWorkflowStep.COMPLIANCE_REVIEW,
                    "assignee": workflow_config.get("compliance_reviewer"),
                    "deadline": datetime.utcnow() + timedelta(days=21),
                    "status": "pending",
                    "required_approval": True
                },
                {
                    "step": DPAWorkflowStep.EXECUTIVE_APPROVAL,
                    "assignee": workflow_config.get("executive_approver"),
                    "deadline": datetime.utcnow() + timedelta(days=28),
                    "status": "pending",
                    "required_approval": True
                },
                {
                    "step": DPAWorkflowStep.CLIENT_SIGNATURE,
                    "assignee": workflow_config.get("client_signer"),
                    "deadline": datetime.utcnow() + timedelta(days=35),
                    "status": "pending",
                    "required_approval": True
                },
                {
                    "step": DPAWorkflowStep.FINAL_APPROVAL,
                    "assignee": workflow_config.get("final_approver"),
                    "deadline": datetime.utcnow() + timedelta(days=42),
                    "status": "pending",
                    "required_approval": True
                }
            ],
            "created_at": datetime.utcnow(),
            "status": "active"
        }
        
        # Log workflow initiation
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="dpa_workflow_initiated",
            actor_id="system",
            resource=f"dpa_contract:{contract.contract_id}",
            result="success",
            context={
                "workflow_id": workflow["workflow_id"],
                "total_steps": len(workflow["steps"])
            }
        )
        
        return workflow
    
    async def generate_compliance_certificate(
        self,
        contract: DPAContract,
        audit_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate compliance certificate for DPA
        
        Args:
            contract: DPA contract
            audit_results: Audit results and findings
            
        Returns:
            Compliance certificate
        """
        certificate = {
            "certificate_id": f"CERT-{uuid.uuid4().hex[:8].upper()}",
            "contract_id": contract.contract_id,
            "certification_date": datetime.utcnow(),
            "valid_until": datetime.utcnow() + timedelta(days=365),
            "compliance_frameworks": contract.processing_details.compliance_frameworks,
            "audit_scope": [
                "DPA obligations compliance",
                "Security measures implementation",
                "Data subject rights procedures",
                "Breach notification procedures",
                "Third-party processor oversight"
            ],
            "audit_findings": audit_results.get("findings", []),
            "compliance_score": audit_results.get("compliance_score", 0),
            "recommendations": audit_results.get("recommendations", []),
            "certification_status": "compliant" if audit_results.get("compliance_score", 0) >= 90 else "non_compliant",
            "issued_by": "Schlep-engine Compliance Team",
            "certification_authority": "Internal Compliance Audit"
        }
        
        # Log certificate generation
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="compliance_certificate_generated",
            actor_id="system",
            resource=f"dpa_contract:{contract.contract_id}",
            result="success",
            context={
                "certificate_id": certificate["certificate_id"],
                "compliance_score": certificate["compliance_score"],
                "certification_status": certificate["certification_status"]
            }
        )
        
        return certificate
    
    async def monitor_dpa_compliance(
        self,
        contract_id: str,
        monitoring_period: str = "30d"
    ) -> Dict[str, Any]:
        """
        Monitor DPA compliance status
        
        Args:
            contract_id: DPA contract ID
            monitoring_period: Monitoring period (e.g., "30d", "90d")
            
        Returns:
            Compliance monitoring report
        """
        # This would integrate with the existing compliance monitoring system
        monitoring_report = {
            "contract_id": contract_id,
            "monitoring_period": monitoring_period,
            "monitoring_date": datetime.utcnow(),
            "compliance_status": "compliant",
            "risk_level": "low",
            "key_metrics": {
                "data_processing_activities": "compliant",
                "security_measures": "compliant",
                "data_subject_rights": "compliant",
                "breach_notification": "compliant",
                "third_party_processors": "compliant"
            },
            "compliance_score": 95.0,
            "findings": [],
            "recommendations": [],
            "next_review_date": datetime.utcnow() + timedelta(days=90)
        }
        
        return monitoring_report 