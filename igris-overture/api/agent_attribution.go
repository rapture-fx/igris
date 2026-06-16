package api

import (
	"context"
	"database/sql"
	"errors"

	"github.com/Igris-inertial/system/igris-overture/agentregistry"
	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/google/uuid"
)

func resolveActionRunAgent(ctx context.Context, db *sql.DB, tenantID, agentID, agentName string) (*agentregistry.ResolvedAgent, error) {
	if db == nil {
		return nil, nil
	}
	return agentregistry.ResolveAgent(ctx, &agentregistry.SQLStore{DB: db}, tenantID, agentID, agentName)
}

func applyResolvedAgentToTaskRequest(req *coordinator.TaskSubmitRequest, resolved *agentregistry.ResolvedAgent) {
	if req == nil || resolved == nil {
		return
	}
	agentUUID := resolved.Agent.AgentID
	req.RegisteredAgentID = &agentUUID
	req.RegisteredAgentName = resolved.Name
	if req.AgentIdentity == nil {
		req.AgentIdentity = &coordinator.AgentIdentity{}
	}
	req.AgentIdentity.AgentID = resolved.AgentID
}

func agentSummaryForTask(task *coordinator.TaskRecord, resolved *agentregistry.ResolvedAgent) map[string]interface{} {
	if resolved != nil {
		summary := resolved.Agent.PublicSummary()
		return map[string]interface{}{
			"agent_id":      summary.AgentID,
			"name":          summary.Name,
			"display_name":  summary.DisplayName,
			"agent_type":    summary.AgentType,
			"template_name": summary.TemplateName,
		}
	}
	if task == nil || task.RegisteredAgentID == nil || *task.RegisteredAgentID == uuid.Nil {
		return nil
	}
	display := task.RegisteredAgentName
	return map[string]interface{}{
		"agent_id":      task.RegisteredAgentID.String(),
		"name":          task.RegisteredAgentName,
		"display_name":  display,
		"agent_type":    "",
		"template_name": "",
	}
}

func statusForAgentResolveErr(err error) int {
	if err == nil {
		return 0
	}
	if errors.Is(err, agentregistry.ErrNotFound) {
		return 404
	}
	return 500
}

func errorForAgentResolveErr(err error) error {
	if errors.Is(err, agentregistry.ErrNotFound) {
		return errValidation("registered agent not found")
	}
	return errBackend("agent resolution failed")
}