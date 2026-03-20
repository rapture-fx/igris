-- Migration 028: Remap legacy tier names to current canonical names
-- Old names (developer/growth/scale) were renamed to seed/horizon/infinite.
-- Migration 026 added the new enum values but existing tenant rows still
-- have the old values, causing getTierAndLimit to return wrong limits.

UPDATE tenants SET tier = 'seed'     WHERE tier = 'developer';
UPDATE tenants SET tier = 'horizon'  WHERE tier = 'growth';
UPDATE tenants SET tier = 'infinite' WHERE tier = 'scale';
UPDATE tenants SET tier = 'seed'     WHERE tier = 'trial';
