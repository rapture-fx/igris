// Package security provides routing integration for cryptographic decision signing.
package security

import (
	"context"
	"crypto/ed25519"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"sync"

	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/observability"
)

// RoutingIntegration provides integration between routing and decision signing
type RoutingIntegration struct {
	signer     *DecisionSigner
	keyManager *TenantKeyManager
	enabled    bool
	mu         sync.RWMutex
}

// RoutingIntegrationConfig holds configuration for routing integration
type RoutingIntegrationConfig struct {
	Enabled            bool
	MasterKeyHex       string // Hex-encoded 32-byte AES key
	StrictMode         bool
	AuditEnabled       bool
	TimestampWindowSec int
}

// DefaultRoutingIntegrationConfig returns default configuration
func DefaultRoutingIntegrationConfig() RoutingIntegrationConfig {
	return RoutingIntegrationConfig{
		Enabled:            false, // Start disabled for gradual rollout
		MasterKeyHex:       "",    // Must be provided
		StrictMode:         false,
		AuditEnabled:       true,
		TimestampWindowSec: 300, // 5 minutes
	}
}

// NewRoutingIntegration creates a new routing integration
func NewRoutingIntegration(db *sql.DB, config RoutingIntegrationConfig) (*RoutingIntegration, error) {
	if !config.Enabled {
		log.Info().Msg("Routing crypto integration disabled")
		return &RoutingIntegration{
			enabled: false,
		}, nil
	}

	if config.MasterKeyHex == "" {
		return nil, fmt.Errorf("master key hex is required when crypto integration is enabled")
	}

	// Convert hex to bytes then to base64 for NewTenantKeyManager
	masterKeyBytes, err := hex.DecodeString(config.MasterKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode master key hex: %w", err)
	}

	if len(masterKeyBytes) != 32 {
		return nil, fmt.Errorf("master key must be 32 bytes (AES-256), got %d", len(masterKeyBytes))
	}

	masterKeyBase64 := base64.StdEncoding.EncodeToString(masterKeyBytes)

	// Create key manager
	keyManager, err := NewTenantKeyManager(db, masterKeyBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to create key manager: %w", err)
	}

	// Create decision signer
	signerConfig := DecisionSignerConfig{
		Enabled:      true,
		StrictMode:   config.StrictMode,
		AuditEnabled: config.AuditEnabled,
	}

	signer := NewDecisionSigner(keyManager, db, signerConfig)

	log.Info().
		Bool("strict_mode", config.StrictMode).
		Bool("audit_enabled", config.AuditEnabled).
		Msg("Routing crypto integration initialized")

	return &RoutingIntegration{
		signer:     signer,
		keyManager: keyManager,
		enabled:    true,
	}, nil
}

// SignRoutingDecision signs a routing decision before sending to Runtime
func (ri *RoutingIntegration) SignRoutingDecision(
	ctx context.Context,
	tenantID string,
	requestID string,
	providerID string,
	modelID string,
	strategy string,
	confidence float64,
	metadata map[string]interface{},
) (*SignedRoutingDecision, error) {
	ri.mu.RLock()
	enabled := ri.enabled
	ri.mu.RUnlock()

	if !enabled {
		// Return unsigned placeholder for disabled mode
		return &SignedRoutingDecision{
			RequestID:  requestID,
			ProviderID: providerID,
		}, nil
	}

	decision := &RoutingDecision{
		RequestID:  requestID,
		TenantID:   tenantID,
		ProviderID: providerID,
		ModelID:    modelID,
		Strategy:   strategy,
		Confidence: confidence,
		Metadata:   metadata,
	}

	return ri.signer.SignRoutingDecision(ctx, decision)
}

// VerifyExecutionFeedback verifies execution feedback from Runtime
func (ri *RoutingIntegration) VerifyExecutionFeedback(
	ctx context.Context,
	signedDecision *SignedDecisionEnvelope,
	executionEnvelope *SignedExecutionEnvelope,
	runtimePublicKey string,
) error {
	ri.mu.RLock()
	enabled := ri.enabled
	ri.mu.RUnlock()

	if !enabled {
		return nil
	}

	return ri.signer.VerifyAndRecordExecution(ctx, signedDecision, executionEnvelope, runtimePublicKey)
}

// GetKeyManager returns the key manager for direct access
func (ri *RoutingIntegration) GetKeyManager() *TenantKeyManager {
	return ri.keyManager
}

// GetDecisionSigner returns the decision signer for direct access
func (ri *RoutingIntegration) GetDecisionSigner() *DecisionSigner {
	return ri.signer
}

// IsEnabled returns whether crypto integration is enabled
func (ri *RoutingIntegration) IsEnabled() bool {
	ri.mu.RLock()
	defer ri.mu.RUnlock()
	return ri.enabled
}

// SetEnabled enables or disables crypto integration at runtime
func (ri *RoutingIntegration) SetEnabled(enabled bool) {
	ri.mu.Lock()
	defer ri.mu.Unlock()
	ri.enabled = enabled
	log.Info().Bool("enabled", enabled).Msg("Routing crypto integration status changed")
}

// SetStrictMode enables or disables strict mode at runtime
func (ri *RoutingIntegration) SetStrictMode(strict bool) {
	if ri.signer != nil {
		ri.signer.SetStrictMode(strict)
	}
}

// EnsureTenantKey ensures a tenant has a signing key, generating if needed
func (ri *RoutingIntegration) EnsureTenantKey(ctx context.Context, tenantID string) (*TenantKey, error) {
	ri.mu.RLock()
	enabled := ri.enabled
	ri.mu.RUnlock()

	if !enabled || ri.keyManager == nil {
		return nil, fmt.Errorf("crypto integration not enabled")
	}

	// Try to get or create key
	_, err := ri.keyManager.GetOrCreateKey(ctx, tenantID, "decision_signing")
	if err != nil {
		return nil, err
	}

	// GenerateKeyPair returns TenantKey, but we already have key via GetOrCreateKey
	// If we need a TenantKey specifically, generate a new one
	return ri.keyManager.GenerateKeyPair(ctx, tenantID, "decision_signing")
}

// GetTenantPublicKey returns the active public key for a tenant (base64-encoded)
func (ri *RoutingIntegration) GetTenantPublicKey(ctx context.Context, tenantID string) (string, error) {
	ri.mu.RLock()
	enabled := ri.enabled
	ri.mu.RUnlock()

	if !enabled || ri.keyManager == nil {
		return "", fmt.Errorf("crypto integration not enabled")
	}

	pubKeyBase64, _, err := ri.keyManager.GetPublicKeyBase64(ctx, tenantID, "decision_signing")
	return pubKeyBase64, err
}

// RotateTenantKey rotates the signing key for a tenant
func (ri *RoutingIntegration) RotateTenantKey(ctx context.Context, tenantID string) (*TenantKey, error) {
	ri.mu.RLock()
	enabled := ri.enabled
	ri.mu.RUnlock()

	if !enabled || ri.keyManager == nil {
		return nil, fmt.Errorf("crypto integration not enabled")
	}

	// GenerateKeyPair creates new key and deactivates old ones (acts as rotation)
	return ri.keyManager.GenerateKeyPair(ctx, tenantID, "decision_signing")
}

// RuntimeRegistration represents a Runtime registration request
type RuntimeRegistration struct {
	RuntimeID       string `json:"runtime_id"`
	TenantID        string `json:"tenant_id"`
	PublicKeyBase64 string `json:"public_key"`
	Timestamp       int64  `json:"timestamp"`
	Signature       string `json:"signature"`
}

// RuntimeHeartbeat represents a heartbeat from Runtime
type RuntimeHeartbeat struct {
	RuntimeID string                 `json:"runtime_id"`
	TenantID  string                 `json:"tenant_id"`
	Timestamp int64                  `json:"timestamp"`
	Stats     map[string]interface{} `json:"stats,omitempty"`
	Signature string                 `json:"signature"`
}

// RuntimeRegistry tracks registered Runtime instances
type RuntimeRegistry struct {
	runtimes map[string]*RegisteredRuntime
	mu       sync.RWMutex
}

// RegisteredRuntime represents a registered Runtime instance
type RegisteredRuntime struct {
	RuntimeID       string
	TenantID        string
	PublicKeyBase64 string
	RegisteredAt    int64
	LastHeartbeat   int64
	Stats           map[string]interface{}
}

// NewRuntimeRegistry creates a new Runtime registry
func NewRuntimeRegistry() *RuntimeRegistry {
	return &RuntimeRegistry{
		runtimes: make(map[string]*RegisteredRuntime),
	}
}

// RegisterRuntime registers a new Runtime instance
func (rr *RuntimeRegistry) RegisterRuntime(reg *RuntimeRegistration) error {
	// Validate signature using provided public key
	if err := verifyRuntimeSignature(reg); err != nil {
		observability.RecordVerificationFailure(reg.TenantID, "runtime_registration_signature_invalid")
		return fmt.Errorf("invalid registration signature: %w", err)
	}

	rr.mu.Lock()
	defer rr.mu.Unlock()

	rr.runtimes[reg.RuntimeID] = &RegisteredRuntime{
		RuntimeID:       reg.RuntimeID,
		TenantID:        reg.TenantID,
		PublicKeyBase64: reg.PublicKeyBase64,
		RegisteredAt:    reg.Timestamp,
		LastHeartbeat:   reg.Timestamp,
	}

	log.Info().
		Str("runtime_id", reg.RuntimeID).
		Str("tenant_id", reg.TenantID).
		Msg("Runtime registered")

	return nil
}

// GetRuntime returns a registered Runtime by ID
func (rr *RuntimeRegistry) GetRuntime(runtimeID string) (*RegisteredRuntime, bool) {
	rr.mu.RLock()
	defer rr.mu.RUnlock()

	runtime, exists := rr.runtimes[runtimeID]
	return runtime, exists
}

// GetRuntimePublicKey returns the public key for a registered Runtime
func (rr *RuntimeRegistry) GetRuntimePublicKey(runtimeID string) (string, error) {
	rr.mu.RLock()
	defer rr.mu.RUnlock()

	runtime, exists := rr.runtimes[runtimeID]
	if !exists {
		return "", fmt.Errorf("runtime %s not registered", runtimeID)
	}

	return runtime.PublicKeyBase64, nil
}

// UpdateHeartbeat updates the last heartbeat time for a Runtime
func (rr *RuntimeRegistry) UpdateHeartbeat(hb *RuntimeHeartbeat) error {
	rr.mu.Lock()
	defer rr.mu.Unlock()

	runtime, exists := rr.runtimes[hb.RuntimeID]
	if !exists {
		return fmt.Errorf("runtime %s not registered", hb.RuntimeID)
	}

	// Verify signature using the stored public key
	if err := verifyHeartbeatSignature(hb, runtime.PublicKeyBase64); err != nil {
		observability.RecordVerificationFailure(hb.TenantID, "heartbeat_signature_invalid")
		return fmt.Errorf("invalid heartbeat signature: %w", err)
	}

	runtime.LastHeartbeat = hb.Timestamp
	runtime.Stats = hb.Stats

	return nil
}

// ListRuntimes returns all registered Runtimes for a tenant
func (rr *RuntimeRegistry) ListRuntimes(tenantID string) []*RegisteredRuntime {
	rr.mu.RLock()
	defer rr.mu.RUnlock()

	var result []*RegisteredRuntime
	for _, runtime := range rr.runtimes {
		if runtime.TenantID == tenantID {
			result = append(result, runtime)
		}
	}

	return result
}

// UnregisterRuntime removes a Runtime from the registry
func (rr *RuntimeRegistry) UnregisterRuntime(runtimeID string) {
	rr.mu.Lock()
	defer rr.mu.Unlock()

	if runtime, exists := rr.runtimes[runtimeID]; exists {
		log.Info().
			Str("runtime_id", runtimeID).
			Str("tenant_id", runtime.TenantID).
			Msg("Runtime unregistered")
		delete(rr.runtimes, runtimeID)
	}
}

// verifyRuntimeSignature verifies a Runtime registration signature using Ed25519
func verifyRuntimeSignature(reg *RuntimeRegistration) error {
	if reg.PublicKeyBase64 == "" {
		return fmt.Errorf("public key is required")
	}

	if reg.Signature == "" {
		return fmt.Errorf("signature is required for registration")
	}

	// Decode public key
	pubKeyBytes, err := base64.StdEncoding.DecodeString(reg.PublicKeyBase64)
	if err != nil {
		return fmt.Errorf("invalid public key encoding: %w", err)
	}

	if len(pubKeyBytes) != ed25519.PublicKeySize {
		return fmt.Errorf("invalid public key size: expected %d bytes, got %d", ed25519.PublicKeySize, len(pubKeyBytes))
	}

	// Reconstruct the signed message: runtime_id + tenant_id + timestamp
	message := fmt.Sprintf("%s:%s:%d", reg.RuntimeID, reg.TenantID, reg.Timestamp)

	// Decode signature
	sigBytes, err := base64.StdEncoding.DecodeString(reg.Signature)
	if err != nil {
		return fmt.Errorf("invalid signature encoding: %w", err)
	}

	// Verify Ed25519 signature
	if !ed25519.Verify(ed25519.PublicKey(pubKeyBytes), []byte(message), sigBytes) {
		return fmt.Errorf("Ed25519 signature verification failed")
	}

	return nil
}

// verifyHeartbeatSignature verifies a Runtime heartbeat signature using Ed25519
func verifyHeartbeatSignature(hb *RuntimeHeartbeat, publicKeyBase64 string) error {
	if hb.Signature == "" {
		return fmt.Errorf("heartbeat signature is required")
	}

	// Decode public key
	pubKeyBytes, err := base64.StdEncoding.DecodeString(publicKeyBase64)
	if err != nil {
		return fmt.Errorf("invalid public key encoding: %w", err)
	}

	if len(pubKeyBytes) != ed25519.PublicKeySize {
		return fmt.Errorf("invalid public key size: expected %d bytes, got %d", ed25519.PublicKeySize, len(pubKeyBytes))
	}

	// Reconstruct the signed message: runtime_id + tenant_id + timestamp
	message := fmt.Sprintf("%s:%s:%d", hb.RuntimeID, hb.TenantID, hb.Timestamp)

	// Decode signature
	sigBytes, err := base64.StdEncoding.DecodeString(hb.Signature)
	if err != nil {
		return fmt.Errorf("invalid signature encoding: %w", err)
	}

	// Verify Ed25519 signature
	if !ed25519.Verify(ed25519.PublicKey(pubKeyBytes), []byte(message), sigBytes) {
		return fmt.Errorf("heartbeat Ed25519 signature verification failed")
	}

	return nil
}
