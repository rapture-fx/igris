# CRITICAL FIXES REQUIRED BEFORE LAUNCH

**Audit Date:** 2026-01-09
**Status:** BLOCKING ISSUES — Must fix before VPS deployment

---

## P0 SECURITY ISSUES (MUST FIX IMMEDIATELY)

### 1. HTTP Domain Whitelist Unsafe Default
**Severity:** 🔴 HIGH
**File:** `igris-runtime/crates/igris-tools/src/http.rs`
**Lines:** 21-22

**Current Code:**
```rust
fn is_domain_allowed(&self, url: &str) -> bool {
    if self.allowed_domains.is_empty() {
        return true;  // ❌ ALLOWS ALL DOMAINS
    }
    // ... rest of validation
}
```

**Fix:**
```rust
fn is_domain_allowed(&self, url: &str) -> bool {
    if self.allowed_domains.is_empty() {
        return false;  // ✅ DENY BY DEFAULT
    }
    // ... rest of validation
}
```

**Risk if not fixed:** SSRF attacks, unauthorized external requests, potential data exfiltration

**Effort:** 1 line + test (15 minutes)

---

### 2. Fixed Nonce in AES-256-GCM Encryption
**Severity:** 🔴 HIGH
**File:** `igris-runtime/crates/igris-emergency/src/escapevector.rs`
**Lines:** 76, 104

**Current Code:**
```rust
// Line 76 (encrypt function)
let nonce = Nonce::from_slice(&[0u8; 12]);  // ❌ FIXED NONCE

// Line 104 (decrypt function)
let nonce = Nonce::from_slice(&[0u8; 12]);  // ❌ FIXED NONCE
```

**Fix:**
```rust
// Use random nonce like line 174 already does correctly
use rand::Rng;

// For encryption (line 76):
let nonce_bytes: [u8; 12] = rand::thread_rng().gen();
let nonce = Nonce::from_slice(&nonce_bytes);
// Store nonce alongside ciphertext

// For decryption (line 104):
// Read nonce from stored data
let nonce = Nonce::from_slice(&stored_nonce);
```

**Note:** Line 174 already shows correct implementation with random nonce. Apply same pattern to lines 76 and 104.

**Risk if not fixed:** Deterministic encryption violates GCM security model, enables pattern analysis attacks

**Effort:** 10 lines + storage format change + test (1 hour)

---

### 3. Hardcoded Fleet Telemetry (Non-Production Data)
**Severity:** 🔴 HIGH (Operational)
**File:** `igris-runtime/crates/igris-fleet/src/lib.rs`
**Lines:** 484-488, 635-638

**Current Code:**
```rust
// Line 484-488 (collect_telemetry function)
let mut metrics = HashMap::new();
metrics.insert("requests_total".to_string(), 1234.0);      // ❌ HARDCODED
metrics.insert("latency_p99_ms".to_string(), 45.2);        // ❌ HARDCODED
metrics.insert("error_rate".to_string(), 0.01);            // ❌ HARDCODED

// Line 635-638 (telemetry upload loop)
let mut metrics = HashMap::new();
metrics.insert("requests_total".to_string(), 1234.0);      // ❌ HARDCODED
metrics.insert("latency_p99_ms".to_string(), 45.2);        // ❌ HARDCODED
metrics.insert("error_rate".to_string(), 0.01);            // ❌ HARDCODED
```

**Fix:**
```rust
// Read from Runtime's Prometheus registry
async fn collect_telemetry(&self) -> Result<TelemetryData> {
    let uptime = SystemTime::now()
        .duration_since(self.start_time)?
        .as_secs();

    // Fetch metrics from /metrics endpoint or in-memory registry
    let metrics = fetch_prometheus_metrics().await?;

    // Parse Prometheus text format
    let mut metrics_map = HashMap::new();
    for metric in metrics {
        match metric.name.as_str() {
            "igris_http_requests_total" => {
                metrics_map.insert("requests_total".to_string(), metric.value);
            }
            "igris_chat_request_duration_seconds" => {
                // Calculate p99 from histogram buckets
                metrics_map.insert("latency_p99_ms".to_string(), calculate_p99(&metric));
            }
            // ... other metrics
            _ => {}
        }
    }

    let status = AgentStatus {
        health: determine_health(&metrics_map),
        uptime_secs: uptime,
        cpu_usage_percent: get_cpu_usage()?,
        memory_usage_mb: get_memory_usage()?,
        active_tasks: get_active_tasks()?,
    };

    Ok(TelemetryData {
        agent_id: self.config.agent_id.clone(),
        timestamp: SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs(),
        metrics: metrics_map,
        logs: collect_recent_logs()?,
        status,
    })
}
```

**Risk if not fixed:** Overture dashboard shows fake data, cannot detect real failures, fleet monitoring non-functional

**Effort:** 50-100 lines + test (2-3 hours)

---

## P0 MARKETING ISSUES (MUST FIX IMMEDIATELY)

### 4. Remove "Gold Code Override" - Feature Does Not Exist
**Severity:** 🔴 HIGH (Legal Risk - False Advertising)
**Files to modify:**
- `web/apps/web-docs/docs/core-features/gold-code.mdx` - DELETE ENTIRE FILE
- `web/apps/web-landing/src/components/sections/Pricing.tsx` - Remove any mentions
- Any other marketing materials

**Evidence:** Comprehensive search of all repos found ZERO code implementing this feature.

**Risk if not fixed:** False advertising, customer trust damage, potential legal liability

**Effort:** 30 minutes

---

### 5. Label Beta/Incomplete Features Accurately
**Severity:** 🟡 MEDIUM (Customer Expectation Management)

**Features to relabel as "Beta" or "Coming Soon":**

| Current Claim | Reality | Action |
|---------------|---------|--------|
| "Cognitive Advisor (auto-tune routing)" | Proposal generation works, applier stubbed | Add "(Beta)" label |
| "Advanced SLO enforcement & auto-remediation" | Basic enforcement only, auto-remediation stubbed | Downgrade to "Basic SLO Enforcement (Beta)" |
| "Hotfix Blob... instant fixes" | Minimal implementation | Add "(Beta)" label or remove |
| "Emergency Protocols" | Empty directory | Remove or add "Coming Q2 2026" |
| "Policy Engine" | Minimal implementation | Add "(Basic/Beta)" label |
| "Governance" | Empty directory | Remove or add "Enterprise Roadmap" |
| "ROS2 integration" | Stub implementation (~300 lines) | Add "(Beta)" label |
| "Sensor integration (GPIO/Camera/LIDAR)" | Placeholder only | Remove or add "Coming Soon" |
| "Swarm Mode... consensus-based decisions" | Basic coordination only | Add "(Beta)" label |

**Risk if not fixed:** Customer expectations mismatch, support burden, churn

**Effort:** 1-2 hours

---

## LAUNCH READINESS CHECKLIST

### Before ANY Deployment:
- [ ] Fix #1: HTTP domain whitelist (15 min)
- [ ] Fix #2: Fixed nonce encryption (1 hour)
- [ ] Fix #3: Hardcoded telemetry (3 hours)
- [ ] Fix #4: Remove Gold Code Override (30 min)
- [ ] Fix #5: Label Beta features (2 hours)

**Total Effort:** ~7 hours

### Before Hacking Tier Launch:
- [ ] Test end-to-end hybrid deployment with real telemetry
- [ ] Verify dashboard shows real metrics
- [ ] Load test: 100K requests
- [ ] Document Beta features clearly

### Before Growth Tier Launch:
- [ ] Replace custom JWT with standard library (Runtime)
- [ ] Add OpenTelemetry tracing to Runtime
- [ ] Load test: 500K requests/month
- [ ] Verify speculative execution performance claims

### Before Scale Tier Launch:
- [ ] Load test: 1000 RPS sustained
- [ ] Implement 90-day trace retention
- [ ] Complete SLO auto-remediation
- [ ] Add Kubernetes deployment manifests

---

## VERIFICATION COMMANDS

**After fixing HTTP whitelist:**
```bash
cd igris-runtime
cargo test --package igris-tools -- http::tests::test_empty_whitelist_denies
```

**After fixing encryption nonce:**
```bash
cd igris-runtime
cargo test --package igris-emergency -- tests::test_encrypt_decrypt_with_random_nonce
```

**After fixing telemetry:**
```bash
# Start Runtime
cd igris-runtime
cargo run

# In another terminal, check metrics endpoint
curl http://localhost:8080/metrics

# Verify fleet telemetry shows real data
# (Deploy Runtime + Overture, check dashboard)
```

---

## ESTIMATED TIMELINE

**Critical Fixes (P0):** 1 business day
**Testing & Verification:** 0.5 business day
**Beta Label Updates:** 0.25 business day

**TOTAL: 1.75 business days to launch-ready state**

---

## CONTACT & QUESTIONS

If you encounter issues while applying these fixes:

1. **HTTP Whitelist:** Simple boolean flip, very low risk
2. **Encryption Nonce:** Moderate complexity, follow line 174 pattern
3. **Telemetry:** Most complex, consider interim solution (read from file) if time-constrained

**Interim Telemetry Solution (if needed):**
```rust
// Instead of full Prometheus integration, read metrics from JSON file
// Updated by separate process that polls /metrics endpoint
let metrics = tokio::fs::read_to_string("/var/lib/igris/metrics.json").await?;
let metrics: HashMap<String, f64> = serde_json::from_str(&metrics)?;
```

This allows shipping with real telemetry while deferring full integration.

---

**End of Critical Fixes Document**
**Next Steps:** Apply fixes → Test → Deploy
