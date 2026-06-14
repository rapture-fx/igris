package agentregistry

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type stubResolver struct {
	byID   map[string]Agent
	byName map[string]Agent
}

func (s stubResolver) GetByID(_ context.Context, tenantID, id string) (Agent, error) {
	agent, ok := s.byID[tenantID+"|"+id]
	if !ok {
		return Agent{}, ErrNotFound
	}
	return agent, nil
}

func (s stubResolver) GetByName(_ context.Context, tenantID, name string) (Agent, error) {
	agent, ok := s.byName[tenantID+"|"+NormalizeName(name)]
	if !ok {
		return Agent{}, ErrNotFound
	}
	return agent, nil
}

func TestResolveAgentByName(t *testing.T) {
	t.Parallel()

	agentID := uuid.New()
	resolver := stubResolver{
		byName: map[string]Agent{
			"tenant-a|support_bot": {
				AgentID:     agentID,
				TenantID:    "tenant-a",
				Name:        "support_bot",
				DisplayName: "Support Bot",
				AgentType:   AgentTypeClaudeCode,
			},
		},
	}
	resolved, err := ResolveAgent(context.Background(), resolver, "tenant-a", "", "support-bot")
	require.NoError(t, err)
	require.NotNil(t, resolved)
	require.Equal(t, agentID.String(), resolved.AgentID)
	require.Equal(t, "support_bot", resolved.Name)
}

func TestResolveAgentEmptyIsOptional(t *testing.T) {
	t.Parallel()

	resolved, err := ResolveAgent(context.Background(), stubResolver{}, "tenant-a", "", "")
	require.NoError(t, err)
	require.Nil(t, resolved)
}