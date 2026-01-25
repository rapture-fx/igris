// Package security provides cryptographic utilities for the fleet system.
package security

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// Error definitions
var (
	ErrInvalidSignature = errors.New("invalid signature")
	ErrInvalidKeyLength = errors.New("invalid key length")
	ErrKeyNotFound      = errors.New("tenant key not found")
	ErrKeyExpired       = errors.New("tenant key has expired")
	ErrNonceReplay      = errors.New("nonce replay detected")
	ErrTimestampExpired = errors.New("timestamp outside valid window")
)

// TenantKeyManager manages Ed25519 keypairs for tenants
type TenantKeyManager struct {
	db              *sql.DB
	masterKey       []byte // 32-byte AES-256 key encryption key
	keyCache        map[string]*CachedKey
	cacheMu         sync.RWMutex
	cacheTTL        time.Duration
	timestampWindow time.Duration // Valid timestamp window (default ±5 minutes)
}

// CachedKey represents a cached tenant key
type CachedKey struct {
	PublicKey  ed25519.PublicKey
	PrivateKey ed25519.PrivateKey
	Version    int
	ExpiresAt  time.Time
	CachedAt   time.Time
}

// TenantKey represents a tenant's keypair stored in the database
type TenantKey struct {
	ID                  int64
	TenantID            string
	KeyVersion          int
	PublicKey           []byte
	EncryptedPrivateKey []byte
	EncryptionNonce     []byte
	KeyEncryptionKeyID  string
	Algorithm           string
	Purpose             string
	IsActive            bool
	ExpiresAt           *time.Time
	CreatedAt           time.Time
	RotatedAt           *time.Time
}

// SignedDecision represents a cryptographically signed routing decision
type SignedDecision struct {
	Decision   interface{} `json:"decision"`
	TenantID   string      `json:"tenant_id"`
	DecisionID string      `json:"decision_id"`
	Timestamp  int64       `json:"timestamp"`
	Nonce      string      `json:"nonce"`
	KeyVersion int         `json:"key_version"`
}

// SignedDecisionEnvelope contains the decision and its signature
type SignedDecisionEnvelope struct {
	Decision  SignedDecision `json:"decision"`
	Signature string         `json:"signature"` // Base64-encoded Ed25519 signature
}

// ExecutionEnvelope represents a signed execution result from Runtime
type ExecutionEnvelope struct {
	Result       interface{} `json:"result"`
	DecisionHash string      `json:"decision_hash"` // SHA-256 hash of signed decision
	AgentID      string      `json:"agent_id"`
	Timestamp    int64       `json:"timestamp"`
	Success      bool        `json:"success"`
	LatencyMs    int         `json:"latency_ms"`
	ProviderID   string      `json:"provider_id,omitempty"`
}

// SignedExecutionEnvelope contains execution result and signature
type SignedExecutionEnvelope struct {
	Envelope  ExecutionEnvelope `json:"envelope"`
	Signature string            `json:"signature"` // Base64-encoded signature from Runtime
}

// NewTenantKeyManager creates a new tenant key manager
func NewTenantKeyManager(db *sql.DB, masterKeyBase64 string) (*TenantKeyManager, error) {
	masterKey, err := base64.StdEncoding.DecodeString(masterKeyBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode master key: %w", err)
	}

	if len(masterKey) != 32 {
		return nil, fmt.Errorf("master key must be 32 bytes (AES-256)")
	}

	return &TenantKeyManager{
		db:              db,
		masterKey:       masterKey,
		keyCache:        make(map[string]*CachedKey),
		cacheTTL:        5 * time.Minute,
		timestampWindow: 5 * time.Minute,
	}, nil
}

// NewTenantKeyManagerFromEnv creates a key manager using environment variable for master key
func NewTenantKeyManagerFromEnv(db *sql.DB, masterKey []byte) (*TenantKeyManager, error) {
	if len(masterKey) != 32 {
		return nil, fmt.Errorf("master key must be 32 bytes (AES-256)")
	}

	return &TenantKeyManager{
		db:              db,
		masterKey:       masterKey,
		keyCache:        make(map[string]*CachedKey),
		cacheTTL:        5 * time.Minute,
		timestampWindow: 5 * time.Minute,
	}, nil
}

// GenerateKeyPair generates a new Ed25519 keypair for a tenant
func (m *TenantKeyManager) GenerateKeyPair(ctx context.Context, tenantID, purpose string) (*TenantKey, error) {
	// Generate new Ed25519 keypair
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate keypair: %w", err)
	}

	// Encrypt private key with AES-256-GCM
	block, err := aes.NewCipher(m.masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt private key (64 bytes for Ed25519)
	encryptedPrivateKey := gcm.Seal(nil, nonce, privateKey, nil)

	// Get next key version
	var currentVersion int
	err = m.db.QueryRowContext(ctx,
		"SELECT COALESCE(MAX(key_version), 0) FROM tenant_crypto_keys WHERE tenant_id = $1",
		tenantID,
	).Scan(&currentVersion)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get current version: %w", err)
	}

	// Start transaction
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Deactivate existing keys for this purpose
	_, err = tx.ExecContext(ctx,
		"UPDATE tenant_crypto_keys SET is_active = FALSE, rotated_at = NOW() WHERE tenant_id = $1 AND purpose = $2 AND is_active = TRUE",
		tenantID, purpose,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to deactivate existing keys: %w", err)
	}

	// Insert new key
	var keyID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO tenant_crypto_keys (
			tenant_id, key_version, public_key, encrypted_private_key,
			encryption_nonce, algorithm, purpose, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
		RETURNING id
	`, tenantID, currentVersion+1, []byte(publicKey), encryptedPrivateKey, nonce, "Ed25519", purpose).Scan(&keyID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert key: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit: %w", err)
	}

	// Invalidate cache
	m.cacheMu.Lock()
	delete(m.keyCache, m.cacheKey(tenantID, purpose))
	m.cacheMu.Unlock()

	log.Info().
		Str("tenant_id", tenantID).
		Str("purpose", purpose).
		Int("key_version", currentVersion+1).
		Msg("Generated new Ed25519 keypair for tenant")

	return &TenantKey{
		ID:                  keyID,
		TenantID:            tenantID,
		KeyVersion:          currentVersion + 1,
		PublicKey:           publicKey,
		EncryptedPrivateKey: encryptedPrivateKey,
		EncryptionNonce:     nonce,
		Algorithm:           "Ed25519",
		Purpose:             purpose,
		IsActive:            true,
		CreatedAt:           time.Now(),
	}, nil
}

// GetActiveKey retrieves the active key for a tenant
func (m *TenantKeyManager) GetActiveKey(ctx context.Context, tenantID, purpose string) (*CachedKey, error) {
	cacheKey := m.cacheKey(tenantID, purpose)

	// Check cache
	m.cacheMu.RLock()
	cached, ok := m.keyCache[cacheKey]
	m.cacheMu.RUnlock()

	if ok && time.Since(cached.CachedAt) < m.cacheTTL {
		if cached.ExpiresAt.IsZero() || time.Now().Before(cached.ExpiresAt) {
			return cached, nil
		}
	}

	// Load from database
	var key TenantKey
	var expiresAt sql.NullTime
	err := m.db.QueryRowContext(ctx, `
		SELECT id, key_version, public_key, encrypted_private_key, encryption_nonce, expires_at
		FROM tenant_crypto_keys
		WHERE tenant_id = $1 AND purpose = $2 AND is_active = TRUE
		ORDER BY key_version DESC
		LIMIT 1
	`, tenantID, purpose).Scan(&key.ID, &key.KeyVersion, &key.PublicKey, &key.EncryptedPrivateKey, &key.EncryptionNonce, &expiresAt)

	if err == sql.ErrNoRows {
		return nil, ErrKeyNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load key: %w", err)
	}

	if expiresAt.Valid {
		key.ExpiresAt = &expiresAt.Time
		if time.Now().After(expiresAt.Time) {
			return nil, ErrKeyExpired
		}
	}

	// Decrypt private key
	block, err := aes.NewCipher(m.masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	privateKey, err := gcm.Open(nil, key.EncryptionNonce, key.EncryptedPrivateKey, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt private key: %w", err)
	}

	cached = &CachedKey{
		PublicKey:  key.PublicKey,
		PrivateKey: privateKey,
		Version:    key.KeyVersion,
		CachedAt:   time.Now(),
	}
	if key.ExpiresAt != nil {
		cached.ExpiresAt = *key.ExpiresAt
	}

	// Update cache
	m.cacheMu.Lock()
	m.keyCache[cacheKey] = cached
	m.cacheMu.Unlock()

	return cached, nil
}

// GetOrCreateKey retrieves an active key or creates one if it doesn't exist
func (m *TenantKeyManager) GetOrCreateKey(ctx context.Context, tenantID, purpose string) (*CachedKey, error) {
	key, err := m.GetActiveKey(ctx, tenantID, purpose)
	if err == nil {
		return key, nil
	}

	if errors.Is(err, ErrKeyNotFound) {
		// Generate a new key
		tenantKey, err := m.GenerateKeyPair(ctx, tenantID, purpose)
		if err != nil {
			return nil, fmt.Errorf("failed to generate key: %w", err)
		}

		return m.GetActiveKey(ctx, tenantID, purpose)
		_ = tenantKey // avoid unused warning
	}

	return nil, err
}

// GetPublicKey retrieves only the public key for a tenant (no decryption needed)
func (m *TenantKeyManager) GetPublicKey(ctx context.Context, tenantID, purpose string, version int) (ed25519.PublicKey, error) {
	var publicKey []byte
	query := `
		SELECT public_key FROM tenant_crypto_keys
		WHERE tenant_id = $1 AND purpose = $2
	`
	args := []interface{}{tenantID, purpose}

	if version > 0 {
		query += " AND key_version = $3"
		args = append(args, version)
	} else {
		query += " AND is_active = TRUE"
	}

	err := m.db.QueryRowContext(ctx, query, args...).Scan(&publicKey)
	if err == sql.ErrNoRows {
		return nil, ErrKeyNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load public key: %w", err)
	}

	return publicKey, nil
}

// GetPublicKeyBase64 retrieves the base64-encoded public key for a tenant
func (m *TenantKeyManager) GetPublicKeyBase64(ctx context.Context, tenantID, purpose string) (string, int, error) {
	key, err := m.GetActiveKey(ctx, tenantID, purpose)
	if err != nil {
		return "", 0, err
	}
	return base64.StdEncoding.EncodeToString(key.PublicKey), key.Version, nil
}

// SignDecision signs a routing decision with the tenant's private key
func (m *TenantKeyManager) SignDecision(ctx context.Context, tenantID string, decision interface{}) (*SignedDecisionEnvelope, error) {
	key, err := m.GetOrCreateKey(ctx, tenantID, "decision_signing")
	if err != nil {
		return nil, fmt.Errorf("failed to get signing key: %w", err)
	}

	// Generate nonce
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}
	nonce := hex.EncodeToString(nonceBytes)

	// Create signed decision
	signedDecision := SignedDecision{
		Decision:   decision,
		TenantID:   tenantID,
		DecisionID: generateDecisionID(),
		Timestamp:  time.Now().Unix(),
		Nonce:      nonce,
		KeyVersion: key.Version,
	}

	// Serialize to JSON for signing
	decisionBytes, err := json.Marshal(signedDecision)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal decision: %w", err)
	}

	// Sign
	signature := ed25519.Sign(key.PrivateKey, decisionBytes)

	return &SignedDecisionEnvelope{
		Decision:  signedDecision,
		Signature: base64.StdEncoding.EncodeToString(signature),
	}, nil
}

// VerifyDecision verifies a signed decision envelope
func (m *TenantKeyManager) VerifyDecision(ctx context.Context, envelope *SignedDecisionEnvelope) error {
	// Get public key for the specified version
	publicKey, err := m.GetPublicKey(ctx, envelope.Decision.TenantID, "decision_signing", envelope.Decision.KeyVersion)
	if err != nil {
		return fmt.Errorf("failed to get public key: %w", err)
	}

	// Verify timestamp is within window
	decisionTime := time.Unix(envelope.Decision.Timestamp, 0)
	if time.Since(decisionTime).Abs() > m.timestampWindow {
		return ErrTimestampExpired
	}

	// Check nonce hasn't been used (anti-replay)
	if err := m.checkAndRecordNonce(ctx, envelope.Decision.Nonce, envelope.Decision.TenantID, envelope.Decision.DecisionID); err != nil {
		return err
	}

	// Decode signature
	signature, err := base64.StdEncoding.DecodeString(envelope.Signature)
	if err != nil {
		return fmt.Errorf("failed to decode signature: %w", err)
	}

	// Serialize decision for verification
	decisionBytes, err := json.Marshal(envelope.Decision)
	if err != nil {
		return fmt.Errorf("failed to marshal decision: %w", err)
	}

	// Verify signature
	if !ed25519.Verify(publicKey, decisionBytes, signature) {
		return ErrInvalidSignature
	}

	return nil
}

// VerifyExecutionEnvelope verifies a signed execution envelope from Runtime
func (m *TenantKeyManager) VerifyExecutionEnvelope(ctx context.Context, envelope *SignedExecutionEnvelope, runtimePublicKey string) error {
	// Decode Runtime's public key
	publicKeyBytes, err := base64.StdEncoding.DecodeString(runtimePublicKey)
	if err != nil {
		return fmt.Errorf("failed to decode runtime public key: %w", err)
	}

	if len(publicKeyBytes) != ed25519.PublicKeySize {
		return ErrInvalidKeyLength
	}

	// Decode signature
	signature, err := base64.StdEncoding.DecodeString(envelope.Signature)
	if err != nil {
		return fmt.Errorf("failed to decode signature: %w", err)
	}

	// Serialize envelope for verification
	envelopeBytes, err := json.Marshal(envelope.Envelope)
	if err != nil {
		return fmt.Errorf("failed to marshal envelope: %w", err)
	}

	// Verify signature
	if !ed25519.Verify(publicKeyBytes, envelopeBytes, signature) {
		return ErrInvalidSignature
	}

	return nil
}

// checkAndRecordNonce checks if a nonce has been used and records it
func (m *TenantKeyManager) checkAndRecordNonce(ctx context.Context, nonce, tenantID, decisionID string) error {
	expiresAt := time.Now().Add(m.timestampWindow * 2)

	// Try to insert nonce - will fail if already exists
	_, err := m.db.ExecContext(ctx, `
		INSERT INTO decision_nonces (nonce, tenant_id, decision_id, expires_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (nonce) DO NOTHING
	`, nonce, tenantID, decisionID, expiresAt)
	if err != nil {
		return fmt.Errorf("failed to record nonce: %w", err)
	}

	// Check if insertion happened (nonce was new)
	var count int
	err = m.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM decision_nonces WHERE nonce = $1 AND decision_id = $2",
		nonce, decisionID,
	).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to verify nonce: %w", err)
	}

	if count == 0 {
		return ErrNonceReplay
	}

	return nil
}

func (m *TenantKeyManager) cacheKey(tenantID, purpose string) string {
	return tenantID + ":" + purpose
}

func generateDecisionID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// HashDecision creates a SHA-256 hash of a decision for verification
func HashDecision(decision interface{}) (string, error) {
	data, err := json.Marshal(decision)
	if err != nil {
		return "", fmt.Errorf("failed to marshal decision: %w", err)
	}
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:]), nil
}

// CleanupExpiredNonces removes expired nonces from the database
func (m *TenantKeyManager) CleanupExpiredNonces(ctx context.Context) (int64, error) {
	result, err := m.db.ExecContext(ctx, "DELETE FROM decision_nonces WHERE expires_at < NOW()")
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup nonces: %w", err)
	}
	return result.RowsAffected()
}

// VerifyEd25519Signature verifies an Ed25519 signature against a public key and message
//
// Parameters:
//   - publicKeyBase64: Base64-encoded Ed25519 public key (32 bytes)
//   - signatureBase64: Base64-encoded Ed25519 signature (64 bytes)
//   - message: The original message that was signed
//
// Returns:
//   - error: nil if verification succeeds, error otherwise
func VerifyEd25519Signature(publicKeyBase64, signatureBase64 string, message []byte) error {
	// Decode base64 public key
	publicKeyBytes, err := base64.StdEncoding.DecodeString(publicKeyBase64)
	if err != nil {
		return fmt.Errorf("failed to decode public key: %w", err)
	}

	if len(publicKeyBytes) != ed25519.PublicKeySize {
		return fmt.Errorf("invalid public key length: expected %d bytes, got %d", ed25519.PublicKeySize, len(publicKeyBytes))
	}

	publicKey := ed25519.PublicKey(publicKeyBytes)

	// Decode base64 signature
	signatureBytes, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		return fmt.Errorf("failed to decode signature: %w", err)
	}

	if len(signatureBytes) != ed25519.SignatureSize {
		return fmt.Errorf("invalid signature length: expected %d bytes, got %d", ed25519.SignatureSize, len(signatureBytes))
	}

	// Verify signature
	if !ed25519.Verify(publicKey, message, signatureBytes) {
		return fmt.Errorf("signature verification failed")
	}

	return nil
}

// VerifyJSONPayloadSignature verifies a signature for a JSON payload
//
// This is a convenience function that serializes the payload to JSON (canonical form)
// and then verifies the signature.
//
// Parameters:
//   - publicKeyBase64: Base64-encoded Ed25519 public key
//   - signatureBase64: Base64-encoded Ed25519 signature
//   - payload: The JSON payload struct that was signed
//
// Returns:
//   - error: nil if verification succeeds, error otherwise
func VerifyJSONPayloadSignature(publicKeyBase64, signatureBase64 string, payload interface{}) error {
	// Serialize payload to JSON (same as what Runtime does)
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to serialize payload: %w", err)
	}

	// Verify signature
	return VerifyEd25519Signature(publicKeyBase64, signatureBase64, payloadBytes)
}
