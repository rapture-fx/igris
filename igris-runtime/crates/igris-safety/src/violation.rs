use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signer, SigningKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::OpenOptions;
use std::io::Write;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ViolationKind {
    Time,
    Cpu,
}

/// Robotics metadata captured at the moment of a containment violation.
///
/// All fields are included in the canonical payload before signing, so they
/// are part of the hash chain and cannot be modified after the fact.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoboticsContext {
    /// Nav2 goal UUID active at violation time, if any.
    pub nav2_goal_id: Option<String>,
    /// Robot pose at violation time: `[x_m, y_m, yaw_rad]`.
    /// Source: `/amcl_pose` or equivalent odometry frame.
    pub current_pose: Option<[f64; 3]>,
    /// Robot velocity at violation time: `[linear_x_m_s, angular_z_rad_s]`.
    /// Captured from odometry **before** the zero-velocity command is sent.
    pub velocity: Option<[f64; 2]>,
    /// Deterministic fallback action applied (e.g. `"emergency_halt"`).
    pub fallback_action: String,
}

impl RoboticsContext {
    /// Construct a standard emergency-halt context.
    pub fn emergency_halt(
        nav2_goal_id: Option<String>,
        current_pose: Option<[f64; 3]>,
        velocity: Option<[f64; 2]>,
    ) -> Self {
        Self {
            nav2_goal_id,
            current_pose,
            velocity,
            fallback_action: "emergency_halt".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViolationRecord {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub violation_kind: ViolationKind,
    pub context: serde_json::Value,
    /// SHA-256 hex of the previous record's payload for chain integrity.
    pub previous_hash: String,
    /// SHA-256 hex of this record's canonical payload.
    pub hash: String,
    /// Base64-encoded Ed25519 signature over `hash`.
    pub signature: String,
    /// Optional robotics metadata. When present, included in the signed hash.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub robotics: Option<RoboticsContext>,
}

impl ViolationRecord {
    /// Create a standard violation record (no robotics context).
    pub fn new(
        kind: ViolationKind,
        context: serde_json::Value,
        previous_hash: String,
        signing_key: &SigningKey,
    ) -> Self {
        Self::new_inner(kind, context, previous_hash, signing_key, None)
    }

    /// Create a violation record that includes signed robotics metadata.
    ///
    /// The `robotics` context is included in the canonical payload before
    /// hashing, so it is cryptographically bound to this record.
    pub fn new_with_robotics(
        kind: ViolationKind,
        context: serde_json::Value,
        previous_hash: String,
        signing_key: &SigningKey,
        robotics: RoboticsContext,
    ) -> Self {
        Self::new_inner(kind, context, previous_hash, signing_key, Some(robotics))
    }

    fn new_inner(
        kind: ViolationKind,
        context: serde_json::Value,
        previous_hash: String,
        signing_key: &SigningKey,
        robotics: Option<RoboticsContext>,
    ) -> Self {
        let id = Uuid::now_v7();
        let timestamp = Utc::now();

        // Canonical payload for hashing (deterministic field order).
        // `robotics` is included when present so it is part of the signed chain.
        let mut payload = serde_json::json!({
            "id": id,
            "timestamp": timestamp,
            "violation_kind": kind,
            "context": context,
            "previous_hash": previous_hash,
        });

        if let Some(ref r) = robotics {
            payload["robotics"] = serde_json::to_value(r).expect("RoboticsContext is serializable");
        }

        let mut hasher = Sha256::new();
        hasher.update(payload.to_string().as_bytes());
        let hash = format!("{:x}", hasher.finalize());

        let signature = signing_key.sign(hash.as_bytes());
        let signature_b64 = STANDARD.encode(signature.to_bytes());

        Self {
            id,
            timestamp,
            violation_kind: kind,
            context,
            previous_hash,
            hash,
            signature: signature_b64,
            robotics,
        }
    }

    /// Append this record as a JSONL line to `path`.
    pub fn append_to_log(&self, path: &str) -> std::io::Result<()> {
        let mut file = OpenOptions::new().create(true).append(true).open(path)?;
        writeln!(
            file,
            "{}",
            serde_json::to_string(self).expect("ViolationRecord is always serializable")
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;

    fn test_key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32])
    }

    #[test]
    fn new_produces_non_empty_hash_and_signature() {
        let r = ViolationRecord::new(
            ViolationKind::Time,
            serde_json::json!({}),
            String::new(),
            &test_key(),
        );
        assert!(!r.hash.is_empty());
        assert!(!r.signature.is_empty());
        assert!(r.robotics.is_none());
    }

    #[test]
    fn new_with_robotics_includes_context_in_hash() {
        let key = test_key();
        let r_bare = ViolationRecord::new(
            ViolationKind::Time,
            serde_json::json!({"job": "x"}),
            String::new(),
            &key,
        );
        let robotics = RoboticsContext::emergency_halt(
            Some("goal-1".to_string()),
            Some([1.0, 2.0, 0.5]),
            Some([0.3, 0.1]),
        );
        let r_robotics = ViolationRecord::new_with_robotics(
            ViolationKind::Time,
            serde_json::json!({"job": "x"}),
            String::new(),
            &key,
            robotics,
        );
        // Hashes must differ because robotics is part of the payload.
        assert_ne!(r_bare.hash, r_robotics.hash);
        assert!(r_robotics.robotics.is_some());
        let ctx = r_robotics.robotics.unwrap();
        assert_eq!(ctx.nav2_goal_id.as_deref(), Some("goal-1"));
        assert_eq!(ctx.fallback_action, "emergency_halt");
    }

    #[test]
    fn hash_chain_links_correctly() {
        let key = test_key();
        let r1 = ViolationRecord::new(
            ViolationKind::Time,
            serde_json::json!({}),
            String::new(),
            &key,
        );
        let r2 = ViolationRecord::new(
            ViolationKind::Cpu,
            serde_json::json!({}),
            r1.hash.clone(),
            &key,
        );
        assert_eq!(r2.previous_hash, r1.hash);
    }

    #[test]
    fn record_is_clone() {
        let r = ViolationRecord::new(
            ViolationKind::Time,
            serde_json::json!({}),
            String::new(),
            &test_key(),
        );
        let clone = r.clone();
        assert_eq!(r.id, clone.id);
        assert_eq!(r.hash, clone.hash);
    }

    #[test]
    fn append_to_log_writes_valid_jsonl() {
        let key = test_key();
        let record = ViolationRecord::new(
            ViolationKind::Time,
            serde_json::json!({"test": 1}),
            String::new(),
            &key,
        );
        let path = std::env::temp_dir()
            .join("igris_violation_test_v2.jsonl")
            .to_string_lossy()
            .into_owned();
        let _ = std::fs::remove_file(&path);
        record.append_to_log(&path).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        let parsed: ViolationRecord =
            serde_json::from_str(content.lines().next().unwrap()).unwrap();
        assert_eq!(parsed.hash, record.hash);
        let _ = std::fs::remove_file(&path);
    }
}
