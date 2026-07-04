package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/url"
	"strings"
)

const responseRedactionPolicyVersion = "api-response-redaction-v1"
const maxSafeResponseStringLength = 512

var sensitiveResponseKeyPatterns = []string{
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
	"ciphertext",
	"nonce",
	"body",
	"raw_body",
	"response_body",
	"request_body",
	"content",
	"file_content",
	"file_contents",
	"full_text",
	"file_path",
	"absolute_path",
	"full_absolute_path",
}

var safeResponseRedactionMetadataKeys = map[string]struct{}{
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
	// This action metadata field stores the name of an env var, not its value.
	// The actual shared secret remains in process env and is encrypted as an
	// outbound header before task persistence.
	"local_auth_secret_env": {},
}

func sanitizeJSONRawMessage(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	var value interface{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return redactedJSONValue("invalid_json", sha256HexBytes(raw), len(raw))
	}
	encoded, err := json.Marshal(sanitizeResponseValue(value))
	if err != nil {
		return redactedJSONValue("redaction_failed", sha256HexBytes(raw), len(raw))
	}
	return encoded
}

func sanitizeResponseValue(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		out := make(map[string]interface{}, len(typed))
		for key, child := range typed {
			normalized := strings.ReplaceAll(strings.ToLower(key), "-", "_")
			if responseKeyDropped(normalized) {
				continue
			}
			if responseKeySensitive(key) {
				out[key] = redactedMap("sensitive_key", sha256HexString(valueToString(child)), len(valueToString(child)))
			} else if normalized == "path" && looksLikePrivateResponsePath(valueToString(child)) {
				out[key] = safeResponsePathEnvelope(valueToString(child))
			} else if normalized == "url" {
				out[key] = safeResponseURL(valueToString(child))
			} else if normalized == "headers" {
				out[key] = sanitizeResponseHeaders(child)
			} else {
				out[key] = sanitizeResponseValue(child)
			}
		}
		return out
	case []interface{}:
		out := make([]interface{}, 0, len(typed))
		for _, child := range typed {
			out = append(out, sanitizeResponseValue(child))
		}
		return out
	case string:
		if len(typed) > maxSafeResponseStringLength {
			return redactedMap("large_string", sha256HexString(typed), len(typed))
		}
		return redactInlineAuth(typed)
	default:
		return value
	}
}

func responseKeyDropped(normalized string) bool {
	switch normalized {
	case "ciphertext", "nonce":
		return true
	default:
		return false
	}
}

func sanitizeTargetSummary(actionType, target string) string {
	target = strings.TrimSpace(target)
	if target == "" {
		return ""
	}
	switch actionType {
	case "read_file":
		return "file:" + sha256HexString(target)
	case "http_call":
		method, rest, ok := strings.Cut(target, " ")
		if !ok {
			return redactURLQuery(target)
		}
		return strings.TrimSpace(method) + " " + redactURLQuery(rest)
	default:
		return redactInlineAuth(target)
	}
}

func sanitizeActionTargetURL(target string) string {
	safe := safeResponseURL(target)
	switch typed := safe.(type) {
	case map[string]interface{}:
		if value, ok := typed["safe_url"].(string); ok {
			return value
		}
		return ""
	case string:
		return typed
	default:
		return ""
	}
}

func sanitizeActionMetadata(metadata map[string]interface{}) map[string]interface{} {
	if metadata == nil {
		return map[string]interface{}{}
	}
	sanitized, ok := sanitizeResponseValue(metadata).(map[string]interface{})
	if !ok || sanitized == nil {
		return map[string]interface{}{
			"input_redacted":           true,
			"safe_summary":             "metadata_redaction_failed",
			"redaction_policy_version": responseRedactionPolicyVersion,
		}
	}
	return sanitized
}

func safeInputSummaryRaw(raw json.RawMessage) map[string]interface{} {
	if len(raw) == 0 {
		return nil
	}
	resp := map[string]interface{}{
		"input_redacted":           true,
		"safe_summary":             "execution input redacted; raw task definition is not returned",
		"input_digest_sha256":      sha256HexBytes(raw),
		"input_bytes":              len(raw),
		"redaction_policy_version": responseRedactionPolicyVersion,
	}
	if refs := encryptedInputRefSummaries(raw); len(refs) > 0 {
		resp["encrypted_input_refs"] = refs
	}
	return resp
}

func encryptedInputRefSummaries(raw json.RawMessage) []map[string]interface{} {
	var value interface{}
	if len(raw) == 0 || json.Unmarshal(raw, &value) != nil {
		return nil
	}
	seen := map[string]struct{}{}
	refs := []map[string]interface{}{}
	var walk func(interface{})
	walk = func(current interface{}) {
		switch typed := current.(type) {
		case map[string]interface{}:
			if encrypted, _ := typed["encrypted_input_ref"].(bool); encrypted {
				id := stringFromAny(typed["encrypted_input_ref_id"])
				if id != "" {
					if _, ok := seen[id]; !ok {
						seen[id] = struct{}{}
						refs = append(refs, map[string]interface{}{
							"encrypted_input_ref":       true,
							"encrypted_input_ref_id":    id,
							"purpose":                   stringFromAny(typed["purpose"]),
							"input_digest_sha256":       stringFromAny(typed["input_digest_sha256"]),
							"input_bytes":               typed["input_bytes"],
							"input_content_type":        stringFromAny(typed["input_content_type"]),
							"key_version":               stringFromAny(typed["key_version"]),
							"redaction_policy_version":  stringFromAny(typed["redaction_policy_version"]),
							"safe_summary":              stringFromAny(typed["safe_summary"]),
							"sensitive_fields_redacted": typed["sensitive_fields_redacted"],
						})
					}
				}
			}
			for _, child := range typed {
				walk(child)
			}
		case []interface{}:
			for _, child := range typed {
				walk(child)
			}
		}
	}
	walk(value)
	return refs
}

func safeResponseURL(raw string) interface{} {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return redactInlineAuth(trimmed)
	}
	resp := map[string]interface{}{
		"safe_url":                 parsed.Scheme + "://" + parsed.Host + parsed.EscapedPath(),
		"safe_host":                parsed.Hostname(),
		"redaction_policy_version": responseRedactionPolicyVersion,
	}
	if parsed.RawQuery != "" || parsed.User != nil {
		resp["input_redacted"] = true
		resp["input_digest_sha256"] = sha256HexString(trimmed)
		resp["input_bytes"] = len(trimmed)
		resp["sensitive_fields_redacted"] = []string{"url_query_or_credentials"}
	}
	return resp
}

func sanitizeResponseHeaders(value interface{}) interface{} {
	headers, ok := value.(map[string]interface{})
	if !ok {
		return inputRedactedMap("headers", sha256HexString(valueToString(value)), len(valueToString(value)))
	}
	if redacted, _ := headers["input_redacted"].(bool); redacted {
		return sanitizeResponseValue(headers)
	}
	out := map[string]interface{}{
		"input_redacted":            true,
		"sensitive_fields_redacted": []string{},
		"redaction_policy_version":  responseRedactionPolicyVersion,
	}
	for key, child := range headers {
		normalized := strings.ReplaceAll(strings.ToLower(key), "-", "_")
		switch {
		case responseKeySensitive(key):
			out[key] = inputRedactedMap("sensitive_header", sha256HexString(valueToString(child)), len(valueToString(child)))
			out["sensitive_fields_redacted"] = append(out["sensitive_fields_redacted"].([]string), key)
		case normalized == "content_type" || normalized == "content_length" || normalized == "etag" ||
			normalized == "last_modified" || normalized == "cache_control" ||
			normalized == "x_request_id" || normalized == "x_correlation_id":
			out[key] = sanitizeResponseValue(child)
		default:
			out[key] = inputRedactedMap("non_allowlisted_header", sha256HexString(valueToString(child)), len(valueToString(child)))
		}
	}
	return out
}

func safeResponsePathEnvelope(path string) map[string]interface{} {
	trimmed := strings.TrimSpace(path)
	resp := inputRedactedMap("private_path", sha256HexString(trimmed), len(trimmed))
	resp["safe_path_digest"] = sha256HexString(trimmed)
	return resp
}

func looksLikePrivateResponsePath(value string) bool {
	trimmed := strings.TrimSpace(value)
	return strings.HasPrefix(trimmed, "/") ||
		strings.HasPrefix(trimmed, "~/") ||
		strings.HasPrefix(trimmed, `\\`) ||
		(len(trimmed) >= 3 && trimmed[1] == ':' && (trimmed[2] == '\\' || trimmed[2] == '/'))
}

func redactURLQuery(value string) string {
	value = strings.TrimSpace(value)
	if idx := strings.Index(value, "?"); idx >= 0 {
		return value[:idx] + "?[redacted]"
	}
	return value
}

func responseKeySensitive(key string) bool {
	normalized := strings.ReplaceAll(strings.ToLower(key), "-", "_")
	if _, ok := safeResponseRedactionMetadataKeys[normalized]; ok {
		return false
	}
	for _, pattern := range sensitiveResponseKeyPatterns {
		if strings.Contains(normalized, strings.ReplaceAll(pattern, "-", "_")) {
			return true
		}
	}
	return false
}

func redactedJSONValue(reason, digest string, bytes int) json.RawMessage {
	encoded, _ := json.Marshal(redactedMap(reason, digest, bytes))
	return encoded
}

func redactedMap(reason, digest string, bytes int) map[string]interface{} {
	return map[string]interface{}{
		"redacted":                 true,
		"reason":                   reason,
		"content_digest_sha256":    digest,
		"content_bytes":            bytes,
		"redaction_policy_version": responseRedactionPolicyVersion,
	}
}

func inputRedactedMap(reason, digest string, bytes int) map[string]interface{} {
	return map[string]interface{}{
		"input_redacted":            true,
		"safe_summary":              reason,
		"input_digest_sha256":       digest,
		"input_bytes":               bytes,
		"sensitive_fields_redacted": []string{reason},
		"redaction_policy_version":  responseRedactionPolicyVersion,
	}
}

func valueToString(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		encoded, _ := json.Marshal(typed)
		return string(encoded)
	}
}

func redactInlineAuth(value string) string {
	replacer := strings.NewReplacer("Bearer ", "[redacted-auth] ", "Basic ", "[redacted-auth] ")
	return replacer.Replace(value)
}

func sha256HexString(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func sha256HexBytes(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}
