package coordinator

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
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

var (
	ErrExecutionInputRefKeyMissing = errors.New("execution input ref encryption key missing")
	ErrExecutionInputRefDecrypt    = errors.New("execution input ref decrypt denied")
)

type executionInputCipher struct {
	keyVersion string
	gcm        cipher.AEAD
}

func newExecutionInputCipherFromEnv() (*executionInputCipher, error) {
	return newExecutionInputCipher(os.Getenv(executionInputRefKeyEnv), os.Getenv(executionInputRefKeyVersionEnv))
}

func newExecutionInputCipher(rawKey, keyVersion string) (*executionInputCipher, error) {
	key, err := decodeExecutionInputKey(rawKey)
	if err != nil {
		return nil, err
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
		keyVersion = "env:v1"
	}
	return &executionInputCipher{keyVersion: keyVersion, gcm: gcm}, nil
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
