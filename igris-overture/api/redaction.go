package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
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
	"body",
	"raw_body",
	"response_body",
	"request_body",
	"content",
	"file_content",
	"file_contents",
	"full_text",
}

var safeResponseRedactionMetadataKeys = map[string]struct{}{
	"content_redacted":         {},
	"content_digest":           {},
	"content_digest_sha256":    {},
	"content_bytes":            {},
	"content_type":             {},
	"redaction_policy_version": {},
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
			if responseKeySensitive(key) {
				out[key] = redactedMap("sensitive_key", sha256HexString(valueToString(child)), len(valueToString(child)))
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
