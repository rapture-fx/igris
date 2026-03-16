package middleware

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents JWT claims used by the SSO enforcer.
type Claims struct {
	UserID string   `json:"user_id"`
	Email  string   `json:"email"`
	Roles  []string `json:"roles"`
	jwt.RegisteredClaims
}

// AuthConfig holds JWT configuration for token generation.
type AuthConfig struct {
	JWTSecret     string
	TokenDuration time.Duration
}

// GenerateToken creates a signed JWT for a user.
func GenerateToken(config *AuthConfig, userID, email string, roles []string) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		Roles:  roles,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(config.TokenDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(config.JWTSecret))
	if err != nil {
		return "", fmt.Errorf("signing token: %w", err)
	}
	return signed, nil
}
