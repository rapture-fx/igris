//! Violation event bus for broadcasting containment events to subscribers.
//!
//! [`ViolationEventBus`] lets the containment supervisor notify other system
//! components (e.g., the ROS2 actuator bridge) of violations without any
//! synchronous coupling on the violation-recording path.
//!
//! # Safety semantics
//!
//! - `emit_violation` is **non-blocking and infallible** from the emitter's side.
//! - The safety invariant (kill worker, write signed log) is upheld *before* the
//!   event is emitted. Subscribers are best-effort consumers.
//! - Lagged subscribers receive [`broadcast::error::RecvError::Lagged`]. They
//!   **MUST** treat lag as a safety-critical condition and apply fail-safe actions
//!   independently.

use crate::violation::ViolationRecord;
use tokio::sync::broadcast;

/// Maximum number of violation events buffered before lagging subscribers drop.
const EVENT_BUS_CAPACITY: usize = 64;

/// Events emitted by the containment supervisor on safety-relevant transitions.
#[derive(Debug, Clone)]
pub enum ContainmentEvent {
    /// A containment bound was exceeded. The record is already signed and
    /// hash-chained before this event is emitted.
    Violation(Box<ViolationRecord>),
}

/// Broadcast bus for [`ContainmentEvent`]s.
///
/// Create once at startup, inject into the [`Supervisor`](crate::supervisor::Supervisor)
/// via [`Supervisor::new_with_bus`], and hand [`subscribe`](Self::subscribe) receivers
/// to all subsystems that must react to violations (ROS2 bridge, fleet manager, UI, …).
///
/// # Clone semantics
///
/// `ViolationEventBus` is cheaply cloneable — all clones share the same
/// underlying broadcast channel.
#[derive(Clone)]
pub struct ViolationEventBus {
    sender: broadcast::Sender<ContainmentEvent>,
}

impl ViolationEventBus {
    /// Create a new violation event bus.
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(EVENT_BUS_CAPACITY);
        Self { sender }
    }

    /// Subscribe to containment events.
    ///
    /// Returns a [`broadcast::Receiver`] that will deliver all future events.
    /// Subscribe **before** any violations can occur to avoid missing events.
    pub fn subscribe(&self) -> broadcast::Receiver<ContainmentEvent> {
        self.sender.subscribe()
    }

    /// Emit a violation event to all active subscribers (non-blocking).
    ///
    /// The event is dropped silently if no subscribers are registered or if
    /// their buffers are full. Safety recording already completed before
    /// this is called, so the emitter's correctness does not depend on
    /// subscriber delivery.
    ///
    /// In production code only the [`Supervisor`](crate::supervisor::Supervisor)
    /// should call this. The method is `pub` to allow integration tests in
    /// downstream crates (e.g., `igris-ros2`) to inject synthetic events.
    pub fn emit_violation(&self, record: ViolationRecord) {
        let _ = self
            .sender
            .send(ContainmentEvent::Violation(Box::new(record)));
    }

    /// Number of active subscribers (informational; not for safety decisions).
    pub fn subscriber_count(&self) -> usize {
        self.sender.receiver_count()
    }
}

impl Default for ViolationEventBus {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::violation::{ViolationKind, ViolationRecord};
    use ed25519_dalek::SigningKey;

    fn make_record() -> ViolationRecord {
        let key = SigningKey::from_bytes(&[1u8; 32]);
        ViolationRecord::new(
            ViolationKind::Time,
            serde_json::json!({"test": true}),
            String::new(),
            &key,
        )
    }

    #[tokio::test]
    async fn emit_with_no_subscribers_does_not_panic() {
        let bus = ViolationEventBus::new();
        bus.emit_violation(make_record()); // must not panic or deadlock
    }

    #[tokio::test]
    async fn subscriber_receives_violation() {
        let bus = ViolationEventBus::new();
        let mut rx = bus.subscribe();
        let record = make_record();
        let expected_hash = record.hash.clone();

        bus.emit_violation(record);

        let event = rx.recv().await.unwrap();
        let ContainmentEvent::Violation(r) = event;
        assert_eq!(r.hash, expected_hash);
    }

    #[tokio::test]
    async fn multiple_subscribers_each_receive_event() {
        let bus = ViolationEventBus::new();
        let mut rx1 = bus.subscribe();
        let mut rx2 = bus.subscribe();

        bus.emit_violation(make_record());

        let ContainmentEvent::Violation(r1) = rx1.recv().await.unwrap();
        let ContainmentEvent::Violation(r2) = rx2.recv().await.unwrap();
        assert_eq!(r1.hash, r2.hash);
    }

    #[tokio::test]
    async fn subscriber_count_reflects_active_receivers() {
        let bus = ViolationEventBus::new();
        assert_eq!(bus.subscriber_count(), 0);
        let _rx1 = bus.subscribe();
        assert_eq!(bus.subscriber_count(), 1);
        let _rx2 = bus.subscribe();
        assert_eq!(bus.subscriber_count(), 2);
    }

    #[tokio::test]
    async fn bus_clone_shares_channel() {
        let bus = ViolationEventBus::new();
        let bus_clone = bus.clone();
        let mut rx = bus.subscribe();

        // Emit from the clone — receiver on original should get it.
        bus_clone.emit_violation(make_record());

        let event = rx.recv().await.unwrap();
        let ContainmentEvent::Violation(r) = event;
        assert!(!r.hash.is_empty());
    }
}
