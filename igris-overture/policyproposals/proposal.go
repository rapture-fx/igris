// Package policyproposals implements the policy proposal lifecycle: tenant-owned
// draft policy rules that operators evaluate (via the existing read-only policy
// simulation) before they ever affect production.
//
// A proposal is governance metadata only. Nothing in this package mutates active
// policy, replays runs, dispatches tasks, calls runtimes, or persists raw
// request/response bodies, prompts, chain-of-thought, secrets, or ciphertext.
// Only safe proposal metadata, allow-listed match criteria, and a safe
// simulation summary are stored.
package policyproposals

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	// ErrNotFound is returned when a proposal does not exist for the tenant.
	ErrNotFound = errors.New("policy proposal not found")
	// ErrInvalidTransition is returned when a status change is not allowed from
	// the proposal's current state.
	ErrInvalidTransition = errors.New("invalid policy proposal status transition")
	// ErrNotSimulated is returned when an operator tries to approve a proposal
	// that has never been simulated, so there is no evidence attached.
	ErrNotSimulated = errors.New("policy proposal has not been simulated yet")
)

// Lifecycle statuses. A proposal is created as draft, marked review_ready, then
// approved. Archived is a terminal soft-delete. Approval never promotes the rule
// into live policy — that is a separate, explicitly out-of-scope step.
const (
	StatusDraft       = "draft"
	StatusReviewReady = "review_ready"
	StatusApproved    = "approved"
	StatusArchived    = "archived"

	PolicyModeRequireApproval = "require_approval"
	PolicyModeBlock           = "block"

	maxNameLen        = 120
	maxDescriptionLen = 512
	maxMatchValueLen  = 256
)

var allowedPolicyModes = map[string]bool{
	PolicyModeRequireApproval: true,
	PolicyModeBlock:           true,
}

// allowedRanges and allowedResultStatuses mirror the bounds enforced by the
// policy simulation surface so a saved proposal can always be re-simulated.
var allowedRanges = map[string]bool{
	"24h": true,
	"7d":  true,
	"30d": true,
}

var allowedResultStatuses = map[string]bool{
	"completed":         true,
	"failed":            true,
	"canceled":          true,
	"approval_required": true,
	"dispatched":        true,
	"in_flight":         true,
	"running":           true,
	"pending":           true,
}

// MatchCriteria is the allow-listed set of conditions a proposed rule matches
// on. It is the same shape the policy simulation engine consumes; every field is
// optional except range, and unknown fields are rejected at decode time.
type MatchCriteria struct {
	Range                   string `json:"range"`
	MatchActionName         string `json:"match_action_name,omitempty"`
	MatchActionPrefix       string `json:"match_action_prefix,omitempty"`
	MatchAgentID            string `json:"match_agent_id,omitempty"`
	MatchAgentType          string `json:"match_agent_type,omitempty"`
	MatchResultStatus       string `json:"match_result_status,omitempty"`
	RequireProofMissing     bool   `json:"require_proof_missing,omitempty"`
	RequireRecoveryOccurred bool   `json:"require_recovery_occurred,omitempty"`
	RequireEvalFailed       bool   `json:"require_eval_failed,omitempty"`
}

// Proposal is a tenant-owned draft policy rule and its lifecycle state.
type Proposal struct {
	ProposalID       uuid.UUID       `json:"proposal_id"`
	TenantID         string          `json:"-"`
	Name             string          `json:"name"`
	Description      string          `json:"description,omitempty"`
	Status           string          `json:"status"`
	PolicyMode       string          `json:"policy_mode"`
	MatchCriteria    MatchCriteria   `json:"match_criteria_json"`
	LatestSimulation json.RawMessage `json:"latest_simulation_json,omitempty"`
	CreatedBy        string          `json:"created_by,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	ArchivedAt       *time.Time      `json:"archived_at,omitempty"`
}

// Event is one append-only governance audit entry for a proposal. It carries
// only a short, safe summary — never raw bodies, prompts, or secrets.
type Event struct {
	EventID     uuid.UUID `json:"event_id"`
	TenantID    string    `json:"-"`
	ProposalID  uuid.UUID `json:"proposal_id"`
	EventType   string    `json:"event_type"`
	SafeSummary string    `json:"safe_summary"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateInput is the validated, safe input used to create a proposal.
type CreateInput struct {
	Name          string
	Description   string
	PolicyMode    string
	MatchCriteria MatchCriteria
}

// UpdateInput carries only the fields explicitly present in a PATCH. A nil
// pointer means "leave unchanged". Status is handled separately so a transition
// is never silently mixed with a content edit.
type UpdateInput struct {
	Name          *string
	Description   *string
	PolicyMode    *string
	MatchCriteria *MatchCriteria
	Status        *string
}

// ValidateCreateInput normalizes and bounds a create request. It rejects unsafe
// text (prompts, raw bodies, secrets) in any operator-supplied field.
func ValidateCreateInput(input CreateInput) (CreateInput, error) {
	name := strings.TrimSpace(input.Name)
	description := strings.TrimSpace(input.Description)
	if name == "" {
		return CreateInput{}, errors.New("name is required")
	}
	if len(name) > maxNameLen {
		return CreateInput{}, fmt.Errorf("name must be at most %d characters", maxNameLen)
	}
	if len(description) > maxDescriptionLen {
		return CreateInput{}, fmt.Errorf("description must be at most %d characters", maxDescriptionLen)
	}
	if looksUnsafe(name) || looksUnsafe(description) {
		return CreateInput{}, errors.New("proposal metadata must not contain prompts, raw bodies, or secrets")
	}
	mode := strings.TrimSpace(input.PolicyMode)
	if !allowedPolicyModes[mode] {
		return CreateInput{}, errors.New("policy_mode must be require_approval or block")
	}
	criteria, err := ValidateMatchCriteria(input.MatchCriteria)
	if err != nil {
		return CreateInput{}, err
	}
	return CreateInput{
		Name:          name,
		Description:   description,
		PolicyMode:    mode,
		MatchCriteria: criteria,
	}, nil
}

// ValidateMatchCriteria normalizes and bounds the match criteria. range is
// required and must be one of the supported simulation windows; every text value
// is length-bounded and screened for unsafe markers.
func ValidateMatchCriteria(in MatchCriteria) (MatchCriteria, error) {
	out := MatchCriteria{
		Range:                   strings.TrimSpace(in.Range),
		MatchActionName:         strings.TrimSpace(in.MatchActionName),
		MatchActionPrefix:       strings.TrimSpace(in.MatchActionPrefix),
		MatchAgentID:            strings.TrimSpace(in.MatchAgentID),
		MatchAgentType:          strings.TrimSpace(in.MatchAgentType),
		MatchResultStatus:       strings.TrimSpace(in.MatchResultStatus),
		RequireProofMissing:     in.RequireProofMissing,
		RequireRecoveryOccurred: in.RequireRecoveryOccurred,
		RequireEvalFailed:       in.RequireEvalFailed,
	}
	if !allowedRanges[out.Range] {
		return MatchCriteria{}, errors.New("range must be one of 24h, 7d, 30d")
	}
	for _, v := range []string{out.MatchActionName, out.MatchActionPrefix, out.MatchAgentID, out.MatchAgentType} {
		if len(v) > maxMatchValueLen {
			return MatchCriteria{}, fmt.Errorf("match value must be at most %d characters", maxMatchValueLen)
		}
	}
	if out.MatchResultStatus != "" && !allowedResultStatuses[out.MatchResultStatus] {
		return MatchCriteria{}, errors.New("match_result_status is not a known execution status")
	}
	if looksUnsafe(out.MatchActionName) || looksUnsafe(out.MatchActionPrefix) ||
		looksUnsafe(out.MatchAgentID) || looksUnsafe(out.MatchAgentType) {
		return MatchCriteria{}, errors.New("match criteria must not contain prompts, raw bodies, or secrets")
	}
	return out, nil
}

// ValidateUpdateInput normalizes the present fields of a PATCH. Content edits
// (name/description/policy_mode/match_criteria) are only meaningful while the
// proposal is editable; the store enforces the state gate. Status changes are
// restricted to the safe draft<->review_ready toggle here — approval and
// archival have their own dedicated, audited paths.
func ValidateUpdateInput(input UpdateInput) (UpdateInput, error) {
	out := UpdateInput{}
	if input.Name != nil {
		v := strings.TrimSpace(*input.Name)
		if v == "" {
			return UpdateInput{}, errors.New("name must not be empty")
		}
		if len(v) > maxNameLen || looksUnsafe(v) {
			return UpdateInput{}, errors.New("name is invalid")
		}
		out.Name = &v
	}
	if input.Description != nil {
		v := strings.TrimSpace(*input.Description)
		if len(v) > maxDescriptionLen || looksUnsafe(v) {
			return UpdateInput{}, errors.New("description is invalid")
		}
		out.Description = &v
	}
	if input.PolicyMode != nil {
		v := strings.TrimSpace(*input.PolicyMode)
		if !allowedPolicyModes[v] {
			return UpdateInput{}, errors.New("policy_mode must be require_approval or block")
		}
		out.PolicyMode = &v
	}
	if input.MatchCriteria != nil {
		criteria, err := ValidateMatchCriteria(*input.MatchCriteria)
		if err != nil {
			return UpdateInput{}, err
		}
		out.MatchCriteria = &criteria
	}
	if input.Status != nil {
		v := strings.TrimSpace(*input.Status)
		if v != StatusDraft && v != StatusReviewReady {
			return UpdateInput{}, errors.New("status may only be set to draft or review_ready")
		}
		out.Status = &v
	}
	return out, nil
}

// hasContentEdit reports whether the update changes any proposal content (as
// opposed to only toggling review readiness).
func (u UpdateInput) hasContentEdit() bool {
	return u.Name != nil || u.Description != nil || u.PolicyMode != nil || u.MatchCriteria != nil
}

// canEditContent reports whether content may be edited from the given status.
// Content is only editable while a proposal is still a draft; once it is ready
// for review or approved the criteria are frozen as evidence.
func canEditContent(status string) bool {
	return status == StatusDraft
}

// canToggleReadiness reports whether the draft<->review_ready transition is
// allowed from the current status.
func canToggleReadiness(from, to string) bool {
	switch {
	case from == StatusDraft && to == StatusReviewReady:
		return true
	case from == StatusReviewReady && to == StatusDraft:
		return true
	case from == to:
		return true
	default:
		return false
	}
}

// MatchCriteriaJSON marshals validated criteria for storage.
func MatchCriteriaJSON(criteria MatchCriteria) ([]byte, error) {
	normalized, err := ValidateMatchCriteria(criteria)
	if err != nil {
		return nil, err
	}
	return json.Marshal(normalized)
}

// looksUnsafe screens operator-supplied text for prompt/secret/raw-body markers.
// It mirrors the screen used by the execution-evaluation surface so the same
// classes of unsafe content are rejected consistently across governance inputs.
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
