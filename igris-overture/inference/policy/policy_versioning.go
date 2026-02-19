package policy

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/zerolog/log"
	pb "github.com/Igris-inertial/system/proto/orchestration"
)

// PolicyVersion represents a versioned set of policies
type PolicyVersion struct {
	// Version metadata
	VersionID        string    `json:"version_id"`
	VersionHash      string    `json:"version_hash"`
	CreatedAt        time.Time `json:"created_at"`
	
	// Policy set
	Policies         map[string]*pb.RoutingPolicy `json:"policies"`
	
	// Frozen evaluation order (deterministic)
	EvaluationOrder  []string  `json:"evaluation_order"`
	
	// Statistics
	PolicyCount      int       `json:"policy_count"`
	TotalPriority    int       `json:"total_priority"`
}

// PolicyVersionManager manages policy versioning and deterministic evaluation
type PolicyVersionManager struct {
	// Current version
	currentVersion   *PolicyVersion
	versionMu        sync.RWMutex
	
	// Version history
	versionHistory   []*PolicyVersion
	maxHistorySize   int
	historyMu        sync.RWMutex
	
	// Evaluation cache (version_hash -> evaluation order)
	evaluationCache  map[string][]string
	cacheMu          sync.RWMutex
}

// NewPolicyVersionManager creates a new policy version manager
func NewPolicyVersionManager(maxHistorySize int) *PolicyVersionManager {
	return &PolicyVersionManager{
		versionHistory:  make([]*PolicyVersion, 0, maxHistorySize),
		maxHistorySize:  maxHistorySize,
		evaluationCache: make(map[string][]string),
	}
}

// CreateVersion creates a new policy version with frozen evaluation order
func (pvm *PolicyVersionManager) CreateVersion(policies map[string]*pb.RoutingPolicy) (*PolicyVersion, error) {
	if len(policies) == 0 {
		return nil, fmt.Errorf("cannot create version with empty policy set")
	}
	
	// Generate version ID
	versionID := fmt.Sprintf("v%d", time.Now().UnixNano())
	
	// Calculate version hash
	versionHash, err := pvm.calculatePolicyHash(policies)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate version hash: %w", err)
	}
	
	// Create frozen evaluation order
	evaluationOrder := pvm.createEvaluationOrder(policies)
	
	// Create version
	version := &PolicyVersion{
		VersionID:       versionID,
		VersionHash:     versionHash,
		CreatedAt:       time.Now(),
		Policies:        policies,
		EvaluationOrder: evaluationOrder,
		PolicyCount:     len(policies),
		TotalPriority:   pvm.calculateTotalPriority(policies),
	}
	
	// Update current version
	pvm.versionMu.Lock()
	pvm.currentVersion = version
	pvm.versionMu.Unlock()
	
	// Add to history
	pvm.historyMu.Lock()
	pvm.versionHistory = append(pvm.versionHistory, version)
	
	// Trim history if needed
	if len(pvm.versionHistory) > pvm.maxHistorySize {
		pvm.versionHistory = pvm.versionHistory[1:]
	}
	pvm.historyMu.Unlock()
	
	// Cache evaluation order
	pvm.cacheMu.Lock()
	pvm.evaluationCache[versionHash] = evaluationOrder
	pvm.cacheMu.Unlock()
	
	log.Info().
		Str("version_id", versionID).
		Str("version_hash", versionHash[:16]).
		Int("policy_count", len(policies)).
		Int("evaluation_order_length", len(evaluationOrder)).
		Msg("Policy version created with frozen evaluation order")
	
	// Export metrics
	policyVersionsTotal.Inc()
	policyVersionPoliciesGauge.Set(float64(len(policies)))
	
	return version, nil
}

// createEvaluationOrder creates a deterministic evaluation order
func (pvm *PolicyVersionManager) createEvaluationOrder(policies map[string]*pb.RoutingPolicy) []string {
	// Extract policy IDs
	policyIDs := make([]string, 0, len(policies))
	for id := range policies {
		policyIDs = append(policyIDs, id)
	}
	
	// Sort by priority (descending), then by policy ID (ascending) for determinism
	sort.Slice(policyIDs, func(i, j int) bool {
		pi := policies[policyIDs[i]]
		pj := policies[policyIDs[j]]
		
		// Primary sort: priority (higher first)
		if pi.Priority != pj.Priority {
			return pi.Priority > pj.Priority
		}
		
		// Secondary sort: policy ID (lexicographic for determinism)
		return policyIDs[i] < policyIDs[j]
	})
	
	log.Debug().
		Int("total_policies", len(policyIDs)).
		Strs("order_preview", policyIDs[:min(5, len(policyIDs))]).
		Msg("Evaluation order created")
	
	return policyIDs
}

// calculatePolicyHash calculates a deterministic hash of the policy set
func (pvm *PolicyVersionManager) calculatePolicyHash(policies map[string]*pb.RoutingPolicy) (string, error) {
	// Sort policy IDs for determinism
	policyIDs := make([]string, 0, len(policies))
	for id := range policies {
		policyIDs = append(policyIDs, id)
	}
	sort.Strings(policyIDs)
	
	// Create hasher
	hasher := sha256.New()
	
	// Hash each policy in sorted order
	for _, id := range policyIDs {
		policy := policies[id]
		
		// Serialize policy
		policyJSON, err := json.Marshal(policy)
		if err != nil {
			return "", fmt.Errorf("failed to marshal policy %s: %w", id, err)
		}
		
		// Write to hasher
		hasher.Write([]byte(id))
		hasher.Write([]byte(":"))
		hasher.Write(policyJSON)
		hasher.Write([]byte("|"))
	}
	
	// Generate hash
	hash := fmt.Sprintf("%x", hasher.Sum(nil))
	
	return hash, nil
}

// calculateTotalPriority calculates sum of all policy priorities
func (pvm *PolicyVersionManager) calculateTotalPriority(policies map[string]*pb.RoutingPolicy) int {
	total := 0
	for _, policy := range policies {
		total += int(policy.Priority)
	}
	return total
}

// GetCurrentVersion returns the current policy version
func (pvm *PolicyVersionManager) GetCurrentVersion() *PolicyVersion {
	pvm.versionMu.RLock()
	defer pvm.versionMu.RUnlock()
	return pvm.currentVersion
}

// GetEvaluationOrder returns the frozen evaluation order for current version
func (pvm *PolicyVersionManager) GetEvaluationOrder() []string {
	pvm.versionMu.RLock()
	defer pvm.versionMu.RUnlock()
	
	if pvm.currentVersion == nil {
		return nil
	}
	
	return pvm.currentVersion.EvaluationOrder
}

// GetVersionByHash retrieves a version by its hash
func (pvm *PolicyVersionManager) GetVersionByHash(hash string) *PolicyVersion {
	pvm.historyMu.RLock()
	defer pvm.historyMu.RUnlock()
	
	for _, version := range pvm.versionHistory {
		if version.VersionHash == hash {
			return version
		}
	}
	
	return nil
}

// ValidateEvaluationOrder verifies that evaluation order is deterministic
func (pvm *PolicyVersionManager) ValidateEvaluationOrder() error {
	pvm.versionMu.RLock()
	version := pvm.currentVersion
	pvm.versionMu.RUnlock()
	
	if version == nil {
		return fmt.Errorf("no current version")
	}
	
	// Recreate evaluation order
	recreated := pvm.createEvaluationOrder(version.Policies)
	
	// Compare with frozen order
	if len(recreated) != len(version.EvaluationOrder) {
		return fmt.Errorf("evaluation order length mismatch: expected %d, got %d",
			len(version.EvaluationOrder), len(recreated))
	}
	
	for i := range recreated {
		if recreated[i] != version.EvaluationOrder[i] {
			return fmt.Errorf("evaluation order mismatch at index %d: expected %s, got %s",
				i, version.EvaluationOrder[i], recreated[i])
		}
	}
	
	log.Debug().
		Str("version_id", version.VersionID).
		Msg("Evaluation order validation passed")
	
	return nil
}

// DeterministicPolicyEvaluator provides deterministic policy evaluation
type DeterministicPolicyEvaluator struct {
	versionMgr *PolicyVersionManager
}

// NewDeterministicPolicyEvaluator creates a new deterministic evaluator
func NewDeterministicPolicyEvaluator(versionMgr *PolicyVersionManager) *DeterministicPolicyEvaluator {
	return &DeterministicPolicyEvaluator{
		versionMgr: versionMgr,
	}
}

// EvaluatePolicies evaluates policies in deterministic order
func (dpe *DeterministicPolicyEvaluator) EvaluatePolicies(
	req *pb.RouteInferenceRequest,
	matcher PolicyMatcher,
) (*pb.RoutingPolicy, error) {
	// Get current version
	version := dpe.versionMgr.GetCurrentVersion()
	if version == nil {
		return nil, fmt.Errorf("no policy version available")
	}
	
	// Get frozen evaluation order
	evaluationOrder := version.EvaluationOrder
	
	log.Debug().
		Str("version_id", version.VersionID).
		Str("version_hash", version.VersionHash[:16]).
		Int("policies_to_evaluate", len(evaluationOrder)).
		Msg("Starting deterministic policy evaluation")
	
	// Evaluate policies in frozen order
	for i, policyID := range evaluationOrder {
		policy := version.Policies[policyID]
		
		if policy == nil {
			log.Warn().
				Str("policy_id", policyID).
				Msg("Policy in evaluation order not found in policy set")
			continue
		}
		
		// Skip disabled policies
		if !policy.Enabled {
			continue
		}
		
		// Check if policy matches request
		if matcher.Matches(policy, req) {
			log.Info().
				Str("policy_id", policyID).
				Int("evaluation_index", i).
				Int("priority", int(policy.Priority)).
				Str("version_hash", version.VersionHash[:16]).
				Msg("Policy matched in deterministic evaluation")
			
			// Export metrics
			policyEvaluationsTotal.Inc()
			policyMatchesTotal.WithLabelValues(policyID).Inc()
			policyEvaluationIndex.WithLabelValues(policyID).Set(float64(i))
			
			return policy, nil
		}
	}
	
	// No policy matched
	policyEvaluationsTotal.Inc()
	
	return nil, fmt.Errorf("no matching policy found in deterministic evaluation")
}

// PolicyMatcher interface for matching policies to requests
type PolicyMatcher interface {
	Matches(policy *pb.RoutingPolicy, req *pb.RouteInferenceRequest) bool
}

// DefaultPolicyMatcher implements basic policy matching
type DefaultPolicyMatcher struct{}

// Matches checks if a policy matches a request
func (m *DefaultPolicyMatcher) Matches(policy *pb.RoutingPolicy, req *pb.RouteInferenceRequest) bool {
	conditions := policy.Conditions
	
	// Check model conditions
	if len(conditions.ModelIds) > 0 {
		// Check if request preferences match
		if req.RoutingHints != nil {
			for _, preferredModel := range req.RoutingHints.PreferredModels {
				for _, allowedModel := range conditions.ModelIds {
					if preferredModel == allowedModel {
						return true
					}
				}
			}
		}
	}
	
	// Check tenant conditions
	if len(conditions.AllowedTenants) > 0 {
		if req.InferenceRequest != nil && req.InferenceRequest.Metadata != nil {
			tenantID := req.InferenceRequest.Metadata.TenantId
			for _, allowedTenant := range conditions.AllowedTenants {
				if tenantID == allowedTenant {
					return true
				}
			}
		}
	}
	
	// Check region conditions
	if len(conditions.AllowedRegions) > 0 {
		if req.Context != nil {
			region := req.Context.Region
			for _, allowedRegion := range conditions.AllowedRegions {
				if region == allowedRegion {
					return true
				}
			}
		}
	}
	
	// Default: match if no specific conditions
	if len(conditions.ModelIds) == 0 &&
		len(conditions.AllowedTenants) == 0 &&
		len(conditions.AllowedRegions) == 0 {
		return true
	}
	
	return false
}

// VersionedPolicyEngine wraps PolicyEngine with versioning
type VersionedPolicyEngine struct {
	engine     *PolicyEngine
	versionMgr *PolicyVersionManager
	evaluator  *DeterministicPolicyEvaluator
	matcher    PolicyMatcher
	mu         sync.RWMutex
}

// NewVersionedPolicyEngine creates a versioned policy engine
func NewVersionedPolicyEngine(engine *PolicyEngine) *VersionedPolicyEngine {
	versionMgr := NewPolicyVersionManager(100) // Keep 100 versions
	evaluator := NewDeterministicPolicyEvaluator(versionMgr)
	
	vpe := &VersionedPolicyEngine{
		engine:     engine,
		versionMgr: versionMgr,
		evaluator:  evaluator,
		matcher:    &DefaultPolicyMatcher{},
	}
	
	// Create initial version from engine's policies
	engine.mu.RLock()
	policies := make(map[string]*pb.RoutingPolicy, len(engine.policies))
	for k, v := range engine.policies {
		policies[k] = v
	}
	engine.mu.RUnlock()
	
	if len(policies) > 0 {
		if _, err := versionMgr.CreateVersion(policies); err != nil {
			log.Error().Err(err).Msg("Failed to create initial policy version")
		}
	}
	
	return vpe
}

// UpdatePolicies updates policies and creates a new version
func (vpe *VersionedPolicyEngine) UpdatePolicies(policies map[string]*pb.RoutingPolicy) error {
	vpe.mu.Lock()
	defer vpe.mu.Unlock()
	
	// Update engine policies
	vpe.engine.mu.Lock()
	vpe.engine.policies = policies
	vpe.engine.mu.Unlock()
	
	// Create new version
	version, err := vpe.versionMgr.CreateVersion(policies)
	if err != nil {
		return fmt.Errorf("failed to create policy version: %w", err)
	}
	
	log.Info().
		Str("version_id", version.VersionID).
		Str("version_hash", version.VersionHash[:16]).
		Int("policy_count", version.PolicyCount).
		Msg("Policies updated with new version")
	
	return nil
}

// EvaluatePoliciesDeterministic evaluates policies deterministically
func (vpe *VersionedPolicyEngine) EvaluatePoliciesDeterministic(
	req *pb.RouteInferenceRequest,
) (*pb.RoutingPolicy, error) {
	return vpe.evaluator.EvaluatePolicies(req, vpe.matcher)
}

// GetCurrentPolicyVersion returns current policy version
func (vpe *VersionedPolicyEngine) GetCurrentPolicyVersion() *PolicyVersion {
	return vpe.versionMgr.GetCurrentVersion()
}

// ValidateDeterminism validates that evaluation is deterministic
func (vpe *VersionedPolicyEngine) ValidateDeterminism() error {
	return vpe.versionMgr.ValidateEvaluationOrder()
}

// Helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Prometheus metrics
var (
	policyVersionsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "policy_versions_total",
			Help: "Total number of policy versions created",
		},
	)
	
	policyVersionPoliciesGauge = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "policy_version_policies",
			Help: "Number of policies in current version",
		},
	)
	
	policyEvaluationsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "policy_evaluations_total",
			Help: "Total number of policy evaluations",
		},
	)
	
	policyMatchesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "policy_matches_total",
			Help: "Total policy matches by policy ID",
		},
		[]string{"policy_id"},
	)
	
	policyEvaluationIndex = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "policy_evaluation_index",
			Help: "Index in evaluation order where policy matched",
		},
		[]string{"policy_id"},
	)
)

func init() {
	prometheus.MustRegister(policyVersionsTotal)
	prometheus.MustRegister(policyVersionPoliciesGauge)
	prometheus.MustRegister(policyEvaluationsTotal)
	prometheus.MustRegister(policyMatchesTotal)
	prometheus.MustRegister(policyEvaluationIndex)
}
