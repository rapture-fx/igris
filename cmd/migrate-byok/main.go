// Package main implements one-time migration from tenant_api_keys → tenant_keys
//
// Usage:
//   export DATABASE_URL="postgres://user:pass@localhost/schlep"
//   export VAULT_MASTER_KEY="<64-char-hex>"
//   go run cmd/migrate-byok/main.go
//
// This binary:
// 1. Reads all rows from tenant_api_keys
// 2. Decrypts each key using the old encryption scheme
// 3. Re-encrypts using AES-256-GCM with separated IV/tag
// 4. Inserts into tenant_keys table
// 5. Validates migration success
package main

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
	"os"
	"time"

	_ "github.com/lib/pq"
)

// OldAPIKey represents a row from tenant_api_keys (old schema)
type OldAPIKey struct {
	KeyID            int64
	TenantID         string
	Provider         string
	EncryptedKey     string
	KeyHash          string
	KeyName          sql.NullString
	KeyPrefix        sql.NullString
	IsValid          bool
	LastValidatedAt  sql.NullTime
	ValidationError  sql.NullString
	LastUsedAt       sql.NullTime
	TotalRequests    int64
	IsActive         bool
	ExpiresAt        sql.NullTime
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// NewKey represents a row for tenant_keys (new schema)
type NewKey struct {
	TenantID       string
	Provider       string
	KeyName        string
	EncryptedKey   string // Base64 ciphertext only
	EncryptionIV   string // Base64 IV
	EncryptionTag  string // Base64 auth tag
	KeyVersion     int
	IsActive       bool
	IsValid        sql.NullBool
	LastValidated  sql.NullTime
	ValidationErr  sql.NullString
	LastUsedAt     sql.NullTime
	UsageCount     int64
	ExpiresAt      sql.NullTime
	CreatedBy      string
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// 1. Check environment variables
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	masterKeyHex := os.Getenv("VAULT_MASTER_KEY")
	if masterKeyHex == "" {
		log.Fatal("VAULT_MASTER_KEY environment variable is required")
	}

	// Decode master key
	masterKey, err := hex.DecodeString(masterKeyHex)
	if err != nil {
		log.Fatalf("Invalid VAULT_MASTER_KEY format (expected hex): %v", err)
	}
	if len(masterKey) != 32 {
		log.Fatalf("VAULT_MASTER_KEY must be 32 bytes (64 hex chars), got %d bytes", len(masterKey))
	}

	log.Println("✅ Master key loaded successfully")

	// 2. Connect to database
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Println("✅ Database connection established")

	// 3. Check if old table exists
	var oldTableExists bool
	err = db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_name = 'tenant_api_keys'
		)
	`).Scan(&oldTableExists)
	if err != nil {
		log.Fatalf("Failed to check for tenant_api_keys table: %v", err)
	}

	if !oldTableExists {
		log.Println("⚠️  tenant_api_keys table does not exist. Nothing to migrate.")
		log.Println("✅ Migration complete (no-op)")
		return
	}

	// 4. Check if new table exists
	var newTableExists bool
	err = db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_name = 'tenant_keys'
		)
	`).Scan(&newTableExists)
	if err != nil {
		log.Fatalf("Failed to check for tenant_keys table: %v", err)
	}

	if !newTableExists {
		log.Fatal("❌ tenant_keys table does not exist. Run migration 004_use_tenant_keys.sql first!")
	}

	log.Println("✅ Both tables exist, proceeding with migration")

	// 5. Read all rows from tenant_api_keys
	rows, err := db.Query(`
		SELECT key_id, tenant_id, provider, encrypted_key, key_hash,
		       key_name, key_prefix, is_valid, last_validated_at,
		       validation_error, last_used_at, total_requests,
		       is_active, expires_at, created_at, updated_at
		FROM tenant_api_keys
		ORDER BY created_at ASC
	`)
	if err != nil {
		log.Fatalf("Failed to query tenant_api_keys: %v", err)
	}
	defer rows.Close()

	var oldKeys []OldAPIKey
	for rows.Next() {
		var key OldAPIKey
		err := rows.Scan(
			&key.KeyID, &key.TenantID, &key.Provider, &key.EncryptedKey,
			&key.KeyHash, &key.KeyName, &key.KeyPrefix, &key.IsValid,
			&key.LastValidatedAt, &key.ValidationError, &key.LastUsedAt,
			&key.TotalRequests, &key.IsActive, &key.ExpiresAt,
			&key.CreatedAt, &key.UpdatedAt,
		)
		if err != nil {
			log.Fatalf("Failed to scan row: %v", err)
		}
		oldKeys = append(oldKeys, key)
	}

	if err := rows.Err(); err != nil {
		log.Fatalf("Error iterating rows: %v", err)
	}

	log.Printf("📊 Found %d keys to migrate", len(oldKeys))

	if len(oldKeys) == 0 {
		log.Println("✅ No keys to migrate")
		return
	}

	// 6. Migrate each key
	migrated := 0
	failed := 0

	for i, oldKey := range oldKeys {
		log.Printf("[%d/%d] Migrating key: tenant=%s provider=%s",
			i+1, len(oldKeys), oldKey.TenantID, oldKey.Provider)

		// Decrypt old key (assuming it was encrypted as full sealed data)
		plainKey, err := decryptOldKey(oldKey.EncryptedKey, masterKey)
		if err != nil {
			log.Printf("  ❌ Failed to decrypt: %v", err)
			failed++
			continue
		}

		// Re-encrypt with separated IV/tag
		ciphertext, iv, tag, err := encryptNewKey(plainKey, masterKey)
		if err != nil {
			log.Printf("  ❌ Failed to re-encrypt: %v", err)
			failed++
			continue
		}

		// Encode to base64
		newKey := NewKey{
			TenantID:      oldKey.TenantID,
			Provider:      oldKey.Provider,
			KeyName:       oldKey.KeyName.String,
			EncryptedKey:  base64.StdEncoding.EncodeToString(ciphertext),
			EncryptionIV:  base64.StdEncoding.EncodeToString(iv),
			EncryptionTag: base64.StdEncoding.EncodeToString(tag),
			KeyVersion:    1,
			IsActive:      oldKey.IsActive,
			UsageCount:    oldKey.TotalRequests,
			CreatedBy:     "migration",
		}

		if newKey.KeyName == "" {
			newKey.KeyName = "default"
		}

		// Set nullable fields
		if oldKey.IsValid {
			newKey.IsValid = sql.NullBool{Bool: true, Valid: true}
		}
		if oldKey.LastValidatedAt.Valid {
			newKey.LastValidated = oldKey.LastValidatedAt
		}
		if oldKey.ValidationError.Valid {
			newKey.ValidationErr = oldKey.ValidationError
		}
		if oldKey.LastUsedAt.Valid {
			newKey.LastUsedAt = oldKey.LastUsedAt
		}
		if oldKey.ExpiresAt.Valid {
			newKey.ExpiresAt = oldKey.ExpiresAt
		}

		// Insert into tenant_keys using stored procedure
		var keyID string
		err = db.QueryRow(`
			SELECT store_tenant_key($1, $2, $3, $4, $5, $6, $7)
		`, newKey.TenantID, newKey.Provider, newKey.KeyName,
			newKey.EncryptedKey, newKey.EncryptionIV, newKey.EncryptionTag,
			newKey.CreatedBy).Scan(&keyID)

		if err != nil {
			log.Printf("  ❌ Failed to insert: %v", err)
			failed++
			continue
		}

		// Update additional fields not handled by store_tenant_key
		_, err = db.Exec(`
			UPDATE tenant_keys
			SET is_valid = $1,
			    last_validated_at = $2,
			    validation_error = $3,
			    last_used_at = $4,
			    usage_count = $5,
			    expires_at = $6,
			    created_at = $7,
			    updated_at = $8
			WHERE id = $9
		`, newKey.IsValid, newKey.LastValidated, newKey.ValidationErr,
			newKey.LastUsedAt, newKey.UsageCount, newKey.ExpiresAt,
			oldKey.CreatedAt, oldKey.UpdatedAt, keyID)

		if err != nil {
			log.Printf("  ⚠️  Inserted but failed to update metadata: %v", err)
		}

		log.Printf("  ✅ Migrated successfully (key_id=%s)", keyID)
		migrated++
	}

	// 7. Validation
	log.Println("\n📊 Migration Summary:")
	log.Printf("  Total keys found:    %d", len(oldKeys))
	log.Printf("  Successfully migrated: %d", migrated)
	log.Printf("  Failed:              %d", failed)

	if failed > 0 {
		log.Println("\n⚠️  Migration completed with errors. Review failed keys above.")
		os.Exit(1)
	}

	// 8. Count validation
	var oldCount, newCount int
	db.QueryRow("SELECT COUNT(*) FROM tenant_api_keys").Scan(&oldCount)
	db.QueryRow("SELECT COUNT(*) FROM tenant_keys").Scan(&newCount)

	log.Printf("\n✅ Validation:")
	log.Printf("  Old table (tenant_api_keys): %d rows", oldCount)
	log.Printf("  New table (tenant_keys):     %d rows", newCount)

	if newCount >= oldCount {
		log.Println("\n✅ Migration successful! All keys migrated.")
		log.Println("\n⚠️  NEXT STEPS:")
		log.Println("  1. Verify application works with new tenant_keys table")
		log.Println("  2. Run: DROP TABLE tenant_api_keys CASCADE;")
		log.Println("  3. Update application code to remove any tenant_api_keys references")
	} else {
		log.Printf("\n⚠️  Warning: New table has fewer rows (%d) than old table (%d)", newCount, oldCount)
		log.Println("  Review migration logs before dropping old table")
	}
}

// decryptOldKey decrypts using the old encryption format
// Assumes the old format stored the full sealed data (ciphertext+tag combined)
func decryptOldKey(encryptedB64 string, masterKey []byte) (string, error) {
	// Decode from base64
	sealed, err := base64.StdEncoding.DecodeString(encryptedB64)
	if err != nil {
		return "", fmt.Errorf("invalid base64: %w", err)
	}

	// Create cipher
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(sealed) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	// Extract nonce and ciphertext
	// Old format likely stored as: nonce || ciphertext+tag
	nonce := sealed[:nonceSize]
	ciphertextWithTag := sealed[nonceSize:]

	// Decrypt
	plaintext, err := gcm.Open(nil, nonce, ciphertextWithTag, nil)
	if err != nil {
		return "", fmt.Errorf("decryption failed: %w", err)
	}

	return string(plaintext), nil
}

// encryptNewKey encrypts with separated IV and tag
func encryptNewKey(plaintext string, masterKey []byte) (ciphertext, iv, tag []byte, err error) {
	block, err := aes.NewCipher(masterKey)
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

	// GCM appends the tag to the ciphertext
	tagSize := gcm.Overhead()
	if len(sealed) < tagSize {
		return nil, nil, nil, fmt.Errorf("sealed data too short")
	}

	ciphertext = sealed[:len(sealed)-tagSize]
	tag = sealed[len(sealed)-tagSize:]

	return ciphertext, iv, tag, nil
}

// verifyDecryption verifies that re-encrypted key can be decrypted correctly
func verifyDecryption(ciphertext, iv, tag, masterKey []byte, expectedPlaintext string) error {
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	// Reconstruct sealed data
	sealed := append(ciphertext, tag...)

	// Decrypt
	plaintext, err := gcm.Open(nil, iv, sealed, nil)
	if err != nil {
		return fmt.Errorf("verification failed: %w", err)
	}

	if string(plaintext) != expectedPlaintext {
		return fmt.Errorf("verification failed: plaintext mismatch")
	}

	return nil
}
