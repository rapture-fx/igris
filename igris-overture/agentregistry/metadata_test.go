package agentregistry

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSanitizeMetadataRejectsSecretsAndPrompts(t *testing.T) {
	t.Parallel()

	_, err := SanitizeMetadata(map[string]interface{}{
		"workspace": "prod",
		"api_key":   "igris_deadbeef",
	})
	require.Error(t, err)

	_, err = SanitizeMetadata(map[string]interface{}{
		"notes": "system prompt: you are an agent",
	})
	require.Error(t, err)

	_, err = SanitizeMetadata(map[string]interface{}{
		"chain_of_thought": "hidden reasoning",
	})
	require.Error(t, err)
}

func TestSanitizeMetadataEnforcesSizeLimit(t *testing.T) {
	t.Parallel()

	_, err := SanitizeMetadata(map[string]interface{}{
		"notes": strings.Repeat("a", maxMetadataBytes),
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "4096")
}

func TestSanitizeMetadataAllowsSafeFields(t *testing.T) {
	t.Parallel()

	out, err := SanitizeMetadata(map[string]interface{}{
		"workspace": "staging",
		"owner":     "platform-team",
	})
	require.NoError(t, err)
	require.Equal(t, "staging", out["workspace"])
	require.Equal(t, "platform-team", out["owner"])
}