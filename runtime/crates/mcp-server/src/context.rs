use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

use crate::protocol::{ContextMessage, SharedContextEnvelope};

/// In-memory context store with eventual Redb persistence
#[derive(Clone)]
pub struct ContextStore {
    contexts: Arc<RwLock<HashMap<String, SharedContext>>>,
}

impl ContextStore {
    pub fn new() -> Self {
        Self {
            contexts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Sync context from a peer
    pub async fn sync_context(&self, envelope: SharedContextEnvelope) -> Result<()> {
        let mut contexts = self.contexts.write().await;

        let existing = contexts.get(&envelope.conversation_id);

        // Merge or replace based on timestamp
        if let Some(existing) = existing {
            if envelope.last_updated > existing.last_updated {
                info!(
                    "Updating context {} with newer data from peer {}",
                    envelope.conversation_id, envelope.peer_id
                );
                contexts.insert(
                    envelope.conversation_id.clone(),
                    SharedContext::from_envelope(envelope),
                );
            } else {
                info!(
                    "Ignoring older context update for {}",
                    envelope.conversation_id
                );
            }
        } else {
            info!(
                "Creating new context {} from peer {}",
                envelope.conversation_id, envelope.peer_id
            );
            contexts.insert(
                envelope.conversation_id.clone(),
                SharedContext::from_envelope(envelope),
            );
        }

        Ok(())
    }

    /// Get context by conversation ID
    pub async fn get_context(&self, conversation_id: &str) -> Result<Option<SharedContext>> {
        let contexts = self.contexts.read().await;
        Ok(contexts.get(conversation_id).cloned())
    }

    /// List all conversation IDs
    pub async fn list_contexts(&self) -> Result<Vec<String>> {
        let contexts = self.contexts.read().await;
        Ok(contexts.keys().cloned().collect())
    }

    /// Store a new message in a conversation
    pub async fn add_message(
        &self,
        conversation_id: String,
        message: ContextMessage,
    ) -> Result<()> {
        let mut contexts = self.contexts.write().await;

        let context = contexts
            .entry(conversation_id.clone())
            .or_insert_with(|| SharedContext {
                conversation_id: conversation_id.clone(),
                messages: Vec::new(),
                tool_state: serde_json::json!({}),
                last_updated: 0,
            });

        context.messages.push(message);
        context.last_updated = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(())
    }

    /// Get all contexts for broadcasting to peers
    pub async fn get_all_contexts(&self) -> Result<Vec<SharedContext>> {
        let contexts = self.contexts.read().await;
        Ok(contexts.values().cloned().collect())
    }
}

impl Default for ContextStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Shared context structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedContext {
    pub conversation_id: String,
    pub messages: Vec<ContextMessage>,
    pub tool_state: serde_json::Value,
    pub last_updated: u64,
}

impl SharedContext {
    pub fn from_envelope(envelope: SharedContextEnvelope) -> Self {
        Self {
            conversation_id: envelope.conversation_id,
            messages: envelope.messages,
            tool_state: envelope.tool_state,
            last_updated: envelope.last_updated,
        }
    }

    pub fn to_envelope(&self, peer_id: String) -> SharedContextEnvelope {
        SharedContextEnvelope {
            conversation_id: self.conversation_id.clone(),
            messages: self.messages.clone(),
            tool_state: self.tool_state.clone(),
            last_updated: self.last_updated,
            peer_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_context_store() {
        let store = ContextStore::new();

        let envelope = SharedContextEnvelope {
            conversation_id: "test-123".to_string(),
            messages: vec![],
            tool_state: serde_json::json!({}),
            last_updated: 1000,
            peer_id: "peer-1".to_string(),
        };

        store.sync_context(envelope).await.unwrap();

        let contexts = store.list_contexts().await.unwrap();
        assert_eq!(contexts.len(), 1);
        assert_eq!(contexts[0], "test-123");
    }

    #[tokio::test]
    async fn test_context_merge() {
        let store = ContextStore::new();

        // Add older context
        let envelope1 = SharedContextEnvelope {
            conversation_id: "test-123".to_string(),
            messages: vec![],
            tool_state: serde_json::json!({}),
            last_updated: 1000,
            peer_id: "peer-1".to_string(),
        };
        store.sync_context(envelope1).await.unwrap();

        // Add newer context
        let envelope2 = SharedContextEnvelope {
            conversation_id: "test-123".to_string(),
            messages: vec![],
            tool_state: serde_json::json!({"new": "data"}),
            last_updated: 2000,
            peer_id: "peer-2".to_string(),
        };
        store.sync_context(envelope2).await.unwrap();

        let context = store.get_context("test-123").await.unwrap().unwrap();
        assert_eq!(context.last_updated, 2000);
    }
}
