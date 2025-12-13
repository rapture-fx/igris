// Package security provides JWT token generation and validation for tenant authentication
package security

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTManager handles JWT token generation and validation
type JWTManager struct {
	secretKey     []byte
	tokenTTL      time.Duration
	db            *sql.DB
	enabled       bool
	trackSessions bool
	logger        *log.Logger
}

// TenantClaims represents the JWT claims for a tenant
type TenantClaims struct {
	TenantID   string   `json:"tenant_id"`
	TenantName string   `json:"tenant_name"`
	Roles      []string `json:"roles,omitempty"`
	jwt.RegisteredClaims
}

// TokenInfo contains information about a generated token
type TokenInfo struct {
	Token     string
	TokenHash string
	ExpiresAt time.Time
	IssuedAt  time.Time
}

// NewJWTManager creates a new JWT manager
func NewJWTManager(db *sql.DB, jwtSecret string, tokenTTLHours int, trackSessions bool) (*JWTManager, error) {
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}

	if len(jwtSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters long for security")
	}

	if tokenTTLHours <= 0 {
		tokenTTLHours = 24 // Default to 24 hours
	}

	return &JWTManager{
		secretKey:     []byte(jwtSecret),
		tokenTTL:      time.Duration(tokenTTLHours) * time.Hour,
		db:            db,
		enabled:       db != nil,
		trackSessions: trackSessions,
		logger:        log.Default(),
	}, nil
}

// GenerateToken creates a new JWT token for a tenant
func (jm *JWTManager) GenerateToken(tenantID, tenantName string, roles []string, ipAddress, userAgent string) (*TokenInfo, error) {
	now := time.Now()
	expiresAt := now.Add(jm.tokenTTL)

	// Create claims
	claims := &TenantClaims{
		TenantID:   tenantID,
		TenantName: tenantName,
		Roles:      roles,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "igris-inertial",
			Subject:   tenantID,
		},
	}

	// Create token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jm.secretKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign token: %w", err)
	}

	// Hash token for session tracking
	tokenHash := hashToken(tokenString)

	tokenInfo := &TokenInfo{
		Token:     tokenString,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		IssuedAt:  now,
	}

	// Track session if enabled
	if jm.enabled && jm.trackSessions {
		if err := jm.trackSession(tenantID, tokenHash, expiresAt, ipAddress, userAgent); err != nil {
			jm.logger.Printf("[JWTManager] Warning: Failed to track session: %v", err)
			// Don't fail token generation if session tracking fails
		}
	}

	jm.logger.Printf("[JWTManager] Generated token for tenant: %s (expires: %s)", tenantID, expiresAt.Format(time.RFC3339))
	return tokenInfo, nil
}

// ValidateToken validates a JWT token and returns the claims
func (jm *JWTManager) ValidateToken(tokenString string) (*TenantClaims, error) {
	// Parse and validate token
	token, err := jwt.ParseWithClaims(tokenString, &TenantClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jm.secretKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	// Extract claims
	claims, ok := token.Claims.(*TenantClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Check if token is revoked (if session tracking is enabled)
	if jm.enabled && jm.trackSessions {
		tokenHash := hashToken(tokenString)
		if revoked, err := jm.isTokenRevoked(tokenHash); err != nil {
			jm.logger.Printf("[JWTManager] Warning: Failed to check token revocation: %v", err)
		} else if revoked {
			return nil, fmt.Errorf("token has been revoked")
		}

		// Update session last used
		go jm.updateSessionLastUsed(tokenHash)
	}

	return claims, nil
}

// RevokeToken revokes a JWT token (if session tracking is enabled)
func (jm *JWTManager) RevokeToken(tokenString, reason string) error {
	if !jm.enabled || !jm.trackSessions {
		return fmt.Errorf("session tracking not enabled")
	}

	tokenHash := hashToken(tokenString)

	_, err := jm.db.Exec(`
		SELECT revoke_session($1, $2)
	`, tokenHash, reason)

	if err != nil {
		return fmt.Errorf("failed to revoke token: %w", err)
	}

	jm.logger.Printf("[JWTManager] Revoked token: %s (reason: %s)", tokenHash[:16], reason)
	return nil
}

// RevokeAllTenantTokens revokes all tokens for a tenant
func (jm *JWTManager) RevokeAllTenantTokens(tenantID, reason string) error {
	if !jm.enabled || !jm.trackSessions {
		return fmt.Errorf("session tracking not enabled")
	}

	result, err := jm.db.Exec(`
		UPDATE tenant_sessions
		SET revoked_at = NOW(), revoked_reason = $2
		WHERE tenant_id = $1 AND revoked_at IS NULL
	`, tenantID, reason)

	if err != nil {
		return fmt.Errorf("failed to revoke tenant tokens: %w", err)
	}

	count, _ := result.RowsAffected()
	jm.logger.Printf("[JWTManager] Revoked %d tokens for tenant: %s", count, tenantID)
	return nil
}

// trackSession stores session information in database
func (jm *JWTManager) trackSession(tenantID, tokenHash string, expiresAt time.Time, ipAddress, userAgent string) error {
	_, err := jm.db.Exec(`
		INSERT INTO tenant_sessions (tenant_id, token_hash, expires_at, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5)
	`, tenantID, tokenHash, expiresAt, ipAddress, userAgent)

	return err
}

// isTokenRevoked checks if a token has been revoked
func (jm *JWTManager) isTokenRevoked(tokenHash string) (bool, error) {
	var revokedAt sql.NullTime
	err := jm.db.QueryRow(`
		SELECT revoked_at FROM tenant_sessions
		WHERE token_hash = $1
	`, tokenHash).Scan(&revokedAt)

	if err == sql.ErrNoRows {
		// Session not tracked (could be an old token)
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return revokedAt.Valid, nil
}

// updateSessionLastUsed updates the last used timestamp for a session
func (jm *JWTManager) updateSessionLastUsed(tokenHash string) {
	_, err := jm.db.Exec(`
		UPDATE tenant_sessions
		SET last_used_at = NOW(), request_count = request_count + 1
		WHERE token_hash = $1
	`, tokenHash)

	if err != nil {
		jm.logger.Printf("[JWTManager] Failed to update session last used: %v", err)
	}
}

// CleanupExpiredSessions removes expired sessions from the database
func (jm *JWTManager) CleanupExpiredSessions() (int64, error) {
	if !jm.enabled || !jm.trackSessions {
		return 0, nil
	}

	result, err := jm.db.Exec(`
		DELETE FROM tenant_sessions
		WHERE expires_at < NOW() AND revoked_at IS NULL
	`)

	if err != nil {
		return 0, err
	}

	count, _ := result.RowsAffected()
	if count > 0 {
		jm.logger.Printf("[JWTManager] Cleaned up %d expired sessions", count)
	}

	return count, nil
}

// GetActiveSessions returns active sessions for a tenant
func (jm *JWTManager) GetActiveSessions(tenantID string) ([]SessionInfo, error) {
	if !jm.enabled || !jm.trackSessions {
		return nil, fmt.Errorf("session tracking not enabled")
	}

	rows, err := jm.db.Query(`
		SELECT id, issued_at, expires_at, ip_address, user_agent, last_used_at, request_count
		FROM tenant_sessions
		WHERE tenant_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
		ORDER BY issued_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []SessionInfo
	for rows.Next() {
		var session SessionInfo
		var ipAddress sql.NullString
		var userAgent sql.NullString

		err := rows.Scan(
			&session.ID,
			&session.IssuedAt,
			&session.ExpiresAt,
			&ipAddress,
			&userAgent,
			&session.LastUsedAt,
			&session.RequestCount,
		)
		if err != nil {
			return nil, err
		}

		if ipAddress.Valid {
			session.IPAddress = ipAddress.String
		}
		if userAgent.Valid {
			session.UserAgent = userAgent.String
		}

		sessions = append(sessions, session)
	}

	return sessions, nil
}

// SessionInfo represents information about an active session
type SessionInfo struct {
	ID           string
	IssuedAt     time.Time
	ExpiresAt    time.Time
	IPAddress    string
	UserAgent    string
	LastUsedAt   time.Time
	RequestCount int64
}

// GenerateJWTSecret generates a random JWT secret
func GenerateJWTSecret() (string, error) {
	secret := make([]byte, 64) // 512 bits
	if _, err := rand.Read(secret); err != nil {
		return "", fmt.Errorf("failed to generate JWT secret: %w", err)
	}
	return hex.EncodeToString(secret), nil
}

// hashToken creates a SHA256 hash of a token for storage
func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// RefreshToken generates a new token with the same claims but extended expiry
func (jm *JWTManager) RefreshToken(oldTokenString, ipAddress, userAgent string) (*TokenInfo, error) {
	// Validate old token
	claims, err := jm.ValidateToken(oldTokenString)
	if err != nil {
		return nil, fmt.Errorf("cannot refresh invalid token: %w", err)
	}

	// Revoke old token if session tracking is enabled
	if jm.enabled && jm.trackSessions {
		if err := jm.RevokeToken(oldTokenString, "refreshed"); err != nil {
			jm.logger.Printf("[JWTManager] Warning: Failed to revoke old token: %v", err)
		}
	}

	// Generate new token with same claims
	return jm.GenerateToken(claims.TenantID, claims.TenantName, claims.Roles, ipAddress, userAgent)
}
