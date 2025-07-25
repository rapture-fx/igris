"""
Formal Incident Response System
==============================

This module provides comprehensive incident response procedures for security
events, automated escalation, and incident management workflows to ensure
rapid response to security threats and compliance with SOC 2 requirements.

Features:
- Automated incident detection and classification
- Real-time alerting and escalation procedures
- Incident tracking and documentation
- Forensic data collection
- Integration with external security tools
- Compliance reporting
- Post-incident analysis and remediation
"""

import os
import json
import asyncio
import hashlib
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
from datetime import datetime, timedelta
import logging
import smtplib
import ssl
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import aiohttp
import boto3
from botocore.exceptions import ClientError

from app.core.config import settings
from app.middleware.audit_middleware import audit_logger, AuditEventType, AuditSeverity

logger = logging.getLogger(__name__)

class IncidentSeverity(Enum):
    """Incident severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class IncidentStatus(Enum):
    """Incident status tracking"""
    OPEN = "open"
    INVESTIGATING = "investigating"
    CONTAINED = "contained"
    RESOLVED = "resolved"
    CLOSED = "closed"

class IncidentCategory(Enum):
    """Categories of security incidents"""
    DATA_BREACH = "data_breach"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    MALWARE = "malware"
    PHISHING = "phishing"
    DDoS = "ddos"
    INSIDER_THREAT = "insider_threat"
    SYSTEM_COMPROMISE = "system_compromise"
    COMPLIANCE_VIOLATION = "compliance_violation"
    BUSINESS_DISRUPTION = "business_disruption"
    OTHER = "other"

class AlertChannel(Enum):
    """Available alert channels"""
    EMAIL = "email"
    SLACK = "slack"
    SMS = "sms"
    WEBHOOK = "webhook"
    PAGERDUTY = "pagerduty"
    JIRA = "jira"

@dataclass
class IncidentMetrics:
    """Metrics for incident tracking"""
    detection_time: Optional[datetime] = None
    response_time: Optional[datetime] = None
    containment_time: Optional[datetime] = None
    resolution_time: Optional[datetime] = None
    downtime_duration: Optional[timedelta] = None
    affected_users: int = 0
    affected_systems: List[str] = field(default_factory=list)
    financial_impact: float = 0.0

@dataclass
class IncidentEvidence:
    """Evidence collection for incidents"""
    log_files: List[str] = field(default_factory=list)
    network_captures: List[str] = field(default_factory=list)
    system_snapshots: List[str] = field(default_factory=list)
    artifacts: Dict[str, Any] = field(default_factory=dict)
    chain_of_custody: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class Incident:
    """Security incident data structure"""
    incident_id: str
    title: str
    description: str
    severity: IncidentSeverity
    category: IncidentCategory
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime
    detected_by: str
    assigned_to: Optional[str] = None
    affected_assets: List[str] = field(default_factory=list)
    timeline: List[Dict[str, Any]] = field(default_factory=list)
    metrics: IncidentMetrics = field(default_factory=IncidentMetrics)
    evidence: IncidentEvidence = field(default_factory=IncidentEvidence)
    remediation_steps: List[str] = field(default_factory=list)
    lessons_learned: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)

class EscalationRule:
    """Escalation rule configuration"""
    
    def __init__(
        self,
        name: str,
        severity_threshold: IncidentSeverity,
        time_threshold: timedelta,
        escalation_targets: List[str],
        channels: List[AlertChannel]
    ):
        self.name = name
        self.severity_threshold = severity_threshold
        self.time_threshold = time_threshold
        self.escalation_targets = escalation_targets
        self.channels = channels

class AlertManager:
    """Manages alerting and notifications"""
    
    def __init__(self):
        self.smtp_config = {
            "server": os.getenv("SMTP_SERVER", "localhost"),
            "port": int(os.getenv("SMTP_PORT", "587")),
            "username": os.getenv("SMTP_USERNAME"),
            "password": os.getenv("SMTP_PASSWORD"),
            "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        }
        self.slack_webhook = os.getenv("SLACK_WEBHOOK_URL")
        self.pagerduty_key = os.getenv("PAGERDUTY_INTEGRATION_KEY")
    
    async def send_alert(
        self,
        incident: Incident,
        channels: List[AlertChannel],
        targets: List[str],
        message: str
    ):
        """Send alert through specified channels"""
        tasks = []
        
        for channel in channels:
            if channel == AlertChannel.EMAIL:
                tasks.append(self._send_email_alert(incident, targets, message))
            elif channel == AlertChannel.SLACK:
                tasks.append(self._send_slack_alert(incident, message))
            elif channel == AlertChannel.SMS:
                tasks.append(self._send_sms_alert(incident, targets, message))
            elif channel == AlertChannel.PAGERDUTY:
                tasks.append(self._send_pagerduty_alert(incident, message))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _send_email_alert(self, incident: Incident, targets: List[str], message: str):
        """Send email alert"""
        try:
            msg = MimeMultipart()
            msg['From'] = self.smtp_config["username"]
            msg['To'] = ", ".join(targets)
            msg['Subject'] = f"Security Incident Alert: {incident.title} [{incident.severity.value.upper()}]"
            
            html_body = f"""
            <html>
            <body>
                <h2>Security Incident Alert</h2>
                <p><strong>Incident ID:</strong> {incident.incident_id}</p>
                <p><strong>Title:</strong> {incident.title}</p>
                <p><strong>Severity:</strong> {incident.severity.value.upper()}</p>
                <p><strong>Category:</strong> {incident.category.value}</p>
                <p><strong>Status:</strong> {incident.status.value}</p>
                <p><strong>Detection Time:</strong> {incident.created_at}</p>
                
                <h3>Description</h3>
                <p>{incident.description}</p>
                
                <h3>Affected Assets</h3>
                <ul>
                    {"".join(f"<li>{asset}</li>" for asset in incident.affected_assets)}
                </ul>
                
                <h3>Message</h3>
                <p>{message}</p>
                
                <p><em>This is an automated alert from the Security Incident Response System.</em></p>
            </body>
            </html>
            """
            
            msg.attach(MimeText(html_body, 'html'))
            
            context = ssl.create_default_context()
            with smtplib.SMTP(self.smtp_config["server"], self.smtp_config["port"]) as server:
                if self.smtp_config["use_tls"]:
                    server.starttls(context=context)
                if self.smtp_config["username"] and self.smtp_config["password"]:
                    server.login(self.smtp_config["username"], self.smtp_config["password"])
                server.send_message(msg)
                
            logger.info(f"Email alert sent for incident {incident.incident_id}")
            
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
    
    async def _send_slack_alert(self, incident: Incident, message: str):
        """Send Slack alert"""
        if not self.slack_webhook:
            return
        
        try:
            severity_color = {
                IncidentSeverity.LOW: "#36a64f",
                IncidentSeverity.MEDIUM: "#ffcc00", 
                IncidentSeverity.HIGH: "#ff9900",
                IncidentSeverity.CRITICAL: "#ff0000"
            }.get(incident.severity, "#cccccc")
            
            slack_payload = {
                "text": f"Security Incident Alert: {incident.title}",
                "attachments": [{
                    "color": severity_color,
                    "fields": [
                        {"title": "Incident ID", "value": incident.incident_id, "short": True},
                        {"title": "Severity", "value": incident.severity.value.upper(), "short": True},
                        {"title": "Category", "value": incident.category.value, "short": True},
                        {"title": "Status", "value": incident.status.value, "short": True},
                        {"title": "Detection Time", "value": incident.created_at.isoformat(), "short": False},
                        {"title": "Description", "value": incident.description, "short": False},
                        {"title": "Message", "value": message, "short": False}
                    ]
                }]
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(self.slack_webhook, json=slack_payload) as response:
                    if response.status == 200:
                        logger.info(f"Slack alert sent for incident {incident.incident_id}")
                    else:
                        logger.error(f"Slack alert failed: {response.status}")
                        
        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e}")
    
    async def _send_pagerduty_alert(self, incident: Incident, message: str):
        """Send PagerDuty alert"""
        if not self.pagerduty_key:
            return
        
        try:
            pagerduty_payload = {
                "routing_key": self.pagerduty_key,
                "event_action": "trigger",
                "dedup_key": incident.incident_id,
                "payload": {
                    "summary": f"Security Incident: {incident.title}",
                    "severity": incident.severity.value,
                    "source": "Security Incident Response System",
                    "component": "security",
                    "group": "incident_response",
                    "class": incident.category.value,
                    "custom_details": {
                        "incident_id": incident.incident_id,
                        "description": incident.description,
                        "affected_assets": incident.affected_assets,
                        "message": message
                    }
                }
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://events.pagerduty.com/v2/enqueue",
                    json=pagerduty_payload
                ) as response:
                    if response.status == 202:
                        logger.info(f"PagerDuty alert sent for incident {incident.incident_id}")
                    else:
                        logger.error(f"PagerDuty alert failed: {response.status}")
                        
        except Exception as e:
            logger.error(f"Failed to send PagerDuty alert: {e}")
    
    async def _send_sms_alert(self, incident: Incident, targets: List[str], message: str):
        """Send SMS alert via AWS SNS"""
        try:
            sns_client = boto3.client('sns')
            
            sms_message = f"SECURITY ALERT: {incident.title} [{incident.severity.value.upper()}] - {message}"
            
            for phone_number in targets:
                try:
                    sns_client.publish(
                        PhoneNumber=phone_number,
                        Message=sms_message[:160]  # SMS character limit
                    )
                    logger.info(f"SMS alert sent to {phone_number} for incident {incident.incident_id}")
                except ClientError as e:
                    logger.error(f"Failed to send SMS to {phone_number}: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to send SMS alerts: {e}")

class ForensicsCollector:
    """Automated forensics data collection"""
    
    def __init__(self):
        self.evidence_storage = "/var/log/security/evidence"
        os.makedirs(self.evidence_storage, exist_ok=True)
    
    async def collect_evidence(self, incident: Incident) -> IncidentEvidence:
        """Collect forensic evidence for incident"""
        evidence = IncidentEvidence()
        
        try:
            # Collect system logs
            await self._collect_system_logs(incident, evidence)
            
            # Collect application logs
            await self._collect_application_logs(incident, evidence)
            
            # Collect network data
            await self._collect_network_data(incident, evidence)
            
            # Create system snapshot
            await self._create_system_snapshot(incident, evidence)
            
            # Document chain of custody
            self._document_chain_of_custody(incident, evidence)
            
            return evidence
            
        except Exception as e:
            logger.error(f"Evidence collection failed: {e}")
            return evidence
    
    async def _collect_system_logs(self, incident: Incident, evidence: IncidentEvidence):
        """Collect relevant system logs"""
        log_files = [
            "/var/log/auth.log",
            "/var/log/syslog", 
            "/var/log/apache2/access.log",
            "/var/log/apache2/error.log",
            "/var/log/nginx/access.log",
            "/var/log/nginx/error.log"
        ]
        
        timestamp = incident.created_at.strftime("%Y%m%d_%H%M%S")
        
        for log_file in log_files:
            if os.path.exists(log_file):
                evidence_file = f"{self.evidence_storage}/{incident.incident_id}_system_{timestamp}_{os.path.basename(log_file)}"
                
                # Copy recent logs (last 24 hours)
                try:
                    import subprocess
                    cmd = f"tail -n 10000 {log_file} > {evidence_file}"
                    subprocess.run(cmd, shell=True, check=True)
                    evidence.log_files.append(evidence_file)
                except Exception as e:
                    logger.error(f"Failed to collect {log_file}: {e}")
    
    async def _collect_application_logs(self, incident: Incident, evidence: IncidentEvidence):
        """Collect application-specific logs"""
        app_log_paths = [
            "/var/log/app/security.log",
            "/var/log/app/audit.log",
            "/var/log/app/api.log"
        ]
        
        timestamp = incident.created_at.strftime("%Y%m%d_%H%M%S")
        
        for log_path in app_log_paths:
            if os.path.exists(log_path):
                evidence_file = f"{self.evidence_storage}/{incident.incident_id}_app_{timestamp}_{os.path.basename(log_path)}"
                
                try:
                    import shutil
                    shutil.copy2(log_path, evidence_file)
                    evidence.log_files.append(evidence_file)
                except Exception as e:
                    logger.error(f"Failed to collect {log_path}: {e}")
    
    async def _collect_network_data(self, incident: Incident, evidence: IncidentEvidence):
        """Collect network-related data"""
        timestamp = incident.created_at.strftime("%Y%m%d_%H%M%S")
        network_file = f"{self.evidence_storage}/{incident.incident_id}_network_{timestamp}.txt"
        
        try:
            import subprocess
            
            # Collect network connections
            network_data = []
            
            # Current connections
            result = subprocess.run(["netstat", "-tulpn"], capture_output=True, text=True)
            network_data.append("=== Current Network Connections ===")
            network_data.append(result.stdout)
            
            # Active sessions
            result = subprocess.run(["who"], capture_output=True, text=True)
            network_data.append("\n=== Active Sessions ===")
            network_data.append(result.stdout)
            
            # Recent failed logins
            result = subprocess.run(["lastb", "-n", "50"], capture_output=True, text=True)
            network_data.append("\n=== Recent Failed Logins ===")
            network_data.append(result.stdout)
            
            with open(network_file, 'w') as f:
                f.write('\n'.join(network_data))
            
            evidence.network_captures.append(network_file)
            
        except Exception as e:
            logger.error(f"Failed to collect network data: {e}")
    
    async def _create_system_snapshot(self, incident: Incident, evidence: IncidentEvidence):
        """Create system state snapshot"""
        timestamp = incident.created_at.strftime("%Y%m%d_%H%M%S")
        snapshot_file = f"{self.evidence_storage}/{incident.incident_id}_snapshot_{timestamp}.json"
        
        try:
            import subprocess
            import psutil
            
            snapshot_data = {
                "timestamp": timestamp,
                "incident_id": incident.incident_id,
                "system_info": {
                    "hostname": os.uname().nodename,
                    "platform": os.uname().sysname,
                    "release": os.uname().release,
                    "uptime": subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()
                },
                "processes": [],
                "memory_usage": psutil.virtual_memory()._asdict(),
                "disk_usage": psutil.disk_usage('/')._asdict(),
                "network_interfaces": {}
            }
            
            # Running processes
            for proc in psutil.process_iter(['pid', 'name', 'username', 'cmdline']):
                try:
                    snapshot_data["processes"].append(proc.info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            # Network interfaces
            for interface, addrs in psutil.net_if_addrs().items():
                snapshot_data["network_interfaces"][interface] = [
                    {"family": addr.family.name, "address": addr.address} 
                    for addr in addrs
                ]
            
            with open(snapshot_file, 'w') as f:
                json.dump(snapshot_data, f, indent=2, default=str)
            
            evidence.system_snapshots.append(snapshot_file)
            
        except Exception as e:
            logger.error(f"Failed to create system snapshot: {e}")
    
    def _document_chain_of_custody(self, incident: Incident, evidence: IncidentEvidence):
        """Document chain of custody for evidence"""
        custody_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": "evidence_collected",
            "collector": "automated_forensics_system",
            "incident_id": incident.incident_id,
            "evidence_files": evidence.log_files + evidence.network_captures + evidence.system_snapshots,
            "hash_verification": {}
        }
        
        # Generate file hashes for integrity
        for file_path in custody_entry["evidence_files"]:
            if os.path.exists(file_path):
                with open(file_path, 'rb') as f:
                    file_hash = hashlib.sha256(f.read()).hexdigest()
                    custody_entry["hash_verification"][file_path] = file_hash
        
        evidence.chain_of_custody.append(custody_entry)

class IncidentResponseManager:
    """Main incident response orchestrator"""
    
    def __init__(self):
        self.incidents = {}  # In production, this would be a database
        self.alert_manager = AlertManager()
        self.forensics_collector = ForensicsCollector()
        self.escalation_rules = self._setup_escalation_rules()
        self._setup_incident_templates()
    
    def _setup_escalation_rules(self) -> List[EscalationRule]:
        """Setup escalation rules based on severity and time"""
        return [
            EscalationRule(
                name="critical_immediate",
                severity_threshold=IncidentSeverity.CRITICAL,
                time_threshold=timedelta(minutes=0),
                escalation_targets=["security-team@company.com", "ciso@company.com"],
                channels=[AlertChannel.EMAIL, AlertChannel.SLACK, AlertChannel.PAGERDUTY]
            ),
            EscalationRule(
                name="high_15min",
                severity_threshold=IncidentSeverity.HIGH,
                time_threshold=timedelta(minutes=15),
                escalation_targets=["security-lead@company.com"],
                channels=[AlertChannel.EMAIL, AlertChannel.SLACK]
            ),
            EscalationRule(
                name="medium_1hour",
                severity_threshold=IncidentSeverity.MEDIUM,
                time_threshold=timedelta(hours=1),
                escalation_targets=["security-team@company.com"],
                channels=[AlertChannel.EMAIL]
            ),
            EscalationRule(
                name="all_incidents_4hours",
                severity_threshold=IncidentSeverity.LOW,
                time_threshold=timedelta(hours=4),
                escalation_targets=["security-manager@company.com"],
                channels=[AlertChannel.EMAIL]
            )
        ]
    
    def _setup_incident_templates(self):
        """Setup incident response templates"""
        self.response_templates = {
            IncidentCategory.DATA_BREACH: {
                "initial_steps": [
                    "Immediately isolate affected systems",
                    "Identify scope of data exposure",
                    "Notify legal and compliance teams",
                    "Document all evidence",
                    "Prepare breach notification if required"
                ],
                "stakeholders": ["legal@company.com", "compliance@company.com", "privacy@company.com"]
            },
            IncidentCategory.UNAUTHORIZED_ACCESS: {
                "initial_steps": [
                    "Disable compromised accounts",
                    "Review access logs",
                    "Check for privilege escalation",
                    "Reset credentials",
                    "Monitor for lateral movement"
                ],
                "stakeholders": ["security-team@company.com", "it-admin@company.com"]
            },
            IncidentCategory.MALWARE: {
                "initial_steps": [
                    "Isolate infected systems",
                    "Run antimalware scans",
                    "Analyze malware sample",
                    "Check for data exfiltration",
                    "Update security signatures"
                ],
                "stakeholders": ["security-team@company.com", "it-operations@company.com"]
            }
        }
    
    async def create_incident(
        self,
        title: str,
        description: str,
        severity: IncidentSeverity,
        category: IncidentCategory,
        detected_by: str,
        affected_assets: List[str] = None
    ) -> Incident:
        """Create new security incident"""
        
        incident_id = self._generate_incident_id()
        now = datetime.utcnow()
        
        incident = Incident(
            incident_id=incident_id,
            title=title,
            description=description,
            severity=severity,
            category=category,
            status=IncidentStatus.OPEN,
            created_at=now,
            updated_at=now,
            detected_by=detected_by,
            affected_assets=affected_assets or []
        )
        
        # Add initial timeline entry
        incident.timeline.append({
            "timestamp": now.isoformat(),
            "action": "incident_created",
            "description": f"Incident created by {detected_by}",
            "user": detected_by
        })
        
        # Store incident
        self.incidents[incident_id] = incident
        
        # Start incident response workflow
        await self._initiate_response(incident)
        
        # Log incident creation
        await audit_logger.log_event({
            "event_type": AuditEventType.SECURITY_INCIDENT,
            "severity": AuditSeverity.HIGH,
            "description": f"Security incident created: {title}",
            "metadata": {
                "incident_id": incident_id,
                "severity": severity.value,
                "category": category.value,
                "detected_by": detected_by
            }
        })
        
        return incident
    
    async def _initiate_response(self, incident: Incident):
        """Initiate automated incident response"""
        
        # Apply escalation rules
        await self._check_escalation(incident)
        
        # Start evidence collection
        incident.evidence = await self.forensics_collector.collect_evidence(incident)
        
        # Apply response template
        if incident.category in self.response_templates:
            template = self.response_templates[incident.category]
            incident.remediation_steps.extend(template["initial_steps"])
            
            # Notify stakeholders
            await self.alert_manager.send_alert(
                incident,
                [AlertChannel.EMAIL],
                template["stakeholders"],
                f"Security incident requires attention: {incident.title}"
            )
        
        # Update incident status
        await self.update_incident_status(incident.incident_id, IncidentStatus.INVESTIGATING)
    
    async def _check_escalation(self, incident: Incident):
        """Check and apply escalation rules"""
        
        for rule in self.escalation_rules:
            # Check severity threshold
            severity_levels = {
                IncidentSeverity.LOW: 1,
                IncidentSeverity.MEDIUM: 2,
                IncidentSeverity.HIGH: 3,
                IncidentSeverity.CRITICAL: 4
            }
            
            if severity_levels[incident.severity] >= severity_levels[rule.severity_threshold]:
                # Check time threshold
                time_since_creation = datetime.utcnow() - incident.created_at
                
                if time_since_creation >= rule.time_threshold:
                    await self.alert_manager.send_alert(
                        incident,
                        rule.channels,
                        rule.escalation_targets,
                        f"Incident escalation triggered: {rule.name}"
                    )
    
    async def update_incident_status(self, incident_id: str, status: IncidentStatus, user: str = "system"):
        """Update incident status"""
        
        if incident_id not in self.incidents:
            raise ValueError(f"Incident {incident_id} not found")
        
        incident = self.incidents[incident_id]
        old_status = incident.status
        incident.status = status
        incident.updated_at = datetime.utcnow()
        
        # Add timeline entry
        incident.timeline.append({
            "timestamp": incident.updated_at.isoformat(),
            "action": "status_changed",
            "description": f"Status changed from {old_status.value} to {status.value}",
            "user": user
        })
        
        # Update metrics
        if status == IncidentStatus.INVESTIGATING and not incident.metrics.response_time:
            incident.metrics.response_time = datetime.utcnow()
        elif status == IncidentStatus.CONTAINED and not incident.metrics.containment_time:
            incident.metrics.containment_time = datetime.utcnow()
        elif status == IncidentStatus.RESOLVED and not incident.metrics.resolution_time:
            incident.metrics.resolution_time = datetime.utcnow()
    
    async def add_incident_note(self, incident_id: str, note: str, user: str):
        """Add note to incident"""
        
        if incident_id not in self.incidents:
            raise ValueError(f"Incident {incident_id} not found")
        
        incident = self.incidents[incident_id]
        incident.updated_at = datetime.utcnow()
        
        incident.timeline.append({
            "timestamp": incident.updated_at.isoformat(),
            "action": "note_added",
            "description": note,
            "user": user
        })
    
    async def assign_incident(self, incident_id: str, assignee: str, user: str = "system"):
        """Assign incident to a responder"""
        
        if incident_id not in self.incidents:
            raise ValueError(f"Incident {incident_id} not found")
        
        incident = self.incidents[incident_id]
        incident.assigned_to = assignee
        incident.updated_at = datetime.utcnow()
        
        incident.timeline.append({
            "timestamp": incident.updated_at.isoformat(),
            "action": "assigned",
            "description": f"Incident assigned to {assignee}",
            "user": user
        })
        
        # Notify assignee
        await self.alert_manager.send_alert(
            incident,
            [AlertChannel.EMAIL],
            [assignee],
            f"You have been assigned to security incident: {incident.title}"
        )
    
    def _generate_incident_id(self) -> str:
        """Generate unique incident ID"""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        import random
        random_suffix = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=4))
        return f"INC-{timestamp}-{random_suffix}"
    
    async def get_incident(self, incident_id: str) -> Optional[Incident]:
        """Get incident by ID"""
        return self.incidents.get(incident_id)
    
    async def list_incidents(
        self,
        status: Optional[IncidentStatus] = None,
        severity: Optional[IncidentSeverity] = None,
        limit: int = 100
    ) -> List[Incident]:
        """List incidents with optional filtering"""
        
        incidents = list(self.incidents.values())
        
        if status:
            incidents = [i for i in incidents if i.status == status]
        
        if severity:
            incidents = [i for i in incidents if i.severity == severity]
        
        # Sort by creation time (newest first)
        incidents.sort(key=lambda x: x.created_at, reverse=True)
        
        return incidents[:limit]
    
    async def generate_incident_report(self, incident_id: str) -> Dict[str, Any]:
        """Generate comprehensive incident report"""
        
        incident = self.incidents.get(incident_id)
        if not incident:
            raise ValueError(f"Incident {incident_id} not found")
        
        # Calculate response metrics
        response_metrics = {}
        if incident.metrics.response_time:
            response_metrics["time_to_response"] = str(incident.metrics.response_time - incident.created_at)
        if incident.metrics.containment_time:
            response_metrics["time_to_containment"] = str(incident.metrics.containment_time - incident.created_at)
        if incident.metrics.resolution_time:
            response_metrics["time_to_resolution"] = str(incident.metrics.resolution_time - incident.created_at)
        
        return {
            "incident_summary": asdict(incident),
            "response_metrics": response_metrics,
            "evidence_summary": {
                "log_files_collected": len(incident.evidence.log_files),
                "network_captures": len(incident.evidence.network_captures),
                "system_snapshots": len(incident.evidence.system_snapshots),
                "chain_of_custody_entries": len(incident.evidence.chain_of_custody)
            },
            "timeline_summary": {
                "total_actions": len(incident.timeline),
                "actions": incident.timeline
            },
            "compliance_status": {
                "gdpr_notification_required": incident.category == IncidentCategory.DATA_BREACH,
                "soc2_documentation_complete": len(incident.evidence.log_files) > 0,
                "incident_response_plan_followed": len(incident.remediation_steps) > 0
            }
        }

# Global incident response manager
incident_manager = IncidentResponseManager()

# Convenience functions
async def create_security_incident(
    title: str,
    description: str,
    severity: IncidentSeverity,
    category: IncidentCategory,
    detected_by: str = "automated_system",
    affected_assets: List[str] = None
) -> Incident:
    """Create security incident"""
    return await incident_manager.create_incident(
        title, description, severity, category, detected_by, affected_assets
    )

async def get_incident_status(incident_id: str) -> Optional[IncidentStatus]:
    """Get incident status"""
    incident = await incident_manager.get_incident(incident_id)
    return incident.status if incident else None

async def escalate_incident(incident_id: str, reason: str, user: str = "system"):
    """Manually escalate incident"""
    incident = await incident_manager.get_incident(incident_id)
    if incident:
        await incident_manager.add_incident_note(incident_id, f"Manual escalation: {reason}", user)
        
        # Trigger critical escalation
        for rule in incident_manager.escalation_rules:
            if rule.severity_threshold == IncidentSeverity.CRITICAL:
                await incident_manager.alert_manager.send_alert(
                    incident,
                    rule.channels,
                    rule.escalation_targets,
                    f"Incident manually escalated: {reason}"
                )
                break

__all__ = [
    'incident_manager',
    'create_security_incident',
    'get_incident_status',
    'escalate_incident',
    'IncidentSeverity',
    'IncidentStatus',
    'IncidentCategory',
    'Incident'
]