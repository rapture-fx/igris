package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"sync"
	"time"
)

// KeyRotationManager handles master key rotation for the KeyVault
// Enhancement: Enables zero-downtime master key rotation with dual-key operation
type KeyRotationManager struct {
	db              *sql.DB
	logger          *log.Logger
	mu              sync.RWMutex

	// Dual-key operation during rotation
	currentKey      []byte
	previousKey     []byte
	currentKeyID    string
	previousKeyID   string
	rotationStarted time.Time

	// Configuration
	rotationPeriod  time.Duration
	gracePeriod     time.Duration // How long to keep previous key after rotation
}

// NewKeyRotationManager creates a new key rotation manager
func NewKeyRotationManager(db *sql.DB, currentKeyHex, currentKeyID string) (*KeyRotationManager, error) {
	currentKey, err := hex.DecodeString(currentKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid current key: %w", err)
	}

	if len(currentKey) != 32 {
		return nil, fmt.Errorf("current key must be 32 bytes, got %d", len(currentKey))
	}

	krm := &KeyRotationManager{
		db:             db,
		logger:         log.Default(),
		currentKey:     currentKey,
		currentKeyID:   currentKeyID,
		rotationPeriod: 90 * 24 * time.Hour, // Rotate every 90 days
		gracePeriod:    7 * 24 * time.Hour,  // Keep old key for 7 days
	}

	// Load rotation state from database if available
	if db != nil {
		if err := krm.loadRotationState(); err != nil {
			krm.logger.Printf("[KeyRotation] Warning: Could not load rotation state: %v", err)
		}
	}

	return krm, nil
}

// RotateMasterKey generates a new master key and begins rotation
// This is a phased rotation:
// 1. Generate new key
// 2. Re-encrypt all stored keys with new master key
// 3. Mark old key as previous (dual-key mode)
// 4. After grace period, remove old key
func (krm *KeyRotationManager) RotateMasterKey() (newKeyHex string, newKeyID string, err error) {
	krm.mu.Lock()
	defer krm.mu.Unlock()

	// Generate new master key
	newKey := make([]byte, 32)
	if _, err := rand.Read(newKey); err != nil {
		return "", "", fmt.Errorf("failed to generate new master key: %w", err)
	}

	newKeyHex = hex.EncodeToString(newKey)
	newKeyID = fmt.Sprintf("key_%d", time.Now().Unix())

	krm.logger.Printf("[KeyRotation] Starting master key rotation: %s -> %s", krm.currentKeyID, newKeyID)

	// Re-encrypt all keys in database
	if krm.db != nil {
		if err := krm.reencryptAllKeys(krm.currentKey, newKey, newKeyID); err != nil {
			return "", "", fmt.Errorf("failed to re-encrypt keys: %w", err)
		}
	}

	// Store rotation state
	krm.previousKey = krm.currentKey
	krm.previousKeyID = krm.currentKeyID
	krm.currentKey = newKey
	krm.currentKeyID = newKeyID
	krm.rotationStarted = time.Now()

	// Persist rotation state
	if krm.db != nil {
		if err := krm.saveRotationState(); err != nil {
			krm.logger.Printf("[KeyRotation] Warning: Failed to save rotation state: %v", err)
		}
	}

	krm.logger.Printf("[KeyRotation] Master key rotation completed. Grace period: %s", krm.gracePeriod)

	return newKeyHex, newKeyID, nil
}

// GetDecryptionKey returns the appropriate key for decryption
// During rotation grace period, tries current key first, then previous key
func (krm *KeyRotationManager) GetDecryptionKey(keyVersion string) ([]byte, error) {
	krm.mu.RLock()
	defer krm.mu.RUnlock()

	// If key version matches current, use current key
	if keyVersion == krm.currentKeyID || keyVersion == "" {
		return krm.currentKey, nil
	}

	// If key version matches previous and we're in grace period, use previous key
	if krm.previousKey != nil && keyVersion == krm.previousKeyID {
		if time.Since(krm.rotationStarted) < krm.gracePeriod {
			krm.logger.Printf("[KeyRotation] Using previous key for decryption (key_version=%s)", keyVersion)
			return krm.previousKey, nil
		}
		return nil, fmt.Errorf("key version %s has expired", keyVersion)
	}

	return nil, fmt.Errorf("unknown key version: %s", keyVersion)
}

// GetEncryptionKey returns the current encryption key
func (krm *KeyRotationManager) GetEncryptionKey() ([]byte, string) {
	krm.mu.RLock()
	defer krm.mu.RUnlock()

	return krm.currentKey, krm.currentKeyID
}

// CleanupPreviousKey removes the previous key after grace period expires
func (krm *KeyRotationManager) CleanupPreviousKey() error {
	krm.mu.Lock()
	defer krm.mu.Unlock()

	if krm.previousKey == nil {
		return nil // No previous key to cleanup
	}

	if time.Since(krm.rotationStarted) < krm.gracePeriod {
		return fmt.Errorf("grace period not yet expired (expires in %s)",
			krm.gracePeriod-time.Since(krm.rotationStarted))
	}

	krm.logger.Printf("[KeyRotation] Cleaning up previous key: %s", krm.previousKeyID)

	// Zero out previous key memory
	for i := range krm.previousKey {
		krm.previousKey[i] = 0
	}

	krm.previousKey = nil
	krm.previousKeyID = ""

	// Update database
	if krm.db != nil {
		if err := krm.saveRotationState(); err != nil {
			return fmt.Errorf("failed to save rotation state: %w", err)
		}
	}

	return nil
}

// reencryptAllKeys re-encrypts all stored keys with the new master key
func (krm *KeyRotationManager) reencryptAllKeys(oldMasterKey, newMasterKey []byte, newKeyID string) error {
	// Get all encrypted keys from database
	rows, err := krm.db.Query(`
		SELECT id, encrypted_key, encryption_iv, encryption_tag
		FROM tenant_keys
		WHERE is_active = TRUE
	`)
	if err != nil {
		return fmt.Errorf("failed to query keys: %w", err)
	}
	defer rows.Close()

	type keyData struct {
		id           string
		encryptedKey string
		iv           string
		tag          string
	}

	var keys []keyData
	for rows.Next() {
		var k keyData
		if err := rows.Scan(&k.id, &k.encryptedKey, &k.iv, &k.tag); err != nil {
			return fmt.Errorf("failed to scan key row: %w", err)
		}
		keys = append(keys, k)
	}

	krm.logger.Printf("[KeyRotation] Re-encrypting %d active keys", len(keys))

	// Re-encrypt each key
	reencrypted := 0
	for _, k := range keys {
		// Decrypt with old key
		plaintext, err := krm.decryptWithKey(oldMasterKey, k.encryptedKey, k.iv, k.tag)
		if err != nil {
			krm.logger.Printf("[KeyRotation] Warning: Failed to decrypt key %s: %v", k.id, err)
			continue
		}

		// Re-encrypt with new key
		newEncrypted, newIV, newTag, err := krm.encryptWithKey(newMasterKey, plaintext)
		if err != nil {
			krm.logger.Printf("[KeyRotation] Warning: Failed to re-encrypt key %s: %v", k.id, err)
			continue
		}

		// Update database
		_, err = krm.db.Exec(`
			UPDATE tenant_keys
			SET encrypted_key = $1, encryption_iv = $2, encryption_tag = $3,
			    key_version = (SELECT COALESCE(key_version, 0) + 1),
			    updated_at = NOW()
			WHERE id = $4
		`, base64.StdEncoding.EncodeToString(newEncrypted),
			base64.StdEncoding.EncodeToString(newIV),
			base64.StdEncoding.EncodeToString(newTag),
			k.id)

		if err != nil {
			krm.logger.Printf("[KeyRotation] Warning: Failed to update key %s: %v", k.id, err)
			continue
		}

		reencrypted++
	}

	if reencrypted != len(keys) {
		return fmt.Errorf("only re-encrypted %d/%d keys", reencrypted, len(keys))
	}

	krm.logger.Printf("[KeyRotation] Successfully re-encrypted %d keys", reencrypted)
	return nil
}

// encryptWithKey encrypts plaintext with the specified master key
func (krm *KeyRotationManager) encryptWithKey(masterKey []byte, plaintext string) (ciphertext, iv, tag []byte, err error) {
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, nil, nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, nil, err
	}

	iv = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, nil, nil, err
	}

	sealed := gcm.Seal(nil, iv, []byte(plaintext), nil)

	tagSize := gcm.Overhead()
	if len(sealed) < tagSize {
		return nil, nil, nil, fmt.Errorf("sealed data too short")
	}

	ciphertext = sealed[:len(sealed)-tagSize]
	tag = sealed[len(sealed)-tagSize:]

	return ciphertext, iv, tag, nil
}

// decryptWithKey decrypts ciphertext with the specified master key
func (krm *KeyRotationManager) decryptWithKey(masterKey []byte, encryptedKeyB64, ivB64, tagB64 string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedKeyB64)
	if err != nil {
		return "", fmt.Errorf("invalid ciphertext encoding: %w", err)
	}

	iv, err := base64.StdEncoding.DecodeString(ivB64)
	if err != nil {
		return "", fmt.Errorf("invalid IV encoding: %w", err)
	}

	tag, err := base64.StdEncoding.DecodeString(tagB64)
	if err != nil {
		return "", fmt.Errorf("invalid tag encoding: %w", err)
	}

	sealed := append(ciphertext, tag...)

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	plaintext, err := gcm.Open(nil, iv, sealed, nil)
	if err != nil {
		return "", fmt.Errorf("decryption failed: %w", err)
	}

	return string(plaintext), nil
}

// saveRotationState persists rotation state to database
func (krm *KeyRotationManager) saveRotationState() error {
	var rotationStarted sql.NullTime
	if !krm.rotationStarted.IsZero() {
		rotationStarted = sql.NullTime{
			Time:  krm.rotationStarted,
			Valid: true,
		}
	}

	_, err := krm.db.Exec(`
		INSERT INTO key_rotation_state (
			current_key_id, previous_key_id, rotation_started, grace_period_hours
		) VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE SET
			current_key_id = EXCLUDED.current_key_id,
			previous_key_id = EXCLUDED.previous_key_id,
			rotation_started = EXCLUDED.rotation_started,
			grace_period_hours = EXCLUDED.grace_period_hours,
			updated_at = NOW()
	`, krm.currentKeyID, krm.previousKeyID, rotationStarted, int(krm.gracePeriod.Hours()))

	return err
}

// loadRotationState loads rotation state from database
func (krm *KeyRotationManager) loadRotationState() error {
	var previousKeyID sql.NullString
	var rotationStarted sql.NullTime
	var gracePeriodHours int

	err := krm.db.QueryRow(`
		SELECT current_key_id, previous_key_id, rotation_started, grace_period_hours
		FROM key_rotation_state
		WHERE id = 1
	`).Scan(&krm.currentKeyID, &previousKeyID, &rotationStarted, &gracePeriodHours)

	if err == sql.ErrNoRows {
		// No rotation state found, this is fine for first-time setup
		return nil
	}
	if err != nil {
		return err
	}

	if previousKeyID.Valid {
		krm.previousKeyID = previousKeyID.String
	}

	if rotationStarted.Valid {
		krm.rotationStarted = rotationStarted.Time
	}

	krm.gracePeriod = time.Duration(gracePeriodHours) * time.Hour

	krm.logger.Printf("[KeyRotation] Loaded rotation state: current=%s, previous=%s",
		krm.currentKeyID, krm.previousKeyID)

	return nil
}

// GetRotationStatus returns current rotation status
func (krm *KeyRotationManager) GetRotationStatus() map[string]interface{} {
	krm.mu.RLock()
	defer krm.mu.RUnlock()

	status := map[string]interface{}{
		"current_key_id":    krm.currentKeyID,
		"rotation_period":   krm.rotationPeriod.String(),
		"grace_period":      krm.gracePeriod.String(),
	}

	if krm.previousKey != nil {
		status["has_previous_key"] = true
		status["previous_key_id"] = krm.previousKeyID
		status["rotation_started"] = krm.rotationStarted
		status["grace_period_expires"] = krm.rotationStarted.Add(krm.gracePeriod)
		status["time_remaining"] = krm.gracePeriod - time.Since(krm.rotationStarted)
	} else {
		status["has_previous_key"] = false
	}

	return status
}

// StartAutoRotation starts a background goroutine to automatically rotate keys
func (krm *KeyRotationManager) StartAutoRotation() {
	go func() {
		ticker := time.NewTicker(24 * time.Hour) // Check daily
		defer ticker.Stop()

		for range ticker.C {
			krm.mu.RLock()
			shouldRotate := time.Since(krm.rotationStarted) >= krm.rotationPeriod
			krm.mu.RUnlock()

			if shouldRotate {
				krm.logger.Println("[KeyRotation] Auto-rotation triggered")
				if _, newKeyID, err := krm.RotateMasterKey(); err != nil {
					krm.logger.Printf("[KeyRotation] Auto-rotation failed: %v", err)
				} else {
					krm.logger.Printf("[KeyRotation] Auto-rotation successful: key_id=%s (update VAULT_MASTER_KEY in environment)", newKeyID)
					// SECURITY: Never log the master key in plaintext. Retrieve via admin API with proper auth.
				}
			}

			// Cleanup expired previous keys
			if err := krm.CleanupPreviousKey(); err != nil {
				// Expected error if grace period hasn't expired
			}
		}
	}()

	krm.logger.Println("[KeyRotation] Auto-rotation worker started")
}
