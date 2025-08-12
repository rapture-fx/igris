"""
DPA Compliance API Endpoints
===========================

Comprehensive API endpoints for Data Processing Agreement (DPA) compliance management.
Provides full DPA lifecycle management including contract generation, legal workflows,
third-party processor management, and compliance monitoring.

Endpoints:
- DPA contract generation and management
- Legal workflow automation
- Third-party processor registration and monitoring
- Compliance assessment and reporting
- Data transfer agreement management
- Risk assessment and monitoring
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import logging

from app.database.connection import get_db
from app.database.models import User, Organization
from app.auth.dependencies import get_current_user
from app.security.compliance.dpa_manager import (
    DPAManager, DPAProcessingDetails, DPAContract, DPAStatus, DPAWorkflowStep
)
from app.security.compliance.legal_workflow import (
    LegalWorkflowManager, WorkflowStatus, ApprovalStatus
)
from app.security.compliance.third_party_processor_manager import (
    ThirdPartyProcessorManager, ThirdPartyProcessor, ProcessorStatus, RiskLevel
)
from app.middleware.audit_middleware import AuditLogger
from app.security.compliance import ComplianceFramework

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dpa", tags=["DPA Compliance"])

# Initialize managers
dpa_manager = DPAManager()
workflow_manager = LegalWorkflowManager()
processor_manager = ThirdPartyProcessorManager()
audit_logger = AuditLogger()

# ==================== REQUEST/RESPONSE MODELS ====================

class DPAProcessingDetailsRequest(BaseModel):
    purpose: str = Field(..., description="Purpose of data processing")
    legal_basis: str = Field(..., description="Legal basis for processing")
    data_categories: List[str] = Field(..., description="Categories of personal data")
    data_subjects: List[str] = Field(..., description="Categories of data subjects")
    retention_period: str = Field(..., description="Data retention period")
    data_transfers: List[str] = Field(default=[], description="Countries for data transfers")
    security_measures: List[str] = Field(default=[], description="Security measures")
    sub_processors: List[str] = Field(default=[], description="Sub-processors")
    processing_location: str = Field(..., description="Processing location")
    compliance_frameworks: List[str] = Field(default=["GDPR"], description="Compliance frameworks")

class ClientInfoRequest(BaseModel):
    name: str = Field(..., description="Client organization name")
    legal_entity: str = Field(..., description="Legal entity name")
    registration_number: str = Field(..., description="Registration number")
    country: str = Field(..., description="Country of establishment")
    contact_person: str = Field(..., description="Primary contact person")
    email: str = Field(..., description="Contact email")
    phone: str = Field(..., description="Contact phone")
    address: str = Field(..., description="Business address")
    data_protection_officer: Optional[str] = Field(None, description="DPO contact")

class DPAWorkflowRequest(BaseModel):
    workflow_type: str = Field(..., description="Type of workflow")
    assignees: Dict[str, str] = Field(..., description="Role to user ID mappings")
    custom_config: Optional[Dict[str, Any]] = Field(None, description="Custom configuration")

class ThirdPartyProcessorRequest(BaseModel):
    name: str = Field(..., description="Processor name")
    legal_entity: str = Field(..., description="Legal entity name")
    registration_number: str = Field(..., description="Registration number")
    country_of_establishment: str = Field(..., description="Country of establishment")
    contact_info: Dict[str, str] = Field(..., description="Contact information")
    processor_type: str = Field(..., description="Type of processor")
    processing_purposes: List[str] = Field(..., description="Processing purposes")
    data_categories: List[str] = Field(..., description="Data categories")
    data_subjects: List[str] = Field(..., description="Data subjects")
    data_sensitivity: str = Field(default="medium", description="Data sensitivity level")
    processing_volume: str = Field(default="medium", description="Processing volume")
    geographic_scope: str = Field(default="local", description="Geographic scope")
    security_maturity: str = Field(default="standard", description="Security maturity")
    compliance_history: str = Field(default="good", description="Compliance history")
    review_frequency: str = Field(default="annually", description="Review frequency")
    security_certifications: Optional[List[Dict[str, Any]]] = Field(None, description="Security certifications")

class DataTransferAgreementRequest(BaseModel):
    transfer_mechanism: str = Field(..., description="Transfer mechanism")
    source_country: str = Field(..., description="Source country")
    destination_country: str = Field(..., description="Destination country")
    data_categories: List[str] = Field(..., description="Data categories")
    processing_purposes: List[str] = Field(..., description="Processing purposes")
    security_measures: List[str] = Field(..., description="Security measures")
    agreement_date: str = Field(..., description="Agreement date (ISO format)")
    expiry_date: str = Field(..., description="Expiry date (ISO format)")
    scc_modules: Optional[List[str]] = Field(None, description="SCC modules")
    adequacy_decision_reference: Optional[str] = Field(None, description="Adequacy decision reference")

class ComplianceAssessmentRequest(BaseModel):
    framework: str = Field(..., description="Compliance framework")
    compliance_score: float = Field(..., description="Compliance score (0-100)")
    findings: Optional[List[Dict[str, Any]]] = Field(None, description="Assessment findings")
    recommendations: Optional[List[str]] = Field(None, description="Recommendations")

# ==================== DPA CONTRACT ENDPOINTS ====================

@router.post("/contracts/generate", response_model=Dict[str, Any])
async def generate_dpa_contract(
    client_info: ClientInfoRequest,
    processing_details: DPAProcessingDetailsRequest,
    template_type: str = "standard_gdpr",
    custom_terms: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a comprehensive DPA contract
    
    This endpoint creates a complete Data Processing Agreement with all required
    clauses for GDPR compliance, including security measures, data subject rights,
    breach notification procedures, and audit rights.
    """
    try:
        # Convert request models to internal models
        client_info_dict = client_info.dict()
        processing_details_obj = DPAProcessingDetails(
            purpose=processing_details.purpose,
            legal_basis=processing_details.legal_basis,
            data_categories=processing_details.data_categories,
            data_subjects=processing_details.data_subjects,
            retention_period=processing_details.retention_period,
            data_transfers=processing_details.data_transfers,
            security_measures=processing_details.security_measures,
            sub_processors=processing_details.sub_processors,
            processing_location=processing_details.processing_location,
            compliance_frameworks=processing_details.compliance_frameworks
        )
        
        # Generate DPA contract
        contract = await dpa_manager.generate_dpa_contract(
            client_info=client_info_dict,
            processing_details=processing_details_obj,
            template_type=template_type,
            custom_terms=custom_terms
        )
        
        # Log contract generation
        await audit_logger.log_event(
            event_type="compliance",
            action="dpa_contract_generated",
            actor_id=str(current_user.id),
            resource=f"dpa_contract:{contract.contract_id}",
            result="success",
            context={
                "client_name": client_info.name,
                "template_type": template_type,
                "processing_purposes": processing_details.purpose
            }
        )
        
        return {
            "status": "success",
            "contract_id": contract.contract_id,
            "contract": contract.dict(), # Use contract.dict() to get a dictionary representation
            "message": "DPA contract generated successfully"
        }
        
    except Exception as e:
        logger.error(f"Error generating DPA contract: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate DPA contract: {str(e)}"
        )

@router.get("/contracts/{contract_id}", response_model=Dict[str, Any])
async def get_dpa_contract(
    contract_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get DPA contract details
    
    Retrieve comprehensive information about a specific DPA contract including
    all terms, conditions, and current status.
    """
    try:
        # This would typically fetch from database
        # For now, return a mock response
        contract_info = {
            "contract_id": contract_id,
            "status": "draft",
            "client_info": {
                "name": "Example Client Corp",
                "legal_entity": "Example Client Corporation",
                "country": "United States"
            },
            "processing_details": {
                "purpose": "Customer data processing",
                "legal_basis": "Legitimate interest",
                "data_categories": ["Personal data", "Contact information"],
                "data_subjects": ["Customers", "Prospects"]
            },
            "created_at": datetime.utcnow().isoformat(),
            "message": "Contract details retrieved successfully"
        }
        
        return contract_info
        
    except Exception as e:
        logger.error(f"Error retrieving DPA contract: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve DPA contract: {str(e)}"
        )

# ==================== LEGAL WORKFLOW ENDPOINTS ====================

@router.post("/workflows/create", response_model=Dict[str, Any])
async def create_legal_workflow(
    contract_id: str,
    workflow_request: DPAWorkflowRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a legal workflow for DPA approval
    
    Initiates a comprehensive legal workflow with multiple approval steps including
    client review, legal review, compliance review, executive approval, and final approval.
    """
    try:
        # Create workflow
        workflow = await workflow_manager.create_workflow(
            contract_id=contract_id,
            workflow_type=workflow_request.workflow_type,
            assignees=workflow_request.assignees,
            custom_config=workflow_request.custom_config
        )
        
        # Log workflow creation
        await audit_logger.log_event(
            event_type="compliance",
            action="legal_workflow_created",
            actor_id=str(current_user.id),
            resource=f"workflow:{workflow.workflow_id}",
            result="success",
            context={
                "contract_id": contract_id,
                "workflow_type": workflow_request.workflow_type,
                "total_steps": len(workflow.steps)
            }
        )
        
        return {
            "status": "success",
            "workflow_id": workflow.workflow_id,
            "workflow": {
                "workflow_id": workflow.workflow_id,
                "contract_id": workflow.contract_id,
                "workflow_type": workflow.workflow_type,
                "status": workflow.status.value,
                "current_step": workflow.current_step,
                "total_steps": len(workflow.steps),
                "created_at": workflow.created_at.isoformat()
            },
            "message": "Legal workflow created successfully"
        }
        
    except Exception as e:
        logger.error(f"Error creating legal workflow: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create legal workflow: {str(e)}"
        )

@router.post("/workflows/{workflow_id}/approve", response_model=Dict[str, Any])
async def approve_workflow_step(
    workflow_id: str,
    step_id: str,
    approval_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Approve a workflow step
    
    Approve a specific step in the legal workflow with detailed approval information
    and comments.
    """
    try:
        # Approve step
        result = await workflow_manager.approve_step(
            workflow_id=workflow_id,
            step_id=step_id,
            approver_id=str(current_user.id),
            approval_data=approval_data
        )
        
        return {
            "status": "success",
            "workflow_id": workflow_id,
            "step_id": step_id,
            "approval_status": "approved",
            "approver_id": str(current_user.id),
            "approval_date": datetime.utcnow().isoformat(),
            "next_step": result.get("next_step"),
            "message": "Workflow step approved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error approving workflow step: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve workflow step: {str(e)}"
        )

@router.get("/workflows/{workflow_id}/status", response_model=Dict[str, Any])
async def get_workflow_status(
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get workflow status and progress
    
    Retrieve detailed information about workflow progress, current step,
    and overall status.
    """
    try:
        # Get workflow status
        status_info = await workflow_manager.get_workflow_status(workflow_id)
        
        return {
            "status": "success",
            "workflow_status": status_info,
            "message": "Workflow status retrieved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error retrieving workflow status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve workflow status: {str(e)}"
        )

# ==================== THIRD-PARTY PROCESSOR ENDPOINTS ====================

@router.post("/processors/register", response_model=Dict[str, Any])
async def register_third_party_processor(
    processor_request: ThirdPartyProcessorRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Register a third-party processor
    
    Register a new third-party processor with comprehensive risk assessment,
    security certification tracking, and compliance monitoring.
    """
    try:
        # Convert request to processor info
        processor_info = processor_request.dict()
        
        # Register processor
        processor = await processor_manager.register_processor(
            processor_info=processor_info,
            security_certifications=processor_info.get("security_certifications"),
            compliance_frameworks=["GDPR"]  # Default to GDPR
        )
        
        return {
            "status": "success",
            "processor_id": processor.processor_id,
            "processor": {
                "processor_id": processor.processor_id,
                "name": processor.name,
                "status": processor.status.value,
                "risk_assessment": processor.risk_assessment,
                "created_at": processor.created_at.isoformat()
            },
            "message": "Third-party processor registered successfully"
        }
        
    except Exception as e:
        logger.error(f"Error registering third-party processor: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register third-party processor: {str(e)}"
        )

@router.post("/processors/{processor_id}/approve", response_model=Dict[str, Any])
async def approve_third_party_processor(
    processor_id: str,
    approval_conditions: List[str] = [],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Approve a third-party processor
    
    Approve a registered third-party processor with specific conditions
    and requirements for ongoing compliance.
    """
    try:
        # Approve processor
        result = await processor_manager.approve_processor(
            processor_id=processor_id,
            approver_id=str(current_user.id),
            approval_conditions=approval_conditions
        )
        
        return {
            "status": "success",
            "processor_id": processor_id,
            "approval_status": "approved",
            "approval_date": result["approval_date"],
            "approval_conditions": result["approval_conditions"],
            "message": "Third-party processor approved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error approving third-party processor: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve third-party processor: {str(e)}"
        )

@router.post("/processors/{processor_id}/transfer-agreements", response_model=Dict[str, Any])
async def add_data_transfer_agreement(
    processor_id: str,
    transfer_request: DataTransferAgreementRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add data transfer agreement for a processor
    
    Create a data transfer agreement with appropriate safeguards for
    international data transfers, including Standard Contractual Clauses.
    """
    try:
        # Convert request to transfer info
        transfer_info = transfer_request.dict()
        
        # Add transfer agreement
        agreement = await processor_manager.add_data_transfer_agreement(
            processor_id=processor_id,
            transfer_info=transfer_info
        )
        
        return {
            "status": "success",
            "agreement_id": agreement.agreement_id,
            "agreement": {
                "agreement_id": agreement.agreement_id,
                "transfer_mechanism": agreement.transfer_mechanism.value,
                "source_country": agreement.source_country,
                "destination_country": agreement.destination_country,
                "status": agreement.status,
                "agreement_date": agreement.agreement_date.isoformat(),
                "expiry_date": agreement.expiry_date.isoformat()
            },
            "message": "Data transfer agreement added successfully"
        }
        
    except Exception as e:
        logger.error(f"Error adding data transfer agreement: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add data transfer agreement: {str(e)}"
        )

@router.post("/processors/{processor_id}/assessments", response_model=Dict[str, Any])
async def conduct_compliance_assessment(
    processor_id: str,
    assessment_request: ComplianceAssessmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Conduct compliance assessment for a processor
    
    Perform a comprehensive compliance assessment for a third-party processor
    with detailed findings and recommendations.
    """
    try:
        # Convert request to assessment data
        assessment_data = assessment_request.dict()
        
        # Conduct assessment
        assessment = await processor_manager.conduct_compliance_assessment(
            processor_id=processor_id,
            framework=ComplianceFramework(assessment_request.framework),
            assessor_id=str(current_user.id),
            assessment_data=assessment_data
        )
        
        return {
            "status": "success",
            "assessment_id": assessment.assessment_id,
            "assessment": {
                "assessment_id": assessment.assessment_id,
                "framework": assessment.framework.value,
                "compliance_score": assessment.compliance_score,
                "assessment_date": assessment.assessment_date.isoformat(),
                "next_assessment_date": assessment.next_assessment_date.isoformat(),
                "status": assessment.status
            },
            "message": "Compliance assessment conducted successfully"
        }
        
    except Exception as e:
        logger.error(f"Error conducting compliance assessment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to conduct compliance assessment: {str(e)}"
        )

@router.get("/processors/{processor_id}/summary", response_model=Dict[str, Any])
async def get_processor_summary(
    processor_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive processor summary
    
    Retrieve detailed summary of a third-party processor including
    compliance metrics, risk assessment, and processing activities.
    """
    try:
        # Get processor summary
        summary = await processor_manager.get_processor_summary(processor_id)
        
        return {
            "status": "success",
            "processor_summary": summary,
            "message": "Processor summary retrieved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error retrieving processor summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve processor summary: {str(e)}"
        )

# ==================== COMPLIANCE REPORTING ENDPOINTS ====================

@router.get("/compliance/report", response_model=Dict[str, Any])
async def generate_compliance_report(
    framework: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate comprehensive compliance report
    
    Generate a detailed compliance report covering all third-party processors,
    risk assessments, and compliance status across all frameworks.
    """
    try:
        # Convert framework string to enum if provided
        compliance_framework = None
        if framework:
            compliance_framework = ComplianceFramework(framework)
        
        # Generate report
        report = await processor_manager.generate_compliance_report(compliance_framework)
        
        return {
            "status": "success",
            "compliance_report": report,
            "message": "Compliance report generated successfully"
        }
        
    except Exception as e:
        logger.error(f"Error generating compliance report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate compliance report: {str(e)}"
        )

@router.get("/compliance/status", response_model=Dict[str, Any])
async def get_overall_compliance_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get overall compliance status
    
    Retrieve high-level compliance status across all DPA contracts,
    workflows, and third-party processors.
    """
    try:
        # This would aggregate status from all components
        compliance_status = {
            "overall_status": "compliant",
            "dpa_contracts": {
                "total": 0,
                "active": 0,
                "pending": 0,
                "expired": 0
            },
            "workflows": {
                "total": 0,
                "active": 0,
                "completed": 0,
                "pending": 0
            },
            "processors": {
                "total": 0,
                "approved": 0,
                "pending": 0,
                "suspended": 0
            },
            "risk_level": "low",
            "last_assessment": datetime.utcnow().isoformat(),
            "next_assessment": (datetime.utcnow() + timedelta(days=90)).isoformat()
        }
        
        return {
            "status": "success",
            "compliance_status": compliance_status,
            "message": "Compliance status retrieved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error retrieving compliance status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve compliance status: {str(e)}"
        ) 