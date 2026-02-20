package internal

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"testing"
)

// buildAndSignEnvelope marshals the given fields (without a "signature" key),
// SHA-256 hashes the canonical bytes, signs with priv, and attaches the
// base64-encoded signature to the map in-place.
func buildAndSignEnvelope(t *testing.T, priv ed25519.PrivateKey, fields map[string]interface{}) map[string]interface{} {
	t.Helper()
	delete(fields, "signature") // ensure clean state
	b, err := json.Marshal(fields)
	if err != nil {
		t.Fatalf("buildAndSignEnvelope: marshal: %v", err)
	}
	hash := sha256.Sum256(b)
	sig := ed25519.Sign(priv, hash[:])
	fields["signature"] = base64.StdEncoding.EncodeToString(sig)
	return fields
}

// TestVerifyEnvelope_Valid verifies that a correctly signed envelope passes
// verification without error.
func TestVerifyEnvelope_Valid(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	envelope := buildAndSignEnvelope(t, priv, map[string]interface{}{
		"execution_id":     "exec-001",
		"finish_reason":    "stop",
		"model":            "gpt-4o",
		"request_hash":     "aabbccdd",
		"response_hash":    "eeff0011",
		"routing_decision": "openai",
		"timestamp":        "2026-02-20T12:00:00Z",
	})

	c := &RuntimeClient{publicKey: pub}
	if err := c.verifyEnvelope(envelope); err != nil {
		t.Fatalf("expected nil error for valid envelope, got: %v", err)
	}
}

// TestVerifyEnvelope_Tampered verifies that modifying any field after signing
// causes verification to return an error.
func TestVerifyEnvelope_Tampered(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	envelope := buildAndSignEnvelope(t, priv, map[string]interface{}{
		"execution_id":     "exec-002",
		"finish_reason":    "stop",
		"model":            "claude-3-5-sonnet",
		"request_hash":     "aabbccdd",
		"response_hash":    "eeff0011",
		"routing_decision": "anthropic",
		"timestamp":        "2026-02-20T12:00:00Z",
	})

	// Tamper: change the model field after signing.
	envelope["model"] = "gpt-4o"

	c := &RuntimeClient{publicKey: pub}
	if err := c.verifyEnvelope(envelope); err == nil {
		t.Fatal("expected verification error for tampered envelope, got nil")
	}
}

// TestVerifyEnvelope_NoKey verifies that when no public key is configured,
// verification is skipped and returns nil regardless of envelope content.
func TestVerifyEnvelope_NoKey(t *testing.T) {
	c := &RuntimeClient{} // publicKey is nil
	envelope := map[string]interface{}{
		"execution_id": "exec-003",
		"model":        "gpt-4o",
		"signature":    "not-a-real-signature",
	}
	if err := c.verifyEnvelope(envelope); err != nil {
		t.Fatalf("expected nil (no key configured), got: %v", err)
	}
}
