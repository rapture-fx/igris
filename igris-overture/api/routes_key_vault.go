// Package api provides HTTP endpoints for BYOK key vault management
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Igris-inertial/system/igris-overture/security"
)

// KeyVaultHandler handles BYOK key vault HTTP requests
type KeyVaultHandler struct {
	vault *security.KeyVault
}

// NewKeyVaultHandler creates a new key vault handler
func NewKeyVaultHandler(vault *security.KeyVault) *KeyVaultHandler {
	return &KeyVaultHandler{vault: vault}
}

// StoreKeyRequest represents the request to store a new key
type StoreKeyRequest struct {
	TenantID  string `json:"tenant_id"`
	Provider  string `json:"provider"`   // "openai", "anthropic", etc.
	KeyName   string `json:"key_name"`   // "default", "production", etc.
	APIKey    string `json:"api_key"`    // Plaintext API key (encrypted in transit via HTTPS)
	CreatedBy string `json:"created_by"` // User ID or email
}

// StoreKeyResponse represents the response after storing a key
type StoreKeyResponse struct {
	Success bool   `json:"success"`
	KeyID   string `json:"key_id,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// RotateKeyRequest represents the request to rotate a key
type RotateKeyRequest struct {
	TenantID   string `json:"tenant_id"`
	Provider   string `json:"provider"`
	KeyName    string `json:"key_name"`
	NewAPIKey  string `json:"new_api_key"`
	RotatedBy  string `json:"rotated_by"`
}

// KeyInfoResponse represents key metadata (masked)
type KeyInfoResponse struct {
	ID             string     `json:"id"`
	TenantID       string     `json:"tenant_id"`
	Provider       string     `json:"provider"`
	KeyName        string     `json:"key_name"`
	MaskedKey      string     `json:"masked_key"` // e.g., "sk-****abcd"
	KeyVersion     int        `json:"key_version"`
	IsActive       bool       `json:"is_active"`
	IsValid        *bool      `json:"is_valid"`
	LastValidated  *time.Time `json:"last_validated_at,omitempty"`
	LastUsed       *time.Time `json:"last_used_at,omitempty"`
	UsageCount     int64      `json:"usage_count"`
	CreatedAt      time.Time  `json:"created_at"`
}

// ListKeysResponse represents the response for listing keys
type ListKeysResponse struct {
	Success bool              `json:"success"`
	Keys    []KeyInfoResponse `json:"keys"`
	Count   int               `json:"count"`
	Error   string            `json:"error,omitempty"`
}

// ValidateKeyResponse represents the response from key validation
type ValidateKeyResponse struct {
	Success       bool   `json:"success"`
	IsValid       bool   `json:"is_valid"`
	ValidationMsg string `json:"validation_message,omitempty"`
	Error         string `json:"error,omitempty"`
}

// GenericResponse represents a generic API response
type GenericResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// HandleStoreKey handles POST /admin/keys/store
func (h *KeyVaultHandler) HandleStoreKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req StoreKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, StoreKeyResponse{
			Success: false,
			Error:   fmt.Sprintf("Invalid request body: %v", err),
		})
		return
	}

	// Validate required fields
	if req.TenantID == "" || req.Provider == "" || req.APIKey == "" {
		respondJSON(w, http.StatusBadRequest, StoreKeyResponse{
			Success: false,
			Error:   "Missing required fields: tenant_id, provider, api_key",
		})
		return
	}

	// Default key name
	if req.KeyName == "" {
		req.KeyName = "default"
	}

	// Default created_by
	if req.CreatedBy == "" {
		req.CreatedBy = "api"
	}

	// Store the key
	encKey, err := h.vault.StoreKey(req.TenantID, req.Provider, req.KeyName, req.APIKey, req.CreatedBy)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, StoreKeyResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to store key: %v", err),
		})
		return
	}

	respondJSON(w, http.StatusOK, StoreKeyResponse{
		Success: true,
		KeyID:   encKey.ID,
		Message: fmt.Sprintf("Key stored successfully for %s/%s", req.TenantID, req.Provider),
	})
}

// HandleListKeys handles GET /admin/keys/list?tenant_id=xxx
func (h *KeyVaultHandler) HandleListKeys(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	tenantID := r.URL.Query().Get("tenant_id")
	if tenantID == "" {
		respondJSON(w, http.StatusBadRequest, ListKeysResponse{
			Success: false,
			Error:   "Missing tenant_id query parameter",
		})
		return
	}

	keys, err := h.vault.ListKeys(tenantID)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, ListKeysResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to list keys: %v", err),
		})
		return
	}

	// Convert to response format
	var keyInfos []KeyInfoResponse
	for _, k := range keys {
		keyInfos = append(keyInfos, KeyInfoResponse{
			ID:            k.ID,
			TenantID:      k.TenantID,
			Provider:      k.Provider,
			KeyName:       k.KeyName,
			MaskedKey:     k.MaskedKey,
			IsActive:      k.IsActive,
			IsValid:       k.IsValid,
			LastValidated: k.LastValidated,
			LastUsed:      k.LastUsed,
			UsageCount:    k.UsageCount,
			CreatedAt:     k.CreatedAt,
		})
	}

	respondJSON(w, http.StatusOK, ListKeysResponse{
		Success: true,
		Keys:    keyInfos,
		Count:   len(keyInfos),
	})
}

// HandleRotateKey handles POST /admin/keys/rotate
func (h *KeyVaultHandler) HandleRotateKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RotateKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, GenericResponse{
			Success: false,
			Error:   fmt.Sprintf("Invalid request body: %v", err),
		})
		return
	}

	// Validate required fields
	if req.TenantID == "" || req.Provider == "" || req.NewAPIKey == "" {
		respondJSON(w, http.StatusBadRequest, GenericResponse{
			Success: false,
			Error:   "Missing required fields: tenant_id, provider, new_api_key",
		})
		return
	}

	// Default key name
	if req.KeyName == "" {
		req.KeyName = "default"
	}

	// Default rotated_by
	if req.RotatedBy == "" {
		req.RotatedBy = "api"
	}

	// Rotate the key
	newKey, err := h.vault.RotateKey(req.TenantID, req.Provider, req.KeyName, req.NewAPIKey, req.RotatedBy)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, GenericResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to rotate key: %v", err),
		})
		return
	}

	respondJSON(w, http.StatusOK, StoreKeyResponse{
		Success: true,
		KeyID:   newKey.ID,
		Message: fmt.Sprintf("Key rotated successfully (v%d)", newKey.KeyVersion),
	})
}

// HandleValidateKey handles POST /admin/keys/validate
func (h *KeyVaultHandler) HandleValidateKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TenantID string `json:"tenant_id"`
		Provider string `json:"provider"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, ValidateKeyResponse{
			Success: false,
			Error:   fmt.Sprintf("Invalid request body: %v", err),
		})
		return
	}

	// Validate required fields
	if req.TenantID == "" || req.Provider == "" {
		respondJSON(w, http.StatusBadRequest, ValidateKeyResponse{
			Success: false,
			Error:   "Missing required fields: tenant_id, provider",
		})
		return
	}

	// Validate the key
	isValid, err := h.vault.ValidateKey(req.TenantID, req.Provider)
	if err != nil {
		respondJSON(w, http.StatusOK, ValidateKeyResponse{
			Success:       true,
			IsValid:       false,
			ValidationMsg: fmt.Sprintf("Validation failed: %v", err),
		})
		return
	}

	msg := "Key is valid"
	if !isValid {
		msg = "Key is invalid"
	}

	respondJSON(w, http.StatusOK, ValidateKeyResponse{
		Success:       true,
		IsValid:       isValid,
		ValidationMsg: msg,
	})
}

// HandleExpireKey handles POST /admin/keys/expire
func (h *KeyVaultHandler) HandleExpireKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TenantID  string `json:"tenant_id"`
		Provider  string `json:"provider"`
		KeyName   string `json:"key_name"`
		ExpiredBy string `json:"expired_by"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, GenericResponse{
			Success: false,
			Error:   fmt.Sprintf("Invalid request body: %v", err),
		})
		return
	}

	// Validate required fields
	if req.TenantID == "" || req.Provider == "" {
		respondJSON(w, http.StatusBadRequest, GenericResponse{
			Success: false,
			Error:   "Missing required fields: tenant_id, provider",
		})
		return
	}

	// Default key name
	if req.KeyName == "" {
		req.KeyName = "default"
	}

	// Default expired_by
	if req.ExpiredBy == "" {
		req.ExpiredBy = "api"
	}

	// Expire the key
	err := h.vault.ExpireKey(req.TenantID, req.Provider, req.KeyName, req.ExpiredBy)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, GenericResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to expire key: %v", err),
		})
		return
	}

	respondJSON(w, http.StatusOK, GenericResponse{
		Success: true,
		Message: fmt.Sprintf("Key expired successfully for %s/%s/%s", req.TenantID, req.Provider, req.KeyName),
	})
}

// HandleDeleteKey handles DELETE /admin/keys/delete?tenant_id=xxx&provider=yyy
func (h *KeyVaultHandler) HandleDeleteKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	tenantID := r.URL.Query().Get("tenant_id")
	provider := r.URL.Query().Get("provider")

	if tenantID == "" || provider == "" {
		respondJSON(w, http.StatusBadRequest, GenericResponse{
			Success: false,
			Error:   "Missing tenant_id or provider query parameters",
		})
		return
	}

	// Delete the key
	err := h.vault.DeleteKey(tenantID, provider)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, GenericResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to delete key: %v", err),
		})
		return
	}

	respondJSON(w, http.StatusOK, GenericResponse{
		Success: true,
		Message: fmt.Sprintf("Keys deleted successfully for %s/%s", tenantID, provider),
	})
}

// respondJSON writes a JSON response
func respondJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}
