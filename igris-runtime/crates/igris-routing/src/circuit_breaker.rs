use std::sync::atomic::{AtomicI32, AtomicU32, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed = 0,
    Open = 1,
    HalfOpen = 2,
}

pub struct CircuitBreaker {
    state: AtomicI32,
    failure_count: AtomicU32,
    success_count: AtomicU32,
    last_failure_time: RwLock<Option<Instant>>,
    failure_threshold: u32,
    success_threshold: u32,
    timeout: Duration,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, success_threshold: u32, timeout: Duration) -> Self {
        Self {
            state: AtomicI32::new(CircuitState::Closed as i32),
            failure_count: AtomicU32::new(0),
            success_count: AtomicU32::new(0),
            last_failure_time: RwLock::new(None),
            failure_threshold,
            success_threshold,
            timeout,
        }
    }

    pub async fn call<F, Fut, T, E>(&self, f: F) -> Result<T, CircuitBreakerError<E>>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
    {
        // Check if circuit should transition from Open -> HalfOpen
        if self.get_state() == CircuitState::Open {
            if let Some(last_failure) = *self.last_failure_time.read().await {
                if last_failure.elapsed() > self.timeout {
                    self.set_state(CircuitState::HalfOpen);
                }
            }
        }

        match self.get_state() {
            CircuitState::Open => {
                return Err(CircuitBreakerError::CircuitOpen);
            }
            _ => {}
        }

        match f().await {
            Ok(result) => {
                self.on_success();
                Ok(result)
            }
            Err(err) => {
                self.on_failure().await;
                Err(CircuitBreakerError::InnerError(err))
            }
        }
    }

    fn get_state(&self) -> CircuitState {
        match self.state.load(Ordering::SeqCst) {
            0 => CircuitState::Closed,
            1 => CircuitState::Open,
            2 => CircuitState::HalfOpen,
            _ => CircuitState::Closed,
        }
    }

    fn set_state(&self, state: CircuitState) {
        self.state.store(state as i32, Ordering::SeqCst);
    }

    fn on_success(&self) {
        self.failure_count.store(0, Ordering::SeqCst);

        if self.get_state() == CircuitState::HalfOpen {
            let successes = self.success_count.fetch_add(1, Ordering::SeqCst) + 1;
            if successes >= self.success_threshold {
                self.set_state(CircuitState::Closed);
                self.success_count.store(0, Ordering::SeqCst);
            }
        }
    }

    async fn on_failure(&self) {
        let failures = self.failure_count.fetch_add(1, Ordering::SeqCst) + 1;

        if failures >= self.failure_threshold {
            self.set_state(CircuitState::Open);
            *self.last_failure_time.write().await = Some(Instant::now());
        }
    }

    pub fn reset(&self) {
        self.state
            .store(CircuitState::Closed as i32, Ordering::SeqCst);
        self.failure_count.store(0, Ordering::SeqCst);
        self.success_count.store(0, Ordering::SeqCst);
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CircuitBreakerError<E> {
    #[error("Circuit breaker is open")]
    CircuitOpen,
    #[error("Inner error: {0}")]
    InnerError(E),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_circuit_breaker_opens_on_failures() {
        let cb = CircuitBreaker::new(3, 2, Duration::from_secs(30));

        // Simulate failures
        for _ in 0..3 {
            let result = cb.call(|| async { Err::<(), &str>("error") }).await;
            assert!(result.is_err());
        }

        // Circuit should now be open
        assert_eq!(cb.get_state(), CircuitState::Open);

        // Next call should fail immediately
        let result = cb.call(|| async { Ok::<(), &str>(()) }).await;
        assert!(matches!(result, Err(CircuitBreakerError::CircuitOpen)));
    }

    #[tokio::test]
    async fn test_circuit_breaker_resets_on_success() {
        let cb = CircuitBreaker::new(3, 2, Duration::from_secs(30));

        // One failure
        cb.call(|| async { Err::<(), &str>("error") }).await.ok();

        // One success
        cb.call(|| async { Ok::<(), &str>(()) }).await.ok();

        // Failure count should be reset
        assert_eq!(cb.failure_count.load(Ordering::SeqCst), 0);
    }
}
