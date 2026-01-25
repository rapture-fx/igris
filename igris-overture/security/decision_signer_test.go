package security

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultDecisionSignerConfig(t *testing.T) {
	config := DefaultDecisionSignerConfig()

	assert.True(t, config.Enabled)
	assert.False(t, config.StrictMode) // Non-strict for gradual rollout
	assert.True(t, config.AuditEnabled)
}

func TestDecisionSignerDisabled(t *testing.T) {
	config := DecisionSignerConfig{
		Enabled:      false,
		StrictMode:   false,
		AuditEnabled: false,
	}

	signer := NewDecisionSigner(nil, nil, config)
	assert.NotNil(t, signer)
	assert.False(t, signer.IsEnabled())

	// Signing should return unsigned decision when disabled
	ctx := context.Background()
	decision := &RoutingDecision{
		RequestID:  "req-123",
		TenantID:   "tenant-1",
		ProviderID: "openai",
		ModelID:    "gpt-4",
		Strategy:   "thompson_sampling",
		Confidence: 0.85,
	}

	signed, err := signer.SignRoutingDecision(ctx, decision)
	require.NoError(t, err)
	assert.NotNil(t, signed)
	assert.Equal(t, "req-123", signed.RequestID)
	assert.Equal(t, "openai", signed.ProviderID)
	assert.Nil(t, signed.Envelope) // No envelope when disabled
}

func TestDecisionSignerSetStrictMode(t *testing.T) {
	config := DecisionSignerConfig{
		Enabled:    true,
		StrictMode: false,
	}

	signer := NewDecisionSigner(nil, nil, config)

	// Initially non-strict
	signer.SetStrictMode(true)
	// No assertion needed - just verifying no panic

	signer.SetStrictMode(false)
	// No assertion needed - just verifying no panic
}

func TestVerifyAndRecordExecutionDisabled(t *testing.T) {
	config := DecisionSignerConfig{
		Enabled: false,
	}

	signer := NewDecisionSigner(nil, nil, config)

	ctx := context.Background()
	err := signer.VerifyAndRecordExecution(ctx, nil, nil, "")
	assert.NoError(t, err) // Should succeed when disabled
}

func TestRoutingDecisionFields(t *testing.T) {
	decision := &RoutingDecision{
		RequestID:  "req-456",
		TenantID:   "tenant-2",
		ProviderID: "anthropic",
		ModelID:    "claude-3-opus",
		Intent:     "code_completion",
		Strategy:   "speculative",
		Confidence: 0.92,
		Metadata: map[string]interface{}{
			"user_tier":    "premium",
			"region":       "us-east-1",
			"fallback_ids": []string{"openai", "cohere"},
		},
	}

	assert.Equal(t, "req-456", decision.RequestID)
	assert.Equal(t, "tenant-2", decision.TenantID)
	assert.Equal(t, "anthropic", decision.ProviderID)
	assert.Equal(t, "claude-3-opus", decision.ModelID)
	assert.Equal(t, "code_completion", decision.Intent)
	assert.Equal(t, "speculative", decision.Strategy)
	assert.Equal(t, 0.92, decision.Confidence)
	assert.Equal(t, "premium", decision.Metadata["user_tier"])
}

func TestSignedRoutingDecisionFields(t *testing.T) {
	decision := &RoutingDecision{
		RequestID:  "req-789",
		TenantID:   "tenant-3",
		ProviderID: "openai",
	}

	signed := &SignedRoutingDecision{
		RequestID:  decision.RequestID,
		ProviderID: decision.ProviderID,
		Decision:   decision,
	}

	assert.Equal(t, "req-789", signed.RequestID)
	assert.Equal(t, "openai", signed.ProviderID)
	assert.NotNil(t, signed.Decision)
	assert.Nil(t, signed.Envelope) // No envelope without actual signing
}
