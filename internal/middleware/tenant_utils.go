package middleware

import (
	"github.com/gofiber/fiber/v2"
)

// GetTenantIDFromContext extracts the tenant ID from Fiber context
// Phase 2: Helper function for multi-tenant request handling
// Returns "default" if no tenant context is found (backward compatible)
func GetTenantIDFromContext(c *fiber.Ctx) string {
	// Try to get tenant context from locals
	tenantCtx := GetTenantContext(c)
	if tenantCtx != nil && tenantCtx.TenantID != "" {
		return tenantCtx.TenantID
	}

	// Fallback to default for backward compatibility
	return "default"
}

// GetTenantNameFromContext extracts the tenant name from Fiber context
// Returns empty string if no tenant context is found
func GetTenantNameFromContext(c *fiber.Ctx) string {
	tenantCtx := GetTenantContext(c)
	if tenantCtx != nil {
		return tenantCtx.TenantName
	}
	return ""
}

// IsAuthenticatedRequest checks if the request has a valid tenant context
// Phase 2: Used to differentiate between authenticated and anonymous requests
func IsAuthenticatedRequest(c *fiber.Ctx) bool {
	tenantCtx := GetTenantContext(c)
	return tenantCtx != nil && tenantCtx.TenantID != ""
}

// IsAdminRequest checks if the request has admin privileges
func IsAdminRequest(c *fiber.Ctx) bool {
	tenantCtx := GetTenantContext(c)
	return tenantCtx != nil && tenantCtx.IsAdmin
}

// GetTenantRoles returns the roles for the current tenant
func GetTenantRoles(c *fiber.Ctx) []string {
	tenantCtx := GetTenantContext(c)
	if tenantCtx != nil {
		return tenantCtx.Roles
	}
	return []string{}
}
