// Package billing provides canonical tier definitions for Igris Inertial subscriptions.
package billing

// Tier is the canonical subscription tier type used everywhere in backend code.
type Tier string

const (
	TierSeed     Tier = "seed"
	TierHorizon  Tier = "horizon"
	TierInfinite Tier = "infinite"
)

// TierRuntimeLimit maps each tier to its maximum allowed runtime registrations.
var TierRuntimeLimit = map[Tier]int{
	TierSeed:     3,
	TierHorizon:  50,
	TierInfinite: 500,
}

// TierMonthlyPriceCents maps each tier to its monthly price in cents.
var TierMonthlyPriceCents = map[Tier]int{
	TierSeed:     2900,
	TierHorizon:  14900,
	TierInfinite: 69900,
}

// ValidTier returns true if the given string is a known tier.
func ValidTier(s string) bool {
	switch Tier(s) {
	case TierSeed, TierHorizon, TierInfinite:
		return true
	}
	return false
}
