-- Migration 026: Add new tier enum values to tenant_tier type
-- The tenant_tier enum previously only had {developer, growth, scale} (old names).
-- After the pricing rename to seed/horizon/infinite, apiKeyAuth queries using
-- COALESCE(tier, 'seed') would fail with a 500 because 'seed' was not a valid enum value.
-- IF NOT EXISTS is safe to run multiple times and on DBs that already have the values.

ALTER TYPE tenant_tier ADD VALUE IF NOT EXISTS 'seed';
ALTER TYPE tenant_tier ADD VALUE IF NOT EXISTS 'horizon';
ALTER TYPE tenant_tier ADD VALUE IF NOT EXISTS 'infinite';
