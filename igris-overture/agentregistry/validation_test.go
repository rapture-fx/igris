package agentregistry

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateCreateInputAcceptsCanonicalAgent(t *testing.T) {
	t.Parallel()

	out, err := ValidateCreateInput(CreateInput{
		Name:        "support-bot",
		AgentType:   AgentTypeCursor,
		Description: "Cursor agent for support workflows",
		Metadata: map[string]interface{}{
			"workspace": "prod",
		},
	})
	require.NoError(t, err)
	require.Equal(t, "support_bot", out.Name)
	require.Equal(t, AgentTypeCursor, out.AgentType)
	require.Equal(t, "support_bot", out.DisplayName)
}

func TestValidateCreateInputRejectsInvalidType(t *testing.T) {
	t.Parallel()

	_, err := ValidateCreateInput(CreateInput{
		Name:      "support_bot",
		AgentType: "unknown",
	})
	require.Error(t, err)
}