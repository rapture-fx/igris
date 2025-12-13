// Package billing provides emergency budget override functionality
package billing

import (
	"crypto/ed25519"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ============================================================================
// EMERGENCY BUDGET OVERRIDE
// ============================================================================

// OverrideToken represents an emergency budget override JWT
type OverrideToken struct {
	TenantID      string    `json:"tenant_id"`
	MaxRequests   int       `json:"max_requests"`   // Maximum requests allowed (100)
	ExpiresAt     time.Time `json:"expires_at"`     // 24-hour expiration
	IssuedAt      time.Time `json:"issued_at"`
	SingleUse     bool      `json:"single_use"`     // Must be true
	jwt.RegisteredClaims
}

// OverrideManager manages emergency budget override tokens
type OverrideManager struct {
	publicKey     ed25519.PublicKey
	usedTokens    map[string]bool      // Token ID -> used status
	tenantUsage   map[string]int       // Tenant ID -> request count since override
	mu            sync.RWMutex
}

// NewOverrideManager creates a new override token manager
func NewOverrideManager(publicKeyHex string) (*OverrideManager, error) {
	if publicKeyHex == "" {
		return nil, errors.New("public key required for override validation")
	}

	// Decode public key from hex
	publicKey, err := decodePublicKey(publicKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode public key: %w", err)
	}

	return &OverrideManager{
		publicKey:   publicKey,
		usedTokens:  make(map[string]bool),
		tenantUsage: make(map[string]int),
	}, nil
}

// ValidateOverride validates an emergency override token and checks usage
func (om *OverrideManager) ValidateOverride(tokenString string, tenantID string) error {
	om.mu.Lock()
	defer om.mu.Unlock()

	// Parse JWT
	token, err := jwt.ParseWithClaims(tokenString, &OverrideToken{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodEd25519); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return om.publicKey, nil
	})

	if err != nil {
		return fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(*OverrideToken)
	if !ok || !token.Valid {
		return errors.New("invalid token claims")
	}

	// Verify tenant ID matches
	if claims.TenantID != tenantID {
		return errors.New("token tenant mismatch")
	}

	// Verify expiration (24h max)
	if time.Now().After(claims.ExpiresAt) {
		return errors.New("token expired")
	}

	// Verify single-use constraint
	if !claims.SingleUse {
		return errors.New("token must be single-use")
	}

	// Check if token already used
	tokenID := claims.ID
	if om.usedTokens[tokenID] {
		return errors.New("token already used")
	}

	// Check if tenant has exceeded 100 requests since override
	if om.tenantUsage[tenantID] >= claims.MaxRequests {
		return fmt.Errorf("override request limit reached (%d/%d)", om.tenantUsage[tenantID], claims.MaxRequests)
	}

	return nil
}

// MarkTokenUsed marks a token as used (single-use enforcement)
func (om *OverrideManager) MarkTokenUsed(tokenString string) error {
	om.mu.Lock()
	defer om.mu.Unlock()

	token, err := jwt.ParseWithClaims(tokenString, &OverrideToken{}, func(token *jwt.Token) (interface{}, error) {
		return om.publicKey, nil
	})

	if err != nil {
		return err
	}

	claims, ok := token.Claims.(*OverrideToken)
	if !ok {
		return errors.New("invalid claims")
	}

	om.usedTokens[claims.ID] = true
	return nil
}

// IncrementOverrideUsage increments request count for a tenant using override
func (om *OverrideManager) IncrementOverrideUsage(tenantID string) {
	om.mu.Lock()
	defer om.mu.Unlock()

	om.tenantUsage[tenantID]++
}

// ResetOverrideUsage resets request count for a tenant (called when override expires or new budget period)
func (om *OverrideManager) ResetOverrideUsage(tenantID string) {
	om.mu.Lock()
	defer om.mu.Unlock()

	delete(om.tenantUsage, tenantID)
}

// GetOverrideUsage returns current override request count for a tenant
func (om *OverrideManager) GetOverrideUsage(tenantID string) int {
	om.mu.RLock()
	defer om.mu.RUnlock()

	return om.tenantUsage[tenantID]
}

// Helper function to decode hex public key
func decodePublicKey(hexKey string) (ed25519.PublicKey, error) {
	// For now, assume base64 encoding (can extend to hex if needed)
	// This is a placeholder - actual implementation would decode from hex/base64
	if len(hexKey) != ed25519.PublicKeySize*2 {
		return nil, errors.New("invalid public key length")
	}

	// Decode from hex
	pubKey := make([]byte, ed25519.PublicKeySize)
	for i := 0; i < ed25519.PublicKeySize; i++ {
		fmt.Sscanf(hexKey[i*2:i*2+2], "%02x", &pubKey[i])
	}

	return ed25519.PublicKey(pubKey), nil
}

// GenerateOverrideToken generates a new emergency override token (for dashboard use)
// This is a helper function - actual token generation happens in the dashboard
func GenerateOverrideToken(privateKey ed25519.PrivateKey, tenantID string) (string, error) {
	now := time.Now()
	claims := &OverrideToken{
		TenantID:    tenantID,
		MaxRequests: 100, // Fixed at 100 requests
		ExpiresAt:   now.Add(24 * time.Hour),
		IssuedAt:    now,
		SingleUse:   true,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        fmt.Sprintf("override_%s_%d", tenantID, now.Unix()),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
		},
	}

	token := jwt.NewWithClaims(&jwt.SigningMethodEd25519{}, claims)
	return token.SignedString(privateKey)
}

// SerializeOverrideToken serializes token claims to JSON for storage/logging
func SerializeOverrideToken(tokenString string, publicKey ed25519.PublicKey) (string, error) {
	token, err := jwt.ParseWithClaims(tokenString, &OverrideToken{}, func(token *jwt.Token) (interface{}, error) {
		return publicKey, nil
	})

	if err != nil {
		return "", err
	}

	claims, ok := token.Claims.(*OverrideToken)
	if !ok {
		return "", errors.New("invalid claims")
	}

	data, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	return string(data), nil
}
