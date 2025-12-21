//! Igris Error Recovery & Retry Logic
//!
//! Provides intelligent error classification, retry strategies, and backtracking.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::time::Duration;
use tracing::{debug, warn};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorClass {
    Retryable,
    Fatal,
    RateLimited,
}

pub fn classify_error(error: &anyhow::Error) -> ErrorClass {
    let msg = error.to_string().to_lowercase();

    if msg.contains("rate limit") || msg.contains("too many requests") {
        ErrorClass::RateLimited
    } else if msg.contains("timeout") || msg.contains("connection") || msg.contains("temporary") {
        ErrorClass::Retryable
    } else {
        ErrorClass::Fatal
    }
}

pub async fn retry_with_backoff<F, Fut, T>(
    mut operation: F,
    max_retries: usize,
) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let mut attempts = 0;

    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                attempts += 1;
                let error_class = classify_error(&e);

                if error_class == ErrorClass::Fatal || attempts >= max_retries {
                    return Err(e);
                }

                let delay = match error_class {
                    ErrorClass::RateLimited => Duration::from_secs(60),
                    ErrorClass::Retryable => Duration::from_millis(100 * 2u64.pow(attempts as u32)),
                    ErrorClass::Fatal => return Err(e),
                };

                warn!("Retry attempt {}/{}, waiting {:?}", attempts, max_retries, delay);
                tokio::time::sleep(delay).await;
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryConfig {
    pub max_retries: usize,
    pub enable_backtracking: bool,
}

impl Default for RecoveryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            enable_backtracking: true,
        }
    }
}
