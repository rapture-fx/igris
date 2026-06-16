package actionpack

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// InstallResult reports how many actions were created vs skipped as conflicts.
type InstallResult struct {
	PackName string   `json:"pack_name"`
	Created  []string `json:"created"`
	Skipped  []string `json:"skipped"`
}

// ActionCreateRequest is the tenant-scoped payload for POST /v1/actions.
type ActionCreateRequest struct {
	Name             string                 `json:"name"`
	DisplayName      string                 `json:"display_name"`
	Description      string                 `json:"description"`
	TargetType       string                 `json:"target_type"`
	TargetURL        string                 `json:"target_url"`
	Method           string                 `json:"method"`
	PolicyPreset     string                 `json:"policy_preset"`
	ReplayClass      string                 `json:"replay_class,omitempty"`
	ApprovalRequired *bool                  `json:"approval_required,omitempty"`
	Irreversible     *bool                  `json:"irreversible,omitempty"`
	SecretRefs       []string               `json:"secret_refs"`
	TargetMetadata   map[string]interface{} `json:"target_metadata,omitempty"`
}

// ActionCreator persists a registered action for a tenant.
type ActionCreator interface {
	CreateAction(ctx context.Context, tenantID string, req ActionCreateRequest) (created bool, err error)
}

// SQLActionCreator installs actions through the action_definitions table.
type SQLActionCreator struct {
	DB *sql.DB
}

// CreateAction inserts one action definition. Returns created=false on name conflict.
func (c SQLActionCreator) CreateAction(ctx context.Context, tenantID string, req ActionCreateRequest) (bool, error) {
	if c.DB == nil || strings.TrimSpace(tenantID) == "" {
		return false, fmt.Errorf("database or tenant is not configured")
	}
	secretRefs, err := json.Marshal(req.SecretRefs)
	if err != nil {
		return false, err
	}
	targetMetadata, err := json.Marshal(req.TargetMetadata)
	if err != nil {
		return false, err
	}
	fallbackPolicy, err := json.Marshal(map[string]interface{}{"enabled": false})
	if err != nil {
		return false, err
	}
	id := uuid.NewString()
	_, err = c.DB.ExecContext(ctx, `
		INSERT INTO action_definitions (
			id, tenant_id, name, display_name, description, target_type, target_url, method,
			policy_preset, replay_class, approval_required, irreversible, secret_refs, target_metadata,
			fallback_policy
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb)`,
		id, tenantID, req.Name, req.DisplayName, req.Description, req.TargetType, req.TargetURL, req.Method,
		req.PolicyPreset, req.ReplayClass, boolValue(req.ApprovalRequired), boolValue(req.Irreversible),
		string(secretRefs), string(targetMetadata), string(fallbackPolicy),
	)
	if err != nil {
		if isLikelyUniqueViolation(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// Install installs a validated pack into a tenant via registered-action create only.
func Install(ctx context.Context, creator ActionCreator, tenantID string, pack Manifest) (InstallResult, error) {
	if err := ValidateManifest(pack); err != nil {
		return InstallResult{}, err
	}
	result := InstallResult{PackName: pack.Name}
	for _, entry := range pack.Actions {
		req := entryToCreateRequest(entry)
		created, err := creator.CreateAction(ctx, tenantID, req)
		if err != nil {
			return result, fmt.Errorf("install action %q: %w", entry.Name, err)
		}
		if created {
			result.Created = append(result.Created, entry.Name)
		} else {
			result.Skipped = append(result.Skipped, entry.Name)
		}
	}
	return result, nil
}

func entryToCreateRequest(entry ActionEntry) ActionCreateRequest {
	display := strings.TrimSpace(entry.DisplayName)
	if display == "" {
		display = entry.Name
	}
	metadata := map[string]interface{}{}
	for key, value := range entry.TargetMetadata {
		metadata[key] = value
	}
	if entry.InputSchema != nil {
		metadata["input_schema"] = entry.InputSchema
	}
	if entry.IdempotencyGuidance != "" {
		metadata["idempotency_guidance"] = entry.IdempotencyGuidance
	}
	if entry.ExampleInput != nil {
		metadata["example_input"] = entry.ExampleInput
	}
	return ActionCreateRequest{
		Name:             entry.Name,
		DisplayName:      display,
		Description:      entry.Description,
		TargetType:       entry.TargetType,
		TargetURL:        "",
		Method:           "POST",
		PolicyPreset:     entry.PolicyPreset,
		ReplayClass:      entry.ReplayClass,
		ApprovalRequired: entry.ApprovalRequired,
		Irreversible:     entry.Irreversible,
		SecretRefs:       []string{},
		TargetMetadata:   metadata,
	}
}

func boolValue(v *bool) bool {
	if v == nil {
		return false
	}
	return *v
}

func isLikelyUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate")
}