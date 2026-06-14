package agentregistry

import (
	"fmt"
	"regexp"
	"strings"
)

var agentNamePattern = regexp.MustCompile(`^[a-z][a-z0-9_.]{1,63}$`)

var allowedAgentTypes = map[string]struct{}{
	AgentTypeClaudeCode: {},
	AgentTypeCodex:      {},
	AgentTypeCursor:     {},
	AgentTypeCrewAI:     {},
	AgentTypeLangGraph:  {},
	AgentTypeCustom:     {},
}

// NormalizeName canonicalizes registry agent names.
func NormalizeName(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, "-", "_")
	name = strings.ReplaceAll(name, " ", "_")
	return name
}

func ValidName(name string) bool {
	return agentNamePattern.MatchString(name)
}

func ValidAgentType(agentType string) bool {
	_, ok := allowedAgentTypes[strings.TrimSpace(agentType)]
	return ok
}

func ValidateCreateInput(input CreateInput) (CreateInput, error) {
	normalized := input
	normalized.Name = NormalizeName(input.Name)
	if !ValidName(normalized.Name) {
		return CreateInput{}, fmt.Errorf("name must match %s", agentNamePattern.String())
	}
	normalized.AgentType = strings.TrimSpace(input.AgentType)
	if !ValidAgentType(normalized.AgentType) {
		return CreateInput{}, fmt.Errorf("agent_type must be one of claude_code, codex, cursor, crewai, langgraph, custom")
	}
	normalized.DisplayName = strings.TrimSpace(input.DisplayName)
	if normalized.DisplayName == "" {
		normalized.DisplayName = normalized.Name
	}
	normalized.TemplateName = strings.TrimSpace(input.TemplateName)
	normalized.Version = strings.TrimSpace(input.Version)
	normalized.Description = strings.TrimSpace(input.Description)
	metadata, err := SanitizeMetadata(input.Metadata)
	if err != nil {
		return CreateInput{}, err
	}
	normalized.Metadata = metadata
	return normalized, nil
}

func ValidateUpdateInput(current Agent, input UpdateInput) (UpdateInput, error) {
	out := input
	if input.Name != nil {
		name := NormalizeName(*input.Name)
		if !ValidName(name) {
			return UpdateInput{}, fmt.Errorf("name must match %s", agentNamePattern.String())
		}
		out.Name = &name
	}
	if input.DisplayName != nil {
		trimmed := strings.TrimSpace(*input.DisplayName)
		out.DisplayName = &trimmed
	}
	if input.AgentType != nil {
		agentType := strings.TrimSpace(*input.AgentType)
		if !ValidAgentType(agentType) {
			return UpdateInput{}, fmt.Errorf("agent_type must be one of claude_code, codex, cursor, crewai, langgraph, custom")
		}
		out.AgentType = &agentType
	}
	if input.TemplateName != nil {
		trimmed := strings.TrimSpace(*input.TemplateName)
		out.TemplateName = &trimmed
	}
	if input.Version != nil {
		trimmed := strings.TrimSpace(*input.Version)
		out.Version = &trimmed
	}
	if input.Description != nil {
		trimmed := strings.TrimSpace(*input.Description)
		out.Description = &trimmed
	}
	if input.MetadataSet {
		metadata, err := SanitizeMetadata(input.Metadata)
		if err != nil {
			return UpdateInput{}, err
		}
		out.Metadata = metadata
	}
	_ = current
	return out, nil
}