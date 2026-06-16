package agentregistry

import (
	"context"
	"fmt"
	"strings"
)

// Resolver loads registered agents for run attribution.
type Resolver interface {
	GetByID(ctx context.Context, tenantID, id string) (Agent, error)
	GetByName(ctx context.Context, tenantID, name string) (Agent, error)
}

// ResolvedAgent is the attribution result for a run request.
type ResolvedAgent struct {
	Agent   Agent
	AgentID string
	Name    string
}

// ResolveAgent resolves a registered agent by UUID or name for the tenant.
// When both agentID and agentName are empty, returns nil without error.
func ResolveAgent(ctx context.Context, resolver Resolver, tenantID, agentID, agentName string) (*ResolvedAgent, error) {
	tenantID = strings.TrimSpace(tenantID)
	agentID = strings.TrimSpace(agentID)
	agentName = strings.TrimSpace(agentName)
	if agentID == "" && agentName == "" {
		return nil, nil
	}
	if resolver == nil {
		return nil, fmt.Errorf("agent resolver is not configured")
	}

	var (
		agent Agent
		err   error
	)
	switch {
	case agentID != "":
		agent, err = resolver.GetByID(ctx, tenantID, agentID)
	case agentName != "":
		agent, err = resolver.GetByName(ctx, tenantID, agentName)
	default:
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &ResolvedAgent{
		Agent:   agent,
		AgentID: agent.AgentID.String(),
		Name:    agent.Name,
	}, nil
}