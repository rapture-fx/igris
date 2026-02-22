package tenancy

// FIX-2026-02: tenancy — tests for tenant service layer

import (
	"testing"
	"time"
)

// TestErrTenantNotFound verifies the sentinel error is exported correctly.
func TestErrTenantNotFound(t *testing.T) {
	if ErrTenantNotFound == nil {
		t.Fatal("ErrTenantNotFound must be non-nil")
	}
	if ErrTenantNotFound.Error() == "" {
		t.Error("ErrTenantNotFound must have a non-empty message")
	}
}

// TestNewService verifies that NewService accepts a nil db without panicking
// (real DB tests require integration environment).
func TestNewService(t *testing.T) {
	svc := NewService(nil)
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}

// TestTenantStruct verifies that the Tenant struct has the expected fields.
func TestTenantStruct(t *testing.T) {
	tenant := Tenant{
		TenantID:   "acme-corp",
		TenantName: "Acme Corporation",
		Status:     "active",
		CreatedAt:  time.Now(),
	}
	if tenant.TenantID != "acme-corp" {
		t.Errorf("expected TenantID acme-corp, got %s", tenant.TenantID)
	}
	if tenant.Status != "active" {
		t.Errorf("expected Status active, got %s", tenant.Status)
	}
	// Verify optional pointer fields compile correctly
	_ = tenant.Company
	_ = tenant.Email
	_ = tenant.APIKeyPrefix
	_ = tenant.CreatedAt
	_ = tenant.LastLoginAt
}
