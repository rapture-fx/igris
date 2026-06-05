package coordinator

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/url"
	"strings"
)

const inputRedactionPolicyVersion = "overture-input-redaction-v1"
const maxSafeInputStringLength = 512

var sensitiveInputKeyPatterns = []string{
	"authorization",
	"cookie",
	"set_cookie",
	"set-cookie",
	"token",
	"secret",
	"password",
	"api_key",
	"apikey",
	"access_key",
	"refresh_token",
	"private_key",
	"credential",
	"body",
	"raw_body",
	"response_body",
	"request_body",
	"payload",
	"content",
	"file_content",
	"file_contents",
	"full_text",
	"file_path",
	"absolute_path",
	"full_absolute_path",
}

var safeInputMetadataKeys = map[string]struct{}{
	"content_redacted":          {},
	"content_digest":            {},
	"content_digest_sha256":     {},
	"content_bytes":             {},
	"content_type":              {},
	"input_redacted":            {},
	"input_digest_sha256":       {},
	"input_bytes":               {},
	"input_content_type":        {},
	"encrypted_input_ref":       {},
	"encrypted_input_ref_id":    {},
	"purpose":                   {},
	"key_version":               {},
	"created_at":                {},
	"expires_at":                {},
	"safe_summary":              {},
	"sensitive_fields_redacted": {},
	"redaction_policy_version":  {},
}

func sanitizeTaskDefinitionForPersistence(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	var value interface{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return inputRedactedJSON("invalid_json", raw)
	}
	encoded, err := json.Marshal(sanitizeInputValue(value))
	if err != nil {
		return inputRedactedJSON("redaction_failed", raw)
	}
	return encoded
}

func sanitizeInputValue(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		out := make(map[string]interface{}, len(typed))
		for key, child := range typed {
			normalized := normalizeInputKey(key)
			switch {
			case inputKeySafe(normalized):
				out[key] = sanitizeInputValue(child)
			case inputKeySensitive(normalized):
				out[key] = inputRedactedEnvelope(child, "sensitive_input")
			case normalized == "path" && looksLikePrivatePath(valueToInputString(child)):
				out[key] = safePathEnvelope(valueToInputString(child))
			case normalized == "url":
				out[key] = safeURLForPersistence(valueToInputString(child))
			case normalized == "headers":
				out[key] = safeHeaderMetadata(child)
			default:
				out[key] = sanitizeInputValue(child)
			}
		}
		return out
	case []interface{}:
		out := make([]interface{}, 0, len(typed))
		for _, child := range typed {
			out = append(out, sanitizeInputValue(child))
		}
		return out
	case string:
		if looksLikePrivatePath(typed) {
			return safePathEnvelope(typed)
		}
		if len(typed) > maxSafeInputStringLength {
			return inputRedactedEnvelope(typed, "large_string")
		}
		return redactInlineInputAuth(typed)
	default:
		return value
	}
}

func inputKeySensitive(normalized string) bool {
	for _, pattern := range sensitiveInputKeyPatterns {
		if strings.Contains(normalized, normalizeInputKey(pattern)) {
			return true
		}
	}
	return false
}

func inputKeySafe(normalized string) bool {
	_, ok := safeInputMetadataKeys[normalized]
	return ok
}

func normalizeInputKey(key string) string {
	return strings.ReplaceAll(strings.ToLower(strings.TrimSpace(key)), "-", "_")
}

func inputRedactedJSON(reason string, raw []byte) json.RawMessage {
	encoded, _ := json.Marshal(map[string]interface{}{
		"input_redacted":            true,
		"safe_summary":              reason,
		"input_digest_sha256":       sha256InputBytes(raw),
		"input_bytes":               len(raw),
		"sensitive_fields_redacted": []string{"task_definition"},
		"redaction_policy_version":  inputRedactionPolicyVersion,
	})
	return encoded
}

func inputRedactedEnvelope(value interface{}, reason string) map[string]interface{} {
	raw := []byte(valueToInputString(value))
	return map[string]interface{}{
		"input_redacted":            true,
		"safe_summary":              reason,
		"input_digest_sha256":       sha256InputBytes(raw),
		"input_bytes":               len(raw),
		"sensitive_fields_redacted": []string{reason},
		"redaction_policy_version":  inputRedactionPolicyVersion,
	}
}

func safePathEnvelope(path string) map[string]interface{} {
	trimmed := strings.TrimSpace(path)
	resp := inputRedactedEnvelope(trimmed, "private_path")
	resp["safe_path_digest"] = sha256InputBytes([]byte(trimmed))
	return resp
}

func safeURLForPersistence(raw string) interface{} {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return redactInlineInputAuth(trimmed)
	}
	resp := map[string]interface{}{
		"safe_url":                 parsed.Scheme + "://" + parsed.Host + parsed.EscapedPath(),
		"safe_host":                parsed.Hostname(),
		"redaction_policy_version": inputRedactionPolicyVersion,
	}
	if parsed.RawQuery != "" || parsed.User != nil {
		resp["input_redacted"] = true
		resp["input_digest_sha256"] = sha256InputBytes([]byte(trimmed))
		resp["input_bytes"] = len(trimmed)
		resp["sensitive_fields_redacted"] = []string{"url_query_or_credentials"}
	}
	return resp
}

func safeHeaderMetadata(value interface{}) interface{} {
	headers, ok := value.(map[string]interface{})
	if !ok {
		return inputRedactedEnvelope(value, "headers")
	}
	out := map[string]interface{}{
		"input_redacted":            true,
		"sensitive_fields_redacted": []string{},
		"redaction_policy_version":  inputRedactionPolicyVersion,
	}
	for key, child := range headers {
		normalized := normalizeInputKey(key)
		if inputKeySensitive(normalized) {
			out[key] = inputRedactedEnvelope(child, "sensitive_header")
			out["sensitive_fields_redacted"] = append(out["sensitive_fields_redacted"].([]string), key)
			continue
		}
		switch normalized {
		case "content_type", "content_length", "etag", "last_modified", "cache_control", "x_request_id", "x_correlation_id":
			out[key] = sanitizeInputValue(child)
		default:
			out[key] = inputRedactedEnvelope(child, "non_allowlisted_header")
		}
	}
	return out
}

func looksLikePrivatePath(value string) bool {
	trimmed := strings.TrimSpace(value)
	return strings.HasPrefix(trimmed, "/") ||
		strings.HasPrefix(trimmed, "~/") ||
		strings.HasPrefix(trimmed, `\\`) ||
		(len(trimmed) >= 3 && (trimmed[1] == ':' && (trimmed[2] == '\\' || trimmed[2] == '/')))
}

func valueToInputString(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		encoded, _ := json.Marshal(typed)
		return string(encoded)
	}
}

func redactInlineInputAuth(value string) string {
	replacer := strings.NewReplacer("Bearer ", "[redacted-auth] ", "Basic ", "[redacted-auth] ")
	return replacer.Replace(value)
}

func sha256InputBytes(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}
