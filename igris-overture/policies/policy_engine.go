package policies

import (
	"fmt"
	"os"
	"sync"

	"gopkg.in/yaml.v3"
)

// PolicyEngine evaluates routing policies based on cost and latency constraints
type PolicyEngine struct {
	policies map[string]*TenantPolicy
	mu       sync.RWMutex
}

// TenantPolicy represents routing policy for a tenant
type TenantPolicy struct {
	TenantID string      `yaml:"tenant_id" json:"tenant_id"`
	Allow    []AllowRule `yaml:"allow" json:"allow"`
	Version  int         `yaml:"version" json:"version"`
}

// AllowRule defines allowed providers and constraints
type AllowRule struct {
	Provider   []string `yaml:"provider" json:"provider"`
	MaxCostUSD float64  `yaml:"max_cost_usd" json:"max_cost_usd"`
	Prefer     string   `yaml:"prefer" json:"prefer"` // "latency" or "cost"
}

// RoutingDecision represents the result of policy evaluation
type RoutingDecision struct {
	AllowedProviders []string
	MaxCostUSD       float64
	Preference       string // "latency" or "cost"
	PolicyMatched    bool
	Reason           string
}

// NewPolicyEngine creates a new policy engine
func NewPolicyEngine() *PolicyEngine {
	return &PolicyEngine{
		policies: make(map[string]*TenantPolicy),
	}
}

// LoadPolicy loads a policy from YAML file
func (pe *PolicyEngine) LoadPolicy(filePath string) (*TenantPolicy, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read policy file: %w", err)
	}

	var policy TenantPolicy
	if err := yaml.Unmarshal(data, &policy); err != nil {
		return nil, fmt.Errorf("failed to parse policy YAML: %w", err)
	}

	if err := policy.Validate(); err != nil {
		return nil, fmt.Errorf("invalid policy: %w", err)
	}

	pe.mu.Lock()
	pe.policies[policy.TenantID] = &policy
	pe.mu.Unlock()

	return &policy, nil
}

// LoadPolicyFromString loads policy from YAML string
func (pe *PolicyEngine) LoadPolicyFromString(tenantID, yamlContent string) (*TenantPolicy, error) {
	var policy TenantPolicy
	if err := yaml.Unmarshal([]byte(yamlContent), &policy); err != nil {
		return nil, fmt.Errorf("failed to parse policy YAML: %w", err)
	}

	policy.TenantID = tenantID
	if err := policy.Validate(); err != nil {
		return nil, fmt.Errorf("invalid policy: %w", err)
	}

	pe.mu.Lock()
	pe.policies[tenantID] = &policy
	pe.mu.Unlock()

	return &policy, nil
}

// Evaluate evaluates routing policy for a tenant and request
//
// SECURITY: This function implements fail-closed behavior. If no policy exists
// or policy evaluation fails, the decision defaults to DENY (empty AllowedProviders).
func (pe *PolicyEngine) Evaluate(tenantID string, estimatedCost float64, availableProviders []string) *RoutingDecision {
	pe.mu.RLock()
	policy, exists := pe.policies[tenantID]
	pe.mu.RUnlock()

	// FAIL-CLOSED: Start with denial (no providers allowed)
	decision := &RoutingDecision{
		AllowedProviders: []string{}, // SECURITY: Empty = deny all
		MaxCostUSD:       -1,
		Preference:       "cost",
		PolicyMatched:    false,
	}

	// FAIL-CLOSED: No policy = deny all access
	if !exists {
		decision.Reason = "No policy configured for tenant - access denied (fail-closed)"
		return decision
	}

	// FAIL-CLOSED: Empty policy = deny all access
	if len(policy.Allow) == 0 {
		decision.Reason = "Policy has no allow rules - access denied (fail-closed)"
		return decision
	}

	// Evaluate first matching rule
	for _, rule := range policy.Allow {
		if pe.matchesRule(&rule, estimatedCost) {
			decision.AllowedProviders = rule.Provider
			decision.MaxCostUSD = rule.MaxCostUSD
			decision.Preference = rule.Prefer
			decision.PolicyMatched = true
			decision.Reason = fmt.Sprintf("Matched policy rule: max_cost=$%.4f, prefer=%s", rule.MaxCostUSD, rule.Prefer)
			break
		}
	}

	// FAIL-CLOSED: If no rule matched, decision already has empty AllowedProviders
	if !decision.PolicyMatched {
		decision.Reason = "No policy rule matched request constraints - access denied (fail-closed)"
	}

	// FAIL-CLOSED: Sanity check - matched policy must have providers
	if decision.PolicyMatched && len(decision.AllowedProviders) == 0 {
		decision.PolicyMatched = false
		decision.AllowedProviders = []string{} // Explicit empty
		decision.Reason = "Policy rule matched but has no providers - access denied (fail-closed)"
	}

	return decision
}

// matchesRule checks if a rule matches the request
func (pe *PolicyEngine) matchesRule(rule *AllowRule, estimatedCost float64) bool {
	// Check cost constraint
	if rule.MaxCostUSD > 0 && estimatedCost > rule.MaxCostUSD {
		return false
	}
	return true
}

// GetPolicy retrieves a tenant's policy
func (pe *PolicyEngine) GetPolicy(tenantID string) (*TenantPolicy, bool) {
	pe.mu.RLock()
	defer pe.mu.RUnlock()

	policy, exists := pe.policies[tenantID]
	return policy, exists
}

// DeletePolicy removes a tenant's policy
func (pe *PolicyEngine) DeletePolicy(tenantID string) {
	pe.mu.Lock()
	defer pe.mu.Unlock()

	delete(pe.policies, tenantID)
}

// Validate validates a tenant policy
func (tp *TenantPolicy) Validate() error {
	if tp.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}

	if len(tp.Allow) == 0 {
		return fmt.Errorf("at least one allow rule is required")
	}

	for i, rule := range tp.Allow {
		if err := rule.Validate(); err != nil {
			return fmt.Errorf("invalid rule %d: %w", i, err)
		}
	}

	return nil
}

// Validate validates an allow rule
func (ar *AllowRule) Validate() error {
	if len(ar.Provider) == 0 {
		return fmt.Errorf("provider list cannot be empty")
	}

	if ar.MaxCostUSD < 0 {
		return fmt.Errorf("max_cost_usd must be non-negative")
	}

	if ar.Prefer != "" && ar.Prefer != "latency" && ar.Prefer != "cost" {
		return fmt.Errorf("prefer must be 'latency' or 'cost', got: %s", ar.Prefer)
	}

	// Default to "cost" if not specified
	if ar.Prefer == "" {
		ar.Prefer = "cost"
	}

	return nil
}

// SelectProvider selects best provider based on policy decision
func SelectProvider(decision *RoutingDecision, providerCosts map[string]float64, providerLatencies map[string]float64) string {
	if len(decision.AllowedProviders) == 0 {
		return ""
	}

	// Filter to allowed providers
	candidates := make(map[string]bool)
	for _, provider := range decision.AllowedProviders {
		candidates[provider] = true
	}

	// Find best provider based on preference
	var bestProvider string
	var bestValue float64 = -1

	for provider := range candidates {
		// Check cost constraint
		if decision.MaxCostUSD > 0 {
			if cost, ok := providerCosts[provider]; ok && cost > decision.MaxCostUSD {
				continue
			}
		}

		// Select based on preference
		var value float64
		if decision.Preference == "latency" {
			if latency, ok := providerLatencies[provider]; ok {
				value = -latency // Lower latency is better
			}
		} else {
			if cost, ok := providerCosts[provider]; ok {
				value = -cost // Lower cost is better
			}
		}

		if bestProvider == "" || value > bestValue {
			bestProvider = provider
			bestValue = value
		}
	}

	return bestProvider
}
