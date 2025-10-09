# HashiCorp Vault Configuration for Schlep-Engine on Hetzner

# UI Configuration
ui = true

# Listener Configuration
listener "tcp" {
  address = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_disable = 1  # For internal cluster communication
  # tls_cert_file = "/vault/certs/vault.crt"
  # tls_key_file  = "/vault/certs/vault.key"
}

# Storage Configuration (File Backend for Hetzner)
storage "file" {
  path  = "/vault/data"
}

# API Address Configuration
api_addr = "http://127.0.0.1:8200"
cluster_addr = "http://127.0.0.1:8201"

# Default Lease TTLs
default_lease_ttl = "168h"  # 7 days
max_lease_ttl = "720h"      # 30 days

# Log Level
log_level = "INFO"

# Enable mlock
disable_mlock = false
