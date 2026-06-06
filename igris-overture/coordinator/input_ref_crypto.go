package coordinator

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

const executionInputRefKeyEnv = "IGRIS_EXECUTION_INPUT_REF_KEY"
const executionInputRefKeyVersionEnv = "IGRIS_EXECUTION_INPUT_REF_KEY_VERSION"
const executionInputRefKeyringEnv = "IGRIS_EXECUTION_INPUT_REF_KEYS"
const executionInputRefActiveKeyVersionEnv = "IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION"

const defaultExecutionInputRefKeyVersion = "env:v1"

var (
	ErrExecutionInputRefKeyMissing        = errors.New("execution input ref encryption key missing")
	ErrExecutionInputRefKeyVersionMissing = errors.New("execution input ref key version missing")
	ErrExecutionInputRefDecrypt           = errors.New("execution input ref decrypt denied")
)

type executionInputCipher struct {
	keyVersion     string
	keyFingerprint string
	gcm            cipher.AEAD
}

// executionInputKeyring holds one active encryption key version plus any number
// of historical decryption keys. Encryption always uses the active version;
// decryption selects the key by the encrypted ref's stored key_version. There is
// no implicit fallback to another version: an unknown version fails closed.
type executionInputKeyring struct {
	activeKeyVersion string
	ciphers          map[string]*executionInputCipher
}

func newExecutionInputCipher(rawKey, keyVersion string) (*executionInputCipher, error) {
	key, err := decodeExecutionInputKey(rawKey)
	if err != nil {
		return nil, err
	}
	return newExecutionInputCipherFromKeyBytes(key, keyVersion)
}

func newExecutionInputCipherFromKeyBytes(key []byte, keyVersion string) (*executionInputCipher, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("execution input ref key must decode to 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create input ref cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create input ref gcm: %w", err)
	}
	keyVersion = strings.TrimSpace(keyVersion)
	if keyVersion == "" {
		keyVersion = defaultExecutionInputRefKeyVersion
	}
	fingerprint := sha256.Sum256(key)
	return &executionInputCipher{
		keyVersion:     keyVersion,
		keyFingerprint: hex.EncodeToString(fingerprint[:]),
		gcm:            gcm,
	}, nil
}

// newExecutionInputKeyringFromEnv builds the keyring from environment configuration.
// It prefers the multi-key keyring env (IGRIS_EXECUTION_INPUT_REF_KEYS +
// IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION) and falls back to the legacy
// single-key envs for backward compatibility.
func newExecutionInputKeyringFromEnv() (*executionInputKeyring, error) {
	return buildExecutionInputKeyring(
		os.Getenv(executionInputRefKeyringEnv),
		os.Getenv(executionInputRefActiveKeyVersionEnv),
		os.Getenv(executionInputRefKeyEnv),
		os.Getenv(executionInputRefKeyVersionEnv),
	)
}

// newExecutionInputCipherFromEnv returns the active encryption cipher derived
// from the configured keyring. Retained for callers/tests that only need the
// active key.
func newExecutionInputCipherFromEnv() (*executionInputCipher, error) {
	keyring, err := newExecutionInputKeyringFromEnv()
	if err != nil {
		return nil, err
	}
	return keyring.active()
}

func buildExecutionInputKeyring(keyringRaw, activeVersionRaw, legacyKeyRaw, legacyVersionRaw string) (*executionInputKeyring, error) {
	keyringRaw = strings.TrimSpace(keyringRaw)
	legacyKeyRaw = strings.TrimSpace(legacyKeyRaw)

	if keyringRaw != "" {
		ring, err := parseExecutionInputKeyring(keyringRaw, activeVersionRaw)
		if err != nil {
			return nil, err
		}
		// If the legacy single-key env is also present it must be consistent
		// with the keyring; otherwise the two configurations disagree silently.
		if legacyKeyRaw != "" {
			if err := ensureLegacyKeyConsistent(ring, legacyKeyRaw, legacyVersionRaw); err != nil {
				return nil, err
			}
		}
		return ring, nil
	}

	if legacyKeyRaw != "" {
		cipherSvc, err := newExecutionInputCipher(legacyKeyRaw, legacyVersionRaw)
		if err != nil {
			return nil, err
		}
		if active := strings.TrimSpace(activeVersionRaw); active != "" && active != cipherSvc.keyVersion {
			return nil, errExecutionInputKeyringConfig("active key version does not match configured single key version")
		}
		return &executionInputKeyring{
			activeKeyVersion: cipherSvc.keyVersion,
			ciphers:          map[string]*executionInputCipher{cipherSvc.keyVersion: cipherSvc},
		}, nil
	}

	return nil, ErrExecutionInputRefKeyMissing
}

// parseExecutionInputKeyring parses "v1:base64key,v2:base64key" into a keyring.
// It never includes key material in any returned error.
func parseExecutionInputKeyring(raw, activeVersionRaw string) (*executionInputKeyring, error) {
	activeVersion := strings.TrimSpace(activeVersionRaw)
	if activeVersion == "" {
		return nil, errExecutionInputKeyringConfig("active key version is empty")
	}
	ciphers := make(map[string]*executionInputCipher)
	for _, entry := range strings.Split(raw, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			return nil, errExecutionInputKeyringConfig("empty keyring entry")
		}
		version, keyPart, found := strings.Cut(entry, ":")
		version = strings.TrimSpace(version)
		keyPart = strings.TrimSpace(keyPart)
		if !found || version == "" || keyPart == "" {
			return nil, errExecutionInputKeyringConfig("malformed keyring entry")
		}
		if _, exists := ciphers[version]; exists {
			return nil, errExecutionInputKeyringConfig("duplicate key version")
		}
		key, err := decodeExecutionInputKeyringKey(keyPart)
		if err != nil {
			return nil, errExecutionInputKeyringConfig("invalid key for version " + version)
		}
		cipherSvc, err := newExecutionInputCipherFromKeyBytes(key, version)
		if err != nil {
			return nil, errExecutionInputKeyringConfig("invalid key for version " + version)
		}
		ciphers[version] = cipherSvc
	}
	if len(ciphers) == 0 {
		return nil, errExecutionInputKeyringConfig("keyring is empty")
	}
	if _, ok := ciphers[activeVersion]; !ok {
		return nil, errExecutionInputKeyringConfig("active key version not present in keyring")
	}
	return &executionInputKeyring{activeKeyVersion: activeVersion, ciphers: ciphers}, nil
}

func ensureLegacyKeyConsistent(ring *executionInputKeyring, legacyKeyRaw, legacyVersionRaw string) error {
	legacyCipher, err := newExecutionInputCipher(legacyKeyRaw, legacyVersionRaw)
	if err != nil {
		return errExecutionInputKeyringConfig("legacy single key invalid")
	}
	existing, ok := ring.ciphers[legacyCipher.keyVersion]
	if !ok {
		return errExecutionInputKeyringConfig("legacy single key version not present in keyring")
	}
	if existing.keyFingerprint != legacyCipher.keyFingerprint {
		return errExecutionInputKeyringConfig("legacy single key disagrees with keyring entry")
	}
	return nil
}

func errExecutionInputKeyringConfig(detail string) error {
	return fmt.Errorf("execution input ref keyring config invalid: %s", detail)
}

// active returns the cipher for the configured active key version.
func (k *executionInputKeyring) active() (*executionInputCipher, error) {
	if k == nil {
		return nil, ErrExecutionInputRefKeyMissing
	}
	cipherSvc, ok := k.ciphers[k.activeKeyVersion]
	if !ok {
		return nil, ErrExecutionInputRefKeyMissing
	}
	return cipherSvc, nil
}

// forVersion returns the cipher matching the given stored key version, or a
// fail-closed error if that version is not present in the keyring. No fallback
// to any other version is attempted.
func (k *executionInputKeyring) forVersion(keyVersion string) (*executionInputCipher, error) {
	if k == nil {
		return nil, ErrExecutionInputRefKeyVersionMissing
	}
	keyVersion = strings.TrimSpace(keyVersion)
	if keyVersion == "" {
		return nil, ErrExecutionInputRefKeyVersionMissing
	}
	cipherSvc, ok := k.ciphers[keyVersion]
	if !ok {
		return nil, ErrExecutionInputRefKeyVersionMissing
	}
	return cipherSvc, nil
}

func decodeExecutionInputKey(rawKey string) ([]byte, error) {
	rawKey = strings.TrimSpace(rawKey)
	if rawKey == "" {
		return nil, ErrExecutionInputRefKeyMissing
	}
	decoders := []func(string) ([]byte, error){
		base64.StdEncoding.DecodeString,
		base64.RawStdEncoding.DecodeString,
		base64.URLEncoding.DecodeString,
		base64.RawURLEncoding.DecodeString,
		hex.DecodeString,
	}
	for _, decode := range decoders {
		if key, err := decode(rawKey); err == nil && len(key) == 32 {
			return key, nil
		}
	}
	if len([]byte(rawKey)) == 32 {
		return []byte(rawKey), nil
	}
	return nil, fmt.Errorf("execution input ref key must decode to 32 bytes")
}

func decodeExecutionInputKeyringKey(rawKey string) ([]byte, error) {
	rawKey = strings.TrimSpace(rawKey)
	if rawKey == "" {
		return nil, ErrExecutionInputRefKeyMissing
	}
	decoders := []func(string) ([]byte, error){
		base64.StdEncoding.DecodeString,
		base64.RawStdEncoding.DecodeString,
		base64.URLEncoding.DecodeString,
		base64.RawURLEncoding.DecodeString,
	}
	for _, decode := range decoders {
		if key, err := decode(rawKey); err == nil && len(key) == 32 {
			return key, nil
		}
	}
	return nil, fmt.Errorf("execution input ref keyring key must decode from base64 to 32 bytes")
}

func (c *executionInputCipher) encrypt(plaintext, aad []byte) (ciphertext, nonce []byte, err error) {
	if c == nil || c.gcm == nil {
		return nil, nil, ErrExecutionInputRefKeyMissing
	}
	nonce = make([]byte, c.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("generate input ref nonce: %w", err)
	}
	return c.gcm.Seal(nil, nonce, plaintext, aad), nonce, nil
}

func (c *executionInputCipher) decrypt(ciphertext, nonce, aad []byte) ([]byte, error) {
	if c == nil || c.gcm == nil {
		return nil, ErrExecutionInputRefKeyMissing
	}
	plaintext, err := c.gcm.Open(nil, nonce, ciphertext, aad)
	if err != nil {
		return nil, ErrExecutionInputRefDecrypt
	}
	return plaintext, nil
}
