# HashiCorp Vault Configuration for Schlep-Engine
# Production-ready configuration for secret management

# Storage backend - Using filesystem for simplicity (use Consul/Raft for production HA)
storage "file" {
  path = "/vault/data"
}

# Listener configuration
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 0

  tls_cert_file = "/vault/certs/vault.crt"
  tls_key_file  = "/vault/certs/vault.key"
}

# API address
api_addr = "https://vault.schlep-engine.internal:8200"
cluster_addr = "https://vault.schlep-engine.internal:8201"

# UI
ui = true

# Telemetry for Prometheus integration
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname = false
}

# Log level
log_level = "Info"

# Disable mlock for containerized environments
# Remove in production bare-metal deployments
disable_mlock = true

# Max lease TTL
max_lease_ttl = "768h"
default_lease_ttl = "768h"
