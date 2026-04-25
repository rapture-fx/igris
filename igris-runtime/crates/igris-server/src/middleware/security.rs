use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use base64::Engine;
use ed25519_dalek::Verifier;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tracing::{info, warn};

use crate::AppState;

#[derive(Clone)]
pub struct RateLimiter {
    inner: Arc<Mutex<HashMap<String, Bucket>>>,
    rate_per_minute: u32,
    burst: u32,
}

#[derive(Clone)]
struct Bucket {
    tokens: f64,
    last: Instant,
}

impl RateLimiter {
    pub fn new(rate_per_minute: u32, burst: u32) -> Self {
        let burst = if burst == 0 { rate_per_minute } else { burst };
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            rate_per_minute,
            burst,
        }
    }

    pub async fn allow(&self, key: &str) -> bool {
        if self.rate_per_minute == 0 {
            return true;
        }
        let refill_per_sec = (self.rate_per_minute as f64) / 60.0;
        let burst = self.burst.max(1) as f64;

        let mut map = self.inner.lock().await;
        let b = map.entry(key.to_string()).or_insert_with(|| Bucket {
            tokens: burst,
            last: Instant::now(),
        });

        let now = Instant::now();
        let dt = now.duration_since(b.last).as_secs_f64();
        b.last = now;
        b.tokens = (b.tokens + dt * refill_per_sec).min(burst);

        if b.tokens >= 1.0 {
            b.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

#[derive(Debug)]
struct JwtClaims {
    sub: Option<String>,
    #[allow(dead_code)]
    exp: Option<u64>,
    #[allow(dead_code)]
    nbf: Option<u64>,
}

fn base64url_decode(s: &str) -> anyhow::Result<Vec<u8>> {
    base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(s.as_bytes())
        .map_err(|e| anyhow::anyhow!("base64url decode failed: {}", e))
}

fn hmac_sha256(key: &[u8], msg: &[u8]) -> [u8; 32] {
    // Minimal HMAC-SHA256 implementation to avoid extra deps.
    let mut k0 = [0u8; 64];
    if key.len() > 64 {
        let mut h = Sha256::new();
        h.update(key);
        let digest: [u8; 32] = h.finalize().into();
        k0[..32].copy_from_slice(&digest);
    } else {
        k0[..key.len()].copy_from_slice(key);
    }

    let mut ipad = [0x36u8; 64];
    let mut opad = [0x5cu8; 64];
    for i in 0..64 {
        ipad[i] ^= k0[i];
        opad[i] ^= k0[i];
    }

    let mut inner = Sha256::new();
    inner.update(&ipad);
    inner.update(msg);
    let inner_digest: [u8; 32] = inner.finalize().into();

    let mut outer = Sha256::new();
    outer.update(&opad);
    outer.update(&inner_digest);
    outer.finalize().into()
}

fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut x = 0u8;
    for i in 0..a.len() {
        x |= a[i] ^ b[i];
    }
    x == 0
}

fn verify_hs256_jwt(token: &str, secret: &[u8], now_ts: u64) -> anyhow::Result<JwtClaims> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        anyhow::bail!("invalid JWT format");
    }
    let header_b64 = parts[0];
    let payload_b64 = parts[1];
    let sig_b64 = parts[2];

    let header = base64url_decode(header_b64)?;
    let payload = base64url_decode(payload_b64)?;
    let sig = base64url_decode(sig_b64)?;

    let header_v: serde_json::Value = serde_json::from_slice(&header)?;
    let alg = header_v.get("alg").and_then(|v| v.as_str()).unwrap_or("");
    if alg != "HS256" {
        anyhow::bail!("unsupported alg: {}", alg);
    }

    let signing_input = format!("{}.{}", header_b64, payload_b64);
    let expected = hmac_sha256(secret, signing_input.as_bytes());
    if !ct_eq(&sig, &expected) {
        anyhow::bail!("invalid signature");
    }

    let payload_v: serde_json::Value = serde_json::from_slice(&payload)?;
    let sub = payload_v
        .get("sub")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let exp = payload_v.get("exp").and_then(|v| v.as_u64());
    let nbf = payload_v.get("nbf").and_then(|v| v.as_u64());

    if let Some(nbf) = nbf {
        if now_ts + 5 < nbf {
            anyhow::bail!("token not yet valid");
        }
    }
    if let Some(exp) = exp {
        if now_ts > exp + 5 {
            anyhow::bail!("token expired");
        }
    }

    Ok(JwtClaims { sub, exp, nbf })
}

fn is_public_path(path: &str) -> bool {
    path == "/v1/health"
        || path == "/v1/runtime/profile"
        || path.starts_with("/swagger-ui")
        || path.starts_with("/api-docs")
        || path == "/metrics"
}

fn requires_overture_decision_signature(path: &str) -> bool {
    path == "/v1/runtime/execute"
        || path == "/v1/runtime/task/submit"
        || path.starts_with("/v1/runtime/task/") && path.ends_with("/cancel")
}

pub async fn security_middleware(
    State(state): State<AppState>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();
    state
        .metrics
        .http_requests_total
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    if is_public_path(&path) {
        return next.run(req).await;
    }

    // Verify Overture's decision signature for Runtime execution submission paths.
    // Applied before auth.enabled check so it fires even in auth-disabled deployments.
    if requires_overture_decision_signature(&path) {
        let Some(overture_key) = &state.overture_public_key else {
            warn!(path = %path, "decision_sig_verification_unavailable");
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                "decision signature verification unavailable",
            )
                .into_response();
        };

        let sig_b64 = req
            .headers()
            .get("x-igris-decision-sig")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string());

        let (parts, body) = req.into_parts();
        let body_bytes = axum::body::to_bytes(body, 1 << 20)
            .await
            .unwrap_or_default();

        let verified = sig_b64
            .and_then(|b64| base64::engine::general_purpose::STANDARD.decode(b64).ok())
            .and_then(|sig_bytes| {
                let arr: [u8; 64] = sig_bytes.try_into().ok()?;
                Some(ed25519_dalek::Signature::from_bytes(&arr))
            })
            .map(|sig| {
                use sha2::Digest;
                let hash = sha2::Sha256::digest(&body_bytes);
                overture_key.verify(&hash, &sig).is_ok()
            })
            .unwrap_or(false);

        if !verified {
            warn!(path = %path, "decision_sig_invalid");
            return (StatusCode::UNAUTHORIZED, "invalid decision signature").into_response();
        }

        req = Request::from_parts(parts, Body::from(body_bytes));
    }

    let auth = &state.config.auth;
    // FIX: Respect auth.enabled flag (previously checked api_key != "default-api-key" which broke config)
    if !auth.enabled {
        return next.run(req).await;
    }

    let headers = req.headers();
    let mut identity: Option<String> = None;

    // 1) JWT Bearer if configured
    if let Some(secret) = &auth.jwt_hs256_secret {
        if let Some(h) = headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
        {
            if let Some(token) = h.strip_prefix("Bearer ").map(|s| s.trim()) {
                let now_ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or(Duration::from_secs(0))
                    .as_secs();
                let secret_bytes = secret.as_bytes();
                if let Ok(claims) = verify_hs256_jwt(token, secret_bytes, now_ts) {
                    identity = Some(claims.sub.unwrap_or_else(|| "jwt".to_string()));
                }
            }
        }
    }

    // 2) API key (x-api-key or Bearer token equal to key)
    if identity.is_none() {
        let api_key = auth.api_key.as_str();
        let key_hdr = headers
            .get("x-api-key")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.trim().to_string());
        let bearer = headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .and_then(|h| h.strip_prefix("Bearer "))
            .map(|s| s.trim().to_string());

        if key_hdr.as_deref() == Some(api_key) || bearer.as_deref() == Some(api_key) {
            identity = Some("api_key".to_string());
        }
    }

    let Some(identity) = identity else {
        state
            .metrics
            .http_unauthorized_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        warn!(path = %path, "auth_failed");
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    };

    // Rate limiting (per identity)
    if let Some(rl) = &state.rate_limiter {
        if !rl.allow(&identity).await {
            state
                .metrics
                .http_rate_limited_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            warn!(path = %path, identity = %identity, "rate_limited");
            return (StatusCode::TOO_MANY_REQUESTS, "rate_limited").into_response();
        }
    }

    req.extensions_mut().insert(identity.clone());
    info!(path = %path, identity = %identity, "auth_ok");

    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn b64url(data: &[u8]) -> String {
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(data)
    }

    fn make_hs256_jwt(sub: &str, secret: &[u8], now_ts: u64, exp_delta: i64) -> String {
        let header = serde_json::json!({"alg":"HS256","typ":"JWT"});
        let payload = serde_json::json!({
            "sub": sub,
            "exp": (now_ts as i64 + exp_delta) as u64
        });
        let header_b64 = b64url(serde_json::to_string(&header).unwrap().as_bytes());
        let payload_b64 = b64url(serde_json::to_string(&payload).unwrap().as_bytes());
        let signing_input = format!("{}.{}", header_b64, payload_b64);
        let sig = hmac_sha256(secret, signing_input.as_bytes());
        let sig_b64 = b64url(&sig);
        format!("{}.{}.{}", header_b64, payload_b64, sig_b64)
    }

    #[test]
    fn jwt_verifies_and_extracts_sub() {
        let now = 1_700_000_000u64;
        let secret = b"supersecret";
        let tok = make_hs256_jwt("alice", secret, now, 60);
        let claims = verify_hs256_jwt(&tok, secret, now).unwrap();
        assert_eq!(claims.sub.unwrap(), "alice");
    }

    #[test]
    fn jwt_rejects_bad_signature() {
        let now = 1_700_000_000u64;
        let secret = b"supersecret";
        let tok = make_hs256_jwt("alice", secret, now, 60);
        let bad = tok.replace('a', "b");
        assert!(verify_hs256_jwt(&bad, secret, now).is_err());
    }

    #[tokio::test]
    async fn rate_limiter_enforces_tokens() {
        let rl = RateLimiter::new(60, 2); // 1 rps, burst 2
        assert!(rl.allow("k").await);
        assert!(rl.allow("k").await);
        assert!(!rl.allow("k").await);
    }
}
