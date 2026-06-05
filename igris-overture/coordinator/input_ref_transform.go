package coordinator

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type protectedTaskDefinition struct {
	Definition json.RawMessage
	Refs       []ExecutionInputRef
}

func protectTaskDefinitionInputs(raw json.RawMessage, tenantID string, taskID uuid.UUID) (*protectedTaskDefinition, error) {
	if len(raw) == 0 {
		return &protectedTaskDefinition{Definition: raw}, nil
	}
	var value interface{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	// Encryption always uses the active key version from the keyring.
	keyring, err := newExecutionInputKeyringFromEnv()
	var activeCipher *executionInputCipher
	if err == nil {
		activeCipher, err = keyring.active()
	}
	if err != nil {
		if containsSensitiveInput(value) {
			return nil, err
		}
		return &protectedTaskDefinition{Definition: sanitizeTaskDefinitionForPersistence(raw)}, nil
	}
	state := &inputRefProtectionState{
		tenantID: tenantID,
		taskID:   taskID,
		cipher:   activeCipher,
	}
	protectedValue, err := state.protect(value, "")
	if err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(protectedValue)
	if err != nil {
		return nil, err
	}
	return &protectedTaskDefinition{Definition: encoded, Refs: state.refs}, nil
}

type inputRefProtectionState struct {
	tenantID string
	taskID   uuid.UUID
	cipher   *executionInputCipher
	refs     []ExecutionInputRef
}

func (s *inputRefProtectionState) protect(value interface{}, parentKey string) (interface{}, error) {
	switch typed := value.(type) {
	case map[string]interface{}:
		if refID, purpose, ok := inputRefMetadata(typed); ok {
			return typed, ensureInputRefMetadataScope(refID, purpose)
		}
		out := make(map[string]interface{}, len(typed))
		for key, child := range typed {
			normalized := normalizeInputKey(key)
			switch {
			case inputKeySafe(normalized):
				out[key] = child
			case normalized == "headers":
				protected, err := s.protectHeaders(child)
				if err != nil {
					return nil, err
				}
				out[key] = protected
			case normalized == "url" && safeURLContainsSensitiveMaterial(valueToInputString(child)):
				ref, err := s.buildRef(child, "signed_url")
				if err != nil {
					return nil, err
				}
				out[key] = encryptedInputRefMetadata(ref, "signed URL redacted; encrypted input ref available for authorized recovery")
			case inputKeySensitive(normalized):
				ref, err := s.buildRef(child, purposeForSensitiveInputKey(normalized))
				if err != nil {
					return nil, err
				}
				out[key] = encryptedInputRefMetadata(ref, "sensitive input redacted; encrypted input ref available for authorized recovery")
			case normalized == "path" && looksLikePrivatePath(valueToInputString(child)):
				ref, err := s.buildRef(child, "private_path")
				if err != nil {
					return nil, err
				}
				out[key] = encryptedInputRefMetadata(ref, "private path redacted; encrypted input ref available for authorized recovery")
			default:
				protected, err := s.protect(child, normalized)
				if err != nil {
					return nil, err
				}
				out[key] = protected
			}
		}
		return out, nil
	case []interface{}:
		out := make([]interface{}, 0, len(typed))
		for _, child := range typed {
			protected, err := s.protect(child, parentKey)
			if err != nil {
				return nil, err
			}
			out = append(out, protected)
		}
		return out, nil
	case string:
		if looksLikePrivatePath(typed) {
			ref, err := s.buildRef(typed, "private_path")
			if err != nil {
				return nil, err
			}
			return encryptedInputRefMetadata(ref, "private path redacted; encrypted input ref available for authorized recovery"), nil
		}
		if len(typed) > maxSafeInputStringLength || inputKeySensitive(parentKey) {
			ref, err := s.buildRef(typed, purposeForSensitiveInputKey(parentKey))
			if err != nil {
				return nil, err
			}
			return encryptedInputRefMetadata(ref, "sensitive string redacted; encrypted input ref available for authorized recovery"), nil
		}
		return redactInlineInputAuth(typed), nil
	default:
		return value, nil
	}
}

func (s *inputRefProtectionState) protectHeaders(value interface{}) (interface{}, error) {
	headers, ok := value.(map[string]interface{})
	if !ok {
		ref, err := s.buildRef(value, "sensitive_header")
		if err != nil {
			return nil, err
		}
		return encryptedInputRefMetadata(ref, "headers redacted; encrypted input ref available for authorized recovery"), nil
	}
	out := map[string]interface{}{
		"input_redacted":            true,
		"sensitive_fields_redacted": []string{},
		"redaction_policy_version":  inputReferenceRedactionPolicyVersion,
	}
	for key, child := range headers {
		normalized := normalizeInputKey(key)
		if inputKeySensitive(normalized) {
			ref, err := s.buildRef(child, "sensitive_header")
			if err != nil {
				return nil, err
			}
			out[key] = encryptedInputRefMetadata(ref, "sensitive header redacted; encrypted input ref available for authorized recovery")
			out["sensitive_fields_redacted"] = append(out["sensitive_fields_redacted"].([]string), key)
			continue
		}
		switch normalized {
		case "content_type", "content_length", "etag", "last_modified", "cache_control", "x_request_id", "x_correlation_id":
			out[key] = child
		default:
			ref, err := s.buildRef(child, "sensitive_header")
			if err != nil {
				return nil, err
			}
			out[key] = encryptedInputRefMetadata(ref, "non-allowlisted header redacted; encrypted input ref available for authorized recovery")
		}
	}
	return out, nil
}

func (s *inputRefProtectionState) buildRef(value interface{}, purpose string) (ExecutionInputRef, error) {
	refID := uuid.New()
	plaintext := []byte(valueToInputString(value))
	aad, err := executionInputAssociatedData(s.tenantID, s.taskID, refID, purpose, s.cipher.keyVersion)
	if err != nil {
		return ExecutionInputRef{}, err
	}
	ciphertext, nonce, err := s.cipher.encrypt(plaintext, aad)
	if err != nil {
		return ExecutionInputRef{}, err
	}
	ref := ExecutionInputRef{
		ID:                     refID,
		TenantID:               s.tenantID,
		TaskID:                 s.taskID,
		Purpose:                purpose,
		Ciphertext:             ciphertext,
		Nonce:                  nonce,
		AAD:                    aad,
		DigestSHA256:           sha256InputBytes(plaintext),
		PlaintextBytes:         len(plaintext),
		RedactionPolicyVersion: inputReferenceRedactionPolicyVersion,
		KeyVersion:             s.cipher.keyVersion,
	}
	s.refs = append(s.refs, ref)
	return ref, nil
}

func rehydrateTaskDefinitionInputRefs(raw json.RawMessage, tenantID string, taskID uuid.UUID, resolver func(uuid.UUID, string) ([]byte, error)) (json.RawMessage, error) {
	if len(raw) == 0 {
		return raw, nil
	}
	var value interface{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	rehydrated, err := rehydrateInputRefValue(value, resolver)
	if err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(rehydrated)
	if err != nil {
		return nil, err
	}
	return encoded, nil
}

func rehydrateInputRefValue(value interface{}, resolver func(uuid.UUID, string) ([]byte, error)) (interface{}, error) {
	switch typed := value.(type) {
	case map[string]interface{}:
		if refID, purpose, ok := inputRefMetadata(typed); ok {
			plaintext, err := resolver(refID, purpose)
			if err != nil {
				return nil, err
			}
			return string(plaintext), nil
		}
		out := make(map[string]interface{}, len(typed))
		for key, child := range typed {
			rehydrated, err := rehydrateInputRefValue(child, resolver)
			if err != nil {
				return nil, err
			}
			out[key] = rehydrated
		}
		return out, nil
	case []interface{}:
		out := make([]interface{}, 0, len(typed))
		for _, child := range typed {
			rehydrated, err := rehydrateInputRefValue(child, resolver)
			if err != nil {
				return nil, err
			}
			out = append(out, rehydrated)
		}
		return out, nil
	default:
		return value, nil
	}
}

func containsSensitiveInput(value interface{}) bool {
	switch typed := value.(type) {
	case map[string]interface{}:
		for key, child := range typed {
			normalized := normalizeInputKey(key)
			if inputKeySensitive(normalized) ||
				(normalized == "path" && looksLikePrivatePath(valueToInputString(child))) ||
				(normalized == "url" && safeURLContainsSensitiveMaterial(valueToInputString(child))) {
				return true
			}
			if containsSensitiveInput(child) {
				return true
			}
		}
	case []interface{}:
		for _, child := range typed {
			if containsSensitiveInput(child) {
				return true
			}
		}
	case string:
		return looksLikePrivatePath(typed) || len(typed) > maxSafeInputStringLength
	}
	return false
}

func ensureInputRefMetadataScope(refID uuid.UUID, purpose string) error {
	if refID == uuid.Nil || strings.TrimSpace(purpose) == "" {
		return fmt.Errorf("invalid encrypted input ref metadata")
	}
	return nil
}
