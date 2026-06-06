package internal

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/circuitbreaker"
	"github.com/Igris-inertial/system/igris-overture/models"
)

// RuntimeRepositoryI is the subset of RuntimeRepository used by RuntimeSelector,
// declared here so tests can supply a mock without a real database.
type RuntimeRepositoryI interface {
	ListHealthy(ctx context.Context) ([]RuntimeInstance, error)
	ListAll(ctx context.Context) ([]RuntimeInstance, error)
	UpdateHealth(ctx context.Context, runtimeID string, healthy bool) error
}

// RuntimeSelector implements the handlers.RuntimeExecutor interface and selects
// a healthy runtime instance from the DB-backed registry on every request.
//
// Selection policy (simple, no load balancing):
//  1. Load healthy instances ordered edge-first.
//  2. Skip any whose circuit breaker is open.
//  3. Forward to the first available instance.
//  4. On failure: record CB failure, try next.
//  5. Fall back to cloud (is_edge=false) if all edge circuits are open.
//  6. Return error if no instance succeeds → caller falls back to direct routing.
type RuntimeSelector struct {
	repo     RuntimeRepositoryI
	breakers *circuitbreaker.ProviderCircuitBreakers
	clients  sync.Map // endpoint string → *RuntimeClient
	db       *sql.DB  // optional; when set, CB state changes are persisted
}

// NewRuntimeSelector creates a selector backed by the given repository.
// Uses the existing circuitbreaker package with threshold=3 and
// recovery=30s (aligned with the health-poll interval).
func NewRuntimeSelector(repo RuntimeRepositoryI) *RuntimeSelector {
	return &RuntimeSelector{
		repo: repo,
		breakers: circuitbreaker.NewProviderCircuitBreakers(circuitbreaker.Config{
			FailureThreshold: 3,
			RecoveryTimeout:  30 * time.Second,
		}),
	}
}

// WithDB attaches a database handle so circuit breaker state changes are
// persisted to circuit_breaker_states (tenant_id="system", provider=runtimeID).
func (s *RuntimeSelector) WithDB(db *sql.DB) *RuntimeSelector {
	s.db = db
	return s
}

// persistCBState upserts the current in-memory circuit breaker state for the
// given runtimeID to the circuit_breaker_states table.  Runs asynchronously so
// it never blocks the request path.
func (s *RuntimeSelector) persistCBState(runtimeID string) {
	if s.db == nil {
		return
	}
	state := s.breakers.GetState(runtimeID).String()
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO circuit_breaker_states (tenant_id, provider, state, failure_count, updated_at)
			VALUES ('system', $1, $2, 0, NOW())
			ON CONFLICT (tenant_id, provider) DO UPDATE
			  SET state      = EXCLUDED.state,
			      updated_at = NOW()
		`, runtimeID, state)
		if err != nil {
			log.Printf("[RuntimeSelector] persist CB state for %s: %v", runtimeID, err)
		}
	}()
}

// persistCBTrip upserts a tripped (opened) circuit breaker, incrementing trip_count.
func (s *RuntimeSelector) persistCBTrip(runtimeID string) {
	if s.db == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO circuit_breaker_states (tenant_id, provider, state, failure_count, trip_count, last_tripped_at, updated_at)
			VALUES ('system', $1, 'open', 1, 1, NOW(), NOW())
			ON CONFLICT (tenant_id, provider) DO UPDATE
			  SET state          = 'open',
			      failure_count  = circuit_breaker_states.failure_count + 1,
			      trip_count     = circuit_breaker_states.trip_count + 1,
			      last_tripped_at = NOW(),
			      updated_at     = NOW()
		`, runtimeID)
		if err != nil {
			log.Printf("[RuntimeSelector] persist CB trip for %s: %v", runtimeID, err)
		}
	}()
}

// ForwardExecution selects a healthy runtime and delegates the request to it.
// It implements the handlers.RuntimeExecutor interface.
func (s *RuntimeSelector) ForwardExecution(
	ctx context.Context,
	tenantID string,
	req *models.InferRequest,
	boundsHeader string,
) (*models.InferResponse, error) {
	instances, err := s.repo.ListHealthy(ctx)
	if err != nil {
		return nil, fmt.Errorf("runtime_selector: list_healthy: %w", err)
	}

	for _, inst := range instances {
		normalizedEndpoint, err := NormalizeHTTPRuntimeEndpoint(inst.Endpoint)
		if err != nil {
			log.Printf("[RuntimeSelector] runtime %s has unroutable endpoint — skipping", inst.RuntimeID)
			continue
		}
		if !s.breakers.IsProviderAvailable(inst.RuntimeID) {
			log.Printf("[RuntimeSelector] circuit open for %s — skipping", inst.RuntimeID)
			continue
		}

		client := s.getOrCreateClient(normalizedEndpoint)
		resp, ferr := client.ForwardExecution(ctx, tenantID, req, boundsHeader)
		if ferr != nil {
			log.Printf("[RuntimeSelector] runtime %s failed: %v — trying next", inst.RuntimeID, ferr)
			s.breakers.RecordFailure(inst.RuntimeID)
			// Persist state: check if the breaker just tripped open.
			if !s.breakers.IsProviderAvailable(inst.RuntimeID) {
				s.persistCBTrip(inst.RuntimeID)
			} else {
				s.persistCBState(inst.RuntimeID)
			}
			continue
		}
		s.breakers.RecordSuccess(inst.RuntimeID)
		s.persistCBState(inst.RuntimeID)
		return resp, nil
	}

	return nil, fmt.Errorf("runtime_selector: no healthy runtime available")
}

// OpenStreamingExecution selects a healthy runtime and opens a base-mode SSE
// stream against it. Streaming failures are recorded in the circuit breaker
// just like durable task failures.
func (s *RuntimeSelector) OpenStreamingExecution(
	ctx context.Context,
	tenantID string,
	req *models.InferRequest,
	boundsHeader string,
) (*http.Response, error) {
	instances, err := s.repo.ListHealthy(ctx)
	if err != nil {
		return nil, fmt.Errorf("runtime_selector: list_healthy: %w", err)
	}

	for _, inst := range instances {
		normalizedEndpoint, err := NormalizeHTTPRuntimeEndpoint(inst.Endpoint)
		if err != nil {
			log.Printf("[RuntimeSelector] runtime %s has unroutable endpoint — skipping stream", inst.RuntimeID)
			continue
		}
		if !s.breakers.IsProviderAvailable(inst.RuntimeID) {
			log.Printf("[RuntimeSelector] circuit open for %s — skipping stream", inst.RuntimeID)
			continue
		}

		client := s.getOrCreateClient(normalizedEndpoint)
		resp, ferr := client.OpenStreamingExecution(ctx, tenantID, req, boundsHeader)
		if ferr != nil {
			log.Printf("[RuntimeSelector] runtime %s stream failed: %v — trying next", inst.RuntimeID, ferr)
			s.breakers.RecordFailure(inst.RuntimeID)
			if !s.breakers.IsProviderAvailable(inst.RuntimeID) {
				s.persistCBTrip(inst.RuntimeID)
			} else {
				s.persistCBState(inst.RuntimeID)
			}
			continue
		}

		s.breakers.RecordSuccess(inst.RuntimeID)
		s.persistCBState(inst.RuntimeID)
		return resp, nil
	}

	return nil, fmt.Errorf("runtime_selector: no healthy runtime available for streaming")
}

// Health satisfies handlers.RuntimeExecutor; the selector itself is always alive.
func (s *RuntimeSelector) Health(_ context.Context) error { return nil }

// BaseURL satisfies handlers.RuntimeExecutor for logging purposes.
func (s *RuntimeSelector) BaseURL() string { return "runtime-registry" }

// getOrCreateClient returns a cached *RuntimeClient for endpoint, creating one if absent.
func (s *RuntimeSelector) getOrCreateClient(endpoint string) *RuntimeClient {
	if v, ok := s.clients.Load(endpoint); ok {
		return v.(*RuntimeClient)
	}
	rc := NewRuntimeClient(endpoint)
	// Store only once; if another goroutine races, the existing value wins.
	actual, _ := s.clients.LoadOrStore(endpoint, rc)
	return actual.(*RuntimeClient)
}

// StartHealthPoller launches a background goroutine that polls every 30 seconds
// and updates is_healthy in the database.  The goroutine stops when ctx is cancelled.
func (s *RuntimeSelector) StartHealthPoller(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.pollHealth(ctx)
			}
		}
	}()
}

// pollHealth iterates all registered runtimes, checks /v1/health, and writes
// the result back to the DB.  Failures are non-fatal (logged only).
func (s *RuntimeSelector) pollHealth(ctx context.Context) {
	instances, err := s.repo.ListAll(ctx)
	if err != nil {
		log.Printf("[RuntimeSelector] health poll: list_all failed: %v", err)
		return
	}

	for _, inst := range instances {
		normalizedEndpoint, err := NormalizeHTTPRuntimeEndpoint(inst.Endpoint)
		if err != nil {
			if dbErr := s.repo.UpdateHealth(ctx, inst.RuntimeID, false); dbErr != nil {
				log.Printf("[RuntimeSelector] health poll: UpdateHealth(%s) failed: %v", inst.RuntimeID, dbErr)
			}
			log.Printf("[RuntimeSelector] health poll: %s unroutable endpoint", inst.RuntimeID)
			continue
		}
		hctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		client := s.getOrCreateClient(normalizedEndpoint)
		err = client.Health(hctx)
		cancel()

		healthy := err == nil
		if healthy {
			log.Printf("[RuntimeSelector] health poll: %s OK", inst.RuntimeID)
		} else {
			log.Printf("[RuntimeSelector] health poll: %s unhealthy: %v", inst.RuntimeID, err)
		}

		if dbErr := s.repo.UpdateHealth(ctx, inst.RuntimeID, healthy); dbErr != nil {
			log.Printf("[RuntimeSelector] health poll: UpdateHealth(%s) failed: %v", inst.RuntimeID, dbErr)
		}
	}
}
