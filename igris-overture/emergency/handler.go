package emergency

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
)

// Handler provides HTTP endpoints for emergency policy management
type Handler struct {
	store     *PolicyStore
	adminKey  string // Admin key for pushing policies
}

// NewHandler creates a new emergency policy handler
//
// adminKey is required for the POST endpoint (pushing new policies)
// publicKey is used to verify signatures on incoming policies
func NewHandler(adminKey, publicKey string) (*Handler, error) {
	store, err := NewPolicyStore(publicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create policy store: %w", err)
	}

	// If admin key not provided, read from environment
	if adminKey == "" {
		adminKey = os.Getenv("SCHLEP_EMERGENCY_ADMIN_KEY")
	}

	if adminKey == "" {
		return nil, fmt.Errorf("admin key required (set SCHLEP_EMERGENCY_ADMIN_KEY)")
	}

	return &Handler{
		store:    store,
		adminKey: adminKey,
	}, nil
}

// ServeHTTP implements http.Handler
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.handleGet(w, r)
	case http.MethodPost:
		h.handlePost(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleGet serves the current emergency policy
//
// Query params:
//   - since: Return policy only if version > this value
//
// Response:
//   - 200 with policy JSON if policy exists and is newer
//   - 204 if no policy or policy is not newer than 'since'
//   - 500 on error
func (h *Handler) handleGet(w http.ResponseWriter, r *http.Request) {
	// Parse 'since' query param
	sinceStr := r.URL.Query().Get("since")
	var since uint64 = 0

	if sinceStr != "" {
		var err error
		since, err = strconv.ParseUint(sinceStr, 10, 64)
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid 'since' parameter: %v", err), http.StatusBadRequest)
			return
		}
	}

	// Get policy
	var policy *EmergencyPolicy
	if since > 0 {
		policy = h.store.GetPolicySince(since)
	} else {
		policy = h.store.GetPolicy()
	}

	// Return 204 if no policy
	if policy == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Return policy
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(policy); err != nil {
		http.Error(w, fmt.Sprintf("Failed to encode policy: %v", err), http.StatusInternalServerError)
		return
	}
}

// handlePost pushes a new emergency policy
//
// Headers:
//   - X-Admin-Key: Admin key for authentication
//
// Body: EmergencyPolicy JSON
//
// Response:
//   - 200 on success
//   - 400 on invalid request
//   - 401 on auth failure
//   - 500 on error
func (h *Handler) handlePost(w http.ResponseWriter, r *http.Request) {
	// Verify admin key
	adminKey := r.Header.Get("X-Admin-Key")
	if adminKey != h.adminKey {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse policy
	var policy EmergencyPolicy
	if err := json.NewDecoder(r.Body).Decode(&policy); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	// Update policy
	if err := h.store.UpdatePolicy(&policy); err != nil {
		http.Error(w, fmt.Sprintf("Failed to update policy: %v", err), http.StatusBadRequest)
		return
	}

	// Return success
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	response := map[string]interface{}{
		"success": true,
		"version": policy.Version,
		"message": "Emergency policy updated successfully",
	}

	json.NewEncoder(w).Encode(response)
}

// HandleMetrics returns metrics about the emergency policy store
func (h *Handler) HandleMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := h.store.GetMetrics()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(metrics)
}

// GetStore returns the underlying policy store (for testing)
func (h *Handler) GetStore() *PolicyStore {
	return h.store
}
