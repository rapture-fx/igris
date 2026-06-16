// Package agentregistry provides a minimal tenant-scoped Agent Registry for
// identity and run attribution. It does not deploy agents or store secrets.
package agentregistry

import (
	"time"

	"github.com/google/uuid"
)

const (
	AgentTypeClaudeCode = "claude_code"
	AgentTypeCodex      = "codex"
	AgentTypeCursor     = "cursor"
	AgentTypeCrewAI     = "crewai"
	AgentTypeLangGraph  = "langgraph"
	AgentTypeCustom     = "custom"
)

// Agent is the durable registry record for a tenant-owned agent identity.
type Agent struct {
	AgentID      uuid.UUID              `json:"agent_id"`
	TenantID     string                 `json:"-"`
	Name         string                 `json:"name"`
	DisplayName  string                 `json:"display_name"`
	AgentType    string                 `json:"agent_type"`
	TemplateName string                 `json:"template_name"`
	Version      string                 `json:"version"`
	Description  string                 `json:"description"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	ArchivedAt   *time.Time             `json:"archived_at,omitempty"`
}

// PublicSummary is the safe attribution shape exposed on action runs.
type PublicSummary struct {
	AgentID      string `json:"agent_id"`
	Name         string `json:"name"`
	DisplayName  string `json:"display_name"`
	AgentType    string `json:"agent_type"`
	TemplateName string `json:"template_name"`
}

func (a *Agent) PublicSummary() PublicSummary {
	if a == nil {
		return PublicSummary{}
	}
	display := a.DisplayName
	if display == "" {
		display = a.Name
	}
	return PublicSummary{
		AgentID:      a.AgentID.String(),
		Name:         a.Name,
		DisplayName:  display,
		AgentType:    a.AgentType,
		TemplateName: a.TemplateName,
	}
}

// CreateInput is the tenant-scoped create payload.
type CreateInput struct {
	Name         string
	DisplayName  string
	AgentType    string
	TemplateName string
	Version      string
	Description  string
	Metadata     map[string]interface{}
}

// UpdateInput carries optional registry patch fields.
type UpdateInput struct {
	Name         *string
	DisplayName  *string
	AgentType    *string
	TemplateName *string
	Version      *string
	Description  *string
	Metadata     map[string]interface{}
	MetadataSet  bool
}