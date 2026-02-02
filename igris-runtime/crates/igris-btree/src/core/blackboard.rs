//! Shared state management for behavior trees.
//!
//! The blackboard pattern allows nodes to share data without tight coupling.
//! Each node can read and write values to the blackboard, enabling inter-node
//! communication and state persistence across ticks.

use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Blackboard for sharing state between nodes.
///
/// A thread-safe key-value store that nodes use to share data during execution.
/// Values are stored as `serde_json::Value` for maximum flexibility, with
/// type-safe helpers for serialization/deserialization.
///
/// # Thread Safety
///
/// The blackboard uses `Arc<RwLock<>>` for async-safe concurrent access.
/// Multiple nodes can read simultaneously, but writes are exclusive.
///
/// # Storage
///
/// All values are stored as `serde_json::Value`, which means:
/// - Any serializable type can be stored
/// - Type conversions happen at read time via `get_as()`
/// - Runtime type errors are returned as `Result`
///
/// # Examples
///
/// ```
/// use igris_btree::core::Blackboard;
/// use serde_json::json;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let blackboard = Blackboard::new();
///
/// // Set and get basic values
/// blackboard.set("counter", json!(42)).await;
/// let value = blackboard.get("counter").await;
/// assert_eq!(value, Some(json!(42)));
///
/// // Type-safe access
/// #[derive(serde::Serialize, serde::Deserialize)]
/// struct Config {
///     timeout: u64,
///     retry: bool,
/// }
///
/// let config = Config { timeout: 5000, retry: true };
/// blackboard.set_from("config", &config).await?;
///
/// let loaded: Config = blackboard.get_as("config").await?;
/// assert_eq!(loaded.timeout, 5000);
/// # Ok(())
/// # }
/// ```
#[derive(Debug, Clone)]
pub struct Blackboard {
    data: Arc<RwLock<HashMap<String, Value>>>,
}

impl Blackboard {
    /// Create a new empty blackboard.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::core::Blackboard;
    ///
    /// let blackboard = Blackboard::new();
    /// ```
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get a value from the blackboard.
    ///
    /// Returns `None` if the key doesn't exist.
    ///
    /// # Arguments
    ///
    /// * `key` - The key to look up
    ///
    /// # Example
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() {
    /// let blackboard = Blackboard::new();
    /// blackboard.set("name", json!("Alice")).await;
    ///
    /// let value = blackboard.get("name").await;
    /// assert_eq!(value, Some(json!("Alice")));
    /// # }
    /// ```
    pub async fn get(&self, key: &str) -> Option<Value> {
        self.data.read().await.get(key).cloned()
    }

    /// Get a value from the blackboard and deserialize to a specific type.
    ///
    /// This is a type-safe way to retrieve structured data from the blackboard.
    /// The value is deserialized using serde_json.
    ///
    /// # Arguments
    ///
    /// * `key` - The key to look up
    ///
    /// # Returns
    ///
    /// Returns `Ok(T)` if the key exists and deserialization succeeds,
    /// otherwise returns an error.
    ///
    /// # Example
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde::{Deserialize, Serialize};
    /// # #[tokio::main]
    /// # async fn main() -> anyhow::Result<()> {
    /// #[derive(Serialize, Deserialize)]
    /// struct Position { x: f64, y: f64 }
    ///
    /// let blackboard = Blackboard::new();
    /// let pos = Position { x: 10.0, y: 20.0 };
    /// blackboard.set_from("position", &pos).await?;
    ///
    /// let loaded: Position = blackboard.get_as("position").await?;
    /// assert_eq!(loaded.x, 10.0);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn get_as<T: serde::de::DeserializeOwned>(&self, key: &str) -> anyhow::Result<T> {
        let value = self.get(key).await
            .ok_or_else(|| anyhow::anyhow!("Key not found: {}", key))?;
        serde_json::from_value(value)
            .map_err(|e| anyhow::anyhow!("Failed to deserialize: {}", e))
    }

    /// Set a value in the blackboard.
    ///
    /// If the key already exists, the old value is replaced.
    ///
    /// # Arguments
    ///
    /// * `key` - The key to set
    /// * `value` - The JSON value to store
    ///
    /// # Example
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() {
    /// let blackboard = Blackboard::new();
    /// blackboard.set("status", json!("ready")).await;
    /// # }
    /// ```
    pub async fn set(&self, key: &str, value: Value) {
        self.data.write().await.insert(key.to_string(), value);
    }

    /// Set a value in the blackboard from a serializable type.
    ///
    /// This is a type-safe way to store structured data. The value is
    /// serialized to JSON automatically.
    ///
    /// # Arguments
    ///
    /// * `key` - The key to set
    /// * `value` - A reference to any serializable value
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` on success, or an error if serialization fails.
    ///
    /// # Example
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde::Serialize;
    /// # #[tokio::main]
    /// # async fn main() -> anyhow::Result<()> {
    /// #[derive(Serialize)]
    /// struct Goal { target: String, priority: u8 }
    ///
    /// let blackboard = Blackboard::new();
    /// let goal = Goal { target: "warehouse".into(), priority: 5 };
    /// blackboard.set_from("current_goal", &goal).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn set_from<T: serde::Serialize>(&self, key: &str, value: &T) -> anyhow::Result<()> {
        let json_value = serde_json::to_value(value)?;
        self.set(key, json_value).await;
        Ok(())
    }

    /// Remove a value from the blackboard.
    ///
    /// # Arguments
    ///
    /// * `key` - The key to remove
    ///
    /// # Returns
    ///
    /// Returns the removed value if the key existed, or `None` if it didn't.
    ///
    /// # Example
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() {
    /// let blackboard = Blackboard::new();
    /// blackboard.set("temp", json!(42)).await;
    ///
    /// let removed = blackboard.remove("temp").await;
    /// assert_eq!(removed, Some(json!(42)));
    /// assert!(!blackboard.contains("temp").await);
    /// # }
    /// ```
    pub async fn remove(&self, key: &str) -> Option<Value> {
        self.data.write().await.remove(key)
    }

    /// Check if a key exists in the blackboard.
    ///
    /// # Arguments
    ///
    /// * `key` - The key to check
    ///
    /// # Example
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() {
    /// let blackboard = Blackboard::new();
    /// blackboard.set("key", json!("value")).await;
    ///
    /// assert!(blackboard.contains("key").await);
    /// assert!(!blackboard.contains("missing").await);
    /// # }
    /// ```
    pub async fn contains(&self, key: &str) -> bool {
        self.data.read().await.contains_key(key)
    }

    /// Get all keys currently in the blackboard.
    ///
    /// # Returns
    ///
    /// A vector of all key names.
    ///
    /// # Example
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() {
    /// let blackboard = Blackboard::new();
    /// blackboard.set("a", json!(1)).await;
    /// blackboard.set("b", json!(2)).await;
    ///
    /// let keys = blackboard.keys().await;
    /// assert_eq!(keys.len(), 2);
    /// # }
    /// ```
    pub async fn keys(&self) -> Vec<String> {
        self.data.read().await.keys().cloned().collect()
    }

    /// Clear all data from the blackboard.
    ///
    /// After calling this, the blackboard will be empty.
    ///
    /// # Example
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() {
    /// let blackboard = Blackboard::new();
    /// blackboard.set("key", json!("value")).await;
    /// blackboard.clear().await;
    ///
    /// assert!(blackboard.is_empty().await);
    /// # }
    /// ```
    pub async fn clear(&self) {
        self.data.write().await.clear();
    }

    /// Get the number of entries in the blackboard.
    ///
    /// # Example
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() {
    /// let blackboard = Blackboard::new();
    /// blackboard.set("a", json!(1)).await;
    /// blackboard.set("b", json!(2)).await;
    ///
    /// assert_eq!(blackboard.len().await, 2);
    /// # }
    /// ```
    pub async fn len(&self) -> usize {
        self.data.read().await.len()
    }

    /// Check if the blackboard is empty.
    ///
    /// # Example
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # #[tokio::main]
    /// # async fn main() {
    /// let blackboard = Blackboard::new();
    /// assert!(blackboard.is_empty().await);
    /// # }
    /// ```
    pub async fn is_empty(&self) -> bool {
        self.data.read().await.is_empty()
    }
}

impl Default for Blackboard {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_blackboard_basic() {
        let bb = Blackboard::new();

        // Set and get
        bb.set("key", json!("value")).await;
        let val = bb.get("key").await;
        assert_eq!(val, Some(json!("value")));

        // Contains
        assert!(bb.contains("key").await);
        assert!(!bb.contains("missing").await);

        // Remove
        bb.remove("key").await;
        assert!(!bb.contains("key").await);
    }

    #[tokio::test]
    async fn test_blackboard_typed() {
        let bb = Blackboard::new();

        #[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug)]
        struct TestData {
            x: i32,
            y: String,
        }

        let data = TestData { x: 42, y: "test".to_string() };
        bb.set_from("data", &data).await.unwrap();

        let retrieved: TestData = bb.get_as("data").await.unwrap();
        assert_eq!(retrieved, data);
    }

    #[tokio::test]
    async fn test_blackboard_utility() {
        let bb = Blackboard::new();

        assert!(bb.is_empty().await);
        assert_eq!(bb.len().await, 0);

        bb.set("key1", json!(1)).await;
        bb.set("key2", json!(2)).await;

        assert_eq!(bb.len().await, 2);
        assert!(!bb.is_empty().await);

        let keys = bb.keys().await;
        assert!(keys.contains(&"key1".to_string()));
        assert!(keys.contains(&"key2".to_string()));

        bb.clear().await;
        assert!(bb.is_empty().await);
    }
}
