#!/bin/bash
# Vault Initialization Script
# Initializes Vault, unseals it, and configures initial secrets

set -e

VAULT_ADDR="${VAULT_ADDR:-https://vault:8200}"
KEYS_FILE="/vault/keys/vault-keys.json"

echo "🔐 Initializing HashiCorp Vault for Schlep-Engine..."

# Wait for Vault to be ready
echo "⏳ Waiting for Vault to be ready..."
until vault status 2>/dev/null; do
  sleep 2
done

# Check if Vault is already initialized
if vault status | grep -q "Initialized.*true"; then
  echo "✅ Vault is already initialized"

  # Check if already unsealed
  if vault status | grep -q "Sealed.*false"; then
    echo "✅ Vault is already unsealed"
    exit 0
  else
    echo "🔓 Unsealing Vault..."
    if [ -f "$KEYS_FILE" ]; then
      UNSEAL_KEY=$(jq -r '.unseal_keys_b64[0]' "$KEYS_FILE")
      vault operator unseal "$UNSEAL_KEY"
      echo "✅ Vault unsealed successfully"
    else
      echo "❌ Keys file not found. Manual unseal required."
      exit 1
    fi
    exit 0
  fi
fi

# Initialize Vault
echo "🚀 Initializing Vault (first time setup)..."
vault operator init -key-shares=5 -key-threshold=3 -format=json > "$KEYS_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Vault initialized successfully"
  echo "🔑 Unseal keys and root token saved to: $KEYS_FILE"
  echo "⚠️  IMPORTANT: Backup this file securely and remove from server!"
else
  echo "❌ Vault initialization failed"
  exit 1
fi

# Unseal Vault with 3 keys
echo "🔓 Unsealing Vault..."
for i in 0 1 2; do
  UNSEAL_KEY=$(jq -r ".unseal_keys_b64[$i]" "$KEYS_FILE")
  vault operator unseal "$UNSEAL_KEY"
done

echo "✅ Vault unsealed successfully"

# Get root token
ROOT_TOKEN=$(jq -r '.root_token' "$KEYS_FILE")

# Login with root token
echo "🔐 Logging in to Vault..."
vault login "$ROOT_TOKEN"

# Enable KV v2 secrets engine
echo "📦 Enabling KV secrets engine..."
vault secrets enable -path=secret kv-v2

# Create initial secrets structure
echo "🔧 Creating initial secrets structure..."

# Database secrets
vault kv put secret/database/postgres \
  username="schlep_user" \
  password="$(openssl rand -base64 32)" \
  host="postgres" \
  port="5432" \
  database="schlep_engine"

vault kv put secret/database/redis \
  password="$(openssl rand -base64 32)" \
  host="redis" \
  port="6379"

# Application secrets
vault kv put secret/app/api \
  secret_key="$(openssl rand -base64 64)" \
  jwt_secret="$(openssl rand -base64 64)" \
  encryption_key="$(openssl rand -base64 32)"

# OAuth secrets (placeholder - update with actual values)
vault kv put secret/oauth/google \
  client_id="REPLACE_WITH_ACTUAL_GOOGLE_CLIENT_ID" \
  client_secret="REPLACE_WITH_ACTUAL_GOOGLE_CLIENT_SECRET"

vault kv put secret/oauth/github \
  client_id="REPLACE_WITH_ACTUAL_GITHUB_CLIENT_ID" \
  client_secret="REPLACE_WITH_ACTUAL_GITHUB_CLIENT_SECRET"

# SMTP secrets
vault kv put secret/smtp \
  server="smtp.gmail.com" \
  port="587" \
  username="REPLACE_WITH_SMTP_USERNAME" \
  password="REPLACE_WITH_SMTP_PASSWORD" \
  from_email="notifications@schlep-engine.com"

# Enable AppRole auth method for services
echo "🔑 Configuring AppRole authentication..."
vault auth enable approle

# Create policy for schlep-engine services
vault policy write schlep-engine-policy - <<EOF
# Read database credentials
path "secret/data/database/*" {
  capabilities = ["read"]
}

# Read application secrets
path "secret/data/app/*" {
  capabilities = ["read"]
}

# Read OAuth credentials
path "secret/data/oauth/*" {
  capabilities = ["read"]
}

# Read SMTP credentials
path "secret/data/smtp" {
  capabilities = ["read"]
}
EOF

# Create AppRole for Go Gateway
vault write auth/approle/role/go-gateway \
  token_policies="schlep-engine-policy" \
  token_ttl=1h \
  token_max_ttl=4h

# Get RoleID and SecretID
ROLE_ID=$(vault read -field=role_id auth/approle/role/go-gateway/role-id)
SECRET_ID=$(vault write -f -field=secret_id auth/approle/role/go-gateway/secret-id)

echo ""
echo "✅ Vault setup complete!"
echo ""
echo "📋 Configuration Summary:"
echo "  - Vault Address: $VAULT_ADDR"
echo "  - Secrets Engine: kv-v2 at /secret"
echo "  - Auth Method: AppRole"
echo "  - Policy: schlep-engine-policy"
echo ""
echo "🔑 AppRole Credentials (Go Gateway):"
echo "  Role ID: $ROLE_ID"
echo "  Secret ID: $SECRET_ID"
echo ""
echo "⚠️  CRITICAL SECURITY STEPS:"
echo "  1. Backup /vault/keys/vault-keys.json to secure location"
echo "  2. Remove vault-keys.json from server after backup"
echo "  3. Store unseal keys in separate secure locations"
echo "  4. Update OAuth and SMTP secrets with actual values"
echo "  5. Rotate root token: vault token create -policy=root"
echo ""
echo "📖 Next steps:"
echo "  1. Update .env files to use Vault secrets"
echo "  2. Configure Go Gateway to authenticate with AppRole"
echo "  3. Set up secret rotation policies"
echo ""
