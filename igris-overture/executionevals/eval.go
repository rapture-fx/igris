package executionevals

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("execution eval not found")

const (
	StatusPassed = "passed"
	StatusFailed = "failed"

	TypeActionCalled        = "action_called"
	TypeActionNotCalled     = "action_not_called"
	TypeAgentUsed           = "agent_used"
	TypeApprovalRequired    = "approval_required"
	TypeApprovalNotRequired = "approval_not_required"
	TypeRecoveryOccurred    = "recovery_occurred"
	TypeRecoveryNotRequired = "recovery_not_required"
	TypeProofGenerated      = "proof_generated"
	TypeNoSecretLeak        = "no_secret_leak"
)

var allowedAssertionTypes = map[string]bool{
	TypeActionCalled:        true,
	TypeActionNotCalled:     true,
	TypeAgentUsed:           true,
	TypeApprovalRequired:    true,
	TypeApprovalNotRequired: true,
	TypeRecoveryOccurred:    true,
	TypeRecoveryNotRequired: true,
	TypeProofGenerated:      true,
	TypeNoSecretLeak:        true,
}

type Eval struct {
	EvalID           uuid.UUID   `json:"eval_id"`
	TenantID         string      `json:"-"`
	Name             string      `json:"name"`
	Description      string      `json:"description,omitempty"`
	TargetActionName string      `json:"target_action_name,omitempty"`
	TargetAgentID    string      `json:"target_agent_id,omitempty"`
	Assertions       []Assertion `json:"assertions_json"`
	Enabled          bool        `json:"enabled"`
	CreatedAt        time.Time   `json:"created_at"`
	UpdatedAt        time.Time   `json:"updated_at"`
	ArchivedAt       *time.Time  `json:"archived_at,omitempty"`
}

type Assertion struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Value      string `json:"value,omitempty"`
	ActionName string `json:"action_name,omitempty"`
	AgentID    string `json:"agent_id,omitempty"`
}

type Run struct {
	EvalRunID   uuid.UUID         `json:"eval_run_id"`
	TenantID    string            `json:"-"`
	EvalID      uuid.UUID         `json:"eval_id"`
	TaskID      uuid.UUID         `json:"task_id"`
	ExecutionID string            `json:"execution_id,omitempty"`
	Status      string            `json:"status"`
	PassedCount int               `json:"passed_count"`
	FailedCount int               `json:"failed_count"`
	Results     []AssertionResult `json:"results_json"`
	EvalName    string            `json:"eval_name,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
}

type AssertionResult struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Reason string `json:"reason"`
}

type CreateInput struct {
	Name             string
	Description      string
	TargetActionName string
	TargetAgentID    string
	Assertions       []Assertion
	Enabled          *bool
}

type UpdateInput struct {
	Name             *string
	Description      *string
	TargetActionName *string
	TargetAgentID    *string
	Assertions       *[]Assertion
	Enabled          *bool
}

func ValidateCreateInput(input CreateInput) (CreateInput, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Description = strings.TrimSpace(input.Description)
	input.TargetActionName = strings.TrimSpace(input.TargetActionName)
	input.TargetAgentID = strings.TrimSpace(input.TargetAgentID)
	if input.Name == "" {
		return CreateInput{}, errors.New("name is required")
	}
	if len(input.Name) > 120 {
		return CreateInput{}, errors.New("name must be at most 120 characters")
	}
	if len(input.Description) > 512 {
		return CreateInput{}, errors.New("description must be at most 512 characters")
	}
	if looksUnsafe(input.Name) || looksUnsafe(input.Description) ||
		looksUnsafe(input.TargetActionName) || looksUnsafe(input.TargetAgentID) {
		return CreateInput{}, errors.New("eval metadata must not contain prompts, raw bodies, or secrets")
	}
	assertions, err := ValidateAssertions(input.Assertions)
	if err != nil {
		return CreateInput{}, err
	}
	input.Assertions = assertions
	if input.Enabled == nil {
		enabled := true
		input.Enabled = &enabled
	}
	return input, nil
}

func ValidateUpdateInput(input UpdateInput) (UpdateInput, error) {
	if input.Name != nil {
		v := strings.TrimSpace(*input.Name)
		if v == "" {
			return UpdateInput{}, errors.New("name must not be empty")
		}
		if len(v) > 120 || looksUnsafe(v) {
			return UpdateInput{}, errors.New("name is invalid")
		}
		input.Name = &v
	}
	if input.Description != nil {
		v := strings.TrimSpace(*input.Description)
		if len(v) > 512 || looksUnsafe(v) {
			return UpdateInput{}, errors.New("description is invalid")
		}
		input.Description = &v
	}
	if input.TargetActionName != nil {
		v := strings.TrimSpace(*input.TargetActionName)
		if looksUnsafe(v) {
			return UpdateInput{}, errors.New("target_action_name is invalid")
		}
		input.TargetActionName = &v
	}
	if input.TargetAgentID != nil {
		v := strings.TrimSpace(*input.TargetAgentID)
		if looksUnsafe(v) {
			return UpdateInput{}, errors.New("target_agent_id is invalid")
		}
		input.TargetAgentID = &v
	}
	if input.Assertions != nil {
		assertions, err := ValidateAssertions(*input.Assertions)
		if err != nil {
			return UpdateInput{}, err
		}
		input.Assertions = &assertions
	}
	return input, nil
}

func ValidateAssertions(assertions []Assertion) ([]Assertion, error) {
	if len(assertions) == 0 {
		return nil, errors.New("assertions_json must contain at least one assertion")
	}
	if len(assertions) > 50 {
		return nil, errors.New("assertions_json must contain at most 50 assertions")
	}
	out := make([]Assertion, 0, len(assertions))
	for i, assertion := range assertions {
		assertion.Name = strings.TrimSpace(assertion.Name)
		assertion.Type = strings.TrimSpace(assertion.Type)
		assertion.Value = strings.TrimSpace(assertion.Value)
		assertion.ActionName = strings.TrimSpace(assertion.ActionName)
		assertion.AgentID = strings.TrimSpace(assertion.AgentID)
		if assertion.Name == "" {
			return nil, fmt.Errorf("assertions_json[%d].name is required", i)
		}
		if len(assertion.Name) > 120 || looksUnsafe(assertion.Name) {
			return nil, fmt.Errorf("assertions_json[%d].name is invalid", i)
		}
		if !allowedAssertionTypes[assertion.Type] {
			return nil, fmt.Errorf("assertions_json[%d].type is unsupported", i)
		}
		if looksUnsafe(assertion.Value) || looksUnsafe(assertion.ActionName) || looksUnsafe(assertion.AgentID) {
			return nil, fmt.Errorf("assertions_json[%d] contains unsafe text", i)
		}
		switch assertion.Type {
		case TypeActionCalled, TypeActionNotCalled:
			if assertion.targetAction() == "" {
				return nil, fmt.Errorf("assertions_json[%d].action_name is required", i)
			}
		case TypeAgentUsed:
			if assertion.targetAgent() == "" {
				return nil, fmt.Errorf("assertions_json[%d].agent_id is required", i)
			}
		}
		out = append(out, assertion)
	}
	return out, nil
}

func DecodeAssertions(raw []byte) ([]Assertion, error) {
	var assertions []Assertion
	if len(raw) == 0 {
		return nil, errors.New("assertions_json is required")
	}
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&assertions); err != nil {
		return nil, fmt.Errorf("decode assertions_json: %w", err)
	}
	return ValidateAssertions(assertions)
}

func AssertionsJSON(assertions []Assertion) ([]byte, error) {
	normalized, err := ValidateAssertions(assertions)
	if err != nil {
		return nil, err
	}
	return json.Marshal(normalized)
}

func ResultsJSON(results []AssertionResult) ([]byte, error) {
	if results == nil {
		results = []AssertionResult{}
	}
	for i, result := range results {
		if looksUnsafe(result.Name) || looksUnsafe(result.Status) || looksUnsafe(result.Reason) {
			return nil, fmt.Errorf("results_json[%d] contains unsafe text", i)
		}
	}
	return json.Marshal(results)
}

func (a Assertion) targetAction() string {
	if a.ActionName != "" {
		return a.ActionName
	}
	return a.Value
}

func (a Assertion) targetAgent() string {
	if a.AgentID != "" {
		return a.AgentID
	}
	return a.Value
}

func looksUnsafe(value string) bool {
	lower := strings.ToLower(strings.TrimSpace(value))
	if lower == "" {
		return false
	}
	markers := []string{
		"prompt",
		"chain of thought",
		"chain-of-thought",
		"chain_of_thought",
		"hidden reasoning",
		"raw_body",
		"request_body",
		"response_body",
		"ciphertext",
		"nonce",
		"api key",
		"api_key",
		"apikey",
		"authorization:",
		"bearer ",
		"cookie",
		"private key",
		"private_key",
		"password",
		"-----begin",
	}
	for _, marker := range markers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return strings.HasPrefix(lower, "sk-") || strings.HasPrefix(lower, "igris_")
}
