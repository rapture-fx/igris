// Package models provides data structures for the license system
package models

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// License represents a software license for igris-runtime
type License struct {
	ID            string     `json:"id" db:"id"`
	LicenseKey    string     `json:"license_key" db:"license_key"`
	Tier          string     `json:"tier" db:"tier"` // seed, horizon, infinite, enterprise
	CustomerEmail string     `json:"customer_email" db:"customer_email"`
	CustomerID    string     `json:"customer_id,omitempty" db:"customer_id"`
	DevicesLimit  int        `json:"devices_limit" db:"devices_limit"`
	Status        string     `json:"status" db:"status"` // active, suspended, expired
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty" db:"expires_at"`
	Metadata      string     `json:"metadata,omitempty" db:"metadata"` // JSONB stored as string
}

// Device represents a device registered under a license
type Device struct {
	ID             string    `json:"id" db:"id"`
	LicenseID      string    `json:"license_id" db:"license_id"`
	DeviceID       string    `json:"device_id" db:"device_id"`
	Hostname       string    `json:"hostname,omitempty" db:"hostname"`
	Platform       string    `json:"platform,omitempty" db:"platform"`
	RuntimeVersion string    `json:"runtime_version,omitempty" db:"runtime_version"`
	FirstSeen      time.Time `json:"first_seen" db:"first_seen"`
	LastSeen       time.Time `json:"last_seen" db:"last_seen"`
	Status         string    `json:"status" db:"status"`               // active, inactive
	Metadata       string    `json:"metadata,omitempty" db:"metadata"` // JSONB stored as string
}

// LicenseFeatures represents feature flags for a license tier
type LicenseFeatures struct {
	// Core features (all tiers)
	ExecutionLayer    bool `json:"execution_layer"`
	IntelligenceLayer bool `json:"intelligence_layer"`
	MemoryLayer       bool `json:"memory_layer"`
	ProofLayer        bool `json:"proof_layer"`

	// Dashboard features (Horizon+)
	DashboardAccess     bool `json:"dashboard_access"`
	FleetMonitoring     bool `json:"fleet_monitoring"`
	CostOptimization    bool `json:"cost_optimization"`
	PerformanceHeatmaps bool `json:"performance_heatmaps"`
	AuditTrails         bool `json:"audit_trails"` // 7-day retention
	OTAUpdates          bool `json:"ota_updates"`

	// Enterprise features (Infinite)
	OnPremise         bool `json:"on_premise"`
	CustomSLA         bool `json:"custom_sla"`
	ExtendedRetention bool `json:"extended_retention"` // 90+ days
	DedicatedSupport  bool `json:"dedicated_support"`
}

// ValidationRequest represents a license validation request
type ValidationRequest struct {
	LicenseKey     string `json:"license_key" validate:"required"`
	DeviceID       string `json:"device_id" validate:"required"`
	RuntimeVersion string `json:"runtime_version" validate:"required"`
}

// ValidationResponse represents a license validation response
type ValidationResponse struct {
	Valid                    bool            `json:"valid"`
	Tier                     string          `json:"tier,omitempty"`
	CustomerEmail            string          `json:"customer_email,omitempty"`
	DevicesLimit             int             `json:"devices_limit,omitempty"`
	DevicesActive            int             `json:"devices_active,omitempty"`
	CloudRequestsLimit       int             `json:"cloud_requests_limit,omitempty"` // Cloud requests/month included
	CloudRequestsUsed        int             `json:"cloud_requests_used,omitempty"`  // Cloud requests used this month
	Features                 LicenseFeatures `json:"features,omitempty"`
	ExpiresAt                *time.Time      `json:"expires_at,omitempty"`
	Status                   string          `json:"status,omitempty"`
	OfflineArtifact          string          `json:"offline_artifact,omitempty"`
	OfflineArtifactKeyID     string          `json:"offline_artifact_key_id,omitempty"`
	OfflineArtifactExpiresAt *time.Time      `json:"offline_artifact_expires_at,omitempty"`
	Error                    string          `json:"error,omitempty"`
	Message                  string          `json:"message,omitempty"`
	UpgradeURL               string          `json:"upgrade_url,omitempty"`
}

// RegisterDeviceRequest represents a device registration request
type RegisterDeviceRequest struct {
	LicenseKey string                 `json:"license_key" validate:"required"`
	DeviceID   string                 `json:"device_id" validate:"required"`
	DeviceInfo map[string]interface{} `json:"device_info"`
}

// RegisterDeviceResponse represents a device registration response
type RegisterDeviceResponse struct {
	Registered  bool   `json:"registered"`
	DeviceID    string `json:"device_id"`
	DeviceCount int    `json:"device_count"`
	Error       string `json:"error,omitempty"`
	Message     string `json:"message,omitempty"`
}

// HeartbeatRequest represents a device heartbeat request
type HeartbeatRequest struct {
	LicenseKey string `json:"license_key" validate:"required"`
	DeviceID   string `json:"device_id" validate:"required"`
}

// HeartbeatResponse represents a device heartbeat response
type HeartbeatResponse struct {
	Status   string     `json:"status"`
	LastSeen *time.Time `json:"last_seen,omitempty"`
	Error    string     `json:"error,omitempty"`
}

// DeregisterDeviceRequest represents a device deregistration request
type DeregisterDeviceRequest struct {
	LicenseKey string `json:"license_key" validate:"required"`
	DeviceID   string `json:"device_id" validate:"required"`
}

// DeregisterDeviceResponse represents a device deregistration response
type DeregisterDeviceResponse struct {
	Deregistered bool   `json:"deregistered"`
	DeviceCount  int    `json:"device_count"`
	Error        string `json:"error,omitempty"`
}

// GetCloudRequestsLimit returns the monthly cloud request limit for a tier
func GetCloudRequestsLimit(tier string) int {
	switch tier {
	case "seed":
		return 50000 // 50k requests/month
	case "horizon":
		return 500000 // 500k requests/month
	case "infinite":
		return 2000000 // 2M requests/month
	case "enterprise":
		return -1 // Unlimited
	default:
		return 0
	}
}

// GetFeaturesForTier returns the feature flags for a given tier
func GetFeaturesForTier(tier string) LicenseFeatures {
	switch tier {
	case "seed":
		return LicenseFeatures{
			// Core nervous system - all included
			ExecutionLayer:    true,
			IntelligenceLayer: true,
			MemoryLayer:       true,
			ProofLayer:        true,
			// No dashboard features
			DashboardAccess:     false,
			FleetMonitoring:     false,
			CostOptimization:    false,
			PerformanceHeatmaps: false,
			AuditTrails:         false,
			OTAUpdates:          false,
			// No enterprise features
			OnPremise:         false,
			CustomSLA:         false,
			ExtendedRetention: false,
			DedicatedSupport:  false,
		}
	case "horizon":
		return LicenseFeatures{
			// Everything from Seed
			ExecutionLayer:    true,
			IntelligenceLayer: true,
			MemoryLayer:       true,
			ProofLayer:        true,
			// Dashboard features unlocked
			DashboardAccess:     true,
			FleetMonitoring:     true,
			CostOptimization:    true,
			PerformanceHeatmaps: true,
			AuditTrails:         true, // 7-day
			OTAUpdates:          true,
			// No enterprise features yet
			OnPremise:         false,
			CustomSLA:         false,
			ExtendedRetention: false,
			DedicatedSupport:  false,
		}
	case "infinite", "enterprise":
		return LicenseFeatures{
			// Everything enabled
			ExecutionLayer:      true,
			IntelligenceLayer:   true,
			MemoryLayer:         true,
			ProofLayer:          true,
			DashboardAccess:     true,
			FleetMonitoring:     true,
			CostOptimization:    true,
			PerformanceHeatmaps: true,
			AuditTrails:         true,
			OTAUpdates:          true,
			OnPremise:           true,
			CustomSLA:           true,
			ExtendedRetention:   true,
			DedicatedSupport:    true,
		}
	default:
		// Return all disabled for unknown tiers
		return LicenseFeatures{}
	}
}

// GenerateLicenseKey generates a license key for the given tier
// Format: lic_[tier]_[random12]_[checksum4]
// Example: lic_horizon_a1b2c3d4e5f6_d3e4
func GenerateLicenseKey(tier string) (string, error) {
	// Generate 12 random characters
	randomBytes := make([]byte, 6)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	randomPart := hex.EncodeToString(randomBytes)

	// Generate checksum from tier + random part
	checksumData := fmt.Sprintf("%s:%s", tier, randomPart)
	hash := sha256.Sum256([]byte(checksumData))
	checksum := hex.EncodeToString(hash[:2])

	// Construct license key
	licenseKey := fmt.Sprintf("lic_%s_%s_%s", tier, randomPart, checksum)
	return licenseKey, nil
}

// GetDevicesLimit returns the device limit for a tier
func GetDevicesLimit(tier string) int {
	switch tier {
	case "seed":
		return 1
	case "horizon":
		return 50
	case "infinite":
		return 250
	case "enterprise":
		return -1 // Unlimited
	default:
		return 0
	}
}
