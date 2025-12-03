-- Add 2FA support to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;

-- Index for 2FA lookups
CREATE INDEX IF NOT EXISTS idx_tenants_2fa_enabled ON tenants(totp_enabled) WHERE totp_enabled = TRUE;

COMMENT ON COLUMN tenants.totp_secret IS 'TOTP secret for 2FA (encrypted)';
COMMENT ON COLUMN tenants.totp_enabled IS 'Whether 2FA is enabled for this tenant';
