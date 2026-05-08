// Package security provides encryption and key management for BYOK vault (Phase 14)
//
// This module implements AES-256-GCM encryption for secure storage of tenant API keys,
// supporting both database persistence and in-memory fallback.
package security

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// validationCacheEntry holds a cached provider validation result.
// FIX-2026-02: byok — validation cache entry (keyed by "tenantID:provider")
type validationCacheEntry struct {
	IsValid   bool
	CachedAt  time.Time
}

// KeyVault provides secure storage for tenant API keys using AES-256-GCM encryption
type KeyVault struct {
	db          *sql.DB
	masterKey   []byte // 32-byte master key for AES-256
	enabled     bool
	inMemoryKeys map[string]*EncryptedKey // Fallback for when DB is disabled
	mu          sync.RWMutex
	logger      *log.Logger

	// FIX-2026-02: byok — provider validation cache (1h TTL, keyed by "tenantID:provider")
	validationCache    map[string]validationCacheEntry
	validationCacheMu  sync.RWMutex
	httpClient         *http.Client
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
		db:           db,
		masterKey:    masterKey,
		enabled:      enabled,
		inMemoryKeys: make(map[string]*EncryptedKey),
		logger:       log.Default(),
		// FIX-2026-02: byok — initialise validation cache and HTTP client
		validationCache: make(map[string]validationCacheEntry),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
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

// GetKeyByID retrieves and decrypts a key by its vault ID.
// Used when a provider references a specific key_id instead of looking up by provider name.
func (kv *KeyVault) GetKeyByID(id string) (*DecryptedKey, error) {
	kv.mu.RLock()
	defer kv.mu.RUnlock()

	encKey, err := kv.getKeyByIDDB(id)
	if err != nil {
		return nil, fmt.Errorf("key not found: %w", err)
	}

	plainKey, err := kv.decryptKey(encKey)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}

	go kv.trackKeyUsage(encKey.ID, encKey.TenantID, encKey.Provider)

	return &DecryptedKey{
		TenantID: encKey.TenantID,
		Provider: encKey.Provider,
		KeyName:  encKey.KeyName,
		PlainKey: plainKey,
		IsActive: encKey.IsActive,
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

// RotateKey creates a new version of a key and deactivates the old one
// This calls the rotate_tenant_key stored procedure
func (kv *KeyVault) RotateKey(tenantID, provider, keyName, newPlainKey, rotatedBy string) (*EncryptedKey, error) {
	kv.mu.Lock()
	defer kv.mu.Unlock()

	// Encrypt the new key
	encryptedKey, iv, tag, err := kv.encrypt(newPlainKey)
	if err != nil {
		return nil, fmt.Errorf("encryption failed: %w", err)
	}

	// Encode to base64
	encryptedKeyB64 := base64.StdEncoding.EncodeToString(encryptedKey)
	ivB64 := base64.StdEncoding.EncodeToString(iv)
	tagB64 := base64.StdEncoding.EncodeToString(tag)

	if kv.enabled {
		// Use database rotation procedure
		var newKeyID string
		err := kv.db.QueryRow(`
			SELECT rotate_tenant_key($1, $2, $3, $4, $5, $6, $7)
		`, tenantID, provider, keyName, encryptedKeyB64, ivB64, tagB64, rotatedBy).Scan(&newKeyID)

		if err != nil {
			return nil, fmt.Errorf("failed to rotate key: %w", err)
		}

		kv.logger.Printf("[KeyVault] Rotated key: tenant=%s provider=%s name=%s", tenantID, provider, keyName)
		return kv.getKeyByIDDB(newKeyID)
	}

	// In-memory rotation
	mapKey := fmt.Sprintf("%s:%s:%s", tenantID, provider, keyName)
	oldKey, exists := kv.inMemoryKeys[mapKey]
	if !exists {
		return nil, fmt.Errorf("no key found to rotate: tenant=%s provider=%s name=%s", tenantID, provider, keyName)
	}

	// Create new key with incremented version
	newKey := &EncryptedKey{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Provider:     provider,
		KeyName:      keyName,
		EncryptedKey: encryptedKeyB64,
		IV:           ivB64,
		Tag:          tagB64,
		KeyVersion:   oldKey.KeyVersion + 1,
		IsActive:     true,
		CreatedAt:    time.Now(),
		CreatedBy:    rotatedBy,
	}

	// Deactivate old key
	oldKey.IsActive = false

	// Store new key
	kv.inMemoryKeys[mapKey] = newKey

	kv.logger.Printf("[KeyVault] Rotated key in memory: tenant=%s provider=%s (v%d → v%d)",
		tenantID, provider, oldKey.KeyVersion, newKey.KeyVersion)

	return newKey, nil
}

// ValidateKey validates a key with the provider's API
// Returns (isValid, error). If error is nil, isValid indicates validation result.
func (kv *KeyVault) ValidateKey(tenantID, provider string) (bool, error) {
	kv.mu.RLock()
	defer kv.mu.RUnlock()

	// Get the active key
	var encKey *EncryptedKey
	var err error

	if kv.enabled {
		encKey, err = kv.getActiveKeyDB(tenantID, provider)
	} else {
		encKey, err = kv.getActiveKeyMemory(tenantID, provider)
	}

	if err != nil {
		return false, fmt.Errorf("failed to retrieve key: %w", err)
	}

	// Decrypt the key
	plainKey, err := kv.decryptKey(encKey)
	if err != nil {
		return false, fmt.Errorf("failed to decrypt key: %w", err)
	}

	// FIX-2026-02: byok — check validation cache (1h TTL) before calling provider API
	cacheKey := tenantID + ":" + provider
	kv.validationCacheMu.RLock()
	entry, cached := kv.validationCache[cacheKey]
	kv.validationCacheMu.RUnlock()
	if cached && time.Since(entry.CachedAt) < time.Hour {
		kv.logger.Printf("[KeyVault] Validation cache hit: tenant=%s provider=%s valid=%v", tenantID, provider, entry.IsValid)
		return entry.IsValid, nil
	}

	// Validate with provider via real HTTP call
	isValid, validationErr := kv.validateWithProvider(provider, plainKey)

	// FIX-2026-02: byok — store result in cache (only cache definitive results)
	if validationErr == nil {
		kv.validationCacheMu.Lock()
		kv.validationCache[cacheKey] = validationCacheEntry{IsValid: isValid, CachedAt: time.Now()}
		kv.validationCacheMu.Unlock()
	}

	// Update validation status in database
	if kv.enabled {
		var validationErrText sql.NullString
		if validationErr != nil {
			validationErrText = sql.NullString{String: validationErr.Error(), Valid: true}
		}

		_, err := kv.db.Exec(`
			SELECT mark_key_validated($1, $2, $3)
		`, encKey.ID, isValid, validationErrText)

		if err != nil {
			kv.logger.Printf("[KeyVault] Failed to update validation status: %v", err)
		}
	} else {
		// Update in-memory
		now := time.Now()
		encKey.IsValid = &isValid
		encKey.LastValidated = &now
	}

	kv.logger.Printf("[KeyVault] Validated key: tenant=%s provider=%s valid=%v",
		tenantID, provider, isValid)

	if validationErr != nil {
		return false, validationErr
	}

	return isValid, nil
}

// validateWithProvider performs real HTTP validation against the provider's API.
// FIX-2026-02: byok — replaced prefix-only stubs with actual provider API calls.
// Results are cached for 1 hour to avoid hammering provider rate limits.
func (kv *KeyVault) validateWithProvider(provider, apiKey string) (bool, error) {
	switch provider {
	case "openai":
		// FIX-2026-02: byok — real OpenAI validation via GET /v1/models
		if !strings.HasPrefix(apiKey, "sk-") {
			return false, fmt.Errorf("invalid OpenAI key format (expected sk-* prefix)")
		}
		return kv.validateOpenAI(apiKey)

	case "anthropic":
		// FIX-2026-02: byok — real Anthropic validation via POST /v1/messages
		if !strings.HasPrefix(apiKey, "sk-ant-") {
			return false, fmt.Errorf("invalid Anthropic key format (expected sk-ant-* prefix)")
		}
		return kv.validateAnthropic(apiKey)

	case "xai":
		return kv.validateOpenAICompatibleKey("xAI", "https://api.x.ai/v1", "grok-4", apiKey)

	case "groq":
		return kv.validateOpenAICompatibleKey("Groq", "https://api.groq.com/openai/v1", "llama3-70b-8192", apiKey)

	case "qwen":
		return kv.validateOpenAICompatibleKey("Qwen", "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus", apiKey)

	case "kimi", "moonshot":
		return kv.validateOpenAICompatibleKey("Kimi", "https://api.moonshot.ai/v1", "kimi-k2-0711-preview", apiKey)

	case "glm", "zai":
		return kv.validateOpenAICompatibleKey("GLM", "https://open.bigmodel.cn/api/paas/v4", "glm-5", apiKey)

	case "deepseek":
		return kv.validateOpenAICompatibleKey("DeepSeek", "https://api.deepseek.com", "deepseek-v4-flash", apiKey)

	case "mistral":
		return kv.validateOpenAICompatibleKey("Mistral", "https://api.mistral.ai/v1", "mistral-large-latest", apiKey)

	case "google", "google_gemini", "cohere", "azure", "custom":
		// Basic length check (no public key-validation endpoint available without auth scope)
		if len(apiKey) < 10 {
			return false, fmt.Errorf("key appears to be too short")
		}
		return true, nil

	case "benchmark":
		return true, nil

	default:
		return false, fmt.Errorf("unknown provider: %s", provider)
	}
}

// validateOpenAI validates an OpenAI key by calling GET /v1/models.
// A 200 or 429 (rate-limited) response means the key is valid.
// FIX-2026-02: byok — real HTTP call to OpenAI.
func (kv *KeyVault) validateOpenAI(apiKey string) (bool, error) {
	req, err := http.NewRequest(http.MethodGet, "https://api.openai.com/v1/models", nil)
	if err != nil {
		return false, fmt.Errorf("failed to build OpenAI request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := kv.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("OpenAI validation request failed: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK, http.StatusTooManyRequests:
		return true, nil // 429 = valid key, just rate-limited
	case http.StatusUnauthorized, http.StatusForbidden:
		return false, nil
	default:
		return false, fmt.Errorf("OpenAI validation returned unexpected status %d", resp.StatusCode)
	}
}

func (kv *KeyVault) validateOpenAICompatibleKey(providerName, baseURL, model, apiKey string) (bool, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "user", "content": "hi"},
		},
		"max_tokens": 1,
	})

	req, err := http.NewRequest(http.MethodPost, strings.TrimSuffix(baseURL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return false, fmt.Errorf("failed to build %s request: %w", providerName, err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("content-type", "application/json")

	resp, err := kv.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("%s validation request failed: %w", providerName, err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK, http.StatusTooManyRequests:
		return true, nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return false, nil
	default:
		return false, fmt.Errorf("%s validation returned unexpected status %d", providerName, resp.StatusCode)
	}
}

// validateAnthropic validates an Anthropic key by sending a minimal messages request.
// FIX-2026-02: byok — real HTTP call to Anthropic /v1/messages with minimal tokens.
func (kv *KeyVault) validateAnthropic(apiKey string) (bool, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"model":      "claude-haiku-4-5-20251001",
		"max_tokens": 1,
		"messages": []map[string]string{
			{"role": "user", "content": "hi"},
		},
	})

	req, err := http.NewRequest(http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return false, fmt.Errorf("failed to build Anthropic request: %w", err)
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := kv.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("Anthropic validation request failed: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK, http.StatusTooManyRequests:
		return true, nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return false, nil
	default:
		return false, fmt.Errorf("Anthropic validation returned unexpected status %d", resp.StatusCode)
	}
}

// validateXAI validates an xAI API key via POST /v1/chat/completions.
// FIX-2026-02: byok — real HTTP call to xAI.
func (kv *KeyVault) validateXAI(apiKey string) (bool, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"model": "grok-beta",
		"messages": []map[string]string{
			{"role": "user", "content": "hi"},
		},
		"max_tokens": 1,
	})

	req, err := http.NewRequest(http.MethodPost, "https://api.x.ai/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return false, fmt.Errorf("failed to build xAI request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("content-type", "application/json")

	resp, err := kv.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("xAI validation request failed: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK, http.StatusTooManyRequests:
		return true, nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return false, nil
	default:
		return false, fmt.Errorf("xAI validation returned unexpected status %d", resp.StatusCode)
	}
}

// ExpireKey marks a key as expired and deactivates it
func (kv *KeyVault) ExpireKey(tenantID, provider, keyName, expiredBy string) error {
	kv.mu.Lock()
	defer kv.mu.Unlock()

	if kv.enabled {
		// Get the active key ID first
		var keyID string
		err := kv.db.QueryRow(`
			SELECT id FROM tenant_keys
			WHERE tenant_id = $1 AND provider = $2 AND key_name = $3 AND is_active = TRUE
			LIMIT 1
		`, tenantID, provider, keyName).Scan(&keyID)

		if err == sql.ErrNoRows {
			return fmt.Errorf("no active key found: tenant=%s provider=%s name=%s", tenantID, provider, keyName)
		}
		if err != nil {
			return fmt.Errorf("failed to find key: %w", err)
		}

		// Call expire procedure
		_, err = kv.db.Exec(`
			SELECT expire_tenant_key($1, $2)
		`, keyID, expiredBy)

		if err != nil {
			return fmt.Errorf("failed to expire key: %w", err)
		}

		kv.logger.Printf("[KeyVault] Expired key: tenant=%s provider=%s name=%s", tenantID, provider, keyName)
		return nil
	}

	// In-memory expiration
	mapKey := fmt.Sprintf("%s:%s:%s", tenantID, provider, keyName)
	key, exists := kv.inMemoryKeys[mapKey]
	if !exists {
		return fmt.Errorf("no key found: tenant=%s provider=%s name=%s", tenantID, provider, keyName)
	}

	key.IsActive = false
	// Note: EncryptedKey struct doesn't have ExpiresAt, would need to add it
	// For now, just deactivate

	kv.logger.Printf("[KeyVault] Expired key in memory: tenant=%s provider=%s name=%s", tenantID, provider, keyName)
	return nil
}
