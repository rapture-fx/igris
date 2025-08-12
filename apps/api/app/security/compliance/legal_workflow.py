"""
Legal Workflow Management System
===============================

Comprehensive legal workflow management for DPA contracts, including:
- Multi-step approval workflows
- Automated notifications and reminders
- Legal review and compliance checks
- Contract versioning and change management
- Electronic signature integration
- Compliance certification automation

Features:
- Configurable approval chains
- Role-based access control
- Automated deadline tracking
- Escalation procedures
- Audit trail for all workflow actions
- Integration with compliance monitoring
- Legal document generation and management
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from dataclasses import dataclass
import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.audit_middleware import AuditLogger
# SecurityEventType import commented out for now
from app.security.compliance.dpa_manager import DPAWorkflowStep, DPAStatus

logger = logging.getLogger(__name__)

class WorkflowStatus(Enum):
    """Workflow status"""
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"
    ESCALATED = "escalated"

class ApprovalStatus(Enum):
    """Approval status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"
    EXPIRED = "expired"

class NotificationType(Enum):
    """Notification types"""
    WORKFLOW_STARTED = "workflow_started"
    APPROVAL_REQUIRED = "approval_required"
    APPROVAL_COMPLETED = "approval_completed"
    DEADLINE_REMINDER = "deadline_reminder"
    ESCALATION_NOTICE = "escalation_notice"
    WORKFLOW_COMPLETED = "workflow_completed"

@dataclass
class WorkflowStep:
    """Workflow step definition"""
    step_id: str
    step_name: str
    step_type: DPAWorkflowStep
    assignee_role: str
    assignee_id: Optional[str]
    deadline_days: int
    required_approval: bool
    auto_approve: bool
    escalation_after_hours: int
    parallel_steps: List[str]
    dependencies: List[str]
    approval_criteria: Dict[str, Any]

@dataclass
class WorkflowInstance:
    """Workflow instance"""
    workflow_id: str
    contract_id: str
    workflow_type: str
    status: WorkflowStatus
    current_step: str
    steps: List[WorkflowStep]
    step_status: Dict[str, ApprovalStatus]
    step_approvals: Dict[str, Dict[str, Any]]
    created_at: datetime
    started_at: datetime
    completed_at: Optional[datetime]
    total_duration: Optional[timedelta]
    escalations: List[Dict[str, Any]]
    notifications_sent: List[Dict[str, Any]]

class LegalWorkflowManager:
    """
    Legal workflow management system
    """
    
    def __init__(self, audit_logger: Optional[AuditLogger] = None):
        self.audit_logger = audit_logger or AuditLogger()
        self.active_workflows: Dict[str, WorkflowInstance] = {}
        self.workflow_templates = self._load_workflow_templates()
        
    def _load_workflow_templates(self) -> Dict[str, Dict[str, Any]]:
        """Load workflow templates"""
        return {
            "standard_dpa_approval": {
                "name": "Standard DPA Approval Workflow",
                "description": "Standard workflow for DPA contract approval",
                "steps": [
                    {
                        "step_name": "Client Review",
                        "step_type": DPAWorkflowStep.CLIENT_REVIEW,
                        "assignee_role": "client_reviewer",
                        "deadline_days": 7,
                        "required_approval": True,
                        "auto_approve": False,
                        "escalation_after_hours": 168  # 7 days
                    },
                    {
                        "step_name": "Legal Review",
                        "step_type": DPAWorkflowStep.LEGAL_REVIEW,
                        "assignee_role": "legal_reviewer",
                        "deadline_days": 14,
                        "required_approval": True,
                        "auto_approve": False,
                        "escalation_after_hours": 336  # 14 days
                    },
                    {
                        "step_name": "Compliance Review",
                        "step_type": DPAWorkflowStep.COMPLIANCE_REVIEW,
                        "assignee_role": "compliance_reviewer",
                        "deadline_days": 21,
                        "required_approval": True,
                        "auto_approve": False,
                        "escalation_after_hours": 504  # 21 days
                    },
                    {
                        "step_name": "Executive Approval",
                        "step_type": DPAWorkflowStep.EXECUTIVE_APPROVAL,
                        "assignee_role": "executive_approver",
                        "deadline_days": 28,
                        "required_approval": True,
                        "auto_approve": False,
                        "escalation_after_hours": 672  # 28 days
                    },
                    {
                        "step_name": "Client Signature",
                        "step_type": DPAWorkflowStep.CLIENT_SIGNATURE,
                        "assignee_role": "client_signer",
                        "deadline_days": 35,
                        "required_approval": True,
                        "auto_approve": False,
                        "escalation_after_hours": 840  # 35 days
                    },
                    {
                        "step_name": "Final Approval",
                        "step_type": DPAWorkflowStep.FINAL_APPROVAL,
                        "assignee_role": "final_approver",
                        "deadline_days": 42,
                        "required_approval": True,
                        "auto_approve": False,
                        "escalation_after_hours": 1008  # 42 days
                    }
                ]
            },
            "expedited_dpa_approval": {
                "name": "Expedited DPA Approval Workflow",
                "description": "Expedited workflow for urgent DPA contracts",
                "steps": [
                    {
                        "step_name": "Legal Review",
                        "step_type": DPAWorkflowStep.LEGAL_REVIEW,
                        "assignee_role": "legal_reviewer",
                        "deadline_days": 3,
                        "required_approval": True,
                        "auto_approve": False,
                        "escalation_after_hours": 72  # 3 days
                    },
                    {
                        "step_name": "Executive Approval",
                        "step_type": DPAWorkflowStep.EXECUTIVE_APPROVAL,
                        "assignee_role": "executive_approver",
                        "deadline_days": 5,
                        "required_approval": True,
                        "auto_approve": False,
                        "escalation_after_hours": 120  # 5 days
                    },
                    {
                        "step_name": "Client Signature",
                        "step_type": DPAWorkflowStep.CLIENT_SIGNATURE,
                        "assignee_role": "client_signer",
                        "deadline_days": 7,
                        "required_approval": True,
                        "auto_approve": False,
                        "escalation_after_hours": 168  # 7 days
                    }
                ]
            }
        }
    
    async def create_workflow(
        self,
        contract_id: str,
        workflow_type: str,
        assignees: Dict[str, str],
        custom_config: Optional[Dict[str, Any]] = None
    ) -> WorkflowInstance:
        """
        Create a new workflow instance
        
        Args:
            contract_id: DPA contract ID
            workflow_type: Type of workflow template
            assignees: Dictionary of role to user ID mappings
            custom_config: Custom workflow configuration
            
        Returns:
            Workflow instance
        """
        if workflow_type not in self.workflow_templates:
            raise ValueError(f"Invalid workflow type: {workflow_type}")
        
        template = self.workflow_templates[workflow_type]
        workflow_id = f"WF-{uuid.uuid4().hex[:8].upper()}"
        
        # Create workflow steps
        steps = []
        step_status = {}
        step_approvals = {}
        
        for i, step_config in enumerate(template["steps"]):
            step_id = f"step_{i+1}"
            step = WorkflowStep(
                step_id=step_id,
                step_name=step_config["step_name"],
                step_type=step_config["step_type"],
                assignee_role=step_config["assignee_role"],
                assignee_id=assignees.get(step_config["assignee_role"]),
                deadline_days=step_config["deadline_days"],
                required_approval=step_config["required_approval"],
                auto_approve=step_config["auto_approve"],
                escalation_after_hours=step_config["escalation_after_hours"],
                parallel_steps=step_config.get("parallel_steps", []),
                dependencies=step_config.get("dependencies", []),
                approval_criteria=step_config.get("approval_criteria", {})
            )
            steps.append(step)
            step_status[step_id] = ApprovalStatus.PENDING
            step_approvals[step_id] = {}
        
        # Create workflow instance
        workflow = WorkflowInstance(
            workflow_id=workflow_id,
            contract_id=contract_id,
            workflow_type=workflow_type,
            status=WorkflowStatus.ACTIVE,
            current_step=steps[0].step_id if steps else None,
            steps=steps,
            step_status=step_status,
            step_approvals=step_approvals,
            created_at=datetime.utcnow(),
            started_at=datetime.utcnow(),
            completed_at=None,
            total_duration=None,
            escalations=[],
            notifications_sent=[]
        )
        
        # Store workflow
        self.active_workflows[workflow_id] = workflow
        
        # Log workflow creation
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="legal_workflow_created",
            actor_id="system",
            resource=f"dpa_contract:{contract_id}",
            result="success",
            context={
                "workflow_id": workflow_id,
                "workflow_type": workflow_type,
                "total_steps": len(steps)
            }
        )
        
        # Send initial notifications
        await self._send_workflow_notifications(workflow, NotificationType.WORKFLOW_STARTED)
        
        return workflow
    
    async def approve_step(
        self,
        workflow_id: str,
        step_id: str,
        approver_id: str,
        approval_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Approve a workflow step
        
        Args:
            workflow_id: Workflow ID
            step_id: Step ID to approve
            approver_id: ID of the approver
            approval_data: Approval details and comments
            
        Returns:
            Approval result
        """
        if workflow_id not in self.active_workflows:
            raise ValueError(f"Workflow not found: {workflow_id}")
        
        workflow = self.active_workflows[workflow_id]
        
        if step_id not in workflow.step_status:
            raise ValueError(f"Step not found: {step_id}")
        
        if workflow.step_status[step_id] != ApprovalStatus.PENDING:
            raise ValueError(f"Step is not pending approval: {step_id}")
        
        # Record approval
        workflow.step_approvals[step_id] = {
            "approver_id": approver_id,
            "approval_date": datetime.utcnow(),
            "approval_data": approval_data,
            "status": "approved"
        }
        workflow.step_status[step_id] = ApprovalStatus.APPROVED
        
        # Log approval
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="workflow_step_approved",
            actor_id=approver_id,
            resource=f"workflow:{workflow_id}",
            result="success",
            context={
                "step_id": step_id,
                "step_name": next(s.step_name for s in workflow.steps if s.step_id == step_id),
                "approval_data": approval_data
            }
        )
        
        # Check if workflow is complete
        if await self._is_workflow_complete(workflow):
            await self._complete_workflow(workflow)
        else:
            # Move to next step
            await self._advance_workflow(workflow)
        
        return {
            "workflow_id": workflow_id,
            "step_id": step_id,
            "status": "approved",
            "next_step": workflow.current_step
        }
    
    async def reject_step(
        self,
        workflow_id: str,
        step_id: str,
        rejector_id: str,
        rejection_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Reject a workflow step
        
        Args:
            workflow_id: Workflow ID
            step_id: Step ID to reject
            rejector_id: ID of the rejector
            rejection_data: Rejection details and comments
            
        Returns:
            Rejection result
        """
        if workflow_id not in self.active_workflows:
            raise ValueError(f"Workflow not found: {workflow_id}")
        
        workflow = self.active_workflows[workflow_id]
        
        if step_id not in workflow.step_status:
            raise ValueError(f"Step not found: {step_id}")
        
        # Record rejection
        workflow.step_approvals[step_id] = {
            "rejector_id": rejector_id,
            "rejection_date": datetime.utcnow(),
            "rejection_data": rejection_data,
            "status": "rejected"
        }
        workflow.step_status[step_id] = ApprovalStatus.REJECTED
        
        # Log rejection
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="workflow_step_rejected",
            actor_id=rejector_id,
            resource=f"workflow:{workflow_id}",
            result="success",
            context={
                "step_id": step_id,
                "step_name": next(s.step_name for s in workflow.steps if s.step_id == step_id),
                "rejection_data": rejection_data
            }
        )
        
        # Handle rejection (return to previous step or cancel workflow)
        await self._handle_step_rejection(workflow, step_id, rejection_data)
        
        return {
            "workflow_id": workflow_id,
            "step_id": step_id,
            "status": "rejected",
            "workflow_status": workflow.status.value
        }
    
    async def escalate_workflow(
        self,
        workflow_id: str,
        step_id: str,
        escalation_reason: str,
        escalated_to: str
    ) -> Dict[str, Any]:
        """
        Escalate a workflow step
        
        Args:
            workflow_id: Workflow ID
            step_id: Step ID to escalate
            escalation_reason: Reason for escalation
            escalated_to: User ID to escalate to
            
        Returns:
            Escalation result
        """
        if workflow_id not in self.active_workflows:
            raise ValueError(f"Workflow not found: {workflow_id}")
        
        workflow = self.active_workflows[workflow_id]
        
        # Record escalation
        escalation = {
            "step_id": step_id,
            "escalation_date": datetime.utcnow(),
            "escalation_reason": escalation_reason,
            "escalated_to": escalated_to,
            "original_assignee": next(s.assignee_id for s in workflow.steps if s.step_id == step_id)
        }
        workflow.escalations.append(escalation)
        
        # Update step assignee
        for step in workflow.steps:
            if step.step_id == step_id:
                step.assignee_id = escalated_to
                break
        
        workflow.step_status[step_id] = ApprovalStatus.ESCALATED
        
        # Log escalation
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="workflow_step_escalated",
            actor_id="system",
            resource=f"workflow:{workflow_id}",
            result="success",
            context={
                "step_id": step_id,
                "escalation_reason": escalation_reason,
                "escalated_to": escalated_to
            }
        )
        
        # Send escalation notification
        await self._send_workflow_notifications(workflow, NotificationType.ESCALATION_NOTICE)
        
        return {
            "workflow_id": workflow_id,
            "step_id": step_id,
            "status": "escalated",
            "escalated_to": escalated_to
        }
    
    async def get_workflow_status(self, workflow_id: str) -> Dict[str, Any]:
        """
        Get workflow status and details
        
        Args:
            workflow_id: Workflow ID
            
        Returns:
            Workflow status information
        """
        if workflow_id not in self.active_workflows:
            raise ValueError(f"Workflow not found: {workflow_id}")
        
        workflow = self.active_workflows[workflow_id]
        
        # Calculate progress
        total_steps = len(workflow.steps)
        completed_steps = sum(1 for status in workflow.step_status.values() 
                            if status in [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED])
        progress_percentage = (completed_steps / total_steps) * 100 if total_steps > 0 else 0
        
        # Get current step details
        current_step = None
        if workflow.current_step:
            current_step = next((s for s in workflow.steps if s.step_id == workflow.current_step), None)
        
        return {
            "workflow_id": workflow_id,
            "contract_id": workflow.contract_id,
            "workflow_type": workflow.workflow_type,
            "status": workflow.status.value,
            "current_step": workflow.current_step,
            "current_step_details": {
                "step_name": current_step.step_name if current_step else None,
                "assignee": current_step.assignee_id if current_step else None,
                "deadline": current_step.deadline_days if current_step else None
            },
            "progress": {
                "completed_steps": completed_steps,
                "total_steps": total_steps,
                "percentage": progress_percentage
            },
            "step_status": {step_id: status.value for step_id, status in workflow.step_status.items()},
            "created_at": workflow.created_at.isoformat(),
            "started_at": workflow.started_at.isoformat(),
            "estimated_completion": self._estimate_completion_date(workflow)
        }
    
    async def _is_workflow_complete(self, workflow: WorkflowInstance) -> bool:
        """Check if workflow is complete"""
        return all(status in [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] 
                  for status in workflow.step_status.values())
    
    async def _advance_workflow(self, workflow: WorkflowInstance) -> None:
        """Advance workflow to next step"""
        current_index = next(i for i, step in enumerate(workflow.steps) 
                           if step.step_id == workflow.current_step)
        
        # Find next pending step
        for i in range(current_index + 1, len(workflow.steps)):
            step = workflow.steps[i]
            if workflow.step_status[step.step_id] == ApprovalStatus.PENDING:
                workflow.current_step = step.step_id
                
                # Send notification for next step
                await self._send_workflow_notifications(workflow, NotificationType.APPROVAL_REQUIRED)
                break
    
    async def _complete_workflow(self, workflow: WorkflowInstance) -> None:
        """Complete workflow"""
        workflow.status = WorkflowStatus.COMPLETED
        workflow.completed_at = datetime.utcnow()
        workflow.total_duration = workflow.completed_at - workflow.started_at
        
        # Log workflow completion
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="legal_workflow_completed",
            actor_id="system",
            resource=f"workflow:{workflow.workflow_id}",
            result="success",
            context={
                "total_duration": str(workflow.total_duration),
                "total_steps": len(workflow.steps)
            }
        )
        
        # Send completion notification
        await self._send_workflow_notifications(workflow, NotificationType.WORKFLOW_COMPLETED)
    
    async def _handle_step_rejection(self, workflow: WorkflowInstance, step_id: str, rejection_data: Dict[str, Any]) -> None:
        """Handle step rejection"""
        # For now, cancel the workflow on rejection
        # This could be customized based on business rules
        workflow.status = WorkflowStatus.CANCELLED
        
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="legal_workflow_cancelled",
            actor_id="system",
            resource=f"workflow:{workflow.workflow_id}",
            result="success",
            context={
                "rejected_step": step_id,
                "rejection_reason": rejection_data.get("reason", "Unknown")
            }
        )
    
    async def _send_workflow_notifications(self, workflow: WorkflowInstance, notification_type: NotificationType) -> None:
        """Send workflow notifications"""
        # This would integrate with the notification system
        notification = {
            "notification_id": f"NOTIF-{uuid.uuid4().hex[:8].upper()}",
            "workflow_id": workflow.workflow_id,
            "notification_type": notification_type.value,
            "timestamp": datetime.utcnow(),
            "recipients": self._get_notification_recipients(workflow, notification_type),
            "content": self._generate_notification_content(workflow, notification_type)
        }
        
        workflow.notifications_sent.append(notification)
        
        # Log notification
        await self.audit_logger.log_event(
            event_type=SecurityEventType.COMPLIANCE,
            action="workflow_notification_sent",
            actor_id="system",
            resource=f"workflow:{workflow.workflow_id}",
            result="success",
            context={
                "notification_type": notification_type.value,
                "recipients_count": len(notification["recipients"])
            }
        )
    
    def _get_notification_recipients(self, workflow: WorkflowInstance, notification_type: NotificationType) -> List[str]:
        """Get notification recipients based on type"""
        if notification_type == NotificationType.APPROVAL_REQUIRED:
            current_step = next(s for s in workflow.steps if s.step_id == workflow.current_step)
            return [current_step.assignee_id] if current_step.assignee_id else []
        elif notification_type == NotificationType.WORKFLOW_COMPLETED:
            # Return all participants
            return list(set(s.assignee_id for s in workflow.steps if s.assignee_id))
        else:
            return []
    
    def _generate_notification_content(self, workflow: WorkflowInstance, notification_type: NotificationType) -> str:
        """Generate notification content"""
        if notification_type == NotificationType.APPROVAL_REQUIRED:
            current_step = next(s for s in workflow.steps if s.step_id == workflow.current_step)
            return f"Approval required for {current_step.step_name} in workflow {workflow.workflow_id}"
        elif notification_type == NotificationType.WORKFLOW_COMPLETED:
            return f"Workflow {workflow.workflow_id} has been completed successfully"
        else:
            return f"Notification: {notification_type.value}"
    
    def _estimate_completion_date(self, workflow: WorkflowInstance) -> Optional[datetime]:
        """Estimate workflow completion date"""
        if workflow.status != WorkflowStatus.ACTIVE:
            return None
        
        remaining_steps = [s for s in workflow.steps 
                          if workflow.step_status[s.step_id] == ApprovalStatus.PENDING]
        
        if not remaining_steps:
            return None
        
        total_days = sum(s.deadline_days for s in remaining_steps)
        return datetime.utcnow() + timedelta(days=total_days) 