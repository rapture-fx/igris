use serde_json::{json, Map, Value};

pub const REDACTION_POLICY_VERSION: &str = "runtime-output-redaction-v1";
pub const MAX_SAFE_STRING_LENGTH: usize = 512;

const SENSITIVE_KEY_PATTERNS: &[&str] = &[
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
];

pub const SAFE_HTTP_RESPONSE_HEADERS: &[&str] = &[
    "content-type",
    "content-length",
    "etag",
    "last-modified",
    "cache-control",
    "x-request-id",
    "x-correlation-id",
];

pub fn safe_content_output(
    tool_name: &str,
    operation: &str,
    status: &str,
    content: &[u8],
    content_type: Option<&str>,
    summary: &str,
    metadata: Value,
) -> String {
    json!({
        "tool_name": tool_name,
        "operation": operation,
        "status": status,
        "content_redacted": true,
        "content_digest_sha256": crate::sha256_hex(content),
        "content_bytes": content.len(),
        "content_type": content_type.unwrap_or("unknown"),
        "summary": summary,
        "metadata": sanitize_json_value(metadata),
        "redaction_policy_version": REDACTION_POLICY_VERSION,
    })
    .to_string()
}

pub fn safe_empty_output(
    tool_name: &str,
    operation: &str,
    status: &str,
    summary: &str,
    metadata: Value,
) -> String {
    json!({
        "tool_name": tool_name,
        "operation": operation,
        "status": status,
        "content_redacted": false,
        "content_digest_sha256": "",
        "content_bytes": 0,
        "content_type": "none",
        "summary": sanitize_string(summary),
        "metadata": sanitize_json_value(metadata),
        "redaction_policy_version": REDACTION_POLICY_VERSION,
    })
    .to_string()
}

pub fn safe_error_message(code: &str) -> String {
    json!({
        "error_code": code,
        "message": "tool execution failed",
        "redaction_policy_version": REDACTION_POLICY_VERSION,
    })
    .to_string()
}

pub fn safe_file_metadata(path: &str, extra: Value) -> Value {
    let path_obj = std::path::Path::new(path);
    let file_name_safe = path_obj
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown");
    let extension = path_obj
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    let mut metadata = Map::new();
    metadata.insert("file_name_safe".to_string(), json!(file_name_safe));
    metadata.insert("file_extension".to_string(), json!(extension));
    metadata.insert(
        "path_digest_sha256".to_string(),
        json!(crate::sha256_hex(path.as_bytes())),
    );
    if let Value::Object(extra_map) = sanitize_json_value(extra) {
        for (key, value) in extra_map {
            metadata.insert(key, value);
        }
    }
    Value::Object(metadata)
}

pub fn allowlisted_http_headers(headers: &reqwest::header::HeaderMap) -> Value {
    let mut out = Map::new();
    for key in SAFE_HTTP_RESPONSE_HEADERS {
        if let Some(value) = headers.get(*key) {
            if let Ok(value) = value.to_str() {
                out.insert((*key).to_string(), Value::String(sanitize_string(value)));
            }
        }
    }
    Value::Object(out)
}

pub fn sanitize_tool_output(raw: &str) -> Value {
    if let Ok(value) = serde_json::from_str::<Value>(raw) {
        if value
            .get("redaction_policy_version")
            .and_then(Value::as_str)
            .is_some()
        {
            return sanitize_json_value(value);
        }
    }
    json!({
        "content_redacted": true,
        "content_digest_sha256": crate::sha256_hex(raw.as_bytes()),
        "content_bytes": raw.len(),
        "summary": "tool output redacted",
        "redaction_policy_version": REDACTION_POLICY_VERSION,
    })
}

pub fn sanitize_json_value(value: Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut out = Map::new();
            for (key, value) in map {
                if is_sensitive_key(&key) {
                    out.insert(
                        key,
                        redacted_value("sensitive_key", value_digest(&value), value_len(&value)),
                    );
                } else {
                    out.insert(key, sanitize_json_value(value));
                }
            }
            Value::Object(out)
        }
        Value::Array(items) => Value::Array(items.into_iter().map(sanitize_json_value).collect()),
        Value::String(text) => {
            if text.len() > MAX_SAFE_STRING_LENGTH {
                redacted_value(
                    "large_string",
                    crate::sha256_hex(text.as_bytes()),
                    text.len(),
                )
            } else {
                Value::String(sanitize_string(&text))
            }
        }
        other => other,
    }
}

pub fn sanitize_string(text: &str) -> String {
    let mut sanitized = text.to_string();
    for marker in ["Bearer ", "Basic "] {
        if sanitized.contains(marker) {
            sanitized = sanitized.replace(marker, "[redacted-auth] ");
        }
    }
    sanitized
}

fn is_sensitive_key(key: &str) -> bool {
    let normalized = key.to_lowercase().replace('-', "_");
    SENSITIVE_KEY_PATTERNS
        .iter()
        .any(|pattern| normalized.contains(&pattern.replace('-', "_")))
}

fn redacted_value(reason: &str, digest: String, bytes: usize) -> Value {
    json!({
        "redacted": true,
        "reason": reason,
        "content_digest_sha256": digest,
        "content_bytes": bytes,
        "redaction_policy_version": REDACTION_POLICY_VERSION,
    })
}

fn value_digest(value: &Value) -> String {
    crate::sha256_hex(value.to_string().as_bytes())
}

fn value_len(value: &Value) -> usize {
    match value {
        Value::String(text) => text.len(),
        other => other.to_string().len(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_sensitive_keys_recursively() {
        let value = json!({
            "nested": {
                "authorization": "Bearer IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET",
                "items": [{"password": "IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET"}]
            },
            "safe": "ok"
        });
        let sanitized = sanitize_json_value(value);
        let encoded = sanitized.to_string();
        assert!(!encoded.contains("IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET"));
        assert!(encoded.contains(REDACTION_POLICY_VERSION));
        assert!(encoded.contains("\"safe\":\"ok\""));
    }

    #[test]
    fn redacts_large_strings() {
        let marker = "IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET";
        let value = json!({ "safe_key": marker.repeat(30) });
        let sanitized = sanitize_json_value(value).to_string();
        assert!(!sanitized.contains(marker));
        assert!(sanitized.contains("large_string"));
    }
}
