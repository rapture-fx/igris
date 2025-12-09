package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/base32"
	"fmt"

	"github.com/pquerna/otp/totp"
)

// TOTPManager handles 2FA time-based one-time passwords
type TOTPManager struct {
	db     *sql.DB
	issuer string
}

// NewTOTPManager creates a new TOTP manager
func NewTOTPManager(db *sql.DB, issuer string) *TOTPManager {
	return &TOTPManager{
		db:     db,
		issuer: issuer,
	}
}

// GenerateSecret creates a new TOTP secret for a tenant
func (tm *TOTPManager) GenerateSecret(tenantID, tenantName string) (string, string, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      tm.issuer,
		AccountName: tenantName,
		SecretSize:  20,
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to generate TOTP key: %w", err)
	}

	secret := key.Secret()
	qrCodeURL := key.URL()

	return secret, qrCodeURL, nil
}

// Enable2FA enables 2FA for a tenant
func (tm *TOTPManager) Enable2FA(tenantID, secret, verificationCode string) error {
	// Verify the code before enabling
	valid := totp.Validate(verificationCode, secret)
	if !valid {
		return fmt.Errorf("invalid verification code")
	}

	// Store secret in database
	_, err := tm.db.Exec(`
		UPDATE tenants
		SET totp_secret = $1,
		    totp_enabled = true,
		    updated_at = NOW()
		WHERE tenant_id = $2
	`, secret, tenantID)

	if err != nil {
		return fmt.Errorf("failed to enable 2FA: %w", err)
	}

	return nil
}

// Disable2FA disables 2FA for a tenant
func (tm *TOTPManager) Disable2FA(tenantID string) error {
	_, err := tm.db.Exec(`
		UPDATE tenants
		SET totp_secret = NULL,
		    totp_enabled = false,
		    updated_at = NOW()
		WHERE tenant_id = $1
	`, tenantID)

	if err != nil {
		return fmt.Errorf("failed to disable 2FA: %w", err)
	}

	return nil
}

// Verify2FA verifies a TOTP code for a tenant
func (tm *TOTPManager) Verify2FA(tenantID, code string) (bool, error) {
	var secret string
	var enabled bool

	err := tm.db.QueryRow(`
		SELECT COALESCE(totp_secret, ''), COALESCE(totp_enabled, false)
		FROM tenants
		WHERE tenant_id = $1
	`, tenantID).Scan(&secret, &enabled)

	if err != nil {
		return false, fmt.Errorf("failed to get 2FA status: %w", err)
	}

	if !enabled || secret == "" {
		return false, fmt.Errorf("2FA not enabled for this tenant")
	}

	valid := totp.Validate(code, secret)
	return valid, nil
}

// Get2FAStatus returns whether 2FA is enabled for a tenant
func (tm *TOTPManager) Get2FAStatus(tenantID string) (bool, error) {
	var enabled bool

	err := tm.db.QueryRow(`
		SELECT COALESCE(totp_enabled, false)
		FROM tenants
		WHERE tenant_id = $1
	`, tenantID).Scan(&enabled)

	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to get 2FA status: %w", err)
	}

	return enabled, nil
}

// GenerateBackupCodes generates backup codes for 2FA recovery
func (tm *TOTPManager) GenerateBackupCodes() ([]string, error) {
	codes := make([]string, 10)
	for i := range codes {
		b := make([]byte, 5)
		if _, err := rand.Read(b); err != nil {
			return nil, fmt.Errorf("failed to generate backup codes: %w", err)
		}
		codes[i] = base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
	}
	return codes, nil
}
