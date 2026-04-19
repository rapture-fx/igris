use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

pub struct TokenBucket {
    capacity: usize,
    tokens: f64,
    rate: f64, // tokens per second
    last_refill: Instant,
}

impl TokenBucket {
    pub fn new(capacity: usize, rate: f64) -> Self {
        Self {
            capacity,
            tokens: capacity as f64,
            rate,
            last_refill: Instant::now(),
        }
    }

    pub fn try_consume(&mut self, tokens: usize) -> bool {
        self.refill();

        if self.tokens >= tokens as f64 {
            self.tokens -= tokens as f64;
            true
        } else {
            false
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();

        let new_tokens = elapsed * self.rate;
        self.tokens = (self.tokens + new_tokens).min(self.capacity as f64);
        self.last_refill = now;
    }

    pub fn available_tokens(&self) -> usize {
        self.tokens as usize
    }
}

pub struct RateLimiter {
    buckets: Arc<RwLock<HashMap<String, TokenBucket>>>,
    capacity: usize,
    rate: f64,
}

impl RateLimiter {
    pub fn new(capacity: usize, rate: f64) -> Self {
        Self {
            buckets: Arc::new(RwLock::new(HashMap::new())),
            capacity,
            rate,
        }
    }

    pub async fn check(&self, key: &str) -> bool {
        let mut buckets = self.buckets.write().await;

        let bucket = buckets
            .entry(key.to_string())
            .or_insert_with(|| TokenBucket::new(self.capacity, self.rate));

        bucket.try_consume(1)
    }

    pub async fn check_multiple(&self, key: &str, tokens: usize) -> bool {
        let mut buckets = self.buckets.write().await;

        let bucket = buckets
            .entry(key.to_string())
            .or_insert_with(|| TokenBucket::new(self.capacity, self.rate));

        bucket.try_consume(tokens)
    }

    pub async fn reset(&self, key: &str) {
        let mut buckets = self.buckets.write().await;
        buckets.remove(key);
    }

    pub async fn get_available(&self, key: &str) -> usize {
        let buckets = self.buckets.read().await;
        buckets
            .get(key)
            .map(|b| b.available_tokens())
            .unwrap_or(self.capacity)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter_allows_within_limit() {
        let limiter = RateLimiter::new(10, 1.0);

        // Should allow first 10 requests
        for _ in 0..10 {
            assert!(limiter.check("user1").await);
        }

        // 11th request should be denied
        assert!(!limiter.check("user1").await);
    }

    #[tokio::test]
    async fn test_rate_limiter_per_key() {
        let limiter = RateLimiter::new(5, 1.0);

        // Consume for user1
        for _ in 0..5 {
            limiter.check("user1").await;
        }

        // user2 should still have full capacity
        assert!(limiter.check("user2").await);
    }

    #[test]
    fn test_token_bucket_refill() {
        let mut bucket = TokenBucket::new(10, 10.0); // 10 tokens/second

        // Consume all tokens
        bucket.try_consume(10);
        assert_eq!(bucket.available_tokens(), 0);

        // Wait 1 second (simulated by manually advancing time would require tokio::time::pause)
        // In real test we'd use tokio::time::advance
    }
}
