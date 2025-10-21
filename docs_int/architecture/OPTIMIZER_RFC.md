# RFC: Optimizer Migration from Go to Rust via FFI

**Status**: Draft
**Author**: Schlep-Engine Team
**Created**: 2025-10-15
**Updated**: 2025-10-15

---

## 1. Purpose and Scope

### 1.1 Objective

This RFC defines the technical strategy for migrating inference optimization logic from Go-based routing (Thompson Sampling) to a Rust optimizer core integrated via Foreign Function Interface (FFI). The migration aims to:

- **Consolidate optimization logic** in Rust for performance, memory safety, and maintainability
- **Establish clear FFI boundaries** between Go Gateway and Rust optimizer
- **Enable stateful optimization** with safe state ownership patterns
- **Deprecate Python adapter dependencies** for optimization decisions
- **Future-proof architecture** for advanced optimization algorithms (contextual bandits, reinforcement learning)

### 1.2 Scope

**In Scope:**
- Thompson Sampling bandit algorithm migration from Go to Rust
- FFI contract definition for optimizer operations
- State ownership strategy (Go short-term, Rust long-term)
- Error handling and panic safety across FFI boundary
- Testing and validation plan for result parity
- Phased migration roadmap

**Out of Scope:**
- Implementation details (covered in separate implementation docs)
- Python ML service modifications (optimization only)
- Frontend or API changes (internal optimization layer only)
- Database schema changes

---

## 2. Current Architecture Overview

### 2.1 Go Router (Edge Router)

**Location**: `web/apps/go-gateway/internal/edge/edge_router.go`

The Go edge router currently handles:
- Regional node registration and health checking
- Request routing with failover logic
- Priority-based node selection (simple priority sorting)
- Basic round-robin load distribution

**Key Observation**: The current Go router uses **simple priority-based selection** without sophisticated optimization. There is no Thompson Sampling implementation in the current Go codebase.

### 2.2 Rust Kernel

**Location**: `rust-core/rust_kernel/src/`

Current Rust kernel provides:
- FFI exports via `lib.rs` for JSON processing, validation, transformation
- Advanced modules: cache coherence, memory pooling, parallel processing, prefetching
- Orchestration layer (policy engine, drift monitor, feedback loop)
- No optimizer module currently integrated into FFI exports

### 2.3 Thompson Sampling Research Module

**Location**: `labs/research/rl/thompson_sampling.rs`

Existing Rust implementation includes:
- `BanditArm` struct with Beta distribution parameters (alpha, beta)
- `ActionSpace` for discrete batch sizes, prefetch confidences, routing splits
- `ThompsonSampling` agent with action selection and reward updates
- Comprehensive unit tests

**Status**: Research module not yet exposed via FFI to Go.

### 2.4 Python Adapters

**Location**: `adapters/python/`, `web/apps/python-ml-service/`

Python adapters currently:
- Handle ML inference requests
- No direct involvement in routing optimization decisions
- Will not be involved in optimizer migration

---

## 3. Target Architecture

### 3.1 Rust Optimizer Core

**Location**: `rust-core/rust_kernel/src/optimizer/`

New module structure:
```
optimizer/
├── mod.rs           # Module root, public API
├── bandits.rs       # Thompson Sampling, UCB, Epsilon-Greedy
├── arms.rs          # Arm state, Beta distribution sampling
├── rewards.rs       # Reward calculation and normalization
├── state.rs         # State serialization and persistence
└── ffi.rs           # FFI exports for Go integration
```

**Key Design Principles:**
1. **Modular algorithm support**: Start with Thompson Sampling, extend to UCB, contextual bandits
2. **Type safety**: Strong typing for action spaces, rewards, arm states
3. **Panic safety**: All FFI functions must catch panics and return error codes
4. **Memory management**: Clear ownership rules for state passed across FFI

### 3.2 Go Integration Layer

**Location**: `web/apps/go-gateway/internal/optimizer/`

New Go package to wrap Rust FFI:
```go
package optimizer

// OptimizerClient wraps Rust FFI calls
type OptimizerClient struct {
    statePtr unsafe.Pointer  // Opaque pointer to Rust state
}

// Action represents an optimization decision
type Action struct {
    NodeID      string
    BatchSize   int
    Confidence  float64
}

// NewOptimizerClient initializes the Rust optimizer
func NewOptimizerClient(config OptimizerConfig) (*OptimizerClient, error)

// SelectAction samples the best action from the optimizer
func (c *OptimizerClient) SelectAction(ctx Context) (*Action, error)

// UpdateReward provides feedback to the optimizer
func (c *OptimizerClient) UpdateReward(actionID string, reward float64) error

// Close frees Rust-side resources
func (c *OptimizerClient) Close() error
```

---

## 4. Optimizer Module Design in Rust

### 4.1 Core Types

```rust
// optimizer/arms.rs
pub struct BanditArm {
    pub alpha: f64,           // Beta distribution success parameter
    pub beta: f64,            // Beta distribution failure parameter
    pub pulls: usize,         // Total action selections
    pub cumulative_reward: f64,
    pub action_id: String,
}

impl BanditArm {
    pub fn sample(&self) -> f64;  // Sample from Beta(alpha, beta)
    pub fn update(&mut self, reward: f64, threshold: f64);
    pub fn mean_reward(&self) -> f64;
}
```

```rust
// optimizer/bandits.rs
pub struct ThompsonSampling {
    arms: HashMap<String, BanditArm>,
    action_space: ActionSpace,
    success_threshold: f64,
}

impl ThompsonSampling {
    pub fn new(action_space: ActionSpace, threshold: f64) -> Self;
    pub fn select_action(&self) -> (String, ActionIndices);
    pub fn update(&mut self, action_id: &str, reward: f64);
    pub fn export_state(&self) -> Vec<u8>;  // Serialization
    pub fn import_state(data: &[u8]) -> Result<Self, Error>;
}
```

### 4.2 Action Space

```rust
// optimizer/mod.rs
pub struct ActionSpace {
    pub node_ids: Vec<String>,
    pub batch_sizes: Vec<usize>,
    pub prefetch_confidences: Vec<f64>,
}

impl ActionSpace {
    pub fn all_actions(&self) -> Vec<(usize, usize, usize)>;
    pub fn action_to_id(node_idx: usize, batch_idx: usize, conf_idx: usize) -> String;
}
```

### 4.3 Reward Function

```rust
// optimizer/rewards.rs
pub struct RewardMetrics {
    pub latency_ms: f64,
    pub success: bool,
    pub cache_hit: bool,
}

pub fn calculate_reward(metrics: &RewardMetrics) -> f64 {
    let mut reward = 0.0;

    // Latency component (inverse, normalized to [0, 1])
    reward += (1.0 / (1.0 + metrics.latency_ms / 1000.0)) * 0.5;

    // Success component
    if metrics.success {
        reward += 0.3;
    }

    // Cache hit bonus
    if metrics.cache_hit {
        reward += 0.2;
    }

    reward.clamp(0.0, 1.0)
}
```

---

## 5. Go ↔ Rust FFI Contract

### 5.1 Function Signatures

```rust
// optimizer/ffi.rs

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int, c_double};
use std::ptr;

#[repr(C)]
pub struct OptimizerHandle {
    _private: [u8; 0],
}

/// Initialize optimizer with JSON configuration
/// Returns opaque handle, or null on error
/// Caller must call optimizer_free() to release resources
#[no_mangle]
pub unsafe extern "C" fn optimizer_init(
    config_json: *const c_char
) -> *mut OptimizerHandle {
    ffi_guard::catch_panic(|| {
        let config_str = CStr::from_ptr(config_json).to_str()?;
        let config: OptimizerConfig = serde_json::from_str(config_str)?;
        let optimizer = Box::new(ThompsonSampling::new(config.action_space, config.threshold));
        Ok(Box::into_raw(optimizer) as *mut OptimizerHandle)
    }).unwrap_or(ptr::null_mut())
}

/// Select best action using Thompson Sampling
/// Returns action JSON string, or null on error
/// Caller must call optimizer_free_string() to release
#[no_mangle]
pub unsafe extern "C" fn optimizer_select_action(
    handle: *mut OptimizerHandle
) -> *mut c_char {
    ffi_guard::catch_panic(|| {
        let optimizer = &*(handle as *mut ThompsonSampling);
        let (action_id, indices) = optimizer.select_action();
        let result = json!({
            "action_id": action_id,
            "node_idx": indices.0,
            "batch_idx": indices.1,
            "conf_idx": indices.2
        });
        let cstring = CString::new(result.to_string())?;
        Ok(cstring.into_raw())
    }).unwrap_or(ptr::null_mut())
}

/// Update optimizer with reward for selected action
/// Returns 0 on success, negative error code on failure
#[no_mangle]
pub unsafe extern "C" fn optimizer_update_reward(
    handle: *mut OptimizerHandle,
    action_id: *const c_char,
    reward: c_double
) -> c_int {
    ffi_guard::catch_panic(|| {
        let optimizer = &mut *(handle as *mut ThompsonSampling);
        let action_str = CStr::from_ptr(action_id).to_str()?;
        optimizer.update(action_str, reward);
        Ok(0)
    }).unwrap_or(-1)
}

/// Export optimizer state as JSON
#[no_mangle]
pub unsafe extern "C" fn optimizer_export_state(
    handle: *mut OptimizerHandle
) -> *mut c_char {
    ffi_guard::catch_panic(|| {
        let optimizer = &*(handle as *mut ThompsonSampling);
        let state_json = optimizer.export_state_json();
        let cstring = CString::new(state_json)?;
        Ok(cstring.into_raw())
    }).unwrap_or(ptr::null_mut())
}

/// Free optimizer resources
#[no_mangle]
pub unsafe extern "C" fn optimizer_free(handle: *mut OptimizerHandle) {
    if !handle.is_null() {
        let _ = Box::from_raw(handle as *mut ThompsonSampling);
    }
}

/// Free string returned by FFI functions
#[no_mangle]
pub unsafe extern "C" fn optimizer_free_string(s: *mut c_char) {
    if !s.is_null() {
        let _ = CString::from_raw(s);
    }
}
```

### 5.2 Go cgo Bindings

```go
package optimizer

/*
#cgo LDFLAGS: -L${SRCDIR}/../../../rust-core/rust_kernel/target/release -lrust_kernel
#include <stdlib.h>

typedef struct OptimizerHandle OptimizerHandle;

OptimizerHandle* optimizer_init(const char* config_json);
char* optimizer_select_action(OptimizerHandle* handle);
int optimizer_update_reward(OptimizerHandle* handle, const char* action_id, double reward);
char* optimizer_export_state(OptimizerHandle* handle);
void optimizer_free(OptimizerHandle* handle);
void optimizer_free_string(char* s);
*/
import "C"
import (
    "encoding/json"
    "fmt"
    "unsafe"
)

type OptimizerClient struct {
    handle *C.OptimizerHandle
}

func NewOptimizerClient(config OptimizerConfig) (*OptimizerClient, error) {
    configJSON, err := json.Marshal(config)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal config: %w", err)
    }

    cConfig := C.CString(string(configJSON))
    defer C.free(unsafe.Pointer(cConfig))

    handle := C.optimizer_init(cConfig)
    if handle == nil {
        return nil, fmt.Errorf("failed to initialize optimizer")
    }

    return &OptimizerClient{handle: handle}, nil
}

func (c *OptimizerClient) SelectAction() (*Action, error) {
    cResult := C.optimizer_select_action(c.handle)
    if cResult == nil {
        return nil, fmt.Errorf("optimizer_select_action failed")
    }
    defer C.optimizer_free_string(cResult)

    result := C.GoString(cResult)
    var action Action
    if err := json.Unmarshal([]byte(result), &action); err != nil {
        return nil, fmt.Errorf("failed to unmarshal action: %w", err)
    }

    return &action, nil
}

func (c *OptimizerClient) UpdateReward(actionID string, reward float64) error {
    cActionID := C.CString(actionID)
    defer C.free(unsafe.Pointer(cActionID))

    result := C.optimizer_update_reward(c.handle, cActionID, C.double(reward))
    if result != 0 {
        return fmt.Errorf("optimizer_update_reward failed with code %d", result)
    }

    return nil
}

func (c *OptimizerClient) Close() error {
    if c.handle != nil {
        C.optimizer_free(c.handle)
        c.handle = nil
    }
    return nil
}
```

### 5.3 Memory Model

**Ownership Rules:**
1. **Rust owns optimizer state**: Go holds opaque pointer, cannot inspect or modify
2. **Strings cross boundary**: Rust allocates, Go must free via `optimizer_free_string`
3. **No shared memory**: All communication via serialized JSON strings
4. **Handle lifecycle**: Go calls `optimizer_init()` and `optimizer_free()`

**Panic Safety:**
- All FFI functions wrapped in `catch_unwind()` via `ffi_guard` module
- Panics return null pointer or error code, never propagate to Go
- Go checks return values and handles errors gracefully

---

## 6. State Ownership Strategy

### 6.1 Phase 1 (MVP): Go Holds State

**Rationale**: Simplify initial integration, minimize changes to Go codebase.

**Implementation:**
- Rust optimizer is **stateless** per request
- Go serializes arm states to JSON, passes to Rust on each call
- Rust deserializes, performs computation, returns action
- Go stores updated state in memory or database

**Pros:**
- Minimal Go changes
- State visible to Go for debugging/logging
- Easy rollback if Rust optimizer fails

**Cons:**
- Serialization overhead on every request
- State consistency harder to guarantee
- No benefit from Rust's memory safety for state

### 6.2 Phase 2 (Hybrid): Rust Owns State, Go Manages Lifecycle

**Rationale**: Improve performance while maintaining Go control.

**Implementation:**
- Rust allocates optimizer on `optimizer_init()`, returns opaque handle
- Go stores handle, passes it to `optimizer_select_action()` and `optimizer_update_reward()`
- Rust maintains mutable state internally
- Go calls `optimizer_export_state()` periodically for persistence
- Go calls `optimizer_free()` on shutdown

**Pros:**
- No per-request serialization
- Rust guarantees state consistency (Mutex/RwLock)
- Better performance for high-frequency updates

**Cons:**
- Go cannot inspect state without FFI call
- Requires careful lifetime management in Go

### 6.3 Phase 3 (Long-term): Full Rust Core

**Rationale**: Move all optimization logic to Rust for maximum performance and safety.

**Implementation:**
- Rust optimizer runs as separate service or embedded library
- Go calls Rust via FFI or gRPC
- Rust handles state persistence (Redis, SQLite)
- Advanced algorithms (contextual bandits, deep RL) implemented in Rust

**Pros:**
- Maximum performance
- Single source of truth for optimization logic
- Easier to extend with complex algorithms

**Cons:**
- Requires significant Go refactoring
- Operational complexity (separate service deployment)

**Recommendation**: Start with Phase 2 (Hybrid) for production MVP.

---

## 7. Error Handling and Panic Safety

### 7.1 Rust Panic Handling

**Approach**: Wrap all FFI functions with `catch_unwind()`:

```rust
// ffi_guard.rs (existing module)
pub fn catch_panic<F, R>(f: F) -> Result<R, Box<dyn std::any::Any + Send>>
where
    F: FnOnce() -> Result<R, Box<dyn std::error::Error>> + std::panic::UnwindSafe,
{
    std::panic::catch_unwind(f).and_then(|r| r.map_err(|e| Box::new(e) as _))
}
```

**FFI Pattern**:
```rust
#[no_mangle]
pub unsafe extern "C" fn optimizer_operation(...) -> ReturnType {
    ffi_guard::catch_panic(|| {
        // Actual implementation
        Ok(result)
    }).unwrap_or(default_error_value)
}
```

### 7.2 Go Error Handling

**Pattern**:
```go
func (c *OptimizerClient) SelectAction() (*Action, error) {
    cResult := C.optimizer_select_action(c.handle)
    if cResult == nil {
        // Log error, fallback to Go-based selection
        log.Warn("Rust optimizer failed, using fallback")
        return c.fallbackSelectAction()
    }
    defer C.optimizer_free_string(cResult)
    // ... parse result
}
```

### 7.3 Fallback Strategy

**If Rust optimizer unavailable:**
1. Go falls back to current priority-based routing
2. Logs error to monitoring system (Prometheus counter)
3. Alert fires if failure rate > 1% over 5 minutes
4. Optionally disable Rust optimizer dynamically via feature flag

---

## 8. Migration Phases

### Phase 1: MVP (Week 1-2)
**Goal**: Prove FFI integration with basic Thompson Sampling

**Tasks:**
1. Create `rust-core/rust_kernel/src/optimizer/` module
2. Move `labs/research/rl/thompson_sampling.rs` to `optimizer/bandits.rs`
3. Implement FFI exports in `optimizer/ffi.rs`
4. Create Go wrapper in `web/apps/go-gateway/internal/optimizer/`
5. Add feature flag `OPTIMIZER_RUST_ENABLED` (default: false)
6. Write integration tests comparing Go vs Rust output

**Deliverables:**
- Working FFI integration (stateless mode)
- 95%+ result parity with reference Thompson Sampling implementation
- Performance benchmarks (latency, throughput)

### Phase 2: Hybrid State (Week 3-4)
**Goal**: Optimize performance with stateful Rust optimizer

**Tasks:**
1. Implement handle-based state management in Rust
2. Add `optimizer_export_state()` for persistence
3. Integrate with Go edge router for real requests
4. Enable feature flag in staging environment
5. Monitor for errors, performance regressions

**Deliverables:**
- < 1ms FFI call overhead
- State persistence to Redis/PostgreSQL
- A/B test results (Rust vs Go optimizer)

### Phase 3: Production Rollout (Week 5-6)
**Goal**: Replace Go optimizer with Rust in production

**Tasks:**
1. Gradual rollout: 1% → 10% → 50% → 100%
2. Monitor success rate, latency, reward improvements
3. Deprecate Go optimizer code (keep as fallback)
4. Document operational procedures

**Deliverables:**
- 100% traffic on Rust optimizer
- Improved reward metrics (target: +10% over baseline)
- Runbook for troubleshooting

### Phase 4: Advanced Algorithms (Week 7+)
**Goal**: Extend optimizer with contextual bandits, RL

**Tasks:**
1. Add contextual features (user region, time of day, load)
2. Implement LinUCB, neural bandits
3. Offline policy evaluation framework
4. A/B test new algorithms

**Deliverables:**
- Contextual bandit implementation
- Offline evaluation report
- Recommendation for default algorithm

---

## 9. Testing and Validation Plan

### 9.1 Unit Tests

**Rust:**
- Test each bandit algorithm in isolation
- Verify arm update logic (alpha, beta increments)
- Test action space generation (all combinations)
- Test state serialization/deserialization

**Go:**
- Test FFI wrapper error handling (null pointers, invalid JSON)
- Test memory management (no leaks)
- Test concurrent access (multiple goroutines)

### 9.2 Integration Tests

**Scenario 1: Result Parity**
- Initialize Go and Rust optimizers with identical config
- Run 1000 select/update cycles with same rewards
- Compare final arm states (alpha, beta, pulls)
- **Pass criteria**: < 1% difference in arm statistics

**Scenario 2: Performance**
- Benchmark FFI overhead: `select_action()` latency
- **Pass criteria**: < 100μs per call (p99)

**Scenario 3: Failure Handling**
- Inject Rust panic (invalid config)
- Verify Go fallback executes
- **Pass criteria**: No Go panic, fallback succeeds

### 9.3 Load Testing

**Setup:**
- 10,000 requests/sec for 1 hour
- Random rewards [0.0, 1.0]
- 4 edge nodes, 3 batch sizes, 2 confidence levels

**Metrics:**
- FFI call latency (p50, p99)
- Memory usage (Rust heap, Go heap)
- Reward convergence rate

**Pass Criteria:**
- No memory leaks (stable RSS over 1 hour)
- Reward > baseline after 10,000 iterations

### 9.4 Shadow Mode Testing

**Approach:**
1. Run both Go and Rust optimizers in parallel (no user impact)
2. Log divergences (different action selections)
3. Compare reward outcomes

**Metrics:**
- Agreement rate (% of same actions selected)
- Reward delta (Rust reward - Go reward)

**Pass Criteria:**
- > 80% agreement rate after 1000 iterations
- Rust reward ≥ Go reward (statistically significant)

---

## 10. Deprecation of Python Adapters and Future Extensions

### 10.1 Python Adapter Deprecation

**Current State**: Python adapters in `adapters/python/` and `web/apps/python-ml-service/` are not involved in routing optimization decisions.

**Post-Migration**: No changes required to Python services. Optimization logic is entirely within Go → Rust boundary.

**Future Consideration**: If Python services need to report additional metrics (e.g., model confidence scores), extend `RewardMetrics` struct to include these signals.

### 10.2 Future Extensions

**Advanced Algorithms:**
- **LinUCB**: Linear contextual bandits with feature vectors
- **Neural Bandits**: Deep learning-based exploration
- **Offline RL**: Train policies on historical data (shadow mode logs)

**State Persistence:**
- Export arm states to Redis for hot recovery
- Periodic snapshots to PostgreSQL for audit/analysis
- Prometheus metrics export (arm pulls, mean rewards, exploration rate)

**Multi-Objective Optimization:**
- Extend reward function to balance latency, cost, cache hit rate
- Pareto frontier exploration for trade-offs

**Distributed Optimization:**
- Federated learning across multiple edge regions
- Consensus algorithms for global optimal policy

---

## Appendix A: Comparison of Approaches

### Stateless Rust Optimizer

**Pros:**
- Simple integration, easy rollback
- State visible to Go for debugging

**Cons:**
- Serialization overhead (10-50ms per request)
- State consistency issues

**Use Case**: MVP, proof of concept

### Stateful Rust Optimizer (Recommended)

**Pros:**
- High performance (< 1ms FFI overhead)
- Rust memory safety guarantees

**Cons:**
- Opaque state (requires FFI call to inspect)
- Lifetime management complexity

**Use Case**: Production deployment

---

## Appendix B: Example Configuration

```json
{
  "action_space": {
    "node_ids": ["node-us-west-1", "node-us-east-1", "node-eu-west-1"],
    "batch_sizes": [8, 16, 32, 64],
    "prefetch_confidences": [0.70, 0.80, 0.90, 0.95]
  },
  "success_threshold": 0.6,
  "exploration_bonus": 0.1,
  "initial_alpha": 1.0,
  "initial_beta": 1.0
}
```

---

## Appendix C: Glossary

- **FFI**: Foreign Function Interface, allows calling Rust from Go
- **Thompson Sampling**: Bayesian bandit algorithm for exploration/exploitation
- **Beta Distribution**: Probability distribution over [0,1], parameterized by α, β
- **Action Space**: Set of all possible decisions (node, batch size, confidence)
- **Reward**: Feedback signal (0.0-1.0) indicating quality of action
- **Arm**: A bandit arm represents one discrete action with its own statistics

---

## References

1. Russo, D., et al. (2018). "A Tutorial on Thompson Sampling". Foundations and Trends in Machine Learning.
2. Agrawal, S., & Goyal, N. (2013). "Thompson Sampling for Contextual Bandits with Linear Payoffs". ICML.
3. Go cgo documentation: https://golang.org/cmd/cgo/
4. Rust FFI documentation: https://doc.rust-lang.org/nomicon/ffi.html
5. Schlep-Engine Thompson Sampling implementation: `labs/research/rl/thompson_sampling.rs`

---

**End of RFC**
