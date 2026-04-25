// Package api provides license-related API routes
package api

import (
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/models"
)

// LicenseHandler handles license-related API requests
type LicenseHandler struct {
	db *sql.DB
}

type offlineLicenseArtifactPayload struct {
	Version            int                    `json:"version"`
	LicenseKey         string                 `json:"license_key"`
	DeviceID           string                 `json:"device_id"`
	RuntimeVersion     string                 `json:"runtime_version"`
	Tier               string                 `json:"tier"`
	CustomerEmail      string                 `json:"customer_email,omitempty"`
	DevicesLimit       int                    `json:"devices_limit"`
	DevicesActive      int                    `json:"devices_active"`
	CloudRequestsLimit int                    `json:"cloud_requests_limit"`
	CloudRequestsUsed  int                    `json:"cloud_requests_used"`
	Features           models.LicenseFeatures `json:"features"`
	Status             string                 `json:"status"`
	LicenseExpiresAt   *time.Time             `json:"license_expires_at,omitempty"`
	ArtifactIssuedAt   time.Time              `json:"artifact_issued_at"`
	ArtifactExpiresAt  time.Time              `json:"artifact_expires_at"`
}

type offlineLicenseArtifactEnvelope struct {
	Algorithm     string `json:"algorithm"`
	KeyID         string `json:"key_id,omitempty"`
	Payload       string `json:"payload"`
	PayloadSHA256 string `json:"payload_sha256"`
	Signature     string `json:"signature"`
}

// NewLicenseHandler creates a new license handler
func NewLicenseHandler(db *sql.DB) *LicenseHandler {
	return &LicenseHandler{db: db}
}

func decodeOfflineLicenseSigningKey(value string) (ed25519.PrivateKey, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, fmt.Errorf("offline license signing key not configured")
	}

	raw, err := hex.DecodeString(value)
	if err != nil {
		raw, err = base64.StdEncoding.DecodeString(value)
		if err != nil {
			return nil, fmt.Errorf("invalid ed25519 private key encoding")
		}
	}

	switch len(raw) {
	case ed25519.SeedSize:
		return ed25519.NewKeyFromSeed(raw), nil
	case ed25519.PrivateKeySize:
		return ed25519.PrivateKey(raw), nil
	default:
		return nil, fmt.Errorf("invalid ed25519 private key length")
	}
}

func offlineArtifactTTL() time.Duration {
	ttlHours := 168
	if raw := strings.TrimSpace(os.Getenv("IGRIS_LICENSE_OFFLINE_ARTIFACT_TTL_HOURS")); raw != "" {
		if parsed, err := time.ParseDuration(raw + "h"); err == nil && parsed > 0 {
			return parsed
		}
	}
	return time.Duration(ttlHours) * time.Hour
}

func offlineArtifactExpiry(now time.Time, licenseExpiresAt *time.Time) time.Time {
	expiresAt := now.Add(offlineArtifactTTL())
	if licenseExpiresAt != nil && licenseExpiresAt.Before(expiresAt) {
		return licenseExpiresAt.UTC()
	}
	return expiresAt.UTC()
}

func buildOfflineLicenseArtifact(
	req models.ValidationRequest,
	response models.ValidationResponse,
) (string, string, *time.Time, error) {
	signingKeyValue := strings.TrimSpace(os.Getenv("IGRIS_OVERTURE_SIGNING_KEY"))
	if signingKeyValue == "" {
		return "", "", nil, nil
	}

	signingKey, err := decodeOfflineLicenseSigningKey(signingKeyValue)
	if err != nil {
		return "", "", nil, err
	}

	issuedAt := time.Now().UTC()
	expiresAt := offlineArtifactExpiry(issuedAt, response.ExpiresAt)
	payload := offlineLicenseArtifactPayload{
		Version:            1,
		LicenseKey:         req.LicenseKey,
		DeviceID:           req.DeviceID,
		RuntimeVersion:     req.RuntimeVersion,
		Tier:               response.Tier,
		CustomerEmail:      response.CustomerEmail,
		DevicesLimit:       response.DevicesLimit,
		DevicesActive:      response.DevicesActive,
		CloudRequestsLimit: response.CloudRequestsLimit,
		CloudRequestsUsed:  response.CloudRequestsUsed,
		Features:           response.Features,
		Status:             response.Status,
		LicenseExpiresAt:   response.ExpiresAt,
		ArtifactIssuedAt:   issuedAt,
		ArtifactExpiresAt:  expiresAt,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", "", nil, err
	}

	payloadHash := sha256.Sum256(payloadBytes)
	envelope := offlineLicenseArtifactEnvelope{
		Algorithm:     "ed25519-sha256",
		KeyID:         strings.TrimSpace(os.Getenv("IGRIS_LICENSE_OFFLINE_KEY_ID")),
		Payload:       base64.StdEncoding.EncodeToString(payloadBytes),
		PayloadSHA256: hex.EncodeToString(payloadHash[:]),
		Signature:     base64.StdEncoding.EncodeToString(ed25519.Sign(signingKey, payloadHash[:])),
	}

	envelopeBytes, err := json.Marshal(envelope)
	if err != nil {
		return "", "", nil, err
	}

	return string(envelopeBytes), envelope.KeyID, &expiresAt, nil
}

// RegisterLicenseRoutes registers license-related API routes
func RegisterLicenseRoutes(app *fiber.App, db *sql.DB) {
	handler := NewLicenseHandler(db)

	// v1 API routes (public, no auth required for runtime validation)
	v1 := app.Group("/api/v1/license")

	// License validation endpoint
	v1.Post("/validate", handler.ValidateLicense)

	// Device management endpoints
	v1.Post("/device/register", handler.RegisterDevice)
	v1.Post("/device/heartbeat", handler.Heartbeat)
	v1.Post("/device/deregister", handler.DeregisterDevice)

	log.Info().Msg("[Routes] ✓ Registered license API endpoints (/api/v1/license)")

	// Alias group at /v1/license — web-console calls GET /v1/license and POST /v1/license/activate.
	// These use Clerk auth so the console can read the tenant's current plan.
	consoleV1 := app.Group("/v1/license")
	consoleV1.Use(middleware.BetterAuth(db))
	consoleV1.Get("/", handler.GetLicenseInfo)
	consoleV1.Post("/activate", handler.ActivateLicense)

	log.Info().Msg("[Routes] ✓ Registered console license endpoints (/v1/license)")
}

// GetLicenseInfo handles GET /v1/license — returns the current tenant's license info.
func (h *LicenseHandler) GetLicenseInfo(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Look up the license associated with this tenant's customer_id
	var (
		licenseKey   string
		tier         string
		status       string
		devicesLimit int
		expiresAt    *time.Time
	)

	err := h.db.QueryRow(`
		SELECT license_key, tier, status, devices_limit, expires_at
		FROM licenses
		WHERE customer_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, tenantID).Scan(&licenseKey, &tier, &status, &devicesLimit, &expiresAt)

	if err == sql.ErrNoRows {
		// Return a zero-state license rather than 404 so the console renders cleanly
		return c.JSON(fiber.Map{
			"license_key":        "",
			"masked_key":         "",
			"plan":               "seed",
			"status":             "inactive",
			"quota_requests":     50000,
			"quota_used":         0,
			"quota_devices":      5,
			"quota_devices_used": 0,
			"features":           []string{},
		})
	}
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[License] GetLicenseInfo DB error")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to retrieve license information",
		})
	}

	// Get active device count
	var activeDevices int
	h.db.QueryRow(`
		SELECT COUNT(*)
		FROM devices d
		JOIN licenses l ON d.license_id = l.id
		WHERE l.customer_id = $1
		  AND d.status = 'active'
		  AND d.last_seen > NOW() - INTERVAL '1 hour'
	`, tenantID).Scan(&activeDevices)

	// Get usage this month
	var quotaUsed int
	h.db.QueryRow(`
		SELECT COALESCE(COUNT(*), 0)
		FROM usage_log ul
		JOIN licenses l ON ul.license_id = l.id
		WHERE l.customer_id = $1
		  AND ul.timestamp >= DATE_TRUNC('month', NOW())
	`, tenantID).Scan(&quotaUsed)

	// Derive quota limit from tier
	quotaRequests := 50000
	switch tier {
	case "horizon":
		quotaRequests = 500000
	case "infinite":
		quotaRequests = 2000000
	}

	var validUntil *string
	if expiresAt != nil {
		s := expiresAt.Format(time.RFC3339)
		validUntil = &s
	}

	return c.JSON(fiber.Map{
		"license_key":        licenseKey,
		"masked_key":         maskLicenseKey(licenseKey),
		"plan":               tier,
		"status":             status,
		"valid_until":        validUntil,
		"quota_requests":     quotaRequests,
		"quota_used":         quotaUsed,
		"quota_devices":      devicesLimit,
		"quota_devices_used": activeDevices,
		"features":           models.GetFeaturesForTier(tier),
	})
}

// ActivateLicense handles POST /v1/license/activate — associates a license key with the tenant.
func (h *LicenseHandler) ActivateLicense(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		LicenseKey string `json:"license_key"`
	}
	if err := c.BodyParser(&req); err != nil || req.LicenseKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_request",
			"message": "license_key is required",
		})
	}

	// Verify the key exists and is active
	var licenseID string
	var licStatus string
	err := h.db.QueryRow(`
		SELECT id, status FROM licenses WHERE license_key = $1
	`, req.LicenseKey).Scan(&licenseID, &licStatus)

	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "invalid_license",
			"message": "License key not found",
		})
	}
	if err != nil {
		log.Error().Err(err).Msg("[License] ActivateLicense DB error")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to activate license",
		})
	}

	if licStatus != "active" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "license_" + licStatus,
			"message": "License is " + licStatus,
		})
	}

	// Associate the license with this tenant
	_, err = h.db.Exec(`
		UPDATE licenses SET customer_id = $1 WHERE id = $2
	`, tenantID, licenseID)
	if err != nil {
		log.Error().Err(err).Str("license_id", licenseID).Msg("[License] ActivateLicense update error")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to activate license",
		})
	}

	log.Info().
		Str("tenant_id", tenantID).
		Str("license_key", maskLicenseKey(req.LicenseKey)).
		Msg("[License] License activated for tenant")

	return c.JSON(fiber.Map{
		"activated":   true,
		"license_key": maskLicenseKey(req.LicenseKey),
	})
}

// ValidateLicense handles POST /api/v1/license/validate
func (h *LicenseHandler) ValidateLicense(c *fiber.Ctx) error {
	var req models.ValidationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.ValidationResponse{
			Valid:   false,
			Error:   "invalid_request",
			Message: "Failed to parse request body",
		})
	}

	// Validate required fields
	if req.LicenseKey == "" || req.DeviceID == "" || req.RuntimeVersion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(models.ValidationResponse{
			Valid:   false,
			Error:   "missing_fields",
			Message: "license_key, device_id, and runtime_version are required",
		})
	}

	// Look up license
	var license models.License
	err := h.db.QueryRow(`
		SELECT id, license_key, tier, customer_email, customer_id, devices_limit, status, created_at, expires_at
		FROM licenses
		WHERE license_key = $1
	`, req.LicenseKey).Scan(
		&license.ID,
		&license.LicenseKey,
		&license.Tier,
		&license.CustomerEmail,
		&license.CustomerID,
		&license.DevicesLimit,
		&license.Status,
		&license.CreatedAt,
		&license.ExpiresAt,
	)

	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusForbidden).JSON(models.ValidationResponse{
			Valid:      false,
			Error:      "invalid_license",
			Message:    "License key not found",
			UpgradeURL: "https://igrisinertial.com/pricing",
		})
	}

	if err != nil {
		log.Error().Err(err).Str("license_key", maskLicenseKey(req.LicenseKey)).Msg("[License] Database error during validation")
		return c.Status(fiber.StatusInternalServerError).JSON(models.ValidationResponse{
			Valid:   false,
			Error:   "internal_error",
			Message: "Failed to validate license",
		})
	}

	// Check license status
	if license.Status != "active" {
		return c.Status(fiber.StatusForbidden).JSON(models.ValidationResponse{
			Valid:      false,
			Error:      "license_" + license.Status,
			Message:    "License is " + license.Status,
			UpgradeURL: "https://igrisinertial.com/pricing",
		})
	}

	// Check if license has expired
	if license.ExpiresAt != nil && license.ExpiresAt.Before(time.Now()) {
		return c.Status(fiber.StatusForbidden).JSON(models.ValidationResponse{
			Valid:      false,
			Error:      "license_expired",
			Message:    "License has expired",
			UpgradeURL: "https://igrisinertial.com/pricing",
		})
	}

	// Count active devices for this license
	var activeDevices int
	err = h.db.QueryRow(`
		SELECT COUNT(*)
		FROM devices
		WHERE license_id = $1
		AND status = 'active'
		AND last_seen > NOW() - INTERVAL '1 hour'
	`, license.ID).Scan(&activeDevices)

	if err != nil {
		log.Error().Err(err).Str("license_id", license.ID).Msg("[License] Failed to count active devices")
		activeDevices = 0
	}

	// Check if device already exists for this license
	var existingDeviceCount int
	err = h.db.QueryRow(`
		SELECT COUNT(*)
		FROM devices
		WHERE license_id = $1
		AND device_id = $2
	`, license.ID, req.DeviceID).Scan(&existingDeviceCount)

	if err != nil {
		log.Error().Err(err).Msg("[License] Failed to check existing device")
	}

	// Check device limit (allow if device already registered)
	if existingDeviceCount == 0 && activeDevices >= license.DevicesLimit {
		return c.Status(fiber.StatusForbidden).JSON(models.ValidationResponse{
			Valid:         false,
			Error:         "device_limit_exceeded",
			Message:       "License allows " + string(rune(license.DevicesLimit)) + " devices, currently " + string(rune(activeDevices)) + " active. Upgrade or deactivate devices.",
			DevicesLimit:  license.DevicesLimit,
			DevicesActive: activeDevices,
			UpgradeURL:    "https://igrisinertial.com/pricing",
		})
	}

	// Get features and cloud request limits for tier
	features := models.GetFeaturesForTier(license.Tier)
	cloudRequestsLimit := models.GetCloudRequestsLimit(license.Tier)

	// Get actual cloud requests used this month from usage tracking
	var cloudRequestsUsed int
	err = h.db.QueryRow(`
		SELECT COALESCE(get_monthly_cloud_requests($1), 0)
	`, license.ID).Scan(&cloudRequestsUsed)

	if err != nil {
		log.Error().Err(err).Str("license_id", license.ID).Msg("[License] Failed to get cloud request usage")
		cloudRequestsUsed = 0 // Fail open - don't block validation if usage query fails
	}

	// Check cloud request quota (only if not unlimited)
	if cloudRequestsLimit > 0 && cloudRequestsUsed >= cloudRequestsLimit {
		return c.Status(fiber.StatusForbidden).JSON(models.ValidationResponse{
			Valid:              false,
			Error:              "cloud_quota_exceeded",
			Message:            "Cloud request quota exceeded for this month. Upgrade your plan for higher limits.",
			Tier:               license.Tier,
			DevicesLimit:       license.DevicesLimit,
			DevicesActive:      activeDevices,
			CloudRequestsLimit: cloudRequestsLimit,
			CloudRequestsUsed:  cloudRequestsUsed,
			UpgradeURL:         "https://igrisinertial.com/pricing",
		})
	}

	// Return successful validation
	response := models.ValidationResponse{
		Valid:              true,
		Tier:               license.Tier,
		CustomerEmail:      license.CustomerEmail,
		DevicesLimit:       license.DevicesLimit,
		DevicesActive:      activeDevices,
		CloudRequestsLimit: cloudRequestsLimit,
		CloudRequestsUsed:  cloudRequestsUsed,
		Features:           features,
		ExpiresAt:          license.ExpiresAt,
		Status:             license.Status,
	}

	if artifact, keyID, artifactExpiresAt, err := buildOfflineLicenseArtifact(req, response); err != nil {
		log.Error().Err(err).Str("license_key", maskLicenseKey(req.LicenseKey)).Msg("[License] Failed to build offline artifact")
	} else if artifact != "" {
		response.OfflineArtifact = artifact
		response.OfflineArtifactKeyID = keyID
		response.OfflineArtifactExpiresAt = artifactExpiresAt
	}

	log.Info().
		Str("license_key", maskLicenseKey(req.LicenseKey)).
		Str("device_id", req.DeviceID).
		Str("tier", license.Tier).
		Int("devices_active", activeDevices).
		Int("devices_limit", license.DevicesLimit).
		Msg("[License] Validation successful")

	return c.JSON(response)
}

// RegisterDevice handles POST /api/v1/license/device/register
func (h *LicenseHandler) RegisterDevice(c *fiber.Ctx) error {
	var req models.RegisterDeviceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.RegisterDeviceResponse{
			Registered: false,
			Error:      "invalid_request",
			Message:    "Failed to parse request body",
		})
	}

	// Look up license
	var licenseID string
	var tier string
	err := h.db.QueryRow(`
		SELECT id, tier
		FROM licenses
		WHERE license_key = $1 AND status = 'active'
	`, req.LicenseKey).Scan(&licenseID, &tier)

	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusForbidden).JSON(models.RegisterDeviceResponse{
			Registered: false,
			Error:      "invalid_license",
			Message:    "License not found or inactive",
		})
	}

	if err != nil {
		log.Error().Err(err).Msg("[License] Failed to lookup license")
		return c.Status(fiber.StatusInternalServerError).JSON(models.RegisterDeviceResponse{
			Registered: false,
			Error:      "internal_error",
			Message:    "Failed to register device",
		})
	}

	// Extract device info
	hostname := ""
	platform := ""
	runtimeVersion := ""
	if req.DeviceInfo != nil {
		if h, ok := req.DeviceInfo["hostname"].(string); ok {
			hostname = h
		}
		if p, ok := req.DeviceInfo["platform"].(string); ok {
			platform = p
		}
		if rv, ok := req.DeviceInfo["runtime_version"].(string); ok {
			runtimeVersion = rv
		}
	}

	metadataJSON, _ := json.Marshal(req.DeviceInfo)

	// Upsert device (insert or update)
	_, err = h.db.Exec(`
		INSERT INTO devices (license_id, device_id, hostname, platform, runtime_version, first_seen, last_seen, status, metadata)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 'active', $6)
		ON CONFLICT (device_id)
		DO UPDATE SET
			hostname = EXCLUDED.hostname,
			platform = EXCLUDED.platform,
			runtime_version = EXCLUDED.runtime_version,
			last_seen = NOW(),
			status = 'active',
			metadata = EXCLUDED.metadata
	`, licenseID, req.DeviceID, hostname, platform, runtimeVersion, string(metadataJSON))

	if err != nil {
		log.Error().Err(err).Str("device_id", req.DeviceID).Msg("[License] Failed to register device")
		return c.Status(fiber.StatusInternalServerError).JSON(models.RegisterDeviceResponse{
			Registered: false,
			Error:      "internal_error",
			Message:    "Failed to register device",
		})
	}

	// Count total devices for this license
	var deviceCount int
	h.db.QueryRow(`
		SELECT COUNT(*)
		FROM devices
		WHERE license_id = $1 AND status = 'active'
	`, licenseID).Scan(&deviceCount)

	log.Info().
		Str("license_key", maskLicenseKey(req.LicenseKey)).
		Str("device_id", req.DeviceID).
		Str("tier", tier).
		Int("device_count", deviceCount).
		Msg("[License] Device registered")

	return c.JSON(models.RegisterDeviceResponse{
		Registered:  true,
		DeviceID:    req.DeviceID,
		DeviceCount: deviceCount,
	})
}

// Heartbeat handles POST /api/v1/license/device/heartbeat
func (h *LicenseHandler) Heartbeat(c *fiber.Ctx) error {
	var req models.HeartbeatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.HeartbeatResponse{
			Status: "error",
			Error:  "invalid_request",
		})
	}

	// Update last_seen timestamp
	var lastSeen time.Time
	err := h.db.QueryRow(`
		UPDATE devices
		SET last_seen = NOW(), status = 'active'
		WHERE device_id = $1
		AND license_id IN (SELECT id FROM licenses WHERE license_key = $2 AND status = 'active')
		RETURNING last_seen
	`, req.DeviceID, req.LicenseKey).Scan(&lastSeen)

	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(models.HeartbeatResponse{
			Status: "not_found",
			Error:  "Device not registered or license inactive",
		})
	}

	if err != nil {
		log.Error().Err(err).Str("device_id", req.DeviceID).Msg("[License] Heartbeat failed")
		return c.Status(fiber.StatusInternalServerError).JSON(models.HeartbeatResponse{
			Status: "error",
			Error:  "Failed to update heartbeat",
		})
	}

	return c.JSON(models.HeartbeatResponse{
		Status:   "active",
		LastSeen: &lastSeen,
	})
}

// DeregisterDevice handles POST /api/v1/license/device/deregister
func (h *LicenseHandler) DeregisterDevice(c *fiber.Ctx) error {
	var req models.DeregisterDeviceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.DeregisterDeviceResponse{
			Deregistered: false,
			Error:        "invalid_request",
		})
	}

	// Get license ID
	var licenseID string
	err := h.db.QueryRow(`
		SELECT id FROM licenses WHERE license_key = $1
	`, req.LicenseKey).Scan(&licenseID)

	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(models.DeregisterDeviceResponse{
			Deregistered: false,
			Error:        "invalid_license",
		})
	}

	// Mark device as inactive
	_, err = h.db.Exec(`
		UPDATE devices
		SET status = 'inactive'
		WHERE device_id = $1 AND license_id = $2
	`, req.DeviceID, licenseID)

	if err != nil {
		log.Error().Err(err).Str("device_id", req.DeviceID).Msg("[License] Deregistration failed")
		return c.Status(fiber.StatusInternalServerError).JSON(models.DeregisterDeviceResponse{
			Deregistered: false,
			Error:        "internal_error",
		})
	}

	// Count remaining active devices
	var deviceCount int
	h.db.QueryRow(`
		SELECT COUNT(*)
		FROM devices
		WHERE license_id = $1 AND status = 'active'
	`, licenseID).Scan(&deviceCount)

	log.Info().
		Str("license_key", maskLicenseKey(req.LicenseKey)).
		Str("device_id", req.DeviceID).
		Int("remaining_devices", deviceCount).
		Msg("[License] Device deregistered")

	return c.JSON(models.DeregisterDeviceResponse{
		Deregistered: true,
		DeviceCount:  deviceCount,
	})
}

// maskLicenseKey masks a license key for logging (shows only prefix and suffix)
func maskLicenseKey(key string) string {
	if len(key) <= 10 {
		return "****"
	}
	return key[:8] + "****" + key[len(key)-4:]
}
