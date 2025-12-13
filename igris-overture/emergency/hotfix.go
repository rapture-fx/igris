package emergency

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// EmergencyPolicy represents a signed policy blob that can be pushed during outages
//
// This allows us to update routing policies even when the control plane is completely dead.
// The policy is signed with Ed25519 to prevent tampering.
type EmergencyPolicy struct {
	// Encrypted policy blob (same format as Bayesian cache)
	EncryptedPolicy string `json:"policy"`

	// Ed25519 signature of the policy blob
	Signature string `json:"signature"`

	// Version number (monotonically increasing)
	Version uint64 `json:"version"`

	// Expiration timestamp (Unix milliseconds)
	ExpiresAt int64 `json:"expires_at"`

	// Issuer (for audit trail)
	Issuer string `json:"issuer,omitempty"`

	// Reason (for audit trail)
	Reason string `json:"reason,omitempty"`
}

// PolicyStore manages emergency policy blobs
type PolicyStore struct {
	mu            sync.RWMutex
	currentPolicy *EmergencyPolicy
	publicKey     ed25519.PublicKey
	lastUpdated   time.Time
}

// NewPolicyStore creates a new emergency policy store
//
// The publicKey is used to verify signatures on incoming policies
func NewPolicyStore(publicKeyBase64 string) (*PolicyStore, error) {
	publicKeyBytes, err := base64.StdEncoding.DecodeString(publicKeyBase64)
	if err != nil {
		return nil, fmt.Errorf("invalid public key: %w", err)
	}

	if len(publicKeyBytes) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("public key must be %d bytes", ed25519.PublicKeySize)
	}

	return &PolicyStore{
		publicKey: ed25519.PublicKey(publicKeyBytes),
	}, nil
}

// UpdatePolicy updates the current emergency policy
//
// Returns an error if:
// - Signature verification fails
// - Policy has expired
// - Version is not newer than current
func (ps *PolicyStore) UpdatePolicy(policy *EmergencyPolicy) error {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	// Verify expiration
	now := time.Now().UnixMilli()
	if policy.ExpiresAt < now {
		return fmt.Errorf("policy expired at %d (current: %d)", policy.ExpiresAt, now)
	}

	// Verify version is newer
	if ps.currentPolicy != nil && policy.Version <= ps.currentPolicy.Version {
		return fmt.Errorf("policy version %d is not newer than current %d",
			policy.Version, ps.currentPolicy.Version)
	}

	// Decode signature
	signatureBytes, err := base64.StdEncoding.DecodeString(policy.Signature)
	if err != nil {
		return fmt.Errorf("invalid signature encoding: %w", err)
	}

	// Verify Ed25519 signature
	message := []byte(policy.EncryptedPolicy)
	if !ed25519.Verify(ps.publicKey, message, signatureBytes) {
		return fmt.Errorf("signature verification failed - policy may be tampered")
	}

	// Store policy
	ps.currentPolicy = policy
	ps.lastUpdated = time.Now()

	return nil
}

// GetPolicy returns the current emergency policy
//
// Returns nil if no policy is set or if the policy has expired
func (ps *PolicyStore) GetPolicy() *EmergencyPolicy {
	ps.mu.RLock()
	defer ps.mu.RUnlock()

	if ps.currentPolicy == nil {
		return nil
	}

	// Check expiration
	now := time.Now().UnixMilli()
	if ps.currentPolicy.ExpiresAt < now {
		return nil
	}

	return ps.currentPolicy
}

// GetPolicySince returns the policy if it's newer than the given version
//
// This is used by SDKs to poll for updates
func (ps *PolicyStore) GetPolicySince(version uint64) *EmergencyPolicy {
	ps.mu.RLock()
	defer ps.mu.RUnlock()

	if ps.currentPolicy == nil {
		return nil
	}

	// Check expiration
	now := time.Now().UnixMilli()
	if ps.currentPolicy.ExpiresAt < now {
		return nil
	}

	// Return policy if newer
	if ps.currentPolicy.Version > version {
		return ps.currentPolicy
	}

	return nil
}

// GetMetrics returns metrics about the policy store
func (ps *PolicyStore) GetMetrics() map[string]interface{} {
	ps.mu.RLock()
	defer ps.mu.RUnlock()

	metrics := map[string]interface{}{
		"has_policy":    ps.currentPolicy != nil,
		"last_updated":  ps.lastUpdated.Unix(),
	}

	if ps.currentPolicy != nil {
		metrics["current_version"] = ps.currentPolicy.Version
		metrics["expires_at"] = ps.currentPolicy.ExpiresAt
		metrics["issuer"] = ps.currentPolicy.Issuer
		metrics["reason"] = ps.currentPolicy.Reason
	}

	return metrics
}

// SignPolicy signs a policy blob with the given private key
//
// This is a utility function for the CLI tool
func SignPolicy(policy string, privateKey ed25519.PrivateKey, version uint64, expiresAt int64, issuer, reason string) (*EmergencyPolicy, error) {
	// Sign the policy
	message := []byte(policy)
	signature := ed25519.Sign(privateKey, message)

	return &EmergencyPolicy{
		EncryptedPolicy: policy,
		Signature:       base64.StdEncoding.EncodeToString(signature),
		Version:         version,
		ExpiresAt:       expiresAt,
		Issuer:          issuer,
		Reason:          reason,
	}, nil
}

// GenerateKeyPair generates a new Ed25519 key pair for signing emergency policies
//
// Returns (publicKey, privateKey) as base64-encoded strings
func GenerateKeyPair() (string, string, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate key pair: %w", err)
	}

	publicKeyBase64 := base64.StdEncoding.EncodeToString(publicKey)
	privateKeyBase64 := base64.StdEncoding.EncodeToString(privateKey)

	return publicKeyBase64, privateKeyBase64, nil
}

// SerializePolicy serializes an emergency policy to JSON
func SerializePolicy(policy *EmergencyPolicy) ([]byte, error) {
	return json.Marshal(policy)
}

// DeserializePolicy deserializes an emergency policy from JSON
func DeserializePolicy(data []byte) (*EmergencyPolicy, error) {
	var policy EmergencyPolicy
	if err := json.Unmarshal(data, &policy); err != nil {
		return nil, fmt.Errorf("failed to deserialize policy: %w", err)
	}
	return &policy, nil
}
