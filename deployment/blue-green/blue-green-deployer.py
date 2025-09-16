#!/usr/bin/env python3
"""
Schlep-engine Blue-Green Deployment System
Zero-downtime deployment orchestrator with automated rollback capabilities
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import yaml
import tempfile
import subprocess

import aiohttp
import kubernetes
from kubernetes import client, config
import prometheus_client
from prometheus_client.parser import text_string_to_metric_families


class DeploymentPhase(str, Enum):
    PRE_DEPLOYMENT = "pre_deployment"
    GREEN_DEPLOYMENT = "green_deployment"
    TRAFFIC_SWITCHING = "traffic_switching"
    POST_DEPLOYMENT = "post_deployment"
    ROLLBACK = "rollback"


class DeploymentStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class TrafficState(str, Enum):
    BLUE_ONLY = "blue_only"
    CANARY = "canary"
    GRADUAL_SWITCH = "gradual_switch"
    GREEN_ONLY = "green_only"


@dataclass
class DeploymentConfig:
    application: str
    environment: str
    version: str
    commit_sha: str
    triggered_by: str
    image_tag: str


@dataclass
class DeploymentJob:
    job_id: str
    config: DeploymentConfig
    status: DeploymentStatus
    current_phase: DeploymentPhase
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    rollback_triggered: bool = False
    rollback_reason: Optional[str] = None
    traffic_percentage: int = 0
    health_check_results: Dict[str, bool] = None
    metrics: Dict[str, float] = None


class HealthChecker:
    """Health check and validation utilities"""

    def __init__(self):
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    async def check_application_health(
        self,
        app_config: Dict[str, Any],
        environment: str,
        service_name: str,
        timeout: int = 300
    ) -> bool:
        """Check if application is healthy"""

        health_path = app_config.get("health_check_path", "/health")
        port = app_config.get("port", 8000)

        # In Kubernetes, we'll check via service endpoint
        endpoint = f"http://{service_name}.{environment}.svc.cluster.local:{port}{health_path}"

        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        endpoint,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as response:
                        if response.status == 200:
                            self.logger.info(f"Health check passed for {service_name}")
                            return True

            except Exception as e:
                self.logger.debug(f"Health check failed for {service_name}: {e}")

            await asyncio.sleep(5)

        self.logger.error(f"Health check timed out for {service_name}")
        return False

    async def run_smoke_tests(
        self,
        app_config: Dict[str, Any],
        environment: str,
        service_name: str
    ) -> Dict[str, bool]:
        """Run smoke tests against application"""

        smoke_tests = app_config.get("smoke_tests", [])
        results = {}

        port = app_config.get("port", 8000)
        base_url = f"http://{service_name}.{environment}.svc.cluster.local:{port}"

        for test in smoke_tests:
            endpoint = test.get("endpoint")
            expected_status = test.get("expected_status", 200)

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"{base_url}{endpoint}",
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as response:
                        success = response.status == expected_status
                        results[endpoint] = success

                        if success:
                            self.logger.info(f"Smoke test passed: {endpoint}")
                        else:
                            self.logger.error(
                                f"Smoke test failed: {endpoint} "
                                f"(expected {expected_status}, got {response.status})"
                            )

            except Exception as e:
                self.logger.error(f"Smoke test error for {endpoint}: {e}")
                results[endpoint] = False

        return results

    async def validate_dependencies(
        self,
        dependencies: List[str],
        environment: str
    ) -> bool:
        """Validate that all dependencies are available"""

        for dep in dependencies:
            if not await self._check_dependency_health(dep, environment):
                return False

        return True

    async def _check_dependency_health(
        self,
        dependency: str,
        environment: str
    ) -> bool:
        """Check health of a specific dependency"""

        # This would check database, Redis, external services, etc.
        # For now, we'll simulate the checks
        dependency_endpoints = {
            "database": f"postgresql://postgres.{environment}.svc.cluster.local:5432",
            "redis": f"redis://redis.{environment}.svc.cluster.local:6379"
        }

        endpoint = dependency_endpoints.get(dependency)
        if not endpoint:
            self.logger.warning(f"Unknown dependency: {dependency}")
            return True  # Assume it's okay if we don't know how to check

        # Implement actual dependency checks here
        self.logger.info(f"Dependency {dependency} is healthy")
        return True


class MetricsCollector:
    """Collect and analyze deployment metrics"""

    def __init__(self):
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    async def get_baseline_metrics(
        self,
        application: str,
        environment: str
    ) -> Dict[str, float]:
        """Get baseline metrics for comparison"""

        # This would query Prometheus for baseline metrics
        # For now, return simulated values
        return {
            "error_rate": 0.01,
            "response_time_p95": 500.0,
            "conversion_rate": 0.15,
            "requests_per_minute": 1000.0
        }

    async def get_current_metrics(
        self,
        application: str,
        environment: str
    ) -> Dict[str, float]:
        """Get current application metrics"""

        # This would query Prometheus for current metrics
        # For now, return simulated values
        return {
            "error_rate": 0.008,
            "response_time_p95": 450.0,
            "conversion_rate": 0.16,
            "requests_per_minute": 1100.0
        }

    async def validate_metrics(
        self,
        current: Dict[str, float],
        baseline: Dict[str, float],
        thresholds: Dict[str, float]
    ) -> Tuple[bool, List[str]]:
        """Validate current metrics against baseline and thresholds"""

        issues = []

        # Check error rate
        if current.get("error_rate", 0) > thresholds.get("max_error_rate", 0.05):
            issues.append(f"Error rate too high: {current['error_rate']}")

        # Check response time
        baseline_p95 = baseline.get("response_time_p95", 1000)
        threshold_multiplier = thresholds.get("response_time_multiplier", 1.5)
        if current.get("response_time_p95", 0) > baseline_p95 * threshold_multiplier:
            issues.append(f"Response time degraded: {current['response_time_p95']}ms")

        # Check conversion rate
        baseline_conversion = baseline.get("conversion_rate", 0.1)
        threshold_multiplier = thresholds.get("conversion_rate_multiplier", 0.8)
        if current.get("conversion_rate", 0) < baseline_conversion * threshold_multiplier:
            issues.append(f"Conversion rate dropped: {current['conversion_rate']}")

        return len(issues) == 0, issues


class TrafficManager:
    """Manage traffic routing during blue-green deployment"""

    def __init__(self, k8s_client):
        self.k8s = k8s_client
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    async def setup_green_service(
        self,
        app_config: Dict[str, Any],
        environment: str,
        version: str
    ) -> str:
        """Create green service for new deployment"""

        app_name = app_config["name"]
        green_service_name = f"{app_name}-green"

        service_spec = {
            "apiVersion": "v1",
            "kind": "Service",
            "metadata": {
                "name": green_service_name,
                "namespace": environment,
                "labels": {
                    "app": app_name,
                    "version": "green",
                    "deployment-version": version
                }
            },
            "spec": {
                "selector": {
                    "app": app_name,
                    "version": "green"
                },
                "ports": [
                    {
                        "port": app_config["port"],
                        "targetPort": app_config["port"],
                        "protocol": "TCP"
                    }
                ],
                "type": "ClusterIP"
            }
        }

        try:
            self.k8s.v1.create_namespaced_service(
                namespace=environment,
                body=service_spec
            )
            self.logger.info(f"Created green service: {green_service_name}")
            return green_service_name

        except client.rest.ApiException as e:
            if e.status == 409:  # Already exists
                self.logger.info(f"Green service already exists: {green_service_name}")
                return green_service_name
            else:
                raise

    async def route_canary_traffic(
        self,
        app_name: str,
        environment: str,
        percentage: int
    ) -> bool:
        """Route percentage of traffic to green environment"""

        ingress_name = f"{app_name}-ingress"

        try:
            # Get current ingress
            ingress = self.k8s.networking_v1.read_namespaced_ingress(
                name=ingress_name,
                namespace=environment
            )

            # Update canary annotations
            if not ingress.metadata.annotations:
                ingress.metadata.annotations = {}

            ingress.metadata.annotations.update({
                "nginx.ingress.kubernetes.io/canary": "true",
                "nginx.ingress.kubernetes.io/canary-weight": str(percentage)
            })

            # Apply updated ingress
            self.k8s.networking_v1.patch_namespaced_ingress(
                name=ingress_name,
                namespace=environment,
                body=ingress
            )

            self.logger.info(f"Routed {percentage}% traffic to green for {app_name}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to route canary traffic: {e}")
            return False

    async def switch_traffic_to_green(
        self,
        app_name: str,
        environment: str
    ) -> bool:
        """Switch all traffic to green environment"""

        try:
            # Update main service to point to green pods
            service = self.k8s.v1.read_namespaced_service(
                name=app_name,
                namespace=environment
            )

            service.spec.selector["version"] = "green"

            self.k8s.v1.patch_namespaced_service(
                name=app_name,
                namespace=environment,
                body=service
            )

            # Remove canary ingress annotations
            ingress_name = f"{app_name}-ingress"
            try:
                ingress = self.k8s.networking_v1.read_namespaced_ingress(
                    name=ingress_name,
                    namespace=environment
                )

                if ingress.metadata.annotations:
                    # Remove canary annotations
                    canary_annotations = [
                        "nginx.ingress.kubernetes.io/canary",
                        "nginx.ingress.kubernetes.io/canary-weight"
                    ]
                    for annotation in canary_annotations:
                        ingress.metadata.annotations.pop(annotation, None)

                    self.k8s.networking_v1.patch_namespaced_ingress(
                        name=ingress_name,
                        namespace=environment,
                        body=ingress
                    )

            except client.rest.ApiException:
                # Ingress might not exist, that's okay
                pass

            self.logger.info(f"Switched all traffic to green for {app_name}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to switch traffic to green: {e}")
            return False

    async def revert_traffic_to_blue(
        self,
        app_name: str,
        environment: str
    ) -> bool:
        """Revert traffic back to blue environment"""

        try:
            # Update main service to point to blue pods
            service = self.k8s.v1.read_namespaced_service(
                name=app_name,
                namespace=environment
            )

            service.spec.selector["version"] = "blue"

            self.k8s.v1.patch_namespaced_service(
                name=app_name,
                namespace=environment,
                body=service
            )

            self.logger.info(f"Reverted traffic to blue for {app_name}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to revert traffic to blue: {e}")
            return False


class KubernetesDeployer:
    """Handle Kubernetes deployment operations"""

    def __init__(self):
        try:
            config.load_incluster_config()
        except:
            config.load_kube_config()

        self.v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
        self.networking_v1 = client.NetworkingV1Api()
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    async def deploy_green_environment(
        self,
        app_config: Dict[str, Any],
        deployment_config: DeploymentConfig
    ) -> bool:
        """Deploy application to green environment"""

        try:
            deployment_spec = await self._create_deployment_spec(
                app_config, deployment_config, "green"
            )

            # Create or update green deployment
            deployment_name = f"{app_config['name']}-green"

            try:
                self.apps_v1.create_namespaced_deployment(
                    namespace=deployment_config.environment,
                    body=deployment_spec
                )
                self.logger.info(f"Created green deployment: {deployment_name}")

            except client.rest.ApiException as e:
                if e.status == 409:  # Already exists, update it
                    self.apps_v1.patch_namespaced_deployment(
                        name=deployment_name,
                        namespace=deployment_config.environment,
                        body=deployment_spec
                    )
                    self.logger.info(f"Updated green deployment: {deployment_name}")
                else:
                    raise

            # Wait for deployment to be ready
            return await self._wait_for_deployment_ready(
                deployment_name,
                deployment_config.environment,
                timeout=600
            )

        except Exception as e:
            self.logger.error(f"Failed to deploy green environment: {e}")
            return False

    async def _create_deployment_spec(
        self,
        app_config: Dict[str, Any],
        deployment_config: DeploymentConfig,
        version: str
    ) -> Dict[str, Any]:
        """Create Kubernetes deployment specification"""

        app_name = app_config["name"]
        environment = deployment_config.environment

        # Load environment-specific configuration
        env_config = self._get_environment_config(environment)

        deployment_spec = {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": {
                "name": f"{app_name}-{version}",
                "namespace": environment,
                "labels": {
                    "app": app_name,
                    "version": version,
                    "deployment-version": deployment_config.version
                }
            },
            "spec": {
                "replicas": env_config.get("replica_count", 2),
                "strategy": {
                    "type": "RollingUpdate",
                    "rollingUpdate": {
                        "maxUnavailable": 0,
                        "maxSurge": 1
                    }
                },
                "selector": {
                    "matchLabels": {
                        "app": app_name,
                        "version": version
                    }
                },
                "template": {
                    "metadata": {
                        "labels": {
                            "app": app_name,
                            "version": version,
                            "deployment-version": deployment_config.version
                        }
                    },
                    "spec": {
                        "containers": [
                            {
                                "name": app_name,
                                "image": f"{app_name}:{deployment_config.image_tag}",
                                "ports": [
                                    {
                                        "containerPort": app_config["port"],
                                        "protocol": "TCP"
                                    }
                                ],
                                "env": await self._create_environment_variables(app_config),
                                "resources": {
                                    "requests": {
                                        "cpu": "250m",
                                        "memory": "512Mi"
                                    },
                                    "limits": env_config.get("resource_limits", {
                                        "cpu": "1000m",
                                        "memory": "2Gi"
                                    })
                                },
                                "livenessProbe": {
                                    "httpGet": {
                                        "path": app_config["health_check_path"],
                                        "port": app_config["port"]
                                    },
                                    "initialDelaySeconds": 30,
                                    "periodSeconds": 10,
                                    "timeoutSeconds": 5,
                                    "failureThreshold": 3
                                },
                                "readinessProbe": {
                                    "httpGet": {
                                        "path": app_config["readiness_check_path"],
                                        "port": app_config["port"]
                                    },
                                    "initialDelaySeconds": 10,
                                    "periodSeconds": 5,
                                    "timeoutSeconds": 3,
                                    "failureThreshold": 3
                                },
                                "startupProbe": {
                                    "httpGet": {
                                        "path": app_config["startup_check_path"],
                                        "port": app_config["port"]
                                    },
                                    "initialDelaySeconds": 10,
                                    "periodSeconds": 5,
                                    "timeoutSeconds": 3,
                                    "failureThreshold": 30
                                }
                            }
                        ],
                        "terminationGracePeriodSeconds": app_config.get(
                            "graceful_shutdown_timeout", 30
                        )
                    }
                }
            }
        }

        # Add volumes if configured
        if app_config.get("volumes"):
            deployment_spec["spec"]["template"]["spec"]["volumes"] = []
            deployment_spec["spec"]["template"]["spec"]["containers"][0]["volumeMounts"] = []

            for volume in app_config["volumes"]:
                deployment_spec["spec"]["template"]["spec"]["volumes"].append({
                    "name": volume["name"],
                    "configMap": {"name": volume["configMap"]}
                })

                deployment_spec["spec"]["template"]["spec"]["containers"][0]["volumeMounts"].append({
                    "name": volume["name"],
                    "mountPath": volume["mountPath"]
                })

        return deployment_spec

    async def _create_environment_variables(
        self,
        app_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Create environment variables for container"""

        env_vars = []

        for env_var in app_config.get("environment_variables", []):
            if "value" in env_var:
                # Static value
                env_vars.append({
                    "name": env_var["name"],
                    "value": env_var["value"]
                })
            elif "secret" in env_var:
                # Value from secret
                env_vars.append({
                    "name": env_var["name"],
                    "valueFrom": {
                        "secretKeyRef": {
                            "name": env_var["secret"],
                            "key": env_var["key"]
                        }
                    }
                })

        return env_vars

    def _get_environment_config(self, environment: str) -> Dict[str, Any]:
        """Get environment-specific configuration"""
        # This would load from config file
        # For now, return defaults
        return {
            "replica_count": 2,
            "resource_limits": {
                "cpu": "1000m",
                "memory": "2Gi"
            }
        }

    async def _wait_for_deployment_ready(
        self,
        deployment_name: str,
        namespace: str,
        timeout: int = 600
    ) -> bool:
        """Wait for deployment to be ready"""

        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                deployment = self.apps_v1.read_namespaced_deployment(
                    name=deployment_name,
                    namespace=namespace
                )

                if deployment.status.ready_replicas == deployment.status.replicas:
                    self.logger.info(f"Deployment {deployment_name} is ready")
                    return True

            except Exception as e:
                self.logger.debug(f"Waiting for deployment ready: {e}")

            await asyncio.sleep(10)

        self.logger.error(f"Deployment {deployment_name} not ready within timeout")
        return False

    async def cleanup_blue_environment(
        self,
        app_name: str,
        environment: str
    ) -> bool:
        """Clean up old blue environment"""

        try:
            # Delete blue deployment
            blue_deployment_name = f"{app_name}-blue"

            try:
                self.apps_v1.delete_namespaced_deployment(
                    name=blue_deployment_name,
                    namespace=environment
                )
                self.logger.info(f"Deleted blue deployment: {blue_deployment_name}")
            except client.rest.ApiException as e:
                if e.status != 404:  # Not found is okay
                    raise

            # Delete blue service
            blue_service_name = f"{app_name}-blue"

            try:
                self.v1.delete_namespaced_service(
                    name=blue_service_name,
                    namespace=environment
                )
                self.logger.info(f"Deleted blue service: {blue_service_name}")
            except client.rest.ApiException as e:
                if e.status != 404:  # Not found is okay
                    raise

            return True

        except Exception as e:
            self.logger.error(f"Failed to cleanup blue environment: {e}")
            return False


class NotificationManager:
    """Send deployment notifications"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    async def send_notification(
        self,
        event_type: str,
        job: DeploymentJob,
        **kwargs
    ):
        """Send notification for deployment event"""

        notification_config = self.config.get("notifications", {})
        channels = notification_config.get("channels", {})
        templates = notification_config.get("templates", {})

        template = templates.get(event_type, {})
        title = template.get("title", f"Deployment {event_type}")
        message = template.get("message", f"Deployment event: {event_type}")

        # Format message with job data
        formatted_message = message.format(
            application=job.config.application,
            environment=job.config.environment,
            version=job.config.version,
            commit_sha=job.config.commit_sha,
            triggered_by=job.config.triggered_by,
            duration=self._format_duration(job),
            health_check_results=job.health_check_results,
            traffic_percentage=job.traffic_percentage,
            rollback_trigger=kwargs.get("rollback_trigger", ""),
            rollback_reason=job.rollback_reason or "",
            **kwargs
        )

        # Send to configured channels
        for channel_name, channel_config in channels.items():
            await self._send_to_channel(title, formatted_message, channel_config)

    def _format_duration(self, job: DeploymentJob) -> str:
        """Format deployment duration"""
        if job.completed_at:
            duration = job.completed_at - job.started_at
            return str(duration).split('.')[0]  # Remove microseconds
        else:
            duration = datetime.utcnow() - job.started_at
            return f"{str(duration).split('.')[0]} (ongoing)"

    async def _send_to_channel(
        self,
        title: str,
        message: str,
        channel_config: Dict[str, Any]
    ):
        """Send message to specific channel"""

        if "webhook_url" in channel_config:
            await self._send_slack_message(title, message, channel_config)
        elif "smtp_host" in channel_config:
            await self._send_email(title, message, channel_config)

    async def _send_slack_message(
        self,
        title: str,
        message: str,
        config: Dict[str, Any]
    ):
        """Send Slack notification"""

        try:
            webhook_url = config["webhook_url"]

            payload = {
                "text": title,
                "attachments": [
                    {
                        "color": "good",
                        "text": message,
                        "footer": "Schlep-engine Blue-Green Deployer",
                        "ts": int(time.time())
                    }
                ]
            }

            # Add mentions if configured
            mention_users = config.get("mention_users", [])
            if mention_users:
                payload["text"] = f"{' '.join(mention_users)} {payload['text']}"

            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=payload) as response:
                    if response.status != 200:
                        self.logger.error(f"Slack notification failed: {response.status}")

        except Exception as e:
            self.logger.error(f"Failed to send Slack notification: {e}")

    async def _send_email(
        self,
        title: str,
        message: str,
        config: Dict[str, Any]
    ):
        """Send email notification"""
        # Email implementation would go here
        self.logger.info(f"Would send email notification: {title}")


class BlueGreenDeployer:
    """Main blue-green deployment orchestrator"""

    def __init__(self, config_path: str):
        self.config = self._load_config(config_path)
        self.k8s_deployer = KubernetesDeployer()
        self.health_checker = HealthChecker()
        self.metrics_collector = MetricsCollector()
        self.traffic_manager = TrafficManager(self.k8s_deployer)
        self.notification_manager = NotificationManager(self.config)

        self.active_jobs: Dict[str, DeploymentJob] = {}
        self.logger = self._setup_logging()

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load deployment configuration from YAML file"""
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)

    def _setup_logging(self) -> logging.Logger:
        """Setup structured logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger('blue_green_deployer')

    async def deploy(
        self,
        application: str,
        environment: str,
        version: str,
        commit_sha: str,
        image_tag: str,
        triggered_by: str = "automated"
    ) -> DeploymentJob:
        """Execute blue-green deployment"""

        job_id = f"{application}_{environment}_{version}_{int(time.time())}"

        deployment_config = DeploymentConfig(
            application=application,
            environment=environment,
            version=version,
            commit_sha=commit_sha,
            triggered_by=triggered_by,
            image_tag=image_tag
        )

        job = DeploymentJob(
            job_id=job_id,
            config=deployment_config,
            status=DeploymentStatus.PENDING,
            current_phase=DeploymentPhase.PRE_DEPLOYMENT,
            started_at=datetime.utcnow(),
            health_check_results={},
            metrics={}
        )

        self.active_jobs[job_id] = job

        try:
            await self.notification_manager.send_notification(
                "deployment_start",
                job,
                estimated_duration="20-30 minutes"
            )

            job.status = DeploymentStatus.IN_PROGRESS

            # Execute deployment phases
            if await self._execute_pre_deployment(job):
                if await self._execute_green_deployment(job):
                    if await self._execute_traffic_switching(job):
                        if await self._execute_post_deployment(job):
                            job.status = DeploymentStatus.SUCCESS
                            job.completed_at = datetime.utcnow()

                            await self.notification_manager.send_notification(
                                "deployment_success",
                                job
                            )

            # If we reach here and status is not SUCCESS, deployment failed
            if job.status != DeploymentStatus.SUCCESS:
                job.status = DeploymentStatus.FAILED
                job.completed_at = datetime.utcnow()

                # Trigger rollback if enabled
                env_config = self.config["environments"][environment]
                if env_config.get("auto_rollback", True):
                    await self._execute_rollback(job, "deployment_failure")

        except Exception as e:
            job.status = DeploymentStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()

            self.logger.error(f"Deployment failed for {application}: {e}")

            # Trigger rollback
            await self._execute_rollback(job, "exception", str(e))

        return job

    async def _execute_pre_deployment(self, job: DeploymentJob) -> bool:
        """Execute pre-deployment validation phase"""

        job.current_phase = DeploymentPhase.PRE_DEPLOYMENT
        app_config = self.config["applications"][job.config.application]

        self.logger.info(f"Starting pre-deployment phase for {job.config.application}")

        # Validate dependencies
        dependencies = app_config.get("dependencies", [])
        if not await self.health_checker.validate_dependencies(
            dependencies, job.config.environment
        ):
            job.error_message = "Dependency validation failed"
            return False

        # Get baseline metrics
        baseline_metrics = await self.metrics_collector.get_baseline_metrics(
            job.config.application, job.config.environment
        )
        job.metrics["baseline"] = baseline_metrics

        self.logger.info(f"Pre-deployment phase completed for {job.config.application}")
        return True

    async def _execute_green_deployment(self, job: DeploymentJob) -> bool:
        """Execute green environment deployment phase"""

        job.current_phase = DeploymentPhase.GREEN_DEPLOYMENT
        app_config = self.config["applications"][job.config.application]

        self.logger.info(f"Starting green deployment for {job.config.application}")

        # Deploy to green environment
        if not await self.k8s_deployer.deploy_green_environment(app_config, job.config):
            job.error_message = "Green environment deployment failed"
            return False

        # Setup green service
        green_service_name = await self.traffic_manager.setup_green_service(
            app_config, job.config.environment, job.config.version
        )

        # Wait for green environment to be healthy
        if not await self.health_checker.check_application_health(
            app_config, job.config.environment, green_service_name
        ):
            job.error_message = "Green environment health check failed"
            return False

        # Run smoke tests
        smoke_results = await self.health_checker.run_smoke_tests(
            app_config, job.config.environment, green_service_name
        )
        job.health_check_results["smoke_tests"] = smoke_results

        if not all(smoke_results.values()):
            job.error_message = f"Smoke tests failed: {smoke_results}"
            return False

        self.logger.info(f"Green deployment completed for {job.config.application}")
        return True

    async def _execute_traffic_switching(self, job: DeploymentJob) -> bool:
        """Execute traffic switching phase"""

        job.current_phase = DeploymentPhase.TRAFFIC_SWITCHING
        app_name = job.config.application

        self.logger.info(f"Starting traffic switching for {app_name}")

        # Start with canary traffic
        if not await self.traffic_manager.route_canary_traffic(
            app_name, job.config.environment, 10
        ):
            job.error_message = "Canary traffic routing failed"
            return False

        job.traffic_percentage = 10

        # Monitor canary for issues
        await asyncio.sleep(60)  # Wait 1 minute

        current_metrics = await self.metrics_collector.get_current_metrics(
            app_name, job.config.environment
        )

        baseline_metrics = job.metrics.get("baseline", {})
        thresholds = {
            "max_error_rate": 0.05,
            "response_time_multiplier": 1.5,
            "conversion_rate_multiplier": 0.8
        }

        is_valid, issues = await self.metrics_collector.validate_metrics(
            current_metrics, baseline_metrics, thresholds
        )

        if not is_valid:
            job.error_message = f"Canary validation failed: {issues}"
            return False

        # Gradual traffic switch
        percentages = [25, 50, 75, 100]
        for percentage in percentages:
            if not await self.traffic_manager.route_canary_traffic(
                app_name, job.config.environment, percentage
            ):
                job.error_message = f"Traffic switching failed at {percentage}%"
                return False

            job.traffic_percentage = percentage

            # Wait and validate
            await asyncio.sleep(30)

            current_metrics = await self.metrics_collector.get_current_metrics(
                app_name, job.config.environment
            )

            is_valid, issues = await self.metrics_collector.validate_metrics(
                current_metrics, baseline_metrics, thresholds
            )

            if not is_valid:
                job.error_message = f"Traffic validation failed at {percentage}%: {issues}"
                return False

        # Switch main service to green
        if not await self.traffic_manager.switch_traffic_to_green(
            app_name, job.config.environment
        ):
            job.error_message = "Final traffic switch failed"
            return False

        self.logger.info(f"Traffic switching completed for {app_name}")
        return True

    async def _execute_post_deployment(self, job: DeploymentJob) -> bool:
        """Execute post-deployment monitoring phase"""

        job.current_phase = DeploymentPhase.POST_DEPLOYMENT
        app_name = job.config.application

        self.logger.info(f"Starting post-deployment monitoring for {app_name}")

        # Monitor for 15 minutes
        monitoring_duration = 900  # 15 minutes
        start_time = time.time()

        while time.time() - start_time < monitoring_duration:
            current_metrics = await self.metrics_collector.get_current_metrics(
                app_name, job.config.environment
            )

            baseline_metrics = job.metrics.get("baseline", {})
            thresholds = {
                "max_error_rate": 0.05,
                "response_time_multiplier": 1.5,
                "conversion_rate_multiplier": 0.8
            }

            is_valid, issues = await self.metrics_collector.validate_metrics(
                current_metrics, baseline_metrics, thresholds
            )

            if not is_valid:
                job.error_message = f"Post-deployment validation failed: {issues}"
                await self._execute_rollback(job, "metrics_validation_failure")
                return False

            await asyncio.sleep(60)  # Check every minute

        # Cleanup blue environment
        await asyncio.sleep(600)  # Wait 10 minutes before cleanup

        if not await self.k8s_deployer.cleanup_blue_environment(
            app_name, job.config.environment
        ):
            self.logger.warning(f"Blue environment cleanup failed for {app_name}")
            # Don't fail deployment for cleanup issues

        self.logger.info(f"Post-deployment monitoring completed for {app_name}")
        return True

    async def _execute_rollback(
        self,
        job: DeploymentJob,
        trigger: str,
        reason: str = ""
    ):
        """Execute rollback to blue environment"""

        job.current_phase = DeploymentPhase.ROLLBACK
        job.rollback_triggered = True
        job.rollback_reason = f"{trigger}: {reason}"

        app_name = job.config.application

        self.logger.warning(f"Executing rollback for {app_name}: {trigger}")

        await self.notification_manager.send_notification(
            "rollback_triggered",
            job,
            rollback_trigger=trigger
        )

        # Revert traffic to blue
        if await self.traffic_manager.revert_traffic_to_blue(
            app_name, job.config.environment
        ):
            job.status = DeploymentStatus.ROLLED_BACK
            self.logger.info(f"Rollback completed for {app_name}")
        else:
            job.status = DeploymentStatus.FAILED
            job.error_message = "Rollback failed"
            self.logger.error(f"Rollback failed for {app_name}")

        job.completed_at = datetime.utcnow()


async def main():
    """Main function to run blue-green deployment"""

    config_path = Path(__file__).parent / "blue-green-config.yml"
    deployer = BlueGreenDeployer(str(config_path))

    # Example deployment
    job = await deployer.deploy(
        application="api",
        environment="production",
        version="v1.2.3",
        commit_sha="abc123def456",
        image_tag="v1.2.3",
        triggered_by="github_actions"
    )

    print(f"Deployment job {job.job_id} completed with status: {job.status}")

    if job.rollback_triggered:
        print(f"Rollback reason: {job.rollback_reason}")


if __name__ == "__main__":
    asyncio.run(main())