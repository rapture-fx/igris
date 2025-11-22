// Package slo provides action execution for SLO remediation
package slo

import (
	"fmt"
	"log"
	"strings"
)

// ActionExecutor executes remediation actions
type ActionExecutor interface {
	Execute(action RemediationAction) error
}

// DefaultActionExecutor implements ActionExecutor with real integrations
type DefaultActionExecutor struct {
	circuitBreaker    CircuitBreakerController
	thompsonSampling  ThompsonSamplingController
	k8sScaler         KubernetesScaler
	auditLogger       *AuditLogger
	logger            *log.Logger
}

// NewDefaultActionExecutor creates a new action executor
func NewDefaultActionExecutor(
	cb CircuitBreakerController,
	ts ThompsonSamplingController,
	k8s KubernetesScaler,
	audit *AuditLogger,
) *DefaultActionExecutor {
	return &DefaultActionExecutor{
		circuitBreaker:   cb,
		thompsonSampling: ts,
		k8sScaler:        k8s,
		auditLogger:      audit,
		logger:           log.Default(),
	}
}

// Execute executes a remediation action
func (ae *DefaultActionExecutor) Execute(action RemediationAction) error {
	// Log to audit trail
	if ae.auditLogger != nil {
		ae.auditLogger.LogAction(action)
	}

	// Parse composite actions (e.g., "circuit_breaker:open+scale:deployment")
	actions := strings.Split(action.ActionType, "+")

	for _, singleAction := range actions {
		parts := strings.SplitN(singleAction, ":", 2)
		if len(parts) != 2 {
			ae.logger.Printf("[SLO] Invalid action format: %s", singleAction)
			continue
		}

		actionType := parts[0]
		actionValue := parts[1]

		switch actionType {
		case "circuit_breaker":
			if err := ae.executeCircuitBreakerAction(actionValue, action.Target); err != nil {
				return fmt.Errorf("circuit breaker action failed: %w", err)
			}

		case "thompson_sampling":
			if err := ae.executeThompsonSamplingAction(actionValue, action.Target); err != nil {
				return fmt.Errorf("thompson sampling action failed: %w", err)
			}

		case "scale":
			if err := ae.executeScaleAction(actionValue, action.Target); err != nil {
				return fmt.Errorf("scale action failed: %w", err)
			}

		case "failover":
			if err := ae.executeFailoverAction(actionValue, action.Target); err != nil {
				return fmt.Errorf("failover action failed: %w", err)
			}

		default:
			ae.logger.Printf("[SLO] Unknown action type: %s", actionType)
		}
	}

	return nil
}

func (ae *DefaultActionExecutor) executeCircuitBreakerAction(action, target string) error {
	switch action {
	case "open":
		ae.logger.Printf("[SLO] Opening circuit breaker for: %s", target)
		return ae.circuitBreaker.Open(target)

	case "close":
		ae.logger.Printf("[SLO] Closing circuit breaker for: %s", target)
		return ae.circuitBreaker.Close(target)

	case "half_open":
		ae.logger.Printf("[SLO] Setting circuit breaker to half-open: %s", target)
		return ae.circuitBreaker.HalfOpen(target)

	default:
		return fmt.Errorf("unknown circuit breaker action: %s", action)
	}
}

func (ae *DefaultActionExecutor) executeThompsonSamplingAction(action, target string) error {
	switch action {
	case "penalize":
		// Penalize by setting alpha=1, beta=1000 (very low success rate)
		ae.logger.Printf("[SLO] Penalizing Thompson Sampling for: %s", target)
		return ae.thompsonSampling.UpdateReward(target, 1, 1000)

	case "reward":
		// Reward by boosting alpha
		ae.logger.Printf("[SLO] Rewarding Thompson Sampling for: %s", target)
		return ae.thompsonSampling.UpdateReward(target, 100, 1)

	case "reset":
		// Reset to default values
		ae.logger.Printf("[SLO] Resetting Thompson Sampling for: %s", target)
		return ae.thompsonSampling.UpdateReward(target, 1, 1)

	default:
		return fmt.Errorf("unknown thompson sampling action: %s", action)
	}
}

func (ae *DefaultActionExecutor) executeScaleAction(action, target string) error {
	switch action {
	case "deployment":
		ae.logger.Printf("[SLO] Scaling deployment: %s", target)
		return ae.k8sScaler.ScaleDeployment(target, +1) // Scale up by 1 replica

	case "horizontal":
		ae.logger.Printf("[SLO] Horizontal scale for: %s", target)
		return ae.k8sScaler.ScaleDeployment(target, +2) // Scale up by 2 replicas

	case "down":
		ae.logger.Printf("[SLO] Scaling down: %s", target)
		return ae.k8sScaler.ScaleDeployment(target, -1) // Scale down by 1 replica

	default:
		return fmt.Errorf("unknown scale action: %s", action)
	}
}

func (ae *DefaultActionExecutor) executeFailoverAction(action, target string) error {
	switch action {
	case "healthy_replica":
		ae.logger.Printf("[SLO] Failover to healthy replica: %s", target)
		// In real impl, this would update routing to use backup instances
		return nil

	case "backup_provider":
		ae.logger.Printf("[SLO] Failover to backup provider: %s", target)
		// In real impl, this would switch to backup AI provider
		return nil

	default:
		return fmt.Errorf("unknown failover action: %s", action)
	}
}

// ============================================================================
// Interface Definitions for Controllers
// ============================================================================

// CircuitBreakerController manages circuit breaker state
type CircuitBreakerController interface {
	Open(provider string) error
	Close(provider string) error
	HalfOpen(provider string) error
}

// ThompsonSamplingController manages Thompson Sampling parameters
type ThompsonSamplingController interface {
	UpdateReward(provider string, alpha, beta int) error
}

// KubernetesScaler manages Kubernetes scaling
type KubernetesScaler interface {
	ScaleDeployment(name string, replicas int) error
}

// ============================================================================
// Mock Implementations for Testing/Development
// ============================================================================

// MockCircuitBreaker is a mock implementation
type MockCircuitBreaker struct{}

func (m *MockCircuitBreaker) Open(provider string) error {
	log.Printf("[MOCK] Circuit breaker OPENED for: %s", provider)
	return nil
}

func (m *MockCircuitBreaker) Close(provider string) error {
	log.Printf("[MOCK] Circuit breaker CLOSED for: %s", provider)
	return nil
}

func (m *MockCircuitBreaker) HalfOpen(provider string) error {
	log.Printf("[MOCK] Circuit breaker HALF-OPEN for: %s", provider)
	return nil
}

// MockThompsonSampling is a mock implementation
type MockThompsonSampling struct{}

func (m *MockThompsonSampling) UpdateReward(provider string, alpha, beta int) error {
	log.Printf("[MOCK] Thompson Sampling updated for %s: alpha=%d, beta=%d", provider, alpha, beta)
	return nil
}

// MockK8sScaler is a mock implementation
type MockK8sScaler struct{}

func (m *MockK8sScaler) ScaleDeployment(name string, replicas int) error {
	action := "UP"
	if replicas < 0 {
		action = "DOWN"
	}
	log.Printf("[MOCK] Kubernetes scaling %s for %s by %d replicas", action, name, replicas)
	return nil
}

// NewActionExecutor creates a new action executor with mock controllers (for development/testing)
func NewActionExecutor(auditLogger *AuditLogger) ActionExecutor {
	return NewDefaultActionExecutor(
		&MockCircuitBreaker{},
		&MockThompsonSampling{},
		&MockK8sScaler{},
		auditLogger,
	)
}
