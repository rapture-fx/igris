// Package security provides encryption and key management for BYOK vault (Phase 14)
//
// This module implements AES-256-GCM encryption for secure storage of tenant API keys,
// supporting both database persistence and in-memory fallback.
package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// KeyVault provides secure storage for tenant API keys using AES-256-GCM encryption
type KeyVault struct {
	db          *sql.DB
	masterKey   []byte // 32-byte master key for AES-256
	enabled     bool
	inMemoryKeys map[string]*EncryptedKey // Fallback for when DB is disabled
	mu          sync.RWMutex
	logger      *log.Logger
}

// EncryptedKey represents an encrypted API key
type EncryptedKey struct {
	ID            string
	TenantID      string
	Provider      string    // "openai", "anthropic", "benchmark"
	KeyName       string
	EncryptedKey  string    // Base64-encoded encrypted key
	IV            string    // Initialization vector
	Tag           string    // Authentication tag
	KeyVersion    int
	IsActive      bool
	IsValid       *bool
	LastValidated *time.Time
	LastUsed      *time.Time
	UsageCount    int64
	CreatedAt     time.Time
	CreatedBy     string
}

// DecryptedKey represents a decrypted API key (in memory only, never persisted)
type DecryptedKey struct {
	TenantID  string
	Provider  string
	KeyName   string
	PlainKey  string // The actual API key
	IsActive  bool
}

// MaskedKey represents a key with sensitive data masked
type MaskedKey struct {
	ID            string
	TenantID      string
	Provider      string
	KeyName       string
	MaskedKey     string // Only shows prefix and suffix (e.g., "sk-****abcd")
	IsActive      bool
	IsValid       *bool
	LastValidated *time.Time
	LastUsed      *time.Time
	UsageCount    int64
	CreatedAt     time.Time
}

// NewKeyVault creates a new key vault with the provided master key
// masterKey must be exactly 32 bytes for AES-256
func NewKeyVault(db *sql.DB, masterKeyHex string) (*KeyVault, error) {
	if masterKeyHex == "" {
		return nil, fmt.Errorf("VAULT_MASTER_KEY environment variable is required")
	}

	// Decode hex master key
	masterKey, err := hex.DecodeString(masterKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid master key format (expected hex): %w", err)
	}

	if len(masterKey) != 32 {
		return nil, fmt.Errorf("master key must be exactly 32 bytes (256 bits), got %d bytes", len(masterKey))
	}

	enabled := db != nil

	kv := &KeyVault{
		db:          db,
		masterKey:   masterKey,
		enabled:     enabled,
		inMemoryKeys: make(map[string]*EncryptedKey),
		logger:      log.Default(),
	}

	if enabled {
		log.Println("[KeyVault] Enabled with database persistence")
	} else {
		log.Println("[KeyVault] Using in-memory mode (no persistence)")
	}

	return kv, nil
}

// GenerateMasterKey generates a random 32-byte master key and returns it as hex string
// Use this to generate a new VAULT_MASTER_KEY for initial setup
func GenerateMasterKey() (string, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return "", fmt.Errorf("failed to generate master key: %w", err)
	}
	return hex.EncodeToString(key), nil
}

// StoreKey encrypts and stores an API key for a tenant
func (kv *KeyVault) StoreKey(tenantID, provider, keyName, plainKey, createdBy string) (*EncryptedKey, error) {
	kv.mu.Lock()
	defer kv.mu.Unlock()

	// Encrypt the key
	encryptedKey, iv, tag, err := kv.encrypt(plainKey)
	if err != nil {
		return nil, fmt.Errorf("encryption failed: %w", err)
	}

	// Encode to base64 for storage
	encryptedKeyB64 := base64.StdEncoding.EncodeToString(encryptedKey)
	ivB64 := base64.StdEncoding.EncodeToString(iv)
	tagB64 := base64.StdEncoding.EncodeToString(tag)

	if kv.enabled {
		// Store in database
		return kv.storeKeyDB(tenantID, provider, keyName, encryptedKeyB64, ivB64, tagB64, createdBy)
	}

	// Fallback to in-memory storage
	return kv.storeKeyMemory(tenantID, provider, keyName, encryptedKeyB64, ivB64, tagB64, createdBy)
}

// storeKeyDB stores encrypted key in database using the database function
func (kv *KeyVault) storeKeyDB(tenantID, provider, keyName, encryptedKey, iv, tag, createdBy string) (*EncryptedKey, error) {
	var keyID string
	err := kv.db.QueryRow(`
		SELECT store_tenant_key($1, $2, $3, $4, $5, $6, $7)
	`, tenantID, provider, keyName, encryptedKey, iv, tag, createdBy).Scan(&keyID)

	if err != nil {
		return nil, fmt.Errorf("failed to store key in database: %w", err)
	}

	// Return the stored key
	return kv.getKeyByIDDB(keyID)
}

// storeKeyMemory stores encrypted key in memory
func (kv *KeyVault) storeKeyMemory(tenantID, provider, keyName, encryptedKey, iv, tag, createdBy string) (*EncryptedKey, error) {
	id := uuid.New().String()
	key := &EncryptedKey{
		ID:           id,
		TenantID:     tenantID,
		Provider:     provider,
		KeyName:      keyName,
		EncryptedKey: encryptedKey,
		IV:           iv,
		Tag:          tag,
		KeyVersion:   1,
		IsActive:     true,
		CreatedAt:    time.Now(),
		CreatedBy:    createdBy,
	}

	// Store with composite key
	mapKey := fmt.Sprintf("%s:%s:%s", tenantID, provider, keyName)
	kv.inMemoryKeys[mapKey] = key

	kv.logger.Printf("[KeyVault] Stored key in memory: tenant=%s provider=%s", tenantID, provider)
	return key, nil
}

// GetKey retrieves and decrypts an API key for a tenant
func (kv *KeyVault) GetKey(tenantID, provider string) (*DecryptedKey, error) {
	kv.mu.RLock()
	defer kv.mu.RUnlock()

	var encKey *EncryptedKey
	var err error

	if kv.enabled {
		encKey, err = kv.getActiveKeyDB(tenantID, provider)
	} else {
		encKey, err = kv.getActiveKeyMemory(tenantID, provider)
	}

	if err != nil {
		return nil, err
	}

	// Decrypt the key
	plainKey, err := kv.decryptKey(encKey)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}

	// Update usage tracking (async, non-blocking)
	go kv.trackKeyUsage(encKey.ID, tenantID, provider)

	return &DecryptedKey{
		TenantID:  encKey.TenantID,
		Provider:  encKey.Provider,
		KeyName:   encKey.KeyName,
		PlainKey:  plainKey,
		IsActive:  encKey.IsActive,
	}, nil
}

// getActiveKeyDB retrieves the active key from database
func (kv *KeyVault) getActiveKeyDB(tenantID, provider string) (*EncryptedKey, error) {
	var key EncryptedKey
	var isValid sql.NullBool
	var lastValidated, lastUsed sql.NullTime

	err := kv.db.QueryRow(`
		SELECT id, tenant_id, provider, key_name, encrypted_key, encryption_iv,
		       encryption_tag, key_version, is_active, is_valid, last_validated_at,
		       last_used_at, usage_count, created_at, created_by
		FROM tenant_keys
		WHERE tenant_id = $1 AND provider = $2 AND is_active = TRUE
		ORDER BY created_at DESC
		LIMIT 1
	`, tenantID, provider).Scan(
		&key.ID, &key.TenantID, &key.Provider, &key.KeyName,
		&key.EncryptedKey, &key.IV, &key.Tag, &key.KeyVersion,
		&key.IsActive, &isValid, &lastValidated, &lastUsed,
		&key.UsageCount, &key.CreatedAt, &key.CreatedBy,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("no active key found for tenant %s provider %s", tenantID, provider)
	}
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}

	if isValid.Valid {
		val := isValid.Bool
		key.IsValid = &val
	}
	if lastValidated.Valid {
		key.LastValidated = &lastValidated.Time
	}
	if lastUsed.Valid {
		key.LastUsed = &lastUsed.Time
	}

	return &key, nil
}

// getActiveKeyMemory retrieves the active key from memory
func (kv *KeyVault) getActiveKeyMemory(tenantID, provider string) (*EncryptedKey, error) {
	// Try exact match first
	for _, keyName := range []string{"default", "primary", "main"} {
		mapKey := fmt.Sprintf("%s:%s:%s", tenantID, provider, keyName)
		if key, ok := kv.inMemoryKeys[mapKey]; ok && key.IsActive {
			return key, nil
		}
	}

	// Fall back to any active key for this tenant/provider
	prefix := fmt.Sprintf("%s:%s:", tenantID, provider)
	for k, key := range kv.inMemoryKeys {
		if strings.HasPrefix(k, prefix) && key.IsActive {
			return key, nil
		}
	}

	return nil, fmt.Errorf("no active key found for tenant %s provider %s", tenantID, provider)
}

// getKeyByIDDB retrieves a key by ID from database
func (kv *KeyVault) getKeyByIDDB(id string) (*EncryptedKey, error) {
	var key EncryptedKey
	var isValid sql.NullBool
	var lastValidated, lastUsed sql.NullTime

	err := kv.db.QueryRow(`
		SELECT id, tenant_id, provider, key_name, encrypted_key, encryption_iv,
		       encryption_tag, key_version, is_active, is_valid, last_validated_at,
		       last_used_at, usage_count, created_at, created_by
		FROM tenant_keys
		WHERE id = $1
	`, id).Scan(
		&key.ID, &key.TenantID, &key.Provider, &key.KeyName,
		&key.EncryptedKey, &key.IV, &key.Tag, &key.KeyVersion,
		&key.IsActive, &isValid, &lastValidated, &lastUsed,
		&key.UsageCount, &key.CreatedAt, &key.CreatedBy,
	)

	if err != nil {
		return nil, err
	}

	if isValid.Valid {
		val := isValid.Bool
		key.IsValid = &val
	}
	if lastValidated.Valid {
		key.LastValidated = &lastValidated.Time
	}
	if lastUsed.Valid {
		key.LastUsed = &lastUsed.Time
	}

	return &key, nil
}

// ListKeys returns all keys for a tenant (masked for security)
func (kv *KeyVault) ListKeys(tenantID string) ([]*MaskedKey, error) {
	kv.mu.RLock()
	defer kv.mu.RUnlock()

	if kv.enabled {
		return kv.listKeysDB(tenantID)
	}
	return kv.listKeysMemory(tenantID)
}

// listKeysDB retrieves keys from database
func (kv *KeyVault) listKeysDB(tenantID string) ([]*MaskedKey, error) {
	rows, err := kv.db.Query(`
		SELECT id, tenant_id, provider, key_name, encrypted_key,
		       is_active, is_valid, last_validated_at, last_used_at,
		       usage_count, created_at
		FROM tenant_keys
		WHERE tenant_id = $1
		ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []*MaskedKey
	for rows.Next() {
		var key MaskedKey
		var encryptedKey string
		var isValid sql.NullBool
		var lastValidated, lastUsed sql.NullTime

		err := rows.Scan(
			&key.ID, &key.TenantID, &key.Provider, &key.KeyName,
			&encryptedKey, &key.IsActive, &isValid, &lastValidated,
			&lastUsed, &key.UsageCount, &key.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Mask the key
		key.MaskedKey = maskKey(encryptedKey)

		if isValid.Valid {
			val := isValid.Bool
			key.IsValid = &val
		}
		if lastValidated.Valid {
			key.LastValidated = &lastValidated.Time
		}
		if lastUsed.Valid {
			key.LastUsed = &lastUsed.Time
		}

		keys = append(keys, &key)
	}

	return keys, nil
}

// listKeysMemory retrieves keys from memory
func (kv *KeyVault) listKeysMemory(tenantID string) ([]*MaskedKey, error) {
	var keys []*MaskedKey
	prefix := tenantID + ":"

	for k, encKey := range kv.inMemoryKeys {
		if strings.HasPrefix(k, prefix) {
			keys = append(keys, &MaskedKey{
				ID:         encKey.ID,
				TenantID:   encKey.TenantID,
				Provider:   encKey.Provider,
				KeyName:    encKey.KeyName,
				MaskedKey:  maskKey(encKey.EncryptedKey),
				IsActive:   encKey.IsActive,
				IsValid:    encKey.IsValid,
				LastUsed:   encKey.LastUsed,
				UsageCount: encKey.UsageCount,
				CreatedAt:  encKey.CreatedAt,
			})
		}
	}

	return keys, nil
}

// DeleteKey removes a key from the vault
func (kv *KeyVault) DeleteKey(tenantID, provider string) error {
	kv.mu.Lock()
	defer kv.mu.Unlock()

	if kv.enabled {
		_, err := kv.db.Exec(`
			DELETE FROM tenant_keys
			WHERE tenant_id = $1 AND provider = $2
		`, tenantID, provider)
		return err
	}

	// Delete from memory
	prefix := fmt.Sprintf("%s:%s:", tenantID, provider)
	for k := range kv.inMemoryKeys {
		if strings.HasPrefix(k, prefix) {
			delete(kv.inMemoryKeys, k)
		}
	}

	return nil
}

// encrypt encrypts plaintext using AES-256-GCM
func (kv *KeyVault) encrypt(plaintext string) (ciphertext, iv, tag []byte, err error) {
	block, err := aes.NewCipher(kv.masterKey)
	if err != nil {
		return nil, nil, nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, nil, err
	}

	// Generate random IV
	iv = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, nil, nil, err
	}

	// Encrypt and authenticate
	sealed := gcm.Seal(nil, iv, []byte(plaintext), nil)

	// GCM appends the tag to the ciphertext, extract it
	tagSize := gcm.Overhead()
	if len(sealed) < tagSize {
		return nil, nil, nil, fmt.Errorf("sealed data too short")
	}

	ciphertext = sealed[:len(sealed)-tagSize]
	tag = sealed[len(sealed)-tagSize:]

	return ciphertext, iv, tag, nil
}

// decryptKey decrypts an encrypted key
func (kv *KeyVault) decryptKey(encKey *EncryptedKey) (string, error) {
	// Decode from base64
	ciphertext, err := base64.StdEncoding.DecodeString(encKey.EncryptedKey)
	if err != nil {
		return "", fmt.Errorf("invalid ciphertext encoding: %w", err)
	}

	iv, err := base64.StdEncoding.DecodeString(encKey.IV)
	if err != nil {
		return "", fmt.Errorf("invalid IV encoding: %w", err)
	}

	tag, err := base64.StdEncoding.DecodeString(encKey.Tag)
	if err != nil {
		return "", fmt.Errorf("invalid tag encoding: %w", err)
	}

	// Reconstruct sealed data (ciphertext + tag)
	sealed := append(ciphertext, tag...)

	// Decrypt
	block, err := aes.NewCipher(kv.masterKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	plaintext, err := gcm.Open(nil, iv, sealed, nil)
	if err != nil {
		return "", fmt.Errorf("decryption failed (wrong key or corrupted data): %w", err)
	}

	return string(plaintext), nil
}

// trackKeyUsage updates key usage statistics
func (kv *KeyVault) trackKeyUsage(keyID, tenantID, provider string) {
	if !kv.enabled {
		return
	}

	_, err := kv.db.Exec(`
		UPDATE tenant_keys
		SET last_used_at = NOW(), usage_count = usage_count + 1
		WHERE id = $1
	`, keyID)

	if err != nil {
		kv.logger.Printf("[KeyVault] Failed to track key usage: %v", err)
	}
}

// maskKey masks a key for display (shows only prefix and suffix)
func maskKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	prefix := key[:4]
	suffix := key[len(key)-4:]
	return fmt.Sprintf("%s****%s", prefix, suffix)
}

// HashAPIKey creates a SHA256 hash of an API key for storage
func HashAPIKey(apiKey string) string {
	hash := sha256.Sum256([]byte(apiKey))
	return hex.EncodeToString(hash[:])
}

// GetAPIKeyPrefix extracts the first 8 characters of an API key for identification
func GetAPIKeyPrefix(apiKey string) string {
	if len(apiKey) >= 8 {
		return apiKey[:8]
	}
	return apiKey
}

// IsEnabled returns whether the vault is using database persistence
func (kv *KeyVault) IsEnabled() bool {
	return kv.enabled
}
