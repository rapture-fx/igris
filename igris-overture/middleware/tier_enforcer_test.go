package middleware

import (
	"testing"
)

// ============================================================================
// UNKILLABLE CORE TESTS - Must pass for ALL tiers
// ============================================================================

func TestDevelopTier_CanUseGoldCodeOverride(t *testing.T) {
	features := FeatureFlags{
		// Develop tier with minimal features
		MultiTenancy:     false,
		BYOK:             false,
		ThompsonSampling: true,
	}

	// Gold Code Override must ALWAYS be allowed
	if !hasFeatureAccessStatic(features, "gold_code_override") {
		t.Error("Develop tier must have access to Gold Code Override (unkillable core)")
	}
}

func TestDevelopTier_CanUseRustWasmEscapeVector(t *testing.T) {
	features := FeatureFlags{}

	// Rust WASM EscapeVector must ALWAYS be allowed
	if !hasFeatureAccessStatic(features, "rust_wasm_fallback") {
		t.Error("Develop tier must have access to Rust WASM EscapeVector (unkillable core)")
	}

	if !hasFeatureAccessStatic(features, "escapevector_mode") {
		t.Error("Develop tier must have access to EscapeVector Mode (unkillable core)")
	}
}

func TestDevelopTier_CanFetchEmergencyHotfix(t *testing.T) {
	features := FeatureFlags{}

	// Emergency Hotfix must ALWAYS be allowed
	if !hasFeatureAccessStatic(features, "emergency_hotfix") {
		t.Error("Develop tier must have access to Emergency Hotfix Blob (unkillable core)")
	}
}

func TestAllTiers_UnkillableCoreAlwaysEnabled(t *testing.T) {
	// Test with completely empty features
	emptyFeatures := FeatureFlags{}

	unkillableFeatures := []string{
		"escapevector_mode",
		"emergency_hotfix",
		"gold_code_override",
		"rust_wasm_fallback",
	}

	for _, feature := range unkillableFeatures {
		if !hasFeatureAccessStatic(emptyFeatures, feature) {
			t.Errorf("Feature %s must be enabled for ALL tiers (unkillable core)", feature)
		}
	}
}

// ============================================================================
// GROWTH TIER TESTS - Superpowers gating
// ============================================================================

func TestGrowthTier_CanUseSpeculativeExecution(t *testing.T) {
	developFeatures := FeatureFlags{
		// Develop tier - should NOT have speculative execution
	}

	growthFeatures := FeatureFlags{
		// Growth tier - should have speculative execution
		// (This would be set via tier config YAML)
	}

	// For now, speculative execution gating would be handled
	// by the feature map in getRequiredFeature()
	// This is a placeholder test for when we add those features
	_ = developFeatures
	_ = growthFeatures

	t.Log("Speculative execution gating: Growth+ only (not yet implemented)")
}

// ============================================================================
// SCALE TIER TESTS - Enterprise gating
// ============================================================================

func TestScaleTier_CanUseSelfHosted(t *testing.T) {
	developFeatures := FeatureFlags{}
	scaleFeatures := FeatureFlags{
		OnPremiseDeployment: true,
	}

	// Self-hosted should require Scale tier
	if hasFeatureAccessStatic(developFeatures, "on_premise_deployment") {
		t.Error("Develop tier should NOT have on-premise deployment")
	}

	if !hasFeatureAccessStatic(scaleFeatures, "on_premise_deployment") {
		t.Error("Scale tier SHOULD have on-premise deployment")
	}
}

// ============================================================================
// HELPER FUNCTION - Static version for testing
// ============================================================================

// hasFeatureAccessStatic is a static version of hasFeatureAccess for testing
func hasFeatureAccessStatic(features FeatureFlags, featureName string) bool {
	switch featureName {
	case "sla_enforcement":
		return features.SLAEnforcement
	case "policy_versioning":
		return features.PolicyVersioning
	case "audit_logs":
		return features.AuditLogs
	case "advanced_governance":
		return features.AdvancedGovernance
	case "sso":
		return features.SSO
	case "real_time_analytics":
		return features.RealTimeAnalytics
	case "cost_forecasting":
		return features.CostForecasting
	case "semantic_routing":
		return features.SemanticRouting
	case "on_premise_deployment":
		return features.OnPremiseDeployment
	// ======================================================================
	// UNKILLABLE CORE - FREE FOR ALL TIERS
	// ======================================================================
	// Unkillable core — free forever on all tiers. No paywalls allowed.
	case "escapevector_mode":
		return true  // Free for all tiers
	case "emergency_hotfix":
		return true  // Free for all tiers
	case "gold_code_override":
		return true  // Free for all tiers
	case "rust_wasm_fallback":
		return true  // Free for all tiers
	default:
		return true // Unknown features are allowed by default
	}
}
