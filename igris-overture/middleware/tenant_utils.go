package middleware

import (
	"context"
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// TenantIDContextKey is the context key for tenant ID in standard Go context
// This allows tenant ID to be passed through context.Context (not just Fiber locals)
type tenantIDContextKey struct{}

// tierContextKey is the context key for tier information
type tierContextKey struct{}

// TierInfo holds tier information for feature gating
type TierInfo struct {
	Tier           string
	AuthorityLevel string // observe, influence, enforce, prove
	Features       map[string]bool
}

// WithTenantID returns a new context with the tenant ID set
// Use this to propagate tenant ID from HTTP handlers to downstream services
func WithTenantID(ctx context.Context, tenantID string) context.Context {
	return context.WithValue(ctx, tenantIDContextKey{}, tenantID)
}

// TenantIDFromContext extracts the tenant ID from a standard Go context
// Returns "default" if no tenant ID is set (backward compatible)
func TenantIDFromContext(ctx context.Context) string {
	if tenantID, ok := ctx.Value(tenantIDContextKey{}).(string); ok && tenantID != "" {
		return tenantID
	}
	return "default"
}

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

// ============================================================================
// TIER CONTEXT UTILITIES
// ============================================================================

// WithTierInfo returns a new context with tier information set
func WithTierInfo(ctx context.Context, tier string, authorityLevel string, features map[string]bool) context.Context {
	return context.WithValue(ctx, tierContextKey{}, &TierInfo{
		Tier:           tier,
		AuthorityLevel: authorityLevel,
		Features:       features,
	})
}

// TierInfoFromContext extracts tier info from context
// Returns nil if no tier info is set
func TierInfoFromContext(ctx context.Context) *TierInfo {
	if info, ok := ctx.Value(tierContextKey{}).(*TierInfo); ok {
		return info
	}
	return nil
}

// TierFromContext extracts just the tier name from context
// Returns "hacker" as default (most restrictive)
func TierFromContext(ctx context.Context) string {
	if info := TierInfoFromContext(ctx); info != nil {
		return info.Tier
	}
	return "hacker"
}

// HasFeatureAccess checks if the tier in context has access to a feature
// Used for runtime guards in router/cognitive modules
func HasFeatureAccess(ctx context.Context, feature string) bool {
	info := TierInfoFromContext(ctx)
	if info == nil || info.Features == nil {
		// No tier info - deny by default (except resilience features)
		return isResilienceFeature(feature)
	}

	if enabled, exists := info.Features[feature]; exists {
		return enabled
	}

	// Unknown feature - deny by default (except resilience features)
	return isResilienceFeature(feature)
}

// RequireFeature returns an error if the feature is not available for the tier
// Use this to enforce tier-based feature access in services
func RequireFeature(ctx context.Context, feature string) error {
	if !HasFeatureAccess(ctx, feature) {
		tier := TierFromContext(ctx)
		return fmt.Errorf("feature '%s' not available in %s tier", feature, tier)
	}
	return nil
}

// isResilienceFeature returns true for features that are free for all tiers
func isResilienceFeature(feature string) bool {
	resilienceFeatures := map[string]bool{
		"escapevector_mode":   true,
		"emergency_hotfix":    true,
		"gold_code_override":  true,
		"rust_wasm_fallback":  true,
	}
	return resilienceFeatures[feature]
}

// ============================================================================
// TIER AUTHORITY LEVEL CHECKS
// ============================================================================

// CanObserve returns true if tier can observe (read-only access)
// All tiers can observe
func CanObserve(ctx context.Context) bool {
	return true
}

// CanInfluence returns true if tier can influence decisions
// Startup+ tiers
func CanInfluence(ctx context.Context) bool {
	info := TierInfoFromContext(ctx)
	if info == nil {
		return false
	}
	return info.AuthorityLevel == "influence" ||
		info.AuthorityLevel == "enforce" ||
		info.AuthorityLevel == "prove"
}

// CanEnforce returns true if tier can enforce decisions
// Growth+ tiers
func CanEnforce(ctx context.Context) bool {
	info := TierInfoFromContext(ctx)
	if info == nil {
		return false
	}
	return info.AuthorityLevel == "enforce" ||
		info.AuthorityLevel == "prove"
}

// CanProve returns true if tier can prove decisions (cryptographic)
// Scale tier only
func CanProve(ctx context.Context) bool {
	info := TierInfoFromContext(ctx)
	if info == nil {
		return false
	}
	return info.AuthorityLevel == "prove"
}
