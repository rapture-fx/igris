# Implementation Guide for Remaining Critical Fixes

This document provides detailed implementation guidance for the 5 remaining critical blockers.

---

## SEC-003: Fix Goroutine Leaks in Authentication (8 hours)

### Problem
```go
// tenant_auth.go:102
go ta.updateLastLogin(claims.TenantID)  // Fire-and-forget goroutine

// tenant_auth.go:326
go aka.updateLastLogin(tenantID)  // Fire-and-forget goroutine
```

These spawn unbounded goroutines without lifecycle management.

### Solution 1: Add Context with Timeout (Recommended)

**File:** `internal/middleware/tenant_auth.go`

```go
// Replace the goroutine calls with:
go func() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    if err := ta.updateLastLoginWithContext(ctx, claims.TenantID); err != nil {
        ta.logger.Printf("[TenantAuth] Failed to update last login: %v", err)
    }
}()

// Update the function signature:
func (ta *TenantAuth) updateLastLoginWithContext(ctx context.Context, tenantID string) error {
    if ta.db == nil {
        return nil
    }

    _, err := ta.db.ExecContext(ctx, `
        SELECT update_tenant_last_login($1)
    `, tenantID)

    return err
}
```

### Solution 2: Worker Pool Pattern (Better for High Load)

```go
// Add to TenantAuth struct:
type TenantAuth struct {
    jwtManager *security.JWTManager
    db         *sql.DB
    logger     *log.Logger
    enabled    bool
    loginQueue chan string    // Add this
    workerWg   sync.WaitGroup // Add this
    ctx        context.Context // Add this
    cancel     context.CancelFunc // Add this
}

// In NewTenantAuth:
func NewTenantAuth(jwtManager *security.JWTManager, db *sql.DB) *TenantAuth {
    ctx, cancel := context.WithCancel(context.Background())

    ta := &TenantAuth{
        jwtManager: jwtManager,
        db:         db,
        logger:     log.Default(),
        enabled:    jwtManager != nil,
        loginQueue: make(chan string, 1000), // Buffered channel
        ctx:        ctx,
        cancel:     cancel,
    }

    // Start worker pool (5 workers)
    for i := 0; i < 5; i++ {
        ta.workerWg.Add(1)
        go ta.loginWorker()
    }

    return ta
}

// Add worker function:
func (ta *TenantAuth) loginWorker() {
    defer ta.workerWg.Done()

    for {
        select {
        case <-ta.ctx.Done():
            return
        case tenantID := <-ta.loginQueue:
            ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
            if err := ta.updateLastLoginWithContext(ctx, tenantID); err != nil {
                ta.logger.Printf("[TenantAuth] Failed to update last login: %v", err)
            }
            cancel()
        }
    }
}

// Replace goroutine call with:
func (ta *TenantAuth) Authenticate() fiber.Handler {
    return func(c *fiber.Ctx) error {
        // ... existing code ...

        // Non-blocking send to queue
        select {
        case ta.loginQueue <- claims.TenantID:
        default:
            // Queue full, log but don't block
            ta.logger.Printf("[TenantAuth] Login queue full, dropping update for tenant %s", claims.TenantID)
        }

        // ... rest of code ...
    }
}

// Add Stop method:
func (ta *TenantAuth) Stop() {
    ta.cancel()
    close(ta.loginQueue)
    ta.workerWg.Wait()
}
```

### Validation
```go
// Add test:
func TestNoGoroutineLeaks(t *testing.T) {
    initial := runtime.NumGoroutine()

    // Create and use TenantAuth
    ta := NewTenantAuth(jwtManager, db)

    // Make 1000 requests
    for i := 0; i < 1000; i++ {
        ta.Authenticate()
    }

    ta.Stop()
    time.Sleep(time.Second)

    final := runtime.NumGoroutine()

    if final > initial + 10 {
        t.Errorf("Goroutine leak detected: started with %d, ended with %d", initial, final)
    }
}
```

---

## OBS-005: Telemetry Error Handling (5 hours)

### Problem
```go
// chat_router.go:169
_ = h.telemetry.RecordFromAdapterResult(...)  // Error ignored!
```

### Solution

**File:** `cmd/schlep-engine-api/handlers/chat_router.go`

```go
// Replace the ignored error with proper handling:
if err := h.telemetry.RecordFromAdapterResult(
    ctx,
    tenantCtx.TenantID,
    traceID,
    provider,
    &req.ChatCompletionRequest,
    result,
    fallbackCount,
    selectionReason,
); err != nil {
    // Log the error with full context
    h.logger.Printf("[ChatRouter] WARN: Failed to record telemetry for request %s: %v",
        traceID, logging.SanitizeError(err))

    // Increment error metric (add this)
    metrics.TelemetryErrors.Inc()

    // Don't fail the request - telemetry is non-critical
}
```

**File:** `internal/telemetry/telemetry_collector.go`

```go
// Make sure RecordTelemetry returns errors properly:
func (tc *TelemetryCollector) RecordTelemetry(ctx context.Context, telemetry *RoutingTelemetry) error {
    // ... existing code ...

    if err != nil {
        // Log with sanitized error
        tc.logger.Printf("[TelemetryCollector] ERROR: Failed to record telemetry: %v",
            logging.SanitizeError(err))
        return fmt.Errorf("failed to record telemetry: %w", err)
    }

    // ... rest of code ...
    return nil
}
```

### Add Metrics

**File:** Create `internal/metrics/telemetry.go`

```go
package metrics

import "github.com/prometheus/client_golang/prometheus"

var (
    TelemetryErrors = prometheus.NewCounter(prometheus.CounterOpts{
        Name: "schlep_telemetry_errors_total",
        Help: "Total number of telemetry recording errors",
    })

    TelemetryRecorded = prometheus.NewCounter(prometheus.CounterOpts{
        Name: "schlep_telemetry_recorded_total",
        Help: "Total number of telemetry records successfully written",
    })
)

func init() {
    prometheus.MustRegister(TelemetryErrors)
    prometheus.MustRegister(TelemetryRecorded)
}
```

### Validation
```bash
# Simulate DB outage
sudo iptables -A OUTPUT -p tcp --dport 5432 -j DROP

# Make requests
curl -X POST http://localhost:8080/v1/chat/completions ...

# Check logs for errors
grep "Failed to record telemetry" /var/log/schlep-engine.log

# Check metrics
curl http://localhost:8080/metrics | grep telemetry_errors

# Remove firewall rule
sudo iptables -D OUTPUT -p tcp --dport 5432 -j DROP
```

---

## REL-006: Circuit Breaker Implementation (10 hours)

### Solution

**File:** Create `internal/circuitbreaker/circuit_breaker.go`

```go
package circuitbreaker

import (
    "sync"
    "time"
)

type State int

const (
    StateClosed State = iota
    StateOpen
    StateHalfOpen
)

type CircuitBreaker struct {
    mu                 sync.RWMutex
    state              State
    failures           int
    successes          int
    lastFailureTime    time.Time
    lastStateChange    time.Time

    // Configuration
    maxFailures        int           // Open after N failures
    timeout            time.Duration // Time before trying half-open
    halfOpenSuccesses  int           // Successes needed to close
}

func New(maxFailures int, timeout time.Duration) *CircuitBreaker {
    return &CircuitBreaker{
        state:             StateClosed,
        maxFailures:       maxFailures,
        timeout:           timeout,
        halfOpenSuccesses: 2,
    }
}

func (cb *CircuitBreaker) Call(fn func() error) error {
    if !cb.CanAttempt() {
        return ErrCircuitOpen
    }

    err := fn()

    if err != nil {
        cb.RecordFailure()
        return err
    }

    cb.RecordSuccess()
    return nil
}

func (cb *CircuitBreaker) CanAttempt() bool {
    cb.mu.RLock()
    defer cb.mu.RUnlock()

    switch cb.state {
    case StateClosed:
        return true
    case StateOpen:
        // Check if timeout has passed
        if time.Since(cb.lastStateChange) > cb.timeout {
            cb.mu.RUnlock()
            cb.mu.Lock()
            cb.state = StateHalfOpen
            cb.successes = 0
            cb.mu.Unlock()
            cb.mu.RLock()
            return true
        }
        return false
    case StateHalfOpen:
        return true
    default:
        return false
    }
}

func (cb *CircuitBreaker) RecordSuccess() {
    cb.mu.Lock()
    defer cb.mu.Unlock()

    cb.failures = 0

    if cb.state == StateHalfOpen {
        cb.successes++
        if cb.successes >= cb.halfOpenSuccesses {
            cb.state = StateClosed
            cb.lastStateChange = time.Now()
        }
    }
}

func (cb *CircuitBreaker) RecordFailure() {
    cb.mu.Lock()
    defer cb.mu.Unlock()

    cb.failures++
    cb.lastFailureTime = time.Now()

    if cb.state == StateHalfOpen {
        cb.state = StateOpen
        cb.lastStateChange = time.Now()
    } else if cb.failures >= cb.maxFailures {
        cb.state = StateOpen
        cb.lastStateChange = time.Now()
    }
}

func (cb *CircuitBreaker) GetState() State {
    cb.mu.RLock()
    defer cb.mu.RUnlock()
    return cb.state
}

var ErrCircuitOpen = errors.New("circuit breaker is open")
```

**File:** Update `internal/routing/provider_selector.go`

```go
// Add circuit breakers map
type ProviderSelector struct {
    repo            repository.ProviderRegistryRepository
    logger          *log.Logger
    circuitBreakers map[string]*circuitbreaker.CircuitBreaker
    mu              sync.RWMutex
}

func (s *ProviderSelector) getCircuitBreaker(providerID string) *circuitbreaker.CircuitBreaker {
    s.mu.RLock()
    cb, exists := s.circuitBreakers[providerID]
    s.mu.RUnlock()

    if exists {
        return cb
    }

    s.mu.Lock()
    defer s.mu.Unlock()

    // Double-check after acquiring write lock
    if cb, exists := s.circuitBreakers[providerID]; exists {
        return cb
    }

    // Create new circuit breaker: open after 3 failures, try again after 2 minutes
    cb = circuitbreaker.New(3, 2*time.Minute)
    s.circuitBreakers[providerID] = cb
    return cb
}

// Update filterProviders to check circuit breaker:
func (s *ProviderSelector) filterProviders(providers []*models.ProviderRegistry, criteria *SelectionCriteria) []*ProviderCandidate {
    candidates := make([]*ProviderCandidate, 0, len(providers))

    for _, provider := range providers {
        // Check circuit breaker
        cb := s.getCircuitBreaker(provider.ID)
        if !cb.CanAttempt() {
            s.logger.Printf("[ProviderSelector] Skipping provider '%s': circuit breaker open",
                provider.Name)
            continue
        }

        // ... rest of existing filter logic ...
    }

    return candidates
}
```

**File:** Update `cmd/schlep-engine-api/handlers/chat_router.go`

```go
// After provider request:
if result.Success {
    // Record success with circuit breaker
    cb := h.selector.GetCircuitBreaker(provider.ID)
    cb.RecordSuccess()
} else {
    // Record failure
    cb := h.selector.GetCircuitBreaker(provider.ID)
    cb.RecordFailure()
}
```

### Validation
```bash
# Test circuit breaker
# 1. Configure a provider to fail
# 2. Make 3 requests (should all fail)
# 3. Make 4th request - should skip provider immediately (circuit open)
# 4. Wait 2 minutes
# 5. Make request - should try provider again (half-open)
```

---

## PERF-007: Async Telemetry (12 hours)

### Solution

**File:** Update `internal/telemetry/telemetry_collector.go`

```go
type TelemetryCollector struct {
    db           *sql.DB
    logger       *log.Logger
    queue        chan *RoutingTelemetry
    workers      int
    wg           sync.WaitGroup
    ctx          context.Context
    cancel       context.CancelFunc
}

func NewTelemetryCollector(db *sql.DB) *TelemetryCollector {
    ctx, cancel := context.WithCancel(context.Background())

    tc := &TelemetryCollector{
        db:      db,
        logger:  log.Default(),
        queue:   make(chan *RoutingTelemetry, 10000), // Large buffer
        workers: 10, // 10 concurrent workers
        ctx:     ctx,
        cancel:  cancel,
    }

    // Start worker pool
    for i := 0; i < tc.workers; i++ {
        tc.wg.Add(1)
        go tc.worker(i)
    }

    return tc
}

func (tc *TelemetryCollector) worker(id int) {
    defer tc.wg.Done()

    tc.logger.Printf("[TelemetryCollector] Worker %d started", id)

    for {
        select {
        case <-tc.ctx.Done():
            tc.logger.Printf("[TelemetryCollector] Worker %d shutting down", id)
            return
        case telemetry := <-tc.queue:
            if err := tc.recordTelemetrySync(telemetry); err != nil {
                tc.logger.Printf("[TelemetryCollector] Worker %d failed to record: %v",
                    id, logging.SanitizeError(err))
                metrics.TelemetryErrors.Inc()
            } else {
                metrics.TelemetryRecorded.Inc()
            }
        }
    }
}

// Rename old RecordTelemetry to recordTelemetrySync
func (tc *TelemetryCollector) recordTelemetrySync(telemetry *RoutingTelemetry) error {
    // Existing implementation
}

// New async RecordTelemetry
func (tc *TelemetryCollector) RecordTelemetry(ctx context.Context, telemetry *RoutingTelemetry) error {
    select {
    case tc.queue <- telemetry:
        return nil
    default:
        // Queue full - log and return error but don't block
        tc.logger.Printf("[TelemetryCollector] WARN: Telemetry queue full, dropping record")
        metrics.TelemetryDropped.Inc()
        return fmt.Errorf("telemetry queue full")
    }
}

func (tc *TelemetryCollector) Stop() {
    tc.logger.Println("[TelemetryCollector] Stopping telemetry collector...")

    // Stop accepting new telemetry
    tc.cancel()

    // Wait for queue to drain (with timeout)
    done := make(chan struct{})
    go func() {
        tc.wg.Wait()
        close(done)
    }()

    select {
    case <-done:
        tc.logger.Println("[TelemetryCollector] All workers stopped")
    case <-time.After(30 * time.Second):
        tc.logger.Println("[TelemetryCollector] Timeout waiting for workers, forcing shutdown")
    }
}
```

**File:** Update `cmd/schlep-engine-api/main.go`

```go
// After creating telemetryCollector, ensure it's stopped on shutdown:
defer telemetryCollector.Stop()
```

### Performance Impact
- **Before:** 2-10ms per request (synchronous DB write)
- **After:** <1ms per request (async queue)
- **Expected Improvement:** 10-20% reduction in p95 latency

---

## SEC-008: Error Message Sanitization (4 hours)

### Solution

**File:** Update `cmd/schlep-engine-api/main.go`

```go
func customErrorHandler(c *fiber.Ctx, err error) error {
    code := fiber.StatusInternalServerError
    if e, ok := err.(*fiber.Error); ok {
        code = e.Code
    }

    // Log full error internally with trace ID
    ctx := c.Context()
    logging.LogError(ctx, err, "request_error", map[string]interface{}{
        "path":   c.Path(),
        "method": c.Method(),
        "status": code,
    })

    // Return sanitized error to client
    var message string
    var errorType string

    switch code {
    case fiber.StatusBadRequest:
        message = "Invalid request"
        errorType = "invalid_request_error"
    case fiber.StatusUnauthorized:
        message = "Authentication required"
        errorType = "authentication_error"
    case fiber.StatusForbidden:
        message = "Access denied"
        errorType = "authorization_error"
    case fiber.StatusNotFound:
        message = "Resource not found"
        errorType = "not_found_error"
    case fiber.StatusTooManyRequests:
        message = "Rate limit exceeded"
        errorType = "rate_limit_error"
    case fiber.StatusServiceUnavailable:
        message = "Service temporarily unavailable"
        errorType = "service_unavailable"
    default:
        message = "Internal server error"
        errorType = "internal_error"
    }

    // NEVER include:
    // - Stack traces
    // - Provider names or IDs
    // - Internal file paths
    // - Database errors
    // - Raw error messages

    return c.Status(code).JSON(fiber.Map{
        "error": fiber.Map{
            "message": message,
            "type":    errorType,
            "code":    code,
        },
        "trace_id": logging.GetTraceID(ctx),
    })
}
```

### Validation
```bash
# Trigger various errors and verify sanitized responses:

# 1. Provider failure
curl -X POST http://localhost:8080/v1/chat/completions ...
# Should return: "Service temporarily unavailable" NOT "provider openai failed: connection timeout"

# 2. Database error
# Kill database connection
# Should return: "Internal server error" NOT "pq: connection refused to localhost:5432"

# 3. Authentication error
curl -X POST http://localhost:8080/v1/chat/completions -H "Authorization: Bearer invalid"
# Should return: "Authentication required" NOT "jwt: signature is invalid"
```

---

## Testing Checklist

After implementing all fixes:

- [ ] Run unit tests: `go test ./...`
- [ ] Run sanitizer tests: `go test -v ./internal/logging/...`
- [ ] Run goroutine leak test: `go test -race ./internal/middleware/...`
- [ ] Run load test: `./tests/load_test_routing.sh http://localhost:8080 100 60`
- [ ] Validate telemetry: `./tests/validate_telemetry.sh http://localhost:8080`
- [ ] Check metrics: `curl http://localhost:8080/metrics`
- [ ] Verify circuit breaker: Simulate provider failures
- [ ] Profile memory: `go tool pprof http://localhost:8080/debug/pprof/heap`
- [ ] Profile goroutines: `go tool pprof http://localhost:8080/debug/pprof/goroutine`

---

**Total Remaining Time:** 39 hours (4-5 days @ 8hr/day)
**Priority Order:** SEC-003 → OBS-005 → SEC-008 → REL-006 → PERF-007
