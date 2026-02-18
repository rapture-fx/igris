use tokio::time::{timeout, Duration};

/// Run `f` to completion, or return `Err(())` if it exceeds `max_ms` milliseconds.
pub async fn run_with_timeout<F, T>(max_ms: u64, f: F) -> Result<T, ()>
where
    F: std::future::Future<Output = T>,
{
    timeout(Duration::from_millis(max_ms), f)
        .await
        .map_err(|_| ())
}
