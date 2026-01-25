package policies

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"

	"github.com/Igris-inertial/system/igris-overture/observability"
)

// PolicyEngine manages versioned routing policies with hot reload support
type AdvancedPolicyEngine struct {
	db          *sql.DB
	redis       *redis.Client
	mu          sync.RWMutex
	activePolicy map[string]*AdvancedTenantPolicy // tenantID -> active policy
	cachePrefix  string
}

// AdvancedTenantPolicy represents a tenant's routing policy
type AdvancedTenantPolicy struct {
	ID              string
	TenantID        string
	Version         string
	PolicyHash      string
	Content         *AdvancedPolicyContent
	Status          string
	ActivatedAt     time.Time
	CreatedAt       time.Time
}

// AdvancedPolicyContent represents the parsed YAML policy structure (DSL v2)
type AdvancedPolicyContent struct {
	Version     string                 `yaml:"version" json:"version"`
	RetryChain  []string               `yaml:"retry_chain" json:"retry_chain"`
	Weights     map[string]float64     `yaml:"weights" json:"weights"`
	Region      *RegionConstraints     `yaml:"region" json:"region"`
	TimeWindows map[string]*TimeWindow `yaml:"time_windows" json:"time_windows"`
	Preferences map[string]interface{} `yaml:"preferences" json:"preferences"`
}

// RegionConstraints defines geographic routing constraints
type RegionConstraints struct {
	Allowed []string `yaml:"allowed" json:"allowed"`
	Blocked []string `yaml:"blocked" json:"blocked"`
	Primary string   `yaml:"primary" json:"primary"`
}

// TimeWindow defines time-based routing rules
type TimeWindow struct {
	Start      string   `yaml:"start" json:"start"`       // HH:MM format
	End        string   `yaml:"end" json:"end"`           // HH:MM format
	Days       []string `yaml:"days" json:"days"`         // Mon, Tue, etc.
	Providers  []string `yaml:"providers" json:"providers"`
	MaxCostUSD float64  `yaml:"max_cost_usd" json:"max_cost_usd"`
}

// PolicyVersion represents a versioned policy in the database
type PolicyVersion struct {
	ID           string
	TenantID     string
	Version      string
	PolicyHash   string
	PolicyYAML   string
	Status       string
	IsActive     bool
	ActivatedAt  *time.Time
	CreatedBy    string
	ChangeNotes  string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// NewPolicyEngine creates a new policy engine
func NewAdvancedPolicyEngine(db *sql.DB, redis *redis.Client) *AdvancedPolicyEngine {
	return &AdvancedPolicyEngine{
		db:           db,
		redis:        redis,
		activePolicy: make(map[string]*AdvancedTenantPolicy),
		cachePrefix:  "igris:policy:v2:",
	}
}

// LoadPolicy loads and activates a policy from YAML
func (pe *AdvancedPolicyEngine) LoadPolicy(ctx context.Context, tenantID, policyYAML, version, createdBy string) (*AdvancedTenantPolicy, error) {
	startTime := time.Now()

	// Parse YAML
	var content AdvancedPolicyContent
	if err := yaml.Unmarshal([]byte(policyYAML), &content); err != nil {
		observability.RecordPolicyReload(tenantID, 0, false)
		return nil, fmt.Errorf("failed to parse policy YAML: %w", err)
	}

	// Validate policy content
	if err := pe.validatePolicy(&content); err != nil {
		observability.RecordPolicyReload(tenantID, 0, false)
		return nil, fmt.Errorf("policy validation failed: %w", err)
	}

	// Generate policy hash
	policyHash := pe.hashPolicy(policyYAML)

	// Convert to JSON for database storage
	contentJSON, err := json.Marshal(content)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal policy content: %w", err)
	}

	// Store in database
	query := `
		INSERT INTO policy_versions (
			tenant_id, version, policy_hash, policy_content,
			status, created_by
		) VALUES (
			$1::UUID, $2, $3, $4::JSONB, 'draft', $5
		) RETURNING id, created_at, updated_at
	`

	var policyID string
	var createdAt, updatedAt time.Time

	err = pe.db.QueryRowContext(ctx, query,
		tenantID,
		version,
		policyHash,
		contentJSON,
		createdBy,
	).Scan(&policyID, &createdAt, &updatedAt)

	if err != nil {
		observability.RecordPolicyReload(tenantID, 0, false)
		return nil, fmt.Errorf("failed to store policy: %w", err)
	}

	policy := &AdvancedTenantPolicy{
		ID:         policyID,
		TenantID:   tenantID,
		Version:    version,
		PolicyHash: policyHash,
		Content:    &content,
		Status:     "draft",
		CreatedAt:  createdAt,
	}

	latencySeconds := time.Since(startTime).Seconds()
	observability.RecordPolicyReload(tenantID, latencySeconds, true)

	log.Info().
		Str("tenant_id", tenantID).
		Str("version", version).
		Str("policy_id", policyID).
		Float64("latency_seconds", latencySeconds).
		Msg("Policy loaded successfully")

	return policy, nil
}

// ActivatePolicy activates a policy version for a tenant
func (pe *AdvancedPolicyEngine) ActivatePolicy(ctx context.Context, policyID string) error {
	startTime := time.Now()

	// Call database stored procedure to activate policy
	query := `SELECT activate_policy_version($1::UUID)`

	var success bool
	err := pe.db.QueryRowContext(ctx, query, policyID).Scan(&success)
	if err != nil {
		return fmt.Errorf("failed to activate policy: %w", err)
	}

	// Load the activated policy into memory
	policy, err := pe.loadPolicyByID(ctx, policyID)
	if err != nil {
		return fmt.Errorf("failed to load activated policy: %w", err)
	}

	// Update in-memory cache
	pe.mu.Lock()
	pe.activePolicy[policy.TenantID] = policy
	pe.mu.Unlock()

	// Cache in Redis for hot reload
	if err := pe.cachePolicy(ctx, policy); err != nil {
		log.Warn().Err(err).Str("policy_id", policyID).Msg("Failed to cache policy in Redis")
	}

	latencySeconds := time.Since(startTime).Seconds()
	observability.RecordPolicyReload(policy.TenantID, latencySeconds, true)
	observability.RecordPolicyVersionActive(policy.TenantID, policy.Version, true)

	log.Info().
		Str("tenant_id", policy.TenantID).
		Str("version", policy.Version).
		Str("policy_id", policyID).
		Float64("latency_seconds", latencySeconds).
		Msg("Policy activated successfully")

	return nil
}

// GetActivePolicy retrieves the active policy for a tenant
func (pe *AdvancedPolicyEngine) GetActivePolicy(ctx context.Context, tenantID string) (*AdvancedTenantPolicy, error) {
	// Check in-memory cache first
	pe.mu.RLock()
	policy, exists := pe.activePolicy[tenantID]
	pe.mu.RUnlock()

	if exists {
		return policy, nil
	}

	// Check Redis cache
	cachedPolicy, err := pe.getCachedPolicy(ctx, tenantID)
	if err == nil && cachedPolicy != nil {
		pe.mu.Lock()
		pe.activePolicy[tenantID] = cachedPolicy
		pe.mu.Unlock()
		return cachedPolicy, nil
	}

	// Load from database
	policy, err = pe.loadActivePolicy(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Update caches
	pe.mu.Lock()
	pe.activePolicy[tenantID] = policy
	pe.mu.Unlock()

	_ = pe.cachePolicy(ctx, policy)

	return policy, nil
}

// loadActivePolicy loads the active policy from the database
func (pe *AdvancedPolicyEngine) loadActivePolicy(ctx context.Context, tenantID string) (*AdvancedTenantPolicy, error) {
	query := `
		SELECT
			id, tenant_id, version, policy_hash, policy_content::TEXT,
			status, activated_at, created_at
		FROM policy_versions
		WHERE tenant_id = $1::UUID AND is_active = true
		LIMIT 1
	`

	var policy AdvancedTenantPolicy
	var contentJSON string
	var activatedAt sql.NullTime

	err := pe.db.QueryRowContext(ctx, query, tenantID).Scan(
		&policy.ID,
		&policy.TenantID,
		&policy.Version,
		&policy.PolicyHash,
		&contentJSON,
		&policy.Status,
		&activatedAt,
		&policy.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No active policy
		}
		return nil, fmt.Errorf("failed to load active policy: %w", err)
	}

	if activatedAt.Valid {
		policy.ActivatedAt = activatedAt.Time
	}

	// Parse policy content
	var content AdvancedPolicyContent
	if err := json.Unmarshal([]byte(contentJSON), &content); err != nil {
		return nil, fmt.Errorf("failed to parse policy content: %w", err)
	}

	policy.Content = &content

	return &policy, nil
}

// loadPolicyByID loads a policy by its ID
func (pe *AdvancedPolicyEngine) loadPolicyByID(ctx context.Context, policyID string) (*AdvancedTenantPolicy, error) {
	query := `
		SELECT
			id, tenant_id, version, policy_hash, policy_content::TEXT,
			status, activated_at, created_at
		FROM policy_versions
		WHERE id = $1::UUID
		LIMIT 1
	`

	var policy AdvancedTenantPolicy
	var contentJSON string
	var activatedAt sql.NullTime

	err := pe.db.QueryRowContext(ctx, query, policyID).Scan(
		&policy.ID,
		&policy.TenantID,
		&policy.Version,
		&policy.PolicyHash,
		&contentJSON,
		&policy.Status,
		&activatedAt,
		&policy.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to load policy: %w", err)
	}

	if activatedAt.Valid {
		policy.ActivatedAt = activatedAt.Time
	}

	// Parse policy content
	var content AdvancedPolicyContent
	if err := json.Unmarshal([]byte(contentJSON), &content); err != nil {
		return nil, fmt.Errorf("failed to parse policy content: %w", err)
	}

	policy.Content = &content

	return &policy, nil
}

// cachePolicy stores a policy in Redis
func (pe *AdvancedPolicyEngine) cachePolicy(ctx context.Context, policy *AdvancedTenantPolicy) error {
	key := pe.cachePrefix + policy.TenantID

	data, err := json.Marshal(policy)
	if err != nil {
		return err
	}

	return pe.redis.Set(ctx, key, data, 10*time.Minute).Err()
}

// getCachedPolicy retrieves a policy from Redis
func (pe *AdvancedPolicyEngine) getCachedPolicy(ctx context.Context, tenantID string) (*AdvancedTenantPolicy, error) {
	key := pe.cachePrefix + tenantID

	data, err := pe.redis.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Cache miss
		}
		return nil, err
	}

	var policy AdvancedTenantPolicy
	if err := json.Unmarshal(data, &policy); err != nil {
		return nil, err
	}

	return &policy, nil
}

// validatePolicy validates policy content
func (pe *AdvancedPolicyEngine) validatePolicy(content *AdvancedPolicyContent) error {
	// Validate weights sum to 1.0 if provided
	if len(content.Weights) > 0 {
		sum := 0.0
		for _, weight := range content.Weights {
			if weight < 0 || weight > 1 {
				return fmt.Errorf("weights must be between 0 and 1")
			}
			sum += weight
		}

		// Allow small floating point error
		if sum < 0.99 || sum > 1.01 {
			return fmt.Errorf("weights must sum to 1.0, got %.3f", sum)
		}
	}

	// Validate time windows
	for name, tw := range content.TimeWindows {
		if tw.Start == "" || tw.End == "" {
			return fmt.Errorf("time window '%s' must have start and end times", name)
		}

		// Validate time format (HH:MM)
		if !isValidTimeFormat(tw.Start) || !isValidTimeFormat(tw.End) {
			return fmt.Errorf("time window '%s' has invalid time format (use HH:MM)", name)
		}

		// Validate days
		validDays := map[string]bool{
			"Mon": true, "Tue": true, "Wed": true, "Thu": true,
			"Fri": true, "Sat": true, "Sun": true,
		}
		for _, day := range tw.Days {
			if !validDays[day] {
				return fmt.Errorf("time window '%s' has invalid day: %s", name, day)
			}
		}
	}

	return nil
}

// isValidTimeFormat checks if a time string is in HH:MM format
func isValidTimeFormat(timeStr string) bool {
	_, err := time.Parse("15:04", timeStr)
	return err == nil
}

// hashPolicy generates a SHA-256 hash of the policy YAML
func (pe *AdvancedPolicyEngine) hashPolicy(policyYAML string) string {
	hash := sha256.Sum256([]byte(policyYAML))
	return hex.EncodeToString(hash[:])
}

// EvaluatePolicy evaluates a policy for a given routing context
func (pe *AdvancedPolicyEngine) EvaluatePolicy(ctx context.Context, tenantID string, context *RoutingContext) (*PolicyDecision, error) {
	policy, err := pe.GetActivePolicy(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	if policy == nil {
		// No active policy, return default decision
		return &PolicyDecision{
			AllowedProviders: nil, // All providers allowed
			Weights:          nil, // Use default weights
			MaxCostUSD:       0,   // No cost limit
			Matched:          false,
		}, nil
	}

	decision := &PolicyDecision{
		PolicyVersion: policy.Version,
		Matched:       true,
	}

	// Apply retry chain
	if len(policy.Content.RetryChain) > 0 {
		decision.RetryChain = policy.Content.RetryChain
	}

	// Apply weights
	if len(policy.Content.Weights) > 0 {
		decision.Weights = policy.Content.Weights
	}

	// Apply region constraints
	if policy.Content.Region != nil {
		decision.AllowedProviders = policy.Content.Region.Allowed
		decision.BlockedProviders = policy.Content.Region.Blocked
	}

	// Apply time window constraints
	currentTime := time.Now()
	currentDay := currentTime.Format("Mon")
	currentHHMM := currentTime.Format("15:04")

	for _, tw := range policy.Content.TimeWindows {
		// Check if current day matches
		dayMatches := false
		for _, day := range tw.Days {
			if day == currentDay {
				dayMatches = true
				break
			}
		}

		if !dayMatches {
			continue
		}

		// Check if current time is within window
		if currentHHMM >= tw.Start && currentHHMM <= tw.End {
			decision.AllowedProviders = tw.Providers
			decision.MaxCostUSD = tw.MaxCostUSD
			break
		}
	}

	return decision, nil
}

// RoutingContext contains information needed for policy evaluation
type RoutingContext struct {
	SemanticClass string
	Region        string
	UserTier      string
	RequestTime   time.Time
}

// PolicyDecision represents the result of policy evaluation
type PolicyDecision struct {
	PolicyVersion     string
	AllowedProviders  []string
	BlockedProviders  []string
	RetryChain        []string
	Weights           map[string]float64
	MaxCostUSD        float64
	Matched           bool
}

// InvalidateCache invalidates the policy cache for a tenant
func (pe *AdvancedPolicyEngine) InvalidateCache(ctx context.Context, tenantID string) error {
	// Remove from in-memory cache
	pe.mu.Lock()
	delete(pe.activePolicy, tenantID)
	pe.mu.Unlock()

	// Remove from Redis cache
	key := pe.cachePrefix + tenantID
	return pe.redis.Del(ctx, key).Err()
}

// ListVersions lists all policy versions for a tenant
func (pe *AdvancedPolicyEngine) ListVersions(ctx context.Context, tenantID string, limit int) ([]*PolicyVersion, error) {
	query := `
		SELECT
			id, tenant_id, version, policy_hash, status, is_active,
			activated_at, created_by, change_notes, created_at, updated_at
		FROM policy_versions
		WHERE tenant_id = $1::UUID
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := pe.db.QueryContext(ctx, query, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []*PolicyVersion
	for rows.Next() {
		var v PolicyVersion
		var activatedAt sql.NullTime
		var createdBy, changeNotes sql.NullString

		if err := rows.Scan(
			&v.ID,
			&v.TenantID,
			&v.Version,
			&v.PolicyHash,
			&v.Status,
			&v.IsActive,
			&activatedAt,
			&createdBy,
			&changeNotes,
			&v.CreatedAt,
			&v.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if activatedAt.Valid {
			v.ActivatedAt = &activatedAt.Time
		}
		if createdBy.Valid {
			v.CreatedBy = createdBy.String
		}
		if changeNotes.Valid {
			v.ChangeNotes = changeNotes.String
		}

		versions = append(versions, &v)
	}

	return versions, rows.Err()
}
