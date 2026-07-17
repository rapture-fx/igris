package verifier

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/asn1"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"strings"
)

// KeyCandidate is one supplied verification key under its declared lookup
// identifier. The identifier is the schema-1 truncated key reference the
// caller asserts for lookup; resolution never trusts it beyond selecting the
// candidate.
type KeyCandidate struct {
	ID  string
	Key []byte
}

// TruncatedKeyID computes the schema-1 lookup hint:
// "ed25519:" + SHA-256(raw 32-byte public key) hex, truncated to 16 hex
// characters.
func TruncatedKeyID(publicKey []byte) string {
	digest := sha256.Sum256(publicKey)
	return "ed25519:" + hex.EncodeToString(digest[:])[:16]
}

// LoadPublicKey parses Ed25519 public-key material from PEM (PKIX), padded
// standard base64 of the raw 32 bytes, or 64 hex characters. It refuses
// private-key material and oversized input.
func LoadPublicKey(raw []byte, limits Limits) ([]byte, error) {
	if limits.MaxKeyBytes > 0 && len(raw) > limits.MaxKeyBytes {
		return nil, errors.New("public-key material exceeds the bounded size limit")
	}
	trimmed := strings.TrimSpace(string(raw))
	if strings.Contains(trimmed, "PRIVATE") {
		return nil, errors.New("refusing to load private-key material as a verification key")
	}
	if strings.HasPrefix(trimmed, "-----BEGIN") {
		block, _ := pem.Decode([]byte(trimmed))
		if block == nil || block.Type != "PUBLIC KEY" {
			return nil, errors.New("unsupported PEM public-key block")
		}
		return parseEd25519SPKI(block.Bytes)
	}
	// A 64-character hex key is also alphabet-valid base64 (of the wrong
	// decoded length), so each encoding is accepted only when it yields
	// exactly the Ed25519 public-key size.
	if decoded, err := base64.StdEncoding.Strict().DecodeString(trimmed); err == nil && len(decoded) == ed25519.PublicKeySize {
		return decoded, nil
	}
	if decoded, err := hex.DecodeString(trimmed); err == nil && len(decoded) == ed25519.PublicKeySize {
		return decoded, nil
	}
	return nil, errors.New("unrecognized public-key encoding or wrong key length")
}

// oidEd25519 is the id-Ed25519 algorithm identifier from RFC 8410.
var oidEd25519 = asn1.ObjectIdentifier{1, 3, 101, 112}

// parseEd25519SPKI decodes an RFC 8410 SubjectPublicKeyInfo carrying an
// Ed25519 public key. The focused decoder (encoding/asn1 only) exists so the
// verifier's build graph stays free of crypto/x509 and its transitive network
// packages.
func parseEd25519SPKI(der []byte) ([]byte, error) {
	var info struct {
		Algorithm struct {
			Algorithm  asn1.ObjectIdentifier
			Parameters asn1.RawValue `asn1:"optional"`
		}
		PublicKey asn1.BitString
	}
	rest, err := asn1.Unmarshal(der, &info)
	if err != nil {
		return nil, errors.New("invalid SubjectPublicKeyInfo encoding")
	}
	if len(rest) != 0 {
		return nil, errors.New("trailing bytes after SubjectPublicKeyInfo")
	}
	if !info.Algorithm.Algorithm.Equal(oidEd25519) {
		return nil, errors.New("public key is not Ed25519")
	}
	if len(info.Algorithm.Parameters.FullBytes) != 0 {
		// RFC 8410: the parameters field MUST be absent for Ed25519.
		return nil, errors.New("unexpected Ed25519 algorithm parameters")
	}
	if info.PublicKey.BitLength != ed25519.PublicKeySize*8 {
		return nil, errors.New("Ed25519 public key must be exactly 32 bytes")
	}
	return info.PublicKey.Bytes, nil
}

// resolveKey selects one verification key for the submitted schema-1 key_id.
// Zero matches is unknown; two or more distinct keys under the same declared
// identifier is ambiguous and fails closed.
type keyResolution int

const (
	keyResolved keyResolution = iota
	keyUnknown
	keyAmbiguous
)

func resolveKey(keyID string, candidates []KeyCandidate) ([]byte, keyResolution) {
	var selected []byte
	for _, candidate := range candidates {
		if candidate.ID != keyID || len(candidate.Key) != ed25519.PublicKeySize {
			continue
		}
		if selected == nil {
			selected = candidate.Key
			continue
		}
		if !bytesEqual(selected, candidate.Key) {
			return nil, keyAmbiguous
		}
	}
	if selected == nil {
		return nil, keyUnknown
	}
	return selected, keyResolved
}

func bytesEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// verifyEventSignature checks the schema-1 signature rule: padded standard
// base64, exactly 64 signature bytes, Ed25519 over the recomputed raw 32-byte
// SHA-256 digest of the canonical unsigned payload. It never trusts the
// submitted event_hash.
func verifyEventSignature(signature string, publicKey []byte, digest []byte) bool {
	if strings.ContainsAny(signature, "\r\n") {
		return false
	}
	decoded, err := base64.StdEncoding.Strict().DecodeString(signature)
	if err != nil || len(decoded) != ed25519.SignatureSize {
		return false
	}
	return ed25519.Verify(ed25519.PublicKey(publicKey), digest, decoded)
}
