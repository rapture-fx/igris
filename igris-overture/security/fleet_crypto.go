package security

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"fmt"
)

// VerifyEd25519Signature verifies an Ed25519 signature against a public key and message
//
// Parameters:
//   - publicKeyBase64: Base64-encoded Ed25519 public key (32 bytes)
//   - signatureBase64: Base64-encoded Ed25519 signature (64 bytes)
//   - message: The original message that was signed
//
// Returns:
//   - error: nil if verification succeeds, error otherwise
func VerifyEd25519Signature(publicKeyBase64, signatureBase64 string, message []byte) error {
	// Decode base64 public key
	publicKeyBytes, err := base64.StdEncoding.DecodeString(publicKeyBase64)
	if err != nil {
		return fmt.Errorf("failed to decode public key: %w", err)
	}

	if len(publicKeyBytes) != ed25519.PublicKeySize {
		return fmt.Errorf("invalid public key length: expected %d bytes, got %d", ed25519.PublicKeySize, len(publicKeyBytes))
	}

	publicKey := ed25519.PublicKey(publicKeyBytes)

	// Decode base64 signature
	signatureBytes, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		return fmt.Errorf("failed to decode signature: %w", err)
	}

	if len(signatureBytes) != ed25519.SignatureSize {
		return fmt.Errorf("invalid signature length: expected %d bytes, got %d", ed25519.SignatureSize, len(signatureBytes))
	}

	// Verify signature
	if !ed25519.Verify(publicKey, message, signatureBytes) {
		return fmt.Errorf("signature verification failed")
	}

	return nil
}

// VerifyJSONPayloadSignature verifies a signature for a JSON payload
//
// This is a convenience function that serializes the payload to JSON (canonical form)
// and then verifies the signature.
//
// Parameters:
//   - publicKeyBase64: Base64-encoded Ed25519 public key
//   - signatureBase64: Base64-encoded Ed25519 signature
//   - payload: The JSON payload struct that was signed
//
// Returns:
//   - error: nil if verification succeeds, error otherwise
func VerifyJSONPayloadSignature(publicKeyBase64, signatureBase64 string, payload interface{}) error {
	// Serialize payload to JSON (same as what Runtime does)
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to serialize payload: %w", err)
	}

	// Verify signature
	return VerifyEd25519Signature(publicKeyBase64, signatureBase64, payloadBytes)
}
