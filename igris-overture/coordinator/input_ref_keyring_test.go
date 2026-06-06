package coordinator

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// keyringSecretMarker is plaintext test input only. It must never appear in any
// persisted definition, ciphertext, metadata, or error.
const keyringSecretMarker = "IGRIS_KEYRING_SECRET_MARKER"

func keyringTestKey(seed byte) string {
	raw := make([]byte, 32)
	for i := range raw {
		raw[i] = seed + byte(i)
	}
	return base64.StdEncoding.EncodeToString(raw)
}

// clearExecutionInputRefEnv resets every env source so each test controls
// exactly which configuration is present.
func clearExecutionInputRefEnv(t *testing.T) {
	t.Helper()
	t.Setenv(executionInputRefKeyringEnv, "")
	t.Setenv(executionInputRefActiveKeyVersionEnv, "")
	t.Setenv(executionInputRefKeyEnv, "")
	t.Setenv(executionInputRefKeyVersionEnv, "")
}

func sensitiveTaskDefinition(marker string) json.RawMessage {
	return json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{
			"kind":"tool",
			"node_id":"unsafe-http",
			"tool_name":"http_request",
			"args":{"method":"POST","url":"https://api.example.test/hook","body":"` + marker + `"}
		}]}
	}`)
}

func TestKeyringEncryptUsesActiveKeyVersion(t *testing.T) {
	clearExecutionInputRefEnv(t)
	t.Setenv(executionInputRefKeyringEnv, "v1:"+keyringTestKey(1)+",v2:"+keyringTestKey(2))
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v2")

	tenantID := "tenant-active"
	taskID := uuid.New()
	protected, err := protectTaskDefinitionInputs(sensitiveTaskDefinition(keyringSecretMarker), tenantID, taskID)
	require.NoError(t, err)
	require.NotEmpty(t, protected.Refs)
	require.NotContains(t, string(protected.Definition), keyringSecretMarker)

	keyring, err := newExecutionInputKeyringFromEnv()
	require.NoError(t, err)

	v1, err := keyring.forVersion("v1")
	require.NoError(t, err)

	for _, ref := range protected.Refs {
		// New refs must be stamped with the active version only.
		require.Equal(t, "v2", ref.KeyVersion)

		v2, err := keyring.forVersion(ref.KeyVersion)
		require.NoError(t, err)
		plaintext, err := v2.decrypt(ref.Ciphertext, ref.Nonce, ref.AAD)
		require.NoError(t, err)
		require.Equal(t, keyringSecretMarker, string(plaintext))

		// The historical (non-active) key must not decrypt active-version refs.
		_, err = v1.decrypt(ref.Ciphertext, ref.Nonce, ref.AAD)
		require.ErrorIs(t, err, ErrExecutionInputRefDecrypt)
	}
}

func TestKeyringDecryptsHistoricalRefWithStoredKeyVersion(t *testing.T) {
	clearExecutionInputRefEnv(t)
	tenantID := "tenant-historical"

	// Encrypt a historical ref while v1 is active.
	t.Setenv(executionInputRefKeyringEnv, "v1:"+keyringTestKey(1)+",v2:"+keyringTestKey(2))
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v1")
	oldTask := uuid.New()
	oldProtected, err := protectTaskDefinitionInputs(sensitiveTaskDefinition(keyringSecretMarker), tenantID, oldTask)
	require.NoError(t, err)
	require.NotEmpty(t, oldProtected.Refs)
	for _, ref := range oldProtected.Refs {
		require.Equal(t, "v1", ref.KeyVersion)
	}

	// Rotate: v2 is now active but v1 is retained for historical decryption.
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v2")
	newTask := uuid.New()
	newProtected, err := protectTaskDefinitionInputs(sensitiveTaskDefinition(keyringSecretMarker), tenantID, newTask)
	require.NoError(t, err)
	for _, ref := range newProtected.Refs {
		require.Equal(t, "v2", ref.KeyVersion)
	}

	keyring, err := newExecutionInputKeyringFromEnv()
	require.NoError(t, err)
	require.Equal(t, "v2", keyring.activeKeyVersion)

	// Historical v1 ref still decrypts using its stored version.
	for _, ref := range oldProtected.Refs {
		c, err := keyring.forVersion(ref.KeyVersion)
		require.NoError(t, err)
		plaintext, err := c.decrypt(ref.Ciphertext, ref.Nonce, ref.AAD)
		require.NoError(t, err)
		require.Equal(t, keyringSecretMarker, string(plaintext))
	}
	// New v2 ref decrypts with v2.
	for _, ref := range newProtected.Refs {
		c, err := keyring.forVersion(ref.KeyVersion)
		require.NoError(t, err)
		plaintext, err := c.decrypt(ref.Ciphertext, ref.Nonce, ref.AAD)
		require.NoError(t, err)
		require.Equal(t, keyringSecretMarker, string(plaintext))
	}
}

func TestMissingHistoricalKeyFailsClosed(t *testing.T) {
	clearExecutionInputRefEnv(t)
	tenantID := "tenant-missing"

	// Encrypt under v1.
	t.Setenv(executionInputRefKeyringEnv, "v1:"+keyringTestKey(1))
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v1")
	protected, err := protectTaskDefinitionInputs(sensitiveTaskDefinition(keyringSecretMarker), tenantID, uuid.New())
	require.NoError(t, err)
	require.NotEmpty(t, protected.Refs)

	// Keyring now only contains v2.
	t.Setenv(executionInputRefKeyringEnv, "v2:"+keyringTestKey(2))
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v2")
	keyring, err := newExecutionInputKeyringFromEnv()
	require.NoError(t, err)

	for _, ref := range protected.Refs {
		_, err := keyring.forVersion(ref.KeyVersion)
		require.ErrorIs(t, err, ErrExecutionInputRefKeyVersionMissing)
	}
	require.Equal(t, "missing_key_version", safeInputRefFailureCode(ErrExecutionInputRefKeyVersionMissing))
}

func TestWrongKeyVersionDoesNotFallback(t *testing.T) {
	clearExecutionInputRefEnv(t)
	tenantID := "tenant-nofallback"

	// Encrypt under v1.
	t.Setenv(executionInputRefKeyringEnv, "v1:"+keyringTestKey(1))
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v1")
	protected, err := protectTaskDefinitionInputs(sensitiveTaskDefinition(keyringSecretMarker), tenantID, uuid.New())
	require.NoError(t, err)
	require.NotEmpty(t, protected.Refs)

	// v1 removed; v2 active. A keyring lookup must not silently substitute v2.
	t.Setenv(executionInputRefKeyringEnv, "v2:"+keyringTestKey(2))
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v2")
	keyring, err := newExecutionInputKeyringFromEnv()
	require.NoError(t, err)

	for _, ref := range protected.Refs {
		_, err := keyring.forVersion(ref.KeyVersion)
		require.ErrorIs(t, err, ErrExecutionInputRefKeyVersionMissing)

		// Even forcing the active key on the historical ciphertext fails closed.
		active, aerr := keyring.active()
		require.NoError(t, aerr)
		_, derr := active.decrypt(ref.Ciphertext, ref.Nonce, ref.AAD)
		require.ErrorIs(t, derr, ErrExecutionInputRefDecrypt)
	}
}

func TestMalformedKeyringConfigRejected(t *testing.T) {
	good := keyringTestKey(1)
	cases := []struct {
		name      string
		keyring   string
		active    string
		legacyKey string
		legacyVer string
	}{
		{name: "duplicate versions", keyring: "v1:" + good + ",v1:" + keyringTestKey(2), active: "v1"},
		{name: "invalid base64", keyring: "v1:not*base64*key", active: "v1"},
		{name: "raw key not accepted in keyring", keyring: "v1:0123456789abcdef0123456789abcdef", active: "v1"},
		{name: "wrong key length", keyring: "v1:" + base64.StdEncoding.EncodeToString([]byte("tooshort")), active: "v1"},
		{name: "empty active version", keyring: "v1:" + good, active: ""},
		{name: "active not present", keyring: "v1:" + good, active: "v2"},
		{name: "malformed entry no colon", keyring: "v1" + good, active: "v1"},
		{name: "empty entry trailing comma", keyring: "v1:" + good + ",", active: "v1"},
		{name: "legacy disagrees with keyring", keyring: "v1:" + good, active: "v1", legacyKey: keyringTestKey(9), legacyVer: "v1"},
		{name: "legacy version absent from keyring", keyring: "v1:" + good, active: "v1", legacyKey: keyringTestKey(2), legacyVer: "v9"},
		{name: "legacy active mismatch", legacyKey: good, legacyVer: "v1", active: "v2"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := buildExecutionInputKeyring(tc.keyring, tc.active, tc.legacyKey, tc.legacyVer)
			require.Error(t, err)
			// Key material must never leak through configuration errors.
			require.NotContains(t, err.Error(), good)
			require.NotContains(t, err.Error(), keyringTestKey(2))
			require.NotContains(t, err.Error(), keyringTestKey(9))
		})
	}
}

func TestBackwardCompatibleSingleKeyEnv(t *testing.T) {
	clearExecutionInputRefEnv(t)
	t.Setenv(executionInputRefKeyEnv, keyringTestKey(7))
	t.Setenv(executionInputRefKeyVersionEnv, "legacy:v3")

	keyring, err := newExecutionInputKeyringFromEnv()
	require.NoError(t, err)
	require.Equal(t, "legacy:v3", keyring.activeKeyVersion)

	tenantID := "tenant-legacy"
	taskID := uuid.New()
	protected, err := protectTaskDefinitionInputs(sensitiveTaskDefinition(keyringSecretMarker), tenantID, taskID)
	require.NoError(t, err)
	require.NotEmpty(t, protected.Refs)
	for _, ref := range protected.Refs {
		require.Equal(t, "legacy:v3", ref.KeyVersion)
		c, err := keyring.forVersion(ref.KeyVersion)
		require.NoError(t, err)
		plaintext, err := c.decrypt(ref.Ciphertext, ref.Nonce, ref.AAD)
		require.NoError(t, err)
		require.Equal(t, keyringSecretMarker, string(plaintext))
	}

	// Default version when legacy version env is unset.
	clearExecutionInputRefEnv(t)
	t.Setenv(executionInputRefKeyEnv, keyringTestKey(7))
	defaultRing, err := newExecutionInputKeyringFromEnv()
	require.NoError(t, err)
	require.Equal(t, defaultExecutionInputRefKeyVersion, defaultRing.activeKeyVersion)
}

func TestKeyringPrefersKeyringEnvAndConsistentLegacy(t *testing.T) {
	clearExecutionInputRefEnv(t)
	v1 := keyringTestKey(1)
	t.Setenv(executionInputRefKeyringEnv, "v1:"+v1+",v2:"+keyringTestKey(2))
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v2")
	// Legacy single key matches the v1 keyring entry exactly: allowed.
	t.Setenv(executionInputRefKeyEnv, v1)
	t.Setenv(executionInputRefKeyVersionEnv, "v1")

	keyring, err := newExecutionInputKeyringFromEnv()
	require.NoError(t, err)
	require.Equal(t, "v2", keyring.activeKeyVersion)
	require.Len(t, keyring.ciphers, 2)
}

func TestKeyringPreservesAADSecurity(t *testing.T) {
	clearExecutionInputRefEnv(t)
	keyring, err := buildExecutionInputKeyring("v1:"+keyringTestKey(1)+",v2:"+keyringTestKey(2), "v2", "", "")
	require.NoError(t, err)

	cipherSvc, err := keyring.active()
	require.NoError(t, err)

	tenantID := "tenant-aad"
	taskID := uuid.New()
	refID := uuid.New()
	purpose := "execution_payload"
	aad, err := executionInputAssociatedData(tenantID, taskID, refID, purpose, cipherSvc.keyVersion)
	require.NoError(t, err)
	ciphertext, nonce, err := cipherSvc.encrypt([]byte(keyringSecretMarker), aad)
	require.NoError(t, err)

	plaintext, err := cipherSvc.decrypt(ciphertext, nonce, aad)
	require.NoError(t, err)
	require.Equal(t, keyringSecretMarker, string(plaintext))

	wrongTenant, _ := executionInputAssociatedData("tenant-other", taskID, refID, purpose, cipherSvc.keyVersion)
	_, err = cipherSvc.decrypt(ciphertext, nonce, wrongTenant)
	require.ErrorIs(t, err, ErrExecutionInputRefDecrypt)

	wrongTask, _ := executionInputAssociatedData(tenantID, uuid.New(), refID, purpose, cipherSvc.keyVersion)
	_, err = cipherSvc.decrypt(ciphertext, nonce, wrongTask)
	require.ErrorIs(t, err, ErrExecutionInputRefDecrypt)

	wrongPurpose, _ := executionInputAssociatedData(tenantID, taskID, refID, "private_path", cipherSvc.keyVersion)
	_, err = cipherSvc.decrypt(ciphertext, nonce, wrongPurpose)
	require.ErrorIs(t, err, ErrExecutionInputRefDecrypt)

	// Wrong key version in AAD also fails closed.
	wrongVersion, _ := executionInputAssociatedData(tenantID, taskID, refID, purpose, "v1")
	_, err = cipherSvc.decrypt(ciphertext, nonce, wrongVersion)
	require.ErrorIs(t, err, ErrExecutionInputRefDecrypt)

	tampered := append([]byte(nil), ciphertext...)
	tampered[0] ^= 0xff
	_, err = cipherSvc.decrypt(tampered, nonce, aad)
	require.ErrorIs(t, err, ErrExecutionInputRefDecrypt)
}

func TestKeyringReadPathMetadataExposesNoKeyMaterial(t *testing.T) {
	clearExecutionInputRefEnv(t)
	t.Setenv(executionInputRefKeyringEnv, "v1:"+keyringTestKey(1)+",v2:"+keyringTestKey(2))
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v2")

	protected, err := protectTaskDefinitionInputs(sensitiveTaskDefinition(keyringSecretMarker), "tenant-meta", uuid.New())
	require.NoError(t, err)
	require.NotEmpty(t, protected.Refs)

	for _, ref := range protected.Refs {
		meta := encryptedInputRefMetadata(ref, "summary")
		encoded, err := json.Marshal(meta)
		require.NoError(t, err)
		body := string(encoded)

		// Safe key_version metadata is allowed.
		require.Equal(t, "v2", meta["key_version"])
		// Nothing sensitive may appear.
		require.NotContains(t, body, keyringSecretMarker)
		require.NotContains(t, body, base64.StdEncoding.EncodeToString(ref.Ciphertext))
		require.NotContains(t, body, base64.StdEncoding.EncodeToString(ref.Nonce))
		require.NotContains(t, strings.ToLower(body), "ciphertext")
		require.NotContains(t, strings.ToLower(body), "nonce")
		require.NotContains(t, body, keyringTestKey(1))
		require.NotContains(t, body, keyringTestKey(2))
	}
}

func TestRecoveryDecryptsOldRefAfterRotation(t *testing.T) {
	clearExecutionInputRefEnv(t)
	tenantID := "tenant-recovery-rotation"
	taskID := uuid.New()

	// Recovery-eligible task created while v1 is active.
	t.Setenv(executionInputRefKeyringEnv, "v1:"+keyringTestKey(3))
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v1")
	protected, err := protectTaskDefinitionInputs(json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{"kind":"tool","node_id":"unsafe-file","tool_name":"filesystem","args":{"path":"/private/`+keyringSecretMarker+`.txt"}}]}
	}`), tenantID, taskID)
	require.NoError(t, err)
	require.NotEmpty(t, protected.Refs)
	require.NotContains(t, string(protected.Definition), keyringSecretMarker)
	for _, ref := range protected.Refs {
		require.Equal(t, "v1", ref.KeyVersion)
	}

	refs := map[uuid.UUID]ExecutionInputRef{}
	for _, ref := range protected.Refs {
		refs[ref.ID] = ref
	}

	// Rotate active key to v2 while keeping v1 for historical decryption.
	t.Setenv(executionInputRefKeyringEnv, "v1:"+keyringTestKey(3)+",v2:"+keyringTestKey(4))
	t.Setenv(executionInputRefActiveKeyVersionEnv, "v2")
	keyring, err := newExecutionInputKeyringFromEnv()
	require.NoError(t, err)
	require.Equal(t, "v2", keyring.activeKeyVersion)

	usedKeyVersions := map[string]bool{}
	rehydrated, err := rehydrateTaskDefinitionInputRefs(protected.Definition, tenantID, taskID, func(refID uuid.UUID, purpose string) ([]byte, error) {
		ref, ok := refs[refID]
		require.True(t, ok)
		require.Equal(t, purpose, ref.Purpose)
		usedKeyVersions[ref.KeyVersion] = true
		c, err := keyring.forVersion(ref.KeyVersion)
		if err != nil {
			return nil, err
		}
		return c.decrypt(ref.Ciphertext, ref.Nonce, ref.AAD)
	})
	require.NoError(t, err)

	// Recovery (transient plaintext) succeeds using v1.
	require.Contains(t, string(rehydrated), keyringSecretMarker)
	require.True(t, usedKeyVersions["v1"])
	require.False(t, usedKeyVersions["v2"])
	// Persisted definition stays redacted.
	require.NotContains(t, string(protected.Definition), keyringSecretMarker)
}
