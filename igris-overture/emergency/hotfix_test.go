package emergency

import (
	"crypto/ed25519"
	"encoding/base64"
	"testing"
	"time"
)

func TestPolicyStore_UpdatePolicy(t *testing.T) {
	// Generate key pair
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	publicKeyBase64 := base64.StdEncoding.EncodeToString(publicKey)
	store, err := NewPolicyStore(publicKeyBase64)
	if err != nil {
		t.Fatalf("Failed to create policy store: %v", err)
	}

	// Create and sign a policy
	policyBlob := "encrypted-policy-data"
	expiresAt := time.Now().Add(24 * time.Hour).UnixMilli()

	policy, err := SignPolicy(policyBlob, privateKey, 1, expiresAt, "admin", "test update")
	if err != nil {
		t.Fatalf("Failed to sign policy: %v", err)
	}

	// Update policy
	err = store.UpdatePolicy(policy)
	if err != nil {
		t.Errorf("Failed to update policy: %v", err)
	}

	// Verify policy was stored
	storedPolicy := store.GetPolicy()
	if storedPolicy == nil {
		t.Fatal("Policy was not stored")
	}

	if storedPolicy.EncryptedPolicy != policyBlob {
		t.Errorf("Policy blob mismatch: got %s, want %s", storedPolicy.EncryptedPolicy, policyBlob)
	}

	if storedPolicy.Version != 1 {
		t.Errorf("Policy version mismatch: got %d, want 1", storedPolicy.Version)
	}
}

func TestPolicyStore_RejectExpiredPolicy(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	publicKeyBase64 := base64.StdEncoding.EncodeToString(publicKey)
	store, err := NewPolicyStore(publicKeyBase64)
	if err != nil {
		t.Fatalf("Failed to create policy store: %v", err)
	}

	// Create expired policy
	expiresAt := time.Now().Add(-1 * time.Hour).UnixMilli()
	policy, err := SignPolicy("test-policy", privateKey, 1, expiresAt, "admin", "expired test")
	if err != nil {
		t.Fatalf("Failed to sign policy: %v", err)
	}

	// Should reject expired policy
	err = store.UpdatePolicy(policy)
	if err == nil {
		t.Error("Expected error for expired policy, got nil")
	}
}

func TestPolicyStore_RejectOlderVersion(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	publicKeyBase64 := base64.StdEncoding.EncodeToString(publicKey)
	store, err := NewPolicyStore(publicKeyBase64)
	if err != nil {
		t.Fatalf("Failed to create policy store: %v", err)
	}

	expiresAt := time.Now().Add(24 * time.Hour).UnixMilli()

	// Add version 2 policy
	policy2, err := SignPolicy("policy-v2", privateKey, 2, expiresAt, "admin", "v2")
	if err != nil {
		t.Fatalf("Failed to sign policy: %v", err)
	}

	err = store.UpdatePolicy(policy2)
	if err != nil {
		t.Fatalf("Failed to update policy: %v", err)
	}

	// Try to add version 1 policy (should fail)
	policy1, err := SignPolicy("policy-v1", privateKey, 1, expiresAt, "admin", "v1")
	if err != nil {
		t.Fatalf("Failed to sign policy: %v", err)
	}

	err = store.UpdatePolicy(policy1)
	if err == nil {
		t.Error("Expected error for older version, got nil")
	}
}

func TestPolicyStore_RejectInvalidSignature(t *testing.T) {
	// Generate two key pairs
	publicKey1, _, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	_, privateKey2, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	// Create store with publicKey1
	publicKeyBase64 := base64.StdEncoding.EncodeToString(publicKey1)
	store, err := NewPolicyStore(publicKeyBase64)
	if err != nil {
		t.Fatalf("Failed to create policy store: %v", err)
	}

	// Sign policy with privateKey2 (wrong key)
	expiresAt := time.Now().Add(24 * time.Hour).UnixMilli()
	policy, err := SignPolicy("test-policy", privateKey2, 1, expiresAt, "admin", "test")
	if err != nil {
		t.Fatalf("Failed to sign policy: %v", err)
	}

	// Should reject due to signature mismatch
	err = store.UpdatePolicy(policy)
	if err == nil {
		t.Error("Expected error for invalid signature, got nil")
	}
}

func TestPolicyStore_GetPolicySince(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	publicKeyBase64 := base64.StdEncoding.EncodeToString(publicKey)
	store, err := NewPolicyStore(publicKeyBase64)
	if err != nil {
		t.Fatalf("Failed to create policy store: %v", err)
	}

	expiresAt := time.Now().Add(24 * time.Hour).UnixMilli()

	// Add version 5 policy
	policy, err := SignPolicy("policy-v5", privateKey, 5, expiresAt, "admin", "v5")
	if err != nil {
		t.Fatalf("Failed to sign policy: %v", err)
	}

	err = store.UpdatePolicy(policy)
	if err != nil {
		t.Fatalf("Failed to update policy: %v", err)
	}

	// Should return policy when requesting since version 4
	result := store.GetPolicySince(4)
	if result == nil {
		t.Error("Expected policy, got nil")
	}

	// Should return nil when requesting since version 5 (not newer)
	result = store.GetPolicySince(5)
	if result != nil {
		t.Error("Expected nil for same version, got policy")
	}

	// Should return nil when requesting since version 6 (current is older)
	result = store.GetPolicySince(6)
	if result != nil {
		t.Error("Expected nil for newer version, got policy")
	}
}

func TestGenerateKeyPair(t *testing.T) {
	publicKeyBase64, privateKeyBase64, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	// Verify lengths
	publicKeyBytes, err := base64.StdEncoding.DecodeString(publicKeyBase64)
	if err != nil {
		t.Fatalf("Failed to decode public key: %v", err)
	}

	if len(publicKeyBytes) != ed25519.PublicKeySize {
		t.Errorf("Public key size mismatch: got %d, want %d", len(publicKeyBytes), ed25519.PublicKeySize)
	}

	privateKeyBytes, err := base64.StdEncoding.DecodeString(privateKeyBase64)
	if err != nil {
		t.Fatalf("Failed to decode private key: %v", err)
	}

	if len(privateKeyBytes) != ed25519.PrivateKeySize {
		t.Errorf("Private key size mismatch: got %d, want %d", len(privateKeyBytes), ed25519.PrivateKeySize)
	}
}

func TestSerializeDeserializePolicy(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	expiresAt := time.Now().Add(24 * time.Hour).UnixMilli()
	policy, err := SignPolicy("test-policy", privateKey, 1, expiresAt, "admin", "test")
	if err != nil {
		t.Fatalf("Failed to sign policy: %v", err)
	}

	// Serialize
	data, err := SerializePolicy(policy)
	if err != nil {
		t.Fatalf("Failed to serialize policy: %v", err)
	}

	// Deserialize
	deserialized, err := DeserializePolicy(data)
	if err != nil {
		t.Fatalf("Failed to deserialize policy: %v", err)
	}

	// Verify
	if deserialized.EncryptedPolicy != policy.EncryptedPolicy {
		t.Errorf("Policy blob mismatch after serialization")
	}

	if deserialized.Version != policy.Version {
		t.Errorf("Version mismatch after serialization")
	}

	// Verify signature still valid
	publicKeyBase64 := base64.StdEncoding.EncodeToString(publicKey)
	store, err := NewPolicyStore(publicKeyBase64)
	if err != nil {
		t.Fatalf("Failed to create policy store: %v", err)
	}

	err = store.UpdatePolicy(deserialized)
	if err != nil {
		t.Errorf("Deserialized policy failed verification: %v", err)
	}
}
