package api

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
)

func TestBuildOfflineLicenseArtifactSignsPayload(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}

	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))
	t.Setenv("IGRIS_LICENSE_OFFLINE_KEY_ID", "offline-key-1")
	t.Setenv("IGRIS_LICENSE_OFFLINE_ARTIFACT_TTL_HOURS", "24")

	licenseExpiresAt := time.Now().UTC().Add(72 * time.Hour).Truncate(time.Second)
	artifact, keyID, artifactExpiresAt, err := buildOfflineLicenseArtifact(
		models.ValidationRequest{
			LicenseKey:     "lic_seed_test",
			DeviceID:       "dev_test",
			RuntimeVersion: "1.6.0",
		},
		models.ValidationResponse{
			Valid:              true,
			Tier:               "seed",
			CustomerEmail:      "user@example.com",
			DevicesLimit:       3,
			DevicesActive:      1,
			CloudRequestsLimit: 50000,
			CloudRequestsUsed:  12,
			Features:           models.GetFeaturesForTier("seed"),
			ExpiresAt:          &licenseExpiresAt,
			Status:             "active",
		},
	)
	if err != nil {
		t.Fatalf("buildOfflineLicenseArtifact() error = %v", err)
	}
	if artifact == "" {
		t.Fatal("buildOfflineLicenseArtifact() artifact = empty")
	}
	if keyID != "offline-key-1" {
		t.Fatalf("keyID = %q, want offline-key-1", keyID)
	}
	if artifactExpiresAt == nil {
		t.Fatal("artifactExpiresAt = nil")
	}

	var envelope offlineLicenseArtifactEnvelope
	if err := json.Unmarshal([]byte(artifact), &envelope); err != nil {
		t.Fatalf("json.Unmarshal(envelope) error = %v", err)
	}
	if envelope.Algorithm != "ed25519-sha256" {
		t.Fatalf("Algorithm = %q, want ed25519-sha256", envelope.Algorithm)
	}
	if envelope.KeyID != "offline-key-1" {
		t.Fatalf("KeyID = %q, want offline-key-1", envelope.KeyID)
	}

	payloadBytes, err := base64.StdEncoding.DecodeString(envelope.Payload)
	if err != nil {
		t.Fatalf("DecodeString(payload) error = %v", err)
	}
	var payload offlineLicenseArtifactPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		t.Fatalf("json.Unmarshal(payload) error = %v", err)
	}
	if payload.DeviceID != "dev_test" {
		t.Fatalf("payload.DeviceID = %q, want dev_test", payload.DeviceID)
	}
	if payload.LicenseKey != "lic_seed_test" {
		t.Fatalf("payload.LicenseKey = %q, want lic_seed_test", payload.LicenseKey)
	}
	if payload.ArtifactExpiresAt.After(licenseExpiresAt) {
		t.Fatalf("payload.ArtifactExpiresAt = %v, want <= %v", payload.ArtifactExpiresAt, licenseExpiresAt)
	}

	payloadHash := sha256.Sum256(payloadBytes)
	if got := hex.EncodeToString(payloadHash[:]); got != envelope.PayloadSHA256 {
		t.Fatalf("PayloadSHA256 = %q, want %q", envelope.PayloadSHA256, got)
	}
	signature, err := base64.StdEncoding.DecodeString(envelope.Signature)
	if err != nil {
		t.Fatalf("DecodeString(signature) error = %v", err)
	}
	if !ed25519.Verify(publicKey, payloadHash[:], signature) {
		t.Fatal("artifact signature did not verify")
	}
}

func TestBuildOfflineLicenseArtifactReturnsEmptyWithoutSigningKey(t *testing.T) {
	artifact, keyID, expiresAt, err := buildOfflineLicenseArtifact(
		models.ValidationRequest{LicenseKey: "lic_seed_test", DeviceID: "dev_test", RuntimeVersion: "1.6.0"},
		models.ValidationResponse{Valid: true, Tier: "seed", Features: models.GetFeaturesForTier("seed"), Status: "active"},
	)
	if err != nil {
		t.Fatalf("buildOfflineLicenseArtifact() error = %v", err)
	}
	if artifact != "" || keyID != "" || expiresAt != nil {
		t.Fatalf("expected empty artifact response, got artifact=%q keyID=%q expiresAt=%v", artifact, keyID, expiresAt)
	}
}
