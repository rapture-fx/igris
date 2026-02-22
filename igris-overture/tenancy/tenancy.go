// Package tenancy provides the multi-tenant service layer for Igris Inertial.
// FIX-2026-02: tenancy — new package that centralises tenant lifecycle management.
//
// Previously, tenant data access was scattered across handlers with inline SQL.
// This package provides a clean service abstraction used by both HTTP handlers
// and the middleware JWT extraction path.
package tenancy

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// Tenant represents a tenant record from the tenants DB table.
// FIX-2026-02: tenancy — canonical Tenant struct, single source of truth.
type Tenant struct {
	TenantID     string
	TenantName   string
	Email        string
	Company      string
	Status       string
	APIKeyPrefix string
	CreatedAt    time.Time
	LastLoginAt  *time.Time
}

// Service provides tenant lifecycle operations backed by PostgreSQL.
// FIX-2026-02: tenancy — service layer wrapping DB operations for testability.
type Service struct {
	db *sql.DB
}

// NewService creates a new tenancy service with the provided database handle.
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// CreateTenantParams holds the inputs required to create a new tenant.
type CreateTenantParams struct {
	TenantID     string
	TenantName   string
	APIKeyHash   string
	APIKeyPrefix string
	Email        string
	CreatedBy    string
}

// CreateTenant inserts a new tenant row via the create_tenant DB stored procedure.
// FIX-2026-02: tenancy — thin service wrapper; DB proc validates uniqueness.
func (s *Service) CreateTenant(ctx context.Context, p CreateTenantParams) (*Tenant, error) {
	var tenantID string
	err := s.db.QueryRowContext(ctx,
		`SELECT create_tenant($1, $2, $3, $4, $5, $6)`,
		p.TenantID, p.TenantName, p.APIKeyHash, p.APIKeyPrefix, p.Email, p.CreatedBy,
	).Scan(&tenantID)
	if err != nil {
		return nil, fmt.Errorf("tenancy: create_tenant failed: %w", err)
	}

	t, err := s.GetTenantByID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("tenancy: failed to fetch created tenant: %w", err)
	}

	log.Info().
		Str("tenant_id", tenantID).
		Str("created_by", p.CreatedBy).
		Msg("Tenant created")

	return t, nil
}

// GetTenantByID retrieves a tenant by its primary key.
// FIX-2026-02: tenancy — returns ErrTenantNotFound when the row does not exist.
func (s *Service) GetTenantByID(ctx context.Context, tenantID string) (*Tenant, error) {
	var t Tenant
	var company, email sql.NullString
	var lastLogin sql.NullTime

	err := s.db.QueryRowContext(ctx, `
		SELECT tenant_id, tenant_name, email, company, status,
		       api_key_prefix, created_at, last_login_at
		FROM tenants
		WHERE tenant_id = $1
	`, tenantID).Scan(
		&t.TenantID, &t.TenantName, &email, &company,
		&t.Status, &t.APIKeyPrefix, &t.CreatedAt, &lastLogin,
	)

	if err == sql.ErrNoRows {
		return nil, ErrTenantNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("tenancy: get tenant query failed: %w", err)
	}

	if email.Valid {
		t.Email = email.String
	}
	if company.Valid {
		t.Company = company.String
	}
	if lastLogin.Valid {
		t.LastLoginAt = &lastLogin.Time
	}

	return &t, nil
}

// ErrTenantNotFound is returned when a tenant row does not exist.
var ErrTenantNotFound = fmt.Errorf("tenant not found")

// ExtractTenantFromJWT extracts the authenticated tenant from a Fiber request context.
// FIX-2026-02: tenancy — convenience wrapper around middleware.GetTenantContext.
// Returns nil if the request is unauthenticated or the JWT is missing.
func ExtractTenantFromJWT(c *fiber.Ctx) *middleware.TenantContext {
	return middleware.GetTenantContext(c)
}
