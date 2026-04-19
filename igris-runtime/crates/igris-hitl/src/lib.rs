//! Human-in-the-Loop Framework for Igris Runtime
//!
//! Provides escalation and approval workflow capabilities for AI agents.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::{mpsc, RwLock};
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HitlConfig {
    pub enabled: bool,
    pub auto_approve_threshold: f32,
    pub escalation_endpoint: Option<String>,
    pub timeout_secs: u64,
}

impl Default for HitlConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            auto_approve_threshold: 0.9,
            escalation_endpoint: None,
            timeout_secs: 300,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscalationRequest {
    pub id: String,
    pub task: String,
    pub context: HashMap<String, serde_json::Value>,
    pub confidence: f32,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
    Timeout,
}

pub struct HitlCoordinator {
    config: HitlConfig,
    pending_requests: Arc<RwLock<HashMap<String, (EscalationRequest, ApprovalStatus)>>>,
    #[allow(dead_code)]
    approval_tx: mpsc::UnboundedSender<(String, ApprovalStatus)>,
    #[allow(dead_code)]
    approval_rx: Arc<RwLock<mpsc::UnboundedReceiver<(String, ApprovalStatus)>>>,
}

impl HitlCoordinator {
    pub async fn new(config: HitlConfig) -> Result<Self> {
        info!("Initializing HITL coordinator");

        let (approval_tx, approval_rx) = mpsc::unbounded_channel();

        Ok(Self {
            config,
            pending_requests: Arc::new(RwLock::new(HashMap::new())),
            approval_tx,
            approval_rx: Arc::new(RwLock::new(approval_rx)),
        })
    }

    pub async fn request_approval(
        &self,
        task: String,
        context: HashMap<String, serde_json::Value>,
        confidence: f32,
    ) -> Result<ApprovalStatus> {
        let (request, status) = self.submit_request(task, context, confidence).await?;
        if !matches!(status, ApprovalStatus::Pending) {
            return Ok(status);
        }

        // Wait for approval
        let timeout = tokio::time::Duration::from_secs(self.config.timeout_secs);
        match tokio::time::timeout(timeout, self.wait_for_approval(&request.id)).await {
            Ok(status) => Ok(status?),
            Err(_) => {
                let mut pending = self.pending_requests.write().await;
                if let Some((_, status)) = pending.get_mut(&request.id) {
                    *status = ApprovalStatus::Timeout;
                }
                Ok(ApprovalStatus::Timeout)
            }
        }
    }

    pub async fn submit_request(
        &self,
        task: String,
        context: HashMap<String, serde_json::Value>,
        confidence: f32,
    ) -> Result<(EscalationRequest, ApprovalStatus)> {
        let status = if confidence >= self.config.auto_approve_threshold {
            info!("Auto-approving task (confidence: {:.2})", confidence);
            ApprovalStatus::Approved
        } else {
            ApprovalStatus::Pending
        };

        let request = EscalationRequest {
            id: Uuid::new_v4().to_string(),
            task,
            context,
            confidence,
            timestamp: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)?
                .as_secs(),
        };

        if matches!(status, ApprovalStatus::Pending) {
            warn!(
                "Escalating task '{}' for human approval (confidence: {:.2})",
                request.task, request.confidence
            );
        }

        let mut pending = self.pending_requests.write().await;
        pending.insert(request.id.clone(), (request.clone(), status.clone()));
        drop(pending);

        Ok((request, status))
    }

    async fn wait_for_approval(&self, request_id: &str) -> Result<ApprovalStatus> {
        loop {
            let pending = self.pending_requests.read().await;
            if let Some((_, status)) = pending.get(request_id) {
                match status {
                    ApprovalStatus::Pending => {
                        drop(pending);
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }
                    _ => return Ok(status.clone()),
                }
            } else {
                return Err(anyhow::anyhow!("Request not found"));
            }
        }
    }

    pub async fn approve(&self, request_id: &str) -> Result<()> {
        let mut pending = self.pending_requests.write().await;
        if let Some((_, status)) = pending.get_mut(request_id) {
            *status = ApprovalStatus::Approved;
            info!("Request {} approved", request_id);
        }
        Ok(())
    }

    pub async fn reject(&self, request_id: &str) -> Result<()> {
        let mut pending = self.pending_requests.write().await;
        if let Some((_, status)) = pending.get_mut(request_id) {
            *status = ApprovalStatus::Rejected;
            info!("Request {} rejected", request_id);
        }
        Ok(())
    }

    pub async fn get_pending_requests(&self) -> Vec<EscalationRequest> {
        self.pending_requests
            .read()
            .await
            .values()
            .filter(|(_, status)| matches!(status, ApprovalStatus::Pending))
            .map(|(req, _)| req.clone())
            .collect()
    }

    pub async fn get_status(&self, request_id: &str) -> Option<ApprovalStatus> {
        self.pending_requests
            .read()
            .await
            .get(request_id)
            .map(|(_, status)| status.clone())
    }

    pub fn config(&self) -> HitlConfig {
        self.config.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_auto_approve() {
        let config = HitlConfig {
            enabled: true,
            auto_approve_threshold: 0.9,
            ..Default::default()
        };

        let coordinator = HitlCoordinator::new(config).await.unwrap();
        let status = coordinator
            .request_approval("test".to_string(), HashMap::new(), 0.95)
            .await
            .unwrap();

        assert!(matches!(status, ApprovalStatus::Approved));
    }

    #[tokio::test]
    async fn test_manual_approval() {
        let config = HitlConfig {
            enabled: true,
            auto_approve_threshold: 0.9,
            timeout_secs: 5,
            ..Default::default()
        };

        let coordinator = Arc::new(HitlCoordinator::new(config).await.unwrap());
        let coordinator_clone = coordinator.clone();

        // Request approval in background
        let handle = tokio::spawn(async move {
            coordinator_clone
                .request_approval("test".to_string(), HashMap::new(), 0.5)
                .await
        });

        // Wait a bit then approve
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let pending = coordinator.get_pending_requests().await;
        assert_eq!(pending.len(), 1);

        coordinator.approve(&pending[0].id).await.unwrap();

        let status = handle.await.unwrap().unwrap();
        assert!(matches!(status, ApprovalStatus::Approved));
    }

    #[tokio::test]
    async fn test_rejection() {
        let config = HitlConfig {
            enabled: true,
            auto_approve_threshold: 0.9,
            timeout_secs: 5,
            ..Default::default()
        };

        let coordinator = Arc::new(HitlCoordinator::new(config).await.unwrap());
        let coordinator_clone = coordinator.clone();

        let handle = tokio::spawn(async move {
            coordinator_clone
                .request_approval("test".to_string(), HashMap::new(), 0.5)
                .await
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let pending = coordinator.get_pending_requests().await;
        coordinator.reject(&pending[0].id).await.unwrap();

        let status = handle.await.unwrap().unwrap();
        assert!(matches!(status, ApprovalStatus::Rejected));
    }
}
