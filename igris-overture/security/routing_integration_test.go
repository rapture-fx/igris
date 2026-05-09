package security

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func signedRuntimeRegistration(t *testing.T, runtimeID, tenantID string, timestamp int64) *RuntimeRegistration {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	message := fmt.Sprintf("%s:%s:%d", runtimeID, tenantID, timestamp)
	return &RuntimeRegistration{
		RuntimeID:       runtimeID,
		TenantID:        tenantID,
		PublicKeyBase64: base64.StdEncoding.EncodeToString(publicKey),
		Timestamp:       timestamp,
		Signature:       base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(message))),
	}
}

func signedRuntimeHeartbeat(t *testing.T, runtimeID, tenantID string, timestamp int64, privateKey ed25519.PrivateKey, stats map[string]interface{}) *RuntimeHeartbeat {
	t.Helper()
	message := fmt.Sprintf("%s:%s:%d", runtimeID, tenantID, timestamp)
	return &RuntimeHeartbeat{
		RuntimeID: runtimeID,
		TenantID:  tenantID,
		Timestamp: timestamp,
		Stats:     stats,
		Signature: base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(message))),
	}
}

func signedRuntimeRegistrationWithKey(t *testing.T, runtimeID, tenantID string, timestamp int64) (*RuntimeRegistration, ed25519.PrivateKey) {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	message := fmt.Sprintf("%s:%s:%d", runtimeID, tenantID, timestamp)
	return &RuntimeRegistration{
		RuntimeID:       runtimeID,
		TenantID:        tenantID,
		PublicKeyBase64: base64.StdEncoding.EncodeToString(publicKey),
		Timestamp:       timestamp,
		Signature:       base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(message))),
	}, privateKey
}

func TestRoutingIntegrationDisabled(t *testing.T) {
	config := RoutingIntegrationConfig{
		Enabled: false,
	}

	ri, err := NewRoutingIntegration(nil, config)
	require.NoError(t, err)
	assert.NotNil(t, ri)
	assert.False(t, ri.IsEnabled())

	// Signing should return placeholder when disabled
	ctx := context.Background()
	signed, err := ri.SignRoutingDecision(
		ctx,
		"tenant-1",
		"req-123",
		"openai",
		"gpt-4",
		"thompson_sampling",
		0.85,
		nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "req-123", signed.RequestID)
	assert.Equal(t, "openai", signed.ProviderID)
	assert.Nil(t, signed.Envelope) // No envelope when disabled
}

func TestRuntimeRegistry(t *testing.T) {
	registry := NewRuntimeRegistry()

	// Register a runtime
	reg := signedRuntimeRegistration(t, "runtime-001", "tenant-1", time.Now().Unix())

	err := registry.RegisterRuntime(reg)
	require.NoError(t, err)

	// Verify registration
	rt, exists := registry.GetRuntime("runtime-001")
	assert.True(t, exists)
	assert.Equal(t, "runtime-001", rt.RuntimeID)
	assert.Equal(t, "tenant-1", rt.TenantID)

	// Get public key
	pubKey, err := registry.GetRuntimePublicKey("runtime-001")
	require.NoError(t, err)
	assert.Equal(t, reg.PublicKeyBase64, pubKey)

	// List runtimes for tenant
	runtimes := registry.ListRuntimes("tenant-1")
	assert.Len(t, runtimes, 1)

	// List runtimes for different tenant
	runtimes = registry.ListRuntimes("tenant-2")
	assert.Len(t, runtimes, 0)
}

func TestRuntimeHeartbeat(t *testing.T) {
	registry := NewRuntimeRegistry()

	// Register first
	reg, privateKey := signedRuntimeRegistrationWithKey(t, "runtime-002", "tenant-1", time.Now().Unix())
	err := registry.RegisterRuntime(reg)
	require.NoError(t, err)

	// Send heartbeat
	hb := signedRuntimeHeartbeat(t, "runtime-002", "tenant-1", time.Now().Unix(), privateKey, map[string]interface{}{
		"requests_processed": 100,
		"avg_latency_ms":     45.5,
	})

	err = registry.UpdateHeartbeat(hb)
	require.NoError(t, err)

	// Verify stats updated
	rt, exists := registry.GetRuntime("runtime-002")
	assert.True(t, exists)
	assert.Equal(t, hb.Timestamp, rt.LastHeartbeat)
	assert.Equal(t, 100, rt.Stats["requests_processed"])
}

func TestRuntimeHeartbeatUnregistered(t *testing.T) {
	registry := NewRuntimeRegistry()

	hb := &RuntimeHeartbeat{
		RuntimeID: "unknown-runtime",
		TenantID:  "tenant-1",
		Timestamp: time.Now().Unix(),
	}

	err := registry.UpdateHeartbeat(hb)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not registered")
}

func TestRuntimeUnregister(t *testing.T) {
	registry := NewRuntimeRegistry()

	// Register
	reg := signedRuntimeRegistration(t, "runtime-003", "tenant-1", time.Now().Unix())
	err := registry.RegisterRuntime(reg)
	require.NoError(t, err)

	// Verify exists
	_, exists := registry.GetRuntime("runtime-003")
	assert.True(t, exists)

	// Unregister
	registry.UnregisterRuntime("runtime-003")

	// Verify gone
	_, exists = registry.GetRuntime("runtime-003")
	assert.False(t, exists)
}

func TestRoutingIntegrationSetEnabled(t *testing.T) {
	config := RoutingIntegrationConfig{
		Enabled: false,
	}

	ri, err := NewRoutingIntegration(nil, config)
	require.NoError(t, err)

	assert.False(t, ri.IsEnabled())

	ri.SetEnabled(true)
	assert.True(t, ri.IsEnabled())

	ri.SetEnabled(false)
	assert.False(t, ri.IsEnabled())
}

func TestDefaultRoutingIntegrationConfig(t *testing.T) {
	config := DefaultRoutingIntegrationConfig()

	assert.False(t, config.Enabled)
	assert.Empty(t, config.MasterKeyHex)
	assert.False(t, config.StrictMode)
	assert.True(t, config.AuditEnabled)
	assert.Equal(t, 300, config.TimestampWindowSec)
}

func TestMultipleRuntimesSameTenant(t *testing.T) {
	registry := NewRuntimeRegistry()

	// Register multiple runtimes for same tenant
	for i := 0; i < 3; i++ {
		reg := signedRuntimeRegistration(t, "runtime-"+string(rune('1'+i)), "tenant-1", time.Now().Unix())
		err := registry.RegisterRuntime(reg)
		require.NoError(t, err)
	}

	// Register one for different tenant
	reg := signedRuntimeRegistration(t, "runtime-other", "tenant-2", time.Now().Unix())
	err := registry.RegisterRuntime(reg)
	require.NoError(t, err)

	// List for tenant-1
	runtimes := registry.ListRuntimes("tenant-1")
	assert.Len(t, runtimes, 3)

	// List for tenant-2
	runtimes = registry.ListRuntimes("tenant-2")
	assert.Len(t, runtimes, 1)
}

func TestVerifyRuntimeSignatureEmptyKey(t *testing.T) {
	reg := &RuntimeRegistration{
		RuntimeID:       "runtime-001",
		TenantID:        "tenant-1",
		PublicKeyBase64: "", // Empty key should fail
		Timestamp:       time.Now().Unix(),
	}

	err := verifyRuntimeSignature(reg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "public key is required")
}
