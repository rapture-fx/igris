//! Shared state management for behavior trees.
//!
//! The blackboard pattern allows nodes to share data without tight coupling.
//! Each node can read and write values to the blackboard, enabling inter-node
//! communication and state persistence across ticks.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;
use tokio::sync::RwLock;

// ── Entry type ────────────────────────────────────────────────────────────────

/// Metadata recorded alongside every blackboard value.
///
/// Enables post-mortem analysis after a crash: operators can trace exactly
/// which node wrote which value at which tick — without grepping logs.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BlackboardEntry {
    /// The stored value.
    pub value: Value,
    /// BT tick at which this entry was last written (0 = untracked).
    pub written_at_tick: u64,
    /// Name of the node that last wrote this entry ("" = untracked).
    pub written_by: String,
    /// Monotonically increasing write count for this key.
    /// Starts at 1; increments on every overwrite.
    pub version: u64,
}

impl BlackboardEntry {
    fn new(value: Value, tick: u64, node: &str) -> Self {
        Self {
            value,
            written_at_tick: tick,
            written_by: node.to_string(),
            version: 1,
        }
    }

    fn overwrite(mut self, value: Value, tick: u64, node: &str) -> Self {
        self.value = value;
        self.written_at_tick = tick;
        self.written_by = node.to_string();
        self.version += 1;
        self
    }
}

// ── Blackboard ────────────────────────────────────────────────────────────────

/// Shared state store for behavior tree nodes.
///
/// Thread-safe key-value store with per-entry write metadata. Each write
/// records the tick count and writing node name, enabling crash post-mortems.
///
/// # Namespacing
///
/// Use [`scoped`](Blackboard::scoped) to get a [`ScopedBlackboard`] that
/// prepends a prefix to every key, preventing collisions between subtrees:
///
/// ```
/// # use igris_btree::core::Blackboard;
/// # use serde_json::json;
/// # #[tokio::main]
/// # async fn main() {
/// let bb = Blackboard::new();
/// let nav = bb.scoped("navigate");
/// nav.set("status", json!("running")).await;
/// assert_eq!(bb.get("navigate/status").await, Some(json!("running")));
/// # }
/// ```
///
/// # Atomic updates
///
/// Use [`update_with`](Blackboard::update_with) to atomically read-modify-write
/// in one lock acquisition — safe for counters and accumulators:
///
/// ```
/// # use igris_btree::core::Blackboard;
/// # use serde_json::json;
/// # #[tokio::main]
/// # async fn main() {
/// let bb = Blackboard::new();
/// bb.set("retries", json!(0)).await;
/// bb.update_with("retries", |v| {
///     Some(json!(v.and_then(|n| n.as_i64()).unwrap_or(0) + 1))
/// }).await;
/// assert_eq!(bb.get("retries").await, Some(json!(1)));
/// # }
/// ```
#[derive(Debug, Clone)]
pub struct Blackboard {
    data: Arc<RwLock<HashMap<String, BlackboardEntry>>>,
}

impl Blackboard {
    /// Create a new empty blackboard.
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // ── Reads ─────────────────────────────────────────────────────────────────

    /// Get a value. Returns `None` if the key does not exist.
    pub async fn get(&self, key: &str) -> Option<Value> {
        self.data.read().await.get(key).map(|e| e.value.clone())
    }

    /// Get the full entry including write metadata.
    ///
    /// Useful for observability: inspect when and by whom a key was last written.
    pub async fn get_entry(&self, key: &str) -> Option<BlackboardEntry> {
        self.data.read().await.get(key).cloned()
    }

    /// Get a value and deserialize to a specific type.
    ///
    /// Error messages include the key name and expected type for fast debugging.
    pub async fn get_as<T: serde::de::DeserializeOwned>(&self, key: &str) -> anyhow::Result<T> {
        let value = self
            .get(key)
            .await
            .ok_or_else(|| anyhow::anyhow!("blackboard key '{}' not found", key))?;
        serde_json::from_value(value).map_err(|e| {
            anyhow::anyhow!(
                "blackboard key '{}' could not be deserialized as {}: {}",
                key,
                std::any::type_name::<T>(),
                e
            )
        })
    }

    /// Get a value or return `default` if the key is absent.
    pub async fn get_or(&self, key: &str, default: Value) -> Value {
        self.get(key).await.unwrap_or(default)
    }

    /// Returns `true` if the key exists.
    pub async fn contains(&self, key: &str) -> bool {
        self.data.read().await.contains_key(key)
    }

    // ── Writes ────────────────────────────────────────────────────────────────

    /// Set a value. Tick and node name are not tracked.
    ///
    /// For metadata-aware writes use [`set_tagged`](Self::set_tagged).
    pub async fn set(&self, key: &str, value: Value) {
        self.set_tagged(key, value, 0, "").await;
    }

    /// Set a value with provenance metadata.
    ///
    /// Records the current tick and writing node name alongside the value.
    /// Use this in nodes that implement the write path for post-mortem tracing.
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() {
    /// let bb = Blackboard::new();
    /// bb.set_tagged("goal_reached", json!(true), 47, "NavigationNode").await;
    /// let entry = bb.get_entry("goal_reached").await.unwrap();
    /// assert_eq!(entry.written_at_tick, 47);
    /// assert_eq!(entry.written_by, "NavigationNode");
    /// assert_eq!(entry.version, 1);
    /// # }
    /// ```
    pub async fn set_tagged(&self, key: &str, value: Value, tick: u64, node: &str) {
        let mut data = self.data.write().await;
        let entry = match data.remove(key) {
            Some(existing) => existing.overwrite(value, tick, node),
            None => BlackboardEntry::new(value, tick, node),
        };
        data.insert(key.to_string(), entry);
    }

    /// Set a value from any serializable type.
    pub async fn set_from<T: serde::Serialize>(&self, key: &str, value: &T) -> anyhow::Result<()> {
        self.set(key, serde_json::to_value(value)?).await;
        Ok(())
    }

    /// Set a value only if the key is currently absent.
    ///
    /// The check-then-write is atomic (single lock acquisition).
    /// Returns `true` if the value was written, `false` if the key existed.
    ///
    /// Useful for one-time initialisation at the start of a subtree.
    pub async fn set_if_absent(&self, key: &str, value: Value) -> bool {
        let mut data = self.data.write().await;
        if data.contains_key(key) {
            return false;
        }
        data.insert(key.to_string(), BlackboardEntry::new(value, 0, ""));
        true
    }

    // ── Atomic operations ─────────────────────────────────────────────────────

    /// Atomically read-modify-write a key in one lock acquisition.
    ///
    /// `f` receives the current value (`None` if absent) and returns:
    /// - `Some(new_value)` — write the new value
    /// - `None` — remove the key
    ///
    /// Returns the new value, or `None` if the key was removed.
    ///
    /// # Example — safe counter
    ///
    /// ```
    /// # use igris_btree::core::Blackboard;
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() {
    /// let bb = Blackboard::new();
    /// // Safe even with concurrent ticks — no TOCTOU race
    /// for _ in 0..5 {
    ///     bb.update_with("count", |v| {
    ///         Some(json!(v.and_then(|n| n.as_i64()).unwrap_or(0) + 1))
    ///     }).await;
    /// }
    /// assert_eq!(bb.get("count").await, Some(json!(5)));
    /// # }
    /// ```
    pub async fn update_with<F>(&self, key: &str, f: F) -> Option<Value>
    where
        F: FnOnce(Option<Value>) -> Option<Value> + Send,
    {
        let mut data = self.data.write().await;
        let current = data.get(key).map(|e| e.value.clone());
        match f(current) {
            Some(new_val) => {
                let entry = match data.remove(key) {
                    Some(existing) => existing.overwrite(new_val.clone(), 0, ""),
                    None => BlackboardEntry::new(new_val.clone(), 0, ""),
                };
                data.insert(key.to_string(), entry);
                Some(new_val)
            }
            None => {
                data.remove(key);
                None
            }
        }
    }

    // ── Removal ───────────────────────────────────────────────────────────────

    /// Remove a key. Returns the previous value if the key existed.
    pub async fn remove(&self, key: &str) -> Option<Value> {
        self.data.write().await.remove(key).map(|e| e.value)
    }

    // ── Introspection ─────────────────────────────────────────────────────────

    /// Return all keys in the blackboard (unordered).
    pub async fn keys(&self) -> Vec<String> {
        self.data.read().await.keys().cloned().collect()
    }

    /// Return all keys that start with `prefix`.
    ///
    /// Used internally by [`ScopedBlackboard`] to list scoped keys.
    pub async fn keys_with_prefix(&self, prefix: &str) -> Vec<String> {
        self.data
            .read()
            .await
            .keys()
            .filter(|k| k.starts_with(prefix))
            .cloned()
            .collect()
    }

    /// Number of entries in the blackboard.
    pub async fn len(&self) -> usize {
        self.data.read().await.len()
    }

    /// Returns `true` if the blackboard has no entries.
    pub async fn is_empty(&self) -> bool {
        self.data.read().await.is_empty()
    }

    /// Remove all entries.
    pub async fn clear(&self) {
        self.data.write().await.clear();
    }

    // ── Namespacing ───────────────────────────────────────────────────────────

    /// Return a namespaced view of this blackboard.
    ///
    /// All keys are transparently prefixed with `"{prefix}/"`. Use one scope
    /// per logical subsystem (navigation, manipulation, perception) to prevent
    /// collisions without changing the shared-blackboard architecture.
    pub fn scoped<'a>(&'a self, prefix: &str) -> ScopedBlackboard<'a> {
        ScopedBlackboard {
            bb: self,
            prefix: prefix.to_string(),
        }
    }

    // ── Snapshot / restore ────────────────────────────────────────────────────

    /// Return a deterministically-ordered snapshot of all values.
    ///
    /// Keys are sorted so the SHA-256 of the serialized output is stable
    /// across runs — required for WAL checkpoint digest computation.
    pub async fn snapshot(&self) -> serde_json::Value {
        let data = self.data.read().await;
        let sorted: BTreeMap<_, _> = data
            .iter()
            .map(|(k, e)| (k.clone(), e.value.clone()))
            .collect();
        serde_json::to_value(sorted).unwrap_or(serde_json::Value::Object(Default::default()))
    }

    /// Return a full snapshot including write metadata, sorted by key.
    ///
    /// Use this for observability dashboards and post-mortem analysis.
    /// The output includes `written_at_tick`, `written_by`, and `version`
    /// for every entry.
    pub async fn snapshot_full(&self) -> serde_json::Value {
        let data = self.data.read().await;
        let sorted: BTreeMap<_, _> = data
            .iter()
            .map(|(k, e)| {
                (
                    k.clone(),
                    serde_json::to_value(e).unwrap_or(serde_json::Value::Null),
                )
            })
            .collect();
        serde_json::to_value(sorted).unwrap_or(serde_json::Value::Object(Default::default()))
    }

    /// Replace the entire blackboard with the values from a snapshot.
    ///
    /// Any key not present in the snapshot is removed. This is the correct
    /// semantics for crash recovery: restore to exactly the checkpointed state,
    /// leaving no stale pre-crash keys behind.
    pub async fn restore(&self, snapshot: &serde_json::Value) {
        if let serde_json::Value::Object(map) = snapshot {
            let mut data = self.data.write().await;
            data.clear();
            for (k, v) in map {
                data.insert(k.clone(), BlackboardEntry::new(v.clone(), 0, "checkpoint"));
            }
        }
    }

    /// Merge values from a snapshot into the existing blackboard.
    ///
    /// Unlike [`restore`](Self::restore), keys absent from the snapshot are
    /// preserved. Use this to inject partial state without a full replacement.
    pub async fn merge(&self, snapshot: &serde_json::Value) {
        if let serde_json::Value::Object(map) = snapshot {
            let mut data = self.data.write().await;
            for (k, v) in map {
                let entry = match data.remove(k) {
                    Some(existing) => existing.overwrite(v.clone(), 0, "merge"),
                    None => BlackboardEntry::new(v.clone(), 0, "merge"),
                };
                data.insert(k.clone(), entry);
            }
        }
    }
}

impl Default for Blackboard {
    fn default() -> Self {
        Self::new()
    }
}

// ── ScopedBlackboard ──────────────────────────────────────────────────────────

/// A namespaced view of a [`Blackboard`].
///
/// Every key is automatically prefixed with `"{prefix}/"`. Multiple subtrees
/// can use the same logical key names without colliding on the shared board.
///
/// Obtain via [`Blackboard::scoped`].
pub struct ScopedBlackboard<'a> {
    bb: &'a Blackboard,
    prefix: String,
}

impl<'a> ScopedBlackboard<'a> {
    fn full_key(&self, key: &str) -> String {
        format!("{}/{}", self.prefix, key)
    }

    pub async fn get(&self, key: &str) -> Option<Value> {
        self.bb.get(&self.full_key(key)).await
    }

    pub async fn get_entry(&self, key: &str) -> Option<BlackboardEntry> {
        self.bb.get_entry(&self.full_key(key)).await
    }

    pub async fn get_as<T: serde::de::DeserializeOwned>(&self, key: &str) -> anyhow::Result<T> {
        self.bb.get_as(&self.full_key(key)).await
    }

    pub async fn get_or(&self, key: &str, default: Value) -> Value {
        self.bb.get_or(&self.full_key(key), default).await
    }

    pub async fn set(&self, key: &str, value: Value) {
        self.bb.set(&self.full_key(key), value).await;
    }

    pub async fn set_tagged(&self, key: &str, value: Value, tick: u64, node: &str) {
        self.bb
            .set_tagged(&self.full_key(key), value, tick, node)
            .await;
    }

    pub async fn set_from<T: serde::Serialize>(&self, key: &str, value: &T) -> anyhow::Result<()> {
        self.bb.set_from(&self.full_key(key), value).await
    }

    pub async fn set_if_absent(&self, key: &str, value: Value) -> bool {
        self.bb.set_if_absent(&self.full_key(key), value).await
    }

    pub async fn contains(&self, key: &str) -> bool {
        self.bb.contains(&self.full_key(key)).await
    }

    pub async fn remove(&self, key: &str) -> Option<Value> {
        self.bb.remove(&self.full_key(key)).await
    }

    pub async fn update_with<F>(&self, key: &str, f: F) -> Option<Value>
    where
        F: FnOnce(Option<Value>) -> Option<Value> + Send,
    {
        self.bb.update_with(&self.full_key(key), f).await
    }

    /// List all keys within this scope (prefix stripped from results).
    pub async fn keys(&self) -> Vec<String> {
        let prefix = format!("{}/", self.prefix);
        self.bb
            .keys_with_prefix(&prefix)
            .await
            .into_iter()
            .map(|k| k[prefix.len()..].to_string())
            .collect()
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_basic_get_set() {
        let bb = Blackboard::new();
        bb.set("key", json!("value")).await;
        assert_eq!(bb.get("key").await, Some(json!("value")));
        assert!(bb.contains("key").await);
        assert!(!bb.contains("missing").await);
    }

    #[tokio::test]
    async fn test_remove() {
        let bb = Blackboard::new();
        bb.set("temp", json!(42)).await;
        let removed = bb.remove("temp").await;
        assert_eq!(removed, Some(json!(42)));
        assert!(!bb.contains("temp").await);
    }

    #[tokio::test]
    async fn test_typed_roundtrip() {
        #[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug)]
        struct Position {
            x: f64,
            y: f64,
        }

        let bb = Blackboard::new();
        bb.set_from("pos", &Position { x: 1.0, y: 2.0 })
            .await
            .unwrap();
        let loaded: Position = bb.get_as("pos").await.unwrap();
        assert_eq!(loaded, Position { x: 1.0, y: 2.0 });
    }

    #[tokio::test]
    async fn test_get_as_missing_key_error() {
        let bb = Blackboard::new();
        let err = bb.get_as::<i32>("missing").await.unwrap_err();
        assert!(err.to_string().contains("'missing'"));
    }

    #[tokio::test]
    async fn test_get_as_type_mismatch_error() {
        let bb = Blackboard::new();
        bb.set("key", json!("not_a_number")).await;
        let err = bb.get_as::<i32>("key").await.unwrap_err();
        assert!(err.to_string().contains("'key'"));
        assert!(err.to_string().contains("i32"));
    }

    #[tokio::test]
    async fn test_set_tagged_metadata() {
        let bb = Blackboard::new();
        bb.set_tagged("goal", json!("dock"), 12, "PlannerNode")
            .await;

        let entry = bb.get_entry("goal").await.unwrap();
        assert_eq!(entry.value, json!("dock"));
        assert_eq!(entry.written_at_tick, 12);
        assert_eq!(entry.written_by, "PlannerNode");
        assert_eq!(entry.version, 1);

        // Overwrite increments version
        bb.set_tagged("goal", json!("charge"), 15, "PlannerNode")
            .await;
        let entry = bb.get_entry("goal").await.unwrap();
        assert_eq!(entry.value, json!("charge"));
        assert_eq!(entry.version, 2);
        assert_eq!(entry.written_at_tick, 15);
    }

    #[tokio::test]
    async fn test_set_if_absent() {
        let bb = Blackboard::new();
        assert!(bb.set_if_absent("init", json!(0)).await);
        assert!(!bb.set_if_absent("init", json!(99)).await);
        assert_eq!(bb.get("init").await, Some(json!(0)));
    }

    #[tokio::test]
    async fn test_update_with_increment() {
        let bb = Blackboard::new();
        for _ in 0..5 {
            bb.update_with("count", |v| {
                Some(json!(v.and_then(|n| n.as_i64()).unwrap_or(0) + 1))
            })
            .await;
        }
        assert_eq!(bb.get("count").await, Some(json!(5)));
    }

    #[tokio::test]
    async fn test_update_with_remove() {
        let bb = Blackboard::new();
        bb.set("key", json!(1)).await;
        bb.update_with("key", |_| None).await;
        assert!(!bb.contains("key").await);
    }

    #[tokio::test]
    async fn test_scoped_namespace() {
        let bb = Blackboard::new();
        let nav = bb.scoped("navigate");
        let arm = bb.scoped("arm");

        nav.set("status", json!("running")).await;
        arm.set("status", json!("idle")).await;

        assert_eq!(nav.get("status").await, Some(json!("running")));
        assert_eq!(arm.get("status").await, Some(json!("idle")));

        // Full keys don't collide
        assert_eq!(bb.get("navigate/status").await, Some(json!("running")));
        assert_eq!(bb.get("arm/status").await, Some(json!("idle")));
    }

    #[tokio::test]
    async fn test_scoped_keys_lists_only_own_scope() {
        let bb = Blackboard::new();
        let nav = bb.scoped("navigate");
        nav.set("goal", json!(1)).await;
        nav.set("waypoint", json!(2)).await;
        bb.scoped("arm").set("joint", json!(3)).await;

        let mut keys = nav.keys().await;
        keys.sort();
        assert_eq!(keys, vec!["goal", "waypoint"]);
    }

    #[tokio::test]
    async fn test_snapshot_is_sorted() {
        let bb = Blackboard::new();
        bb.set("z_key", json!(3)).await;
        bb.set("a_key", json!(1)).await;
        bb.set("m_key", json!(2)).await;

        let snap = bb.snapshot().await;
        let bytes = serde_json::to_vec(&snap).unwrap();
        let text = String::from_utf8(bytes).unwrap();

        // Sorted order: a_key < m_key < z_key
        let a_pos = text.find("a_key").unwrap();
        let m_pos = text.find("m_key").unwrap();
        let z_pos = text.find("z_key").unwrap();
        assert!(a_pos < m_pos && m_pos < z_pos);
    }

    #[tokio::test]
    async fn test_restore_replaces_entirely() {
        let bb = Blackboard::new();
        bb.set("stale_key", json!("stale")).await;
        bb.set("shared_key", json!("old")).await;

        let snap = json!({ "shared_key": "new", "fresh_key": "fresh" });
        bb.restore(&snap).await;

        assert_eq!(bb.get("shared_key").await, Some(json!("new")));
        assert_eq!(bb.get("fresh_key").await, Some(json!("fresh")));
        assert!(
            !bb.contains("stale_key").await,
            "stale key should be gone after restore"
        );
    }

    #[tokio::test]
    async fn test_merge_preserves_existing() {
        let bb = Blackboard::new();
        bb.set("existing", json!("keep")).await;
        bb.set("overwrite_me", json!("old")).await;

        let snap = json!({ "overwrite_me": "new", "added": "yes" });
        bb.merge(&snap).await;

        assert_eq!(bb.get("existing").await, Some(json!("keep")));
        assert_eq!(bb.get("overwrite_me").await, Some(json!("new")));
        assert_eq!(bb.get("added").await, Some(json!("yes")));
    }

    #[tokio::test]
    async fn test_snapshot_full_includes_metadata() {
        let bb = Blackboard::new();
        bb.set_tagged("pos", json!({"x": 1}), 7, "NavNode").await;

        let full = bb.snapshot_full().await;
        let entry = full.get("pos").unwrap();
        assert_eq!(entry["written_at_tick"], json!(7));
        assert_eq!(entry["written_by"], json!("NavNode"));
        assert_eq!(entry["version"], json!(1));
    }

    #[tokio::test]
    async fn test_utility_methods() {
        let bb = Blackboard::new();
        assert!(bb.is_empty().await);
        bb.set("a", json!(1)).await;
        bb.set("b", json!(2)).await;
        assert_eq!(bb.len().await, 2);
        assert!(!bb.is_empty().await);
        bb.clear().await;
        assert!(bb.is_empty().await);
    }

    #[tokio::test]
    async fn test_get_or_default() {
        let bb = Blackboard::new();
        let val = bb.get_or("missing", json!(42)).await;
        assert_eq!(val, json!(42));
        bb.set("present", json!(1)).await;
        assert_eq!(bb.get_or("present", json!(99)).await, json!(1));
    }
}
