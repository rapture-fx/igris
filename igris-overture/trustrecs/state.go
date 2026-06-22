// Package trustrecs implements the operator lifecycle overlay for Trust
// Recommendations. Recommendations themselves are generated deterministically
// and read-only from execution truth (in package api); this package stores ONLY
// the operator's triage decision for a finding — acknowledge / snooze / resolve —
// keyed by the stable, generated recommendation id.
//
// It never stores the finding payload, prompts, model output, secrets, or raw
// bodies. The only free text is an optional operator note, which is length-bounded
// and screened for unsafe markers.
package trustrecs

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	// ErrNotFound is returned when no lifecycle row exists.
	ErrNotFound = errors.New("trust recommendation state not found")
	// ErrInvalidStatus is returned for an unknown status value.
	ErrInvalidStatus = errors.New("invalid trust recommendation status")
	// ErrSnoozeRequiresUntil is returned when a snooze omits a future expiry.
	ErrSnoozeRequiresUntil = errors.New("snooze requires a future snoozed_until")
)

const (
	StatusActive       = "active"
	StatusAcknowledged = "acknowledged"
	StatusSnoozed      = "snoozed"
	StatusResolved     = "resolved"

	maxRecommendationIDLen = 256
	maxReasonLen           = 512
)

var allowedStatuses = map[string]bool{
	StatusActive:       true,
	StatusAcknowledged: true,
	StatusSnoozed:      true,
	StatusResolved:     true,
}

// State is the persisted lifecycle decision for one recommendation.
type State struct {
	StateID          uuid.UUID  `json:"state_id"`
	TenantID         string     `json:"-"`
	RecommendationID string     `json:"recommendation_id"`
	Status           string     `json:"status"`
	Reason           string     `json:"reason,omitempty"`
	SnoozedUntil     *time.Time `json:"snoozed_until,omitempty"`
	AcknowledgedAt   *time.Time `json:"acknowledged_at,omitempty"`
	ResolvedAt       *time.Time `json:"resolved_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// UpsertInput is the validated, safe input used to set a lifecycle state.
type UpsertInput struct {
	RecommendationID string
	Status           string
	Reason           string
	SnoozedUntil     *time.Time
}

// EffectiveStatus returns the status accounting for snooze expiry: a snooze whose
// snoozed_until has passed reads as active again.
func (s State) EffectiveStatus(now time.Time) string {
	if s.Status == StatusSnoozed {
		if s.SnoozedUntil == nil || !s.SnoozedUntil.After(now) {
			return StatusActive
		}
	}
	return s.Status
}

// ValidateUpsertInput normalizes and bounds an upsert. It rejects unknown
// statuses, overlong/empty ids, and unsafe note text, and requires a future
// expiry for snoozes.
func ValidateUpsertInput(input UpsertInput, now time.Time) (UpsertInput, error) {
	out := UpsertInput{
		RecommendationID: strings.TrimSpace(input.RecommendationID),
		Status:           strings.TrimSpace(input.Status),
		Reason:           strings.TrimSpace(input.Reason),
		SnoozedUntil:     input.SnoozedUntil,
	}
	if out.RecommendationID == "" {
		return UpsertInput{}, errors.New("recommendation_id is required")
	}
	if len(out.RecommendationID) > maxRecommendationIDLen {
		return UpsertInput{}, errors.New("recommendation_id is too long")
	}
	if !allowedStatuses[out.Status] {
		return UpsertInput{}, ErrInvalidStatus
	}
	if len(out.Reason) > maxReasonLen {
		return UpsertInput{}, errors.New("reason is too long")
	}
	if looksUnsafe(out.Reason) {
		return UpsertInput{}, errors.New("reason must not contain prompts, raw bodies, or secrets")
	}

	// Canonicalize the timestamps each status implies. Only the snoozed status
	// keeps a snoozed_until, and it must be in the future.
	if out.Status == StatusSnoozed {
		if out.SnoozedUntil == nil || !out.SnoozedUntil.After(now) {
			return UpsertInput{}, ErrSnoozeRequiresUntil
		}
	} else {
		out.SnoozedUntil = nil
	}
	return out, nil
}

// looksUnsafe screens the optional operator note for prompt/secret/raw-body
// markers, mirroring the screen used across other governance inputs.
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
