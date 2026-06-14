package agentregistry

import (
	"encoding/json"
	"fmt"
	"strings"
)

const maxMetadataBytes = 4096

var forbiddenMetadataKeys = map[string]struct{}{
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
	"prompt":            {},
	"prompts":           {},
	"system_prompt":     {},
	"chain_of_thought":  {},
	"chain-of-thought":  {},
	"reasoning":         {},
	"raw_body":          {},
	"request_body":      {},
	"response_body":     {},
}

var forbiddenMetadataSubstrings = []string{
	"prompt",
	"chain_of_thought",
	"chain-of-thought",
	"system_message",
	"secret",
	"password",
	"api_key",
	"bearer",
	"private_key",
	"-----begin",
}

// SanitizeMetadata rejects secrets, prompts, chain-of-thought, and oversized blobs.
func SanitizeMetadata(metadata map[string]interface{}) (map[string]interface{}, error) {
	if metadata == nil {
		return map[string]interface{}{}, nil
	}
	sanitized := make(map[string]interface{}, len(metadata))
	for key, value := range metadata {
		normalized := normalizeMetadataKey(key)
		if err := rejectForbiddenMetadataKey(normalized); err != nil {
			return nil, err
		}
		clean, err := sanitizeMetadataValue(normalized, value)
		if err != nil {
			return nil, err
		}
		sanitized[normalized] = clean
	}
	raw, err := json.Marshal(sanitized)
	if err != nil {
		return nil, fmt.Errorf("metadata must be JSON-serializable")
	}
	if len(raw) > maxMetadataBytes {
		return nil, fmt.Errorf("metadata must be at most %d bytes", maxMetadataBytes)
	}
	return sanitized, nil
}

func normalizeMetadataKey(key string) string {
	return strings.ToLower(strings.TrimSpace(key))
}

func rejectForbiddenMetadataKey(key string) error {
	if key == "" {
		return fmt.Errorf("metadata keys cannot be empty")
	}
	if _, forbidden := forbiddenMetadataKeys[key]; forbidden {
		return fmt.Errorf("metadata key %q is not allowed", key)
	}
	lower := strings.ToLower(key)
	for _, marker := range forbiddenMetadataSubstrings {
		if strings.Contains(lower, marker) {
			return fmt.Errorf("metadata key %q is not allowed", key)
		}
	}
	return nil
}

func sanitizeMetadataValue(parentKey string, value interface{}) (interface{}, error) {
	switch typed := value.(type) {
	case map[string]interface{}:
		out := make(map[string]interface{}, len(typed))
		for key, child := range typed {
			normalized := normalizeMetadataKey(key)
			if err := rejectForbiddenMetadataKey(normalized); err != nil {
				return nil, err
			}
			clean, err := sanitizeMetadataValue(normalized, child)
			if err != nil {
				return nil, err
			}
			out[normalized] = clean
		}
		return out, nil
	case []interface{}:
		out := make([]interface{}, 0, len(typed))
		for i, child := range typed {
			clean, err := sanitizeMetadataValue(fmt.Sprintf("%s[%d]", parentKey, i), child)
			if err != nil {
				return nil, err
			}
			out = append(out, clean)
		}
		return out, nil
	case string:
		if looksLikeSensitiveMetadataString(typed) {
			return nil, fmt.Errorf("metadata must not contain secret or prompt values")
		}
		return typed, nil
	default:
		return value, nil
	}
}

func looksLikeSensitiveMetadataString(value string) bool {
	lower := strings.ToLower(strings.TrimSpace(value))
	if lower == "" {
		return false
	}
	if strings.Contains(lower, "bearer") ||
		strings.Contains(lower, "password") ||
		strings.Contains(lower, "authorization") ||
		strings.Contains(lower, "private_key") ||
		strings.Contains(lower, "-----begin") ||
		strings.Contains(lower, "chain of thought") {
		return true
	}
	if strings.HasPrefix(lower, "sk-") || strings.HasPrefix(lower, "igris_") {
		return true
	}
	if len(value) > 512 && (strings.Contains(lower, "you are") || strings.Contains(lower, "system:")) {
		return true
	}
	return false
}