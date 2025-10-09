#!/bin/bash
# Vault Initialization Script for Hetzner Deployment
# Initializes Vault, unseals it, and configures initial secrets

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
KEYS_FILE="/vault/keys/vault-keys.json"
BACKUP_FILE="/vault/keys/vault-keys-backup-$(date +%Y%m%d-%H%M%S).json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Wait for Vault to be ready
log "Waiting for Vault to be ready..."
max_wait=60
wait_time=0
until vault status -address="$VAULT_ADDR" >/dev/null 2>&1; do
    if [ $wait_time -ge $max_wait ]; then
        error "Vault did not become ready within $max_wait seconds"
    fi
    sleep 2
    wait_time=$((wait_time + 2))
    log "Still waiting for Vault... (${wait_time}s/${max_wait}s)"
done

success "Vault is ready"

# Check if Vault is already initialized
if vault status -address="$VAULT_ADDR" | jq -r '.data.initialized' 2>/dev/null | grep -q "true"; then
    success "Vault is already initialized"
    
    # Check if Vault is unsealed
    if vault status -address="$VAULT_ADDR" | jq -r '.data.sealed' 2>/dev/null | grep -q "false"; then
        success "Vault is already unsealed"
        
        # Try to login with existing root token if available
        if [ -f "$KEYS_FILE" ]; then
            ROOT_TOKEN=$(jq -r '.root_token' "$KEYS_FILE" 2>/dev/null || echo "")
            if [ -n "$ROOT_TOKEN" ]; then
                export VAULT_TOKEN="$ROOT_TOKEN"
                log "Using existing root token from $KEYS_FILE"
            fi
        fi
    else
        warn "Vault is sealed, attempting to unseal..."
        
        # Read keys from file if available
        if [ -f "$KEYS_FILE" ]; then
            for i in 1 2 3; do
                UNSEAL_KEY=$(jq -r ".unseal_keys_b64[$((i-1))]" "$KEYS_FILE" 2>/dev/null || echo "")
                if [ -n "$UNSEAL_KEY" ]; then
                    log "Unsealing Vault with key $i..."
                    vault operator unseal -address="$VAULT_ADDR" "$UNSEAL_KEY"
                fi
            done
            success "Vault unsealed successfully"
        else
            error "Vault is sealed but no unseal keys found at $KEYS_FILE"
        fi
    fi
else
    # Initialize Vault
    log "Initializing Vault (first time setup)..."
    if ! vault operator init -address="$VAULT_ADDR" -key-shares=5 -key-threshold=3 -format=json > "$KEYS_FILE"; then
        error "Vault initialization failed"
    fi
    
    # Backup the keys
    cp "$KEYS_FILE" "$BACKUP_FILE"
    log "Vault keys backed up to $BACKUP_FILE"
    
    success "Vault initialized successfully"
    log "IMPORTANT: Backup the keys file securely!"
    
    # Extract and display critical information
    ROOT_TOKEN=$(jq -r '.root_token' "$KEYS_FILE")
    UNSEAL_KEYS=($(jq -r '.unseal_keys_b64[]' "$KEYS_FILE"))
    
    echo
    echo "==================== CAUTION ===================="
    echo "Root Token: $ROOT_TOKEN"
    echo "Unseal Keys:"
    for i in "${!UNSEAL_KEYS[@]}"; do
        echo "  Key $((i+1)): ${UNSEAL_KEYS[i]}"
    done
    echo "================================================"
    echo

    # Unseal Vault with 3 keys
    log "Unsealing Vault..."
    for i in 0 1 2; do
        vault operator unseal -address="$VAULT_ADDR" "${UNSEAL_KEYS[$i]}"
    done
    success "Vault unsealed successfully"
    
    # Login with root token
    export VAULT_TOKEN="$ROOT_TOKEN"
fi

# verify we can authenticate
if ! vault token lookup -address="$VAULT_ADDR" >/dev/null 2>&1; then
    error "Failed to authenticate with Vault"
fi

# Enable secrets engines
log "Setting up Vault secrets engines..."

# Enable KV v2
vault secrets enable -address="$VAULT_ADDR" -path=secret -version=2 kv

# Enable database secrets engine
if ! vault secrets list -address="$VAULT_ADDR" | grep -q "database"; then
    vault secrets enable -address="$VAULT_ADDR" database
    log "Database secrets engine enabled"
fi

# Enable transit secrets engine for encryption
if ! vault secrets list -address="$VAULT_ADDR" | grep -q "transit"; then
    vault secrets enable -address="$VAULT_ADDR" transit
    log "Transit secrets engine enabled"
fi

# Set up initial secrets
log "Configuring initial secrets..."

# Database credentials
if [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_DB:-}" ]; then
    vault kv put -address="$VAULT_ADDR" \
        secret/database/postgres \
        username="${POSTGRES_USER}" \
        password="${POSTGRES_PASSWORD}" \
        database="${POSTGRES_DB}" \
        host="postgres" \
        port="5432"
    success "Database secrets configured"
fi

# Redis credentials
if [ -n "${REDIS_PASSWORD:-}" ]; then
    vault kv put -address="$VAULT_ADDR" \
        secret/database/redis \
        password="${REDIS_PASSWORD}" \
        host="redis" \
        port="6379"
    success "Redis secrets configured"
fi

# JWT secrets
if [ -n "${JWT_SECRET_KEY:-}" ]; then
    vault kv put -address="$VAULT_ADDR" \
        secret/auth/jwt \
        signing_key="${JWT_SECRET_KEY}" \
        algorithm="HS256" \
        expire_minutes="30"
    success "JWT secrets configured"
fi

# Application secrets
if [ -n "${SECRET_KEY:-}" ]; then
    vault kv put -address="$VAULT_ADDR" \
        secret/app/general \
        secret_key="${SECRET_KEY}" \
        allowed_origins="${ALLOWED_ORIGINS:-https://schlep-engine.com}"
    success "Application secrets configured"
fi

# OAuth secrets
if [ -n "${GOOGLE_CLIENT_ID:-}" ] && [ -n "${GOOGLE_CLIENT_SECRET:-}" ]; then
    vault kv put -address="$VAULT_ADDR" \
        secret/oauth/google \
        client_id="${GOOGLE_CLIENT_ID}" \
        client_secret="${GOOGLE_CLIENT_SECRET}"
    success "Google OAuth secrets configured"
fi

if [ -n "${GITHUB_CLIENT_ID:-}" ] && [ -n "${GITHUB_CLIENT_SECRET:-}" ]; then
    vault kv put -address="$VAULT_ADDR" \
        secret/oauth/github \
        client_id="${GITHUB_CLIENT_ID}" \
        client_secret="${GITHUB_CLIENT_SECRET}"
    success "GitHub OAuth secrets configured"
fi

# Set up AppRole authentication
log "Setting up AppRole authentication..."

vault auth enable -address="$VAULT_ADDR" approle

# Create policy for Go Gateway
cat > /tmp/gateway-policy.hcl << 'EOF'
# Allow access to secrets
path "secret/data/*" {
  capabilities = ["read"]
}

# Allow token lookup
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# Allow database credentials
path "database/creds/*" {
  capabilities = ["read"]
}

# Allow transit encryption/decryption
path "transit/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
EOF

vault policy write -address="$VAULT_ADDR" go-gateway-policy /tmp/gateway-policy.hcl
rm /tmp/gateway-policy.hcl

# Create AppRole for Go Gateway
vault write -address="$VAULT_ADDR" \
    auth/approle/role/go-gateway \
    token_policies="go-gateway-policy" \
    token_ttl=1h \
    token_max_ttl=24h \
    secret_id_ttl=24h

# Get AppRole credentials
ROLE_ID=$(vault read -address="$VAULT_ADDR" -field=role_id auth/approle/role/go-gateway/role-id)
SECRET_ID=$(vault write -address="$VAULT_ADDR" -f -field=secret_id auth/approle/role/go-gateway/secret-id)

log "AppRole credentials for Go Gateway:"
log "  Role ID: $ROLE_ID"
log "  Secret ID: $SECRET_ID"

# Store AppRole credentials for automatic injection
vault kv put -address="$VAULT_ADDR" \
    secret/auth/approle/go-gateway \
    role_id="$ROLE_ID" \
    secret_id="$SECRET_ID"

# Create policy for Python ML Service
cat > /tmp/ml-policy.hcl << 'EOF'
# Allow access to database and model secrets
path "secret/data/database/*" {
  capabilities = ["read"]
}

# Allow access to application secrets
path "secret/data/app/*" {
  capabilities = ["read"]
}

# Allow token lookup
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# Allow transit operations for model encryption
path "transit/encrypt/*" {
  capabilities = ["create", "update"]
}

path "transit/decrypt/*" {
  capabilities = ["create", "update"]
}
EOF

vault policy write -address="$VAULT_ADDR" python-ml-policy /tmp/ml-policy.hcl
rm /tmp/ml-policy.hcl

# Create AppRole for Python ML Service
vault write -address="$VAULT_ADDR" \
    auth/approle/role/python-ml-service \
    token_policies="python-ml-policy" \
    token_ttl=1h \
    token_max_ttl=24h \
    secret_id_ttl=24h

# Enable audit logging
vault audit enable -address="$VAULT_ADDR" file file_path=/vault/logs/audit.log

# Create transit encryption key for sensitive data
vault write -address="$VAULT_ADDR" \
    transit/keys/schlep-data \
    type="aes256-gcm96" \
    convergent_encryption=true

success "Vault setup complete!"

echo
echo "==================== NEXT STEPS ===================="
echo "1. Backup the keys file: $KEYS_FILE"
echo "2. Remove vault-keys.json from server after backup"
echo "3. Configure applications to use Vault secrets"
echo "4. Set up monitoring and alerts for Vault"
echo "5. Configure automatic secret rotation"
echo "6. Enable TLS for Vault (currently disabled)"
echo "================================================"
echo
echo "Vault Address: $VAULT_ADDR"
echo "Root Token: ${VAULT_TOKEN:-<not_set>}"
echo "================================================"

# Create environment file template for services
cat > /tmp/vault-env.template << 'EOF'
# Vault Configuration Template
# Copy this to your service environment files and update with actual values

# Vault Connection
VAULT_ADDR=http://127.0.0.1:8200
VAULT_ROLE=go-gateway
# VAULT_TOKEN will be automatically obtained via AppRole

# AppRole Credentials (get from Vault: secret/auth/approle/go-gateway)
VAULT_ROLE_ID=
VAULT_SECRET_ID=

# JWT Secret (get from Vault: secret/auth/jwt)
JWT_SECRET=$(vault kv get -field=signing_key secret/auth/jwt)

# Database Credentials (get from Vault: secret/database/postgres)
POSTGRES_USER=$(vault kv get -field=username secret/database/postgres)
POSTGRES_PASSWORD=$(vault kv get -field=password secret/database/postgres)
POSTGRES_DB=$(vault kv get -field=database secret/database/postgres)

# Redis Password (get from Vault: secret/database/redis)
REDIS_PASSWORD=$(vault kv get -field=password secret/database/redis)
EOF

log "Environment template created: /tmp/vault-env.template"
success "Vault initialization completed successfully!"
