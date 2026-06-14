// Package actionpack defines a minimal Action Pack manifest model: a small,
// tenant-installable bundle of registered actions. Packs never carry secrets,
// raw task definitions, or tenant overrides — only safe action definition
// fields that map onto POST /v1/actions.
package actionpack

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

const SchemaVersion = "2026-06-14"

var actionNamePattern = regexp.MustCompile(`^[a-z][a-z0-9_.]{1,63}$`)

// Manifest is the on-disk / built-in Action Pack shape.
type Manifest struct {
	SchemaVersion string         `json:"schema_version"`
	Name          string         `json:"name"`
	DisplayName   string         `json:"display_name"`
	Description   string         `json:"description"`
	Actions       []ActionEntry  `json:"actions"`
}

// ActionEntry describes one action that installs as a registered definition.
type ActionEntry struct {
	Name                string                 `json:"name"`
	DisplayName         string                 `json:"display_name,omitempty"`
	Description         string                 `json:"description"`
	TargetType          string                 `json:"target_type"`
	PolicyPreset        string                 `json:"policy_preset"`
	ReplayClass         string                 `json:"replay_class,omitempty"`
	ApprovalRequired    *bool                  `json:"approval_required,omitempty"`
	Irreversible        *bool                  `json:"irreversible,omitempty"`
	TargetMetadata      map[string]interface{} `json:"target_metadata,omitempty"`
	InputSchema         map[string]interface{} `json:"input_schema"`
	IdempotencyGuidance string                 `json:"idempotency_guidance"`
	ExampleInput        map[string]interface{} `json:"example_input"`
}

var forbiddenPackKeys = map[string]struct{}{
	"tenant_id":         {},
	"task_definition":   {},
	"task_type":         {},
	"runtime_target":    {},
	"execution_graph":   {},
	"ciphertext":        {},
	"nonce":             {},
	"runtime_endpoint":  {},
	"runtime_id":        {},
	"key_material":      {},
	"secret_refs":       {},
	"secret_ref":        {},
	"api_key":           {},
	"password":          {},
	"token":             {},
	"credential":        {},
	"credentials":       {},
}

// ValidateManifest checks pack shape and rejects smuggled execution material.
func ValidateManifest(m Manifest) error {
	if strings.TrimSpace(m.SchemaVersion) != SchemaVersion {
		return fmt.Errorf("schema_version must be %q", SchemaVersion)
	}
	name := strings.TrimSpace(m.Name)
	if name == "" {
		return fmt.Errorf("pack name is required")
	}
	if strings.TrimSpace(m.Description) == "" {
		return fmt.Errorf("pack description is required")
	}
	if len(m.Actions) == 0 {
		return fmt.Errorf("pack must include at least one action")
	}
	seen := map[string]struct{}{}
	for i, action := range m.Actions {
		if err := validateActionEntry(action, i); err != nil {
			return err
		}
		if _, dup := seen[action.Name]; dup {
			return fmt.Errorf("actions[%d]: duplicate name %q", i, action.Name)
		}
		seen[action.Name] = struct{}{}
	}
	if err := rejectForbiddenKeys(m, "pack"); err != nil {
		return err
	}
	return nil
}

func validateActionEntry(action ActionEntry, index int) error {
	prefix := fmt.Sprintf("actions[%d]", index)
	name := strings.TrimSpace(action.Name)
	if !actionNamePattern.MatchString(name) {
		return fmt.Errorf("%s.name must match %s", prefix, actionNamePattern.String())
	}
	if strings.TrimSpace(action.Description) == "" {
		return fmt.Errorf("%s.description is required", prefix)
	}
	targetType := strings.TrimSpace(action.TargetType)
	if targetType != "mock_demo" {
		return fmt.Errorf("%s.target_type must be mock_demo for built-in packs", prefix)
	}
	preset := strings.TrimSpace(action.PolicyPreset)
	switch preset {
	case "Safe automation", "Human-gated", "Non-replayable", "Read-only":
	default:
		return fmt.Errorf("%s.policy_preset is unsupported", prefix)
	}
	if action.ReplayClass != "" {
		switch strings.TrimSpace(action.ReplayClass) {
		case "retryable", "non_retryable", "read_only":
		default:
			return fmt.Errorf("%s.replay_class is invalid", prefix)
		}
	}
	if action.InputSchema == nil {
		return fmt.Errorf("%s.input_schema is required", prefix)
	}
	if strings.TrimSpace(action.IdempotencyGuidance) == "" {
		return fmt.Errorf("%s.idempotency_guidance is required", prefix)
	}
	if action.ExampleInput == nil {
		return fmt.Errorf("%s.example_input is required", prefix)
	}
	if err := rejectForbiddenKeys(action, prefix); err != nil {
		return err
	}
	if looksLikeEmbeddedSecret(action) {
		return fmt.Errorf("%s must not contain secret values", prefix)
	}
	return nil
}

func rejectForbiddenKeys(value interface{}, path string) error {
	switch typed := value.(type) {
	case map[string]interface{}:
		for key, child := range typed {
			lower := strings.ToLower(strings.TrimSpace(key))
			if _, forbidden := forbiddenPackKeys[lower]; forbidden {
				return fmt.Errorf("%s: forbidden field %q", path, key)
			}
			if err := rejectForbiddenKeys(child, path+"."+key); err != nil {
				return err
			}
		}
	case []interface{}:
		for i, child := range typed {
			if err := rejectForbiddenKeys(child, fmt.Sprintf("%s[%d]", path, i)); err != nil {
				return err
			}
		}
	case Manifest:
		raw, err := json.Marshal(typed)
		if err != nil {
			return err
		}
		var generic map[string]interface{}
		if err := json.Unmarshal(raw, &generic); err != nil {
			return err
		}
		return rejectForbiddenKeys(generic, path)
	case ActionEntry:
		raw, err := json.Marshal(typed)
		if err != nil {
			return err
		}
		var generic map[string]interface{}
		if err := json.Unmarshal(raw, &generic); err != nil {
			return err
		}
		return rejectForbiddenKeys(generic, path)
	}
	return nil
}

func looksLikeEmbeddedSecret(action ActionEntry) bool {
	joined := strings.ToLower(mustJSON(action))
	secretMarkers := []string{
		"igris_",
		"sk-live",
		"sk-test",
		"apikey",
		"bearer ",
		"password=",
		"-----begin",
	}
	for _, marker := range secretMarkers {
		if strings.Contains(joined, marker) {
			return true
		}
	}
	return false
}

func mustJSON(v interface{}) string {
	raw, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(raw)
}

// PackSummary is the public list shape (no action bodies).
type PackSummary struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
	ActionCount int    `json:"action_count"`
}

// Summarize returns a safe pack listing entry.
func Summarize(m Manifest) PackSummary {
	display := strings.TrimSpace(m.DisplayName)
	if display == "" {
		display = m.Name
	}
	return PackSummary{
		Name:        m.Name,
		DisplayName: display,
		Description: m.Description,
		ActionCount: len(m.Actions),
	}
}