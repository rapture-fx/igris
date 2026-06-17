// Package agentmemory stores summary-only operator memory for agent runs.
// It must never store prompts, chain-of-thought, provider tokens, or secrets.
package agentmemory

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	MaxSummaryChars      = 512
	MaxEvidenceItems     = 20
	MaxEvidenceItemChars = 256
	MaxRetentionDays     = 365
	defaultRetentionDays = 90
	RedactionStatus      = "redacted"
)

type Memory struct {
	MemoryID            uuid.UUID  `json:"memory_id"`
	TenantID            string     `json:"-"`
	TaskID              *uuid.UUID `json:"task_id,omitempty"`
	ExecutionID         string     `json:"execution_id,omitempty"`
	RegisteredAgentID   *uuid.UUID `json:"registered_agent_id,omitempty"`
	RegisteredAgentName string     `json:"registered_agent_name,omitempty"`
	GoalSummary         string     `json:"goal_summary"`
	DecisionSummary     string     `json:"decision_summary"`
	EvidenceSummary     []string   `json:"evidence_summary"`
	OutcomeSummary      string     `json:"outcome_summary"`
	RedactionStatus     string     `json:"redaction_status"`
	RetentionExpiresAt  *time.Time `json:"retention_expires_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type CreateInput struct {
	TaskID              *uuid.UUID
	ExecutionID         string
	RegisteredAgentID   *uuid.UUID
	RegisteredAgentName string
	GoalSummary         string
	DecisionSummary     string
	EvidenceSummary     []string
	OutcomeSummary      string
	RetentionDays       *int
}

type ListFilter struct {
	TaskID      *uuid.UUID
	ExecutionID string
	AgentID     *uuid.UUID
	AgentName   string
	Limit       int
}

func ValidateCreateInput(input CreateInput, now time.Time) (CreateInput, error) {
	out := input
	out.ExecutionID = strings.TrimSpace(input.ExecutionID)
	out.RegisteredAgentName = normalizeAgentName(input.RegisteredAgentName)

	if out.TaskID == nil && out.ExecutionID == "" && out.RegisteredAgentID == nil && out.RegisteredAgentName == "" {
		return CreateInput{}, fmt.Errorf("memory must attach to task_id, execution_id, registered_agent_id, or registered_agent_name")
	}

	var err error
	if out.GoalSummary, err = cleanSummary("goal_summary", input.GoalSummary); err != nil {
		return CreateInput{}, err
	}
	if out.DecisionSummary, err = cleanSummary("decision_summary", input.DecisionSummary); err != nil {
		return CreateInput{}, err
	}
	if out.OutcomeSummary, err = cleanSummary("outcome_summary", input.OutcomeSummary); err != nil {
		return CreateInput{}, err
	}
	out.EvidenceSummary, err = cleanEvidence(input.EvidenceSummary)
	if err != nil {
		return CreateInput{}, err
	}

	if input.RetentionDays != nil {
		days := *input.RetentionDays
		if days < 1 || days > MaxRetentionDays {
			return CreateInput{}, fmt.Errorf("retention_days must be between 1 and %d", MaxRetentionDays)
		}
	} else {
		days := defaultRetentionDays
		out.RetentionDays = &days
	}

	_ = now
	return out, nil
}

func RetentionExpiry(now time.Time, retentionDays *int) *time.Time {
	if retentionDays == nil {
		return nil
	}
	expires := now.UTC().Add(time.Duration(*retentionDays) * 24 * time.Hour)
	return &expires
}

func EvidenceJSON(values []string) ([]byte, error) {
	if values == nil {
		values = []string{}
	}
	return json.Marshal(values)
}

func DecodeEvidence(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err != nil {
		return []string{}
	}
	return values
}

func cleanSummary(field, value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("%s is required", field)
	}
	if len(value) > MaxSummaryChars {
		return "", fmt.Errorf("%s must be at most %d characters", field, MaxSummaryChars)
	}
	if looksUnsafe(value) {
		return "", fmt.Errorf("%s must not contain prompt text, chain-of-thought, secrets, or tokens", field)
	}
	return value, nil
}

func cleanEvidence(values []string) ([]string, error) {
	if len(values) > MaxEvidenceItems {
		return nil, fmt.Errorf("evidence_summary must contain at most %d items", MaxEvidenceItems)
	}
	out := make([]string, 0, len(values))
	for i, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if len(value) > MaxEvidenceItemChars {
			return nil, fmt.Errorf("evidence_summary[%d] must be at most %d characters", i, MaxEvidenceItemChars)
		}
		if looksUnsafe(value) {
			return nil, fmt.Errorf("evidence_summary[%d] must not contain prompt text, chain-of-thought, secrets, or tokens", i)
		}
		out = append(out, value)
	}
	return out, nil
}

func looksUnsafe(value string) bool {
	lower := strings.ToLower(strings.TrimSpace(value))
	if lower == "" {
		return false
	}
	markers := []string{
		"chain of thought",
		"chain-of-thought",
		"chain_of_thought",
		"hidden reasoning",
		"internal reasoning",
		"system prompt",
		"developer prompt",
		"provider token",
		"api key",
		"apikey",
		"authorization:",
		"bearer ",
		"password",
		"private_key",
		"-----begin",
	}
	for _, marker := range markers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return strings.HasPrefix(lower, "sk-") || strings.HasPrefix(lower, "igris_")
}

func normalizeAgentName(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, "-", "_")
	value = strings.ReplaceAll(value, " ", "_")
	return value
}
