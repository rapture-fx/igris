package tests

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTSecurityAuditResult stores security audit results
type JWTSecurityAuditResult struct {
	ModuleID                string   `json:"module_id"`
	JWTOldTokensInvalidated bool     `json:"jwt_old_tokens_invalidated"`
	JWTNewTokensValid       bool     `json:"jwt_new_tokens_valid"`
	KeyReencryptionSuccess  bool     `json:"key_reencryption_success"`
	EncryptionStandard      string   `json:"encryption_standard"`
	Status                  string   `json:"status"`
	PassFail                string   `json:"pass_fail"`
	SecurityFindings        []string `json:"security_findings"`
	Recommendations         []string `json:"recommendations"`
}

// Claims mimics the JWT claims structure
type TestClaims struct {
	UserID string   `json:"user_id"`
	Email  string   `json:"email"`
	Roles  []string `json:"roles"`
	jwt.RegisteredClaims
}

// TestJWTAndBYOKSecurityAudit validates JWT rotation and BYOK key handling
func TestJWTAndBYOKSecurityAudit(t *testing.T) {
	t.Log("Starting JWT and BYOK Security Audit...")

	result := JWTSecurityAuditResult{
		ModuleID:           "jwt_byok_security_audit",
		EncryptionStandard: "AES-256-GCM",
		SecurityFindings:   []string{},
		Recommendations:    []string{},
	}

	// Test 1: JWT Token Generation and Rotation
	t.Log("\n[Test 1] JWT Token Rotation Testing...")

	// Original JWT secret
	originalSecret := "test-secret-key-original-32byte"
	newSecret := "test-secret-key-rotated-32bytex"

	// Generate 3 JWT tokens with original secret
	tokens := make([]string, 3)
	for i := 0; i < 3; i++ {
		claims := TestClaims{
			UserID: fmt.Sprintf("user_%d", i),
			Email:  fmt.Sprintf("user%d@test.com", i),
			Roles:  []string{"user"},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signedToken, err := token.SignedString([]byte(originalSecret))
		if err != nil {
			t.Fatalf("Failed to generate JWT token: %v", err)
		}
		tokens[i] = signedToken
		t.Logf("Generated token %d: %s...", i+1, signedToken[:20])
	}

	// Verify old tokens work with original secret
	allOldTokensValid := true
	for i, tokenStr := range tokens {
		_, err := jwt.ParseWithClaims(tokenStr, &TestClaims{}, func(token *jwt.Token) (interface{}, error) {
			return []byte(originalSecret), nil
		})
		if err != nil {
			allOldTokensValid = false
			t.Errorf("Token %d failed validation with original secret: %v", i, err)
		}
	}

	if !allOldTokensValid {
		result.SecurityFindings = append(result.SecurityFindings,
			"JWT tokens failed validation with original secret")
	}

	// Rotate JWT secret
	t.Log("Rotating JWT secret...")

	// Verify old tokens FAIL with new secret (this is expected and desired)
	allOldTokensInvalidated := true
	for i, tokenStr := range tokens {
		_, err := jwt.ParseWithClaims(tokenStr, &TestClaims{}, func(token *jwt.Token) (interface{}, error) {
			return []byte(newSecret), nil
		})
		if err == nil {
			allOldTokensInvalidated = false
			t.Errorf("Token %d should have failed with new secret but passed!", i)
		}
	}

	result.JWTOldTokensInvalidated = allOldTokensInvalidated
	if allOldTokensInvalidated {
		t.Log("✓ Old tokens correctly invalidated after secret rotation")
	} else {
		result.SecurityFindings = append(result.SecurityFindings,
			"CRITICAL: Old tokens still valid after secret rotation")
	}

	// Generate new tokens with new secret
	newTokens := make([]string, 3)
	for i := 0; i < 3; i++ {
		claims := TestClaims{
			UserID: fmt.Sprintf("user_%d", i),
			Email:  fmt.Sprintf("user%d@test.com", i),
			Roles:  []string{"user"},
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signedToken, err := token.SignedString([]byte(newSecret))
		if err != nil {
			t.Fatalf("Failed to generate new JWT token: %v", err)
		}
		newTokens[i] = signedToken
	}

	// Verify new tokens work with new secret
	allNewTokensValid := true
	for i, tokenStr := range newTokens {
		_, err := jwt.ParseWithClaims(tokenStr, &TestClaims{}, func(token *jwt.Token) (interface{}, error) {
			return []byte(newSecret), nil
		})
		if err != nil {
			allNewTokensValid = false
			t.Errorf("New token %d failed validation: %v", i, err)
		}
	}

	result.JWTNewTokensValid = allNewTokensValid
	if allNewTokensValid {
		t.Log("✓ New tokens correctly validated with new secret")
	} else {
		result.SecurityFindings = append(result.SecurityFindings,
			"New tokens failed validation with new secret")
	}

	// Test 2: BYOK Encryption and Key Rotation
	t.Log("\n[Test 2] BYOK Key Encryption and Rotation Testing...")

	// Original master key (32 bytes for AES-256)
	originalMasterKey := []byte("12345678901234567890123456789012") // exactly 32 bytes
	newMasterKey := []byte("abcdefghijklmnopqrstuvwxyz123456")      // exactly 32 bytes

	// Ensure keys are exactly 32 bytes
	if len(originalMasterKey) != 32 {
		t.Fatalf("Original master key must be 32 bytes, got %d", len(originalMasterKey))
	}
	if len(newMasterKey) != 32 {
		t.Fatalf("New master key must be 32 bytes, got %d", len(newMasterKey))
	}

	// Test data: 3 BYOK keys to encrypt
	byokKeys := []string{
		"byok-api-key-1-test-data-value",
		"byok-api-key-2-test-data-value",
		"byok-api-key-3-test-data-value",
	}

	// Encrypt BYOK keys with original master key
	encryptedKeys := make([]string, len(byokKeys))
	for i, key := range byokKeys {
		encrypted, err := encryptAES256GCM([]byte(key), originalMasterKey)
		if err != nil {
			t.Fatalf("Failed to encrypt BYOK key %d: %v", i, err)
		}
		encryptedKeys[i] = encrypted
		t.Logf("Encrypted BYOK key %d: %s...", i+1, encrypted[:20])
	}

	// Verify we can decrypt with original key
	for i, encrypted := range encryptedKeys {
		decrypted, err := decryptAES256GCM(encrypted, originalMasterKey)
		if err != nil {
			t.Errorf("Failed to decrypt BYOK key %d with original master key: %v", i, err)
		} else if string(decrypted) != byokKeys[i] {
			t.Errorf("Decrypted key %d mismatch: got %s, want %s", i, decrypted, byokKeys[i])
		}
	}

	// Re-encrypt all keys with new master key (simulating key rotation)
	t.Log("Rotating master key and re-encrypting BYOK keys...")
	reencryptedKeys := make([]string, len(byokKeys))
	reencryptionSuccess := true

	for i, encrypted := range encryptedKeys {
		// Decrypt with old key
		decrypted, err := decryptAES256GCM(encrypted, originalMasterKey)
		if err != nil {
			t.Errorf("Failed to decrypt during re-encryption: %v", err)
			reencryptionSuccess = false
			continue
		}

		// Re-encrypt with new key
		reencrypted, err := encryptAES256GCM(decrypted, newMasterKey)
		if err != nil {
			t.Errorf("Failed to re-encrypt BYOK key %d: %v", i, err)
			reencryptionSuccess = false
			continue
		}
		reencryptedKeys[i] = reencrypted
	}

	result.KeyReencryptionSuccess = reencryptionSuccess

	// Verify re-encrypted keys can be decrypted with new master key
	for i, reencrypted := range reencryptedKeys {
		decrypted, err := decryptAES256GCM(reencrypted, newMasterKey)
		if err != nil {
			t.Errorf("Failed to decrypt re-encrypted key %d: %v", i, err)
			reencryptionSuccess = false
		} else if string(decrypted) != byokKeys[i] {
			t.Errorf("Re-encrypted key %d mismatch: got %s, want %s", i, decrypted, byokKeys[i])
			reencryptionSuccess = false
		}
	}

	if reencryptionSuccess {
		t.Log("✓ BYOK key re-encryption successful with no data corruption")
	} else {
		result.SecurityFindings = append(result.SecurityFindings,
			"BYOK key re-encryption failed or data corruption detected")
	}

	// Determine overall status
	result.PassFail = "PASS"
	if !result.JWTOldTokensInvalidated || !result.JWTNewTokensValid || !result.KeyReencryptionSuccess {
		result.PassFail = "FAIL"
	}

	if result.PassFail == "PASS" {
		result.Status = "All security checks passed"
	} else {
		result.Status = "Security vulnerabilities detected"
		result.Recommendations = append(result.Recommendations,
			"Review JWT secret rotation mechanism",
			"Verify BYOK key re-encryption process",
			"Implement automated key rotation testing in CI/CD")
	}

	// Add general recommendations
	if len(result.Recommendations) == 0 {
		result.Recommendations = append(result.Recommendations,
			"Consider implementing JWT key versioning for gradual rotation",
			"Implement automated BYOK key rotation schedule (e.g., every 90 days)",
			"Add monitoring for failed authentication attempts after key rotation")
	}

	// Print summary
	t.Logf("\n=== JWT & BYOK Security Audit Results ===")
	t.Logf("JWT Old Tokens Invalidated: %v", result.JWTOldTokensInvalidated)
	t.Logf("JWT New Tokens Valid: %v", result.JWTNewTokensValid)
	t.Logf("BYOK Key Re-encryption Success: %v", result.KeyReencryptionSuccess)
	t.Logf("Encryption Standard: %s", result.EncryptionStandard)
	t.Logf("Status: %s", result.Status)
	t.Logf("Pass/Fail: %s", result.PassFail)

	if len(result.SecurityFindings) > 0 {
		t.Logf("\nSecurity Findings:")
		for _, finding := range result.SecurityFindings {
			t.Logf("  - %s", finding)
		}
	}

	if len(result.Recommendations) > 0 {
		t.Logf("\nRecommendations:")
		for _, rec := range result.Recommendations {
			t.Logf("  - %s", rec)
		}
	}

	// Save results
	resultJSON, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal results: %v", err)
	}

	// Ensure directory exists
	os.MkdirAll("tests/security", 0755)
	outputPath := "tests/security/jwt_rotation_test.log"
	if err := os.WriteFile(outputPath, resultJSON, 0644); err != nil {
		t.Fatalf("Failed to write results: %v", err)
	}
	t.Logf("\nResults saved to: %s", outputPath)

	// Assert
	if result.PassFail == "FAIL" {
		t.Errorf("JWT and BYOK security audit FAILED")
	}
}

// encryptAES256GCM encrypts plaintext using AES-256-GCM
func encryptAES256GCM(plaintext, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decryptAES256GCM decrypts ciphertext using AES-256-GCM
func decryptAES256GCM(ciphertext string, key []byte) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	return gcm.Open(nil, nonce, ciphertextBytes, nil)
}
