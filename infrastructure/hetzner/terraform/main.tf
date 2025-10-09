# Hetzner Cloud Infrastructure for Schlep-Engine
# Production-grade deployment with VPS, networking, and firewall

terraform {
  required_version = ">= 1.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }

  # Backend configuration for remote state
  backend "s3" {
    bucket = "schlep-engine-terraform-state"
    key    = "hetzner/production/terraform.tfstate"
    region = "eu-central-1"
    # Enable state locking
    dynamodb_table = "schlep-engine-terraform-locks"
    encrypt        = true
  }
}

provider "hcloud" {
  token = var.hetzner_token
}

# ============================================================================
# Variables
# ============================================================================

variable "hetzner_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "SSH public key for server access"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "server_type" {
  description = "Hetzner server type"
  type        = string
  default     = "cx22"  # 2 vCPU, 4GB RAM, 40GB SSD - $5.83/month
}

variable "location" {
  description = "Hetzner datacenter location"
  type        = string
  default     = "nbg1"  # Nuremberg, Germany
}

variable "server_image" {
  description = "Base OS image"
  type        = string
  default     = "ubuntu-22.04"
}

# ============================================================================
# SSH Key
# ============================================================================

resource "hcloud_ssh_key" "default" {
  name       = "schlep-engine-${var.environment}"
  public_key = var.ssh_public_key
}

# ============================================================================
# Network & Firewall
# ============================================================================

resource "hcloud_network" "private" {
  name     = "schlep-engine-network-${var.environment}"
  ip_range = "10.0.0.0/16"
}

resource "hcloud_network_subnet" "private_subnet" {
  network_id   = hcloud_network.private.id
  type         = "cloud"
  network_zone = "eu-central"
  ip_range     = "10.0.1.0/24"
}

resource "hcloud_firewall" "web" {
  name = "schlep-engine-firewall-${var.environment}"

  # SSH
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "22"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  # HTTP
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "80"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  # HTTPS
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "443"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  # Go Gateway
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "8080"
    source_ips = [
      "10.0.0.0/16"  # Internal only
    ]
  }

  # Python ML Service (gRPC)
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "50051"
    source_ips = [
      "10.0.0.0/16"  # Internal only
    ]
  }

  # Vault
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "8200"
    source_ips = [
      "10.0.0.0/16"  # Internal only
    ]
  }

  # PostgreSQL (internal only)
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "5432"
    source_ips = [
      "10.0.0.0/16"
    ]
  }

  # Redis (internal only)
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "6379"
    source_ips = [
      "10.0.0.0/16"
    ]
  }

  # Prometheus
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "9090"
    source_ips = [
      "10.0.0.0/16"  # Internal only
    ]
  }

  # Grafana
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "3001"
    source_ips = [
      "0.0.0.0/0",  # Public access for dashboards
      "::/0"
    ]
  }
}

# ============================================================================
# Primary Application Server
# ============================================================================

resource "hcloud_server" "app" {
  name        = "schlep-engine-app-${var.environment}"
  server_type = var.server_type
  image       = var.server_image
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.default.id]
  firewall_ids = [hcloud_firewall.web.id]

  network {
    network_id = hcloud_network.private.id
    ip         = "10.0.1.10"
  }

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  user_data = templatefile("${path.module}/cloud-init.yml", {
    environment = var.environment
  })

  labels = {
    environment = var.environment
    service     = "schlep-engine"
    managed_by  = "terraform"
  }
}

# ============================================================================
# Volume for Persistent Data
# ============================================================================

resource "hcloud_volume" "data" {
  name      = "schlep-engine-data-${var.environment}"
  size      = 100  # 100GB
  server_id = hcloud_server.app.id
  automount = true
  format    = "ext4"

  labels = {
    environment = var.environment
    purpose     = "database-storage"
  }
}

# ============================================================================
# Floating IP for High Availability
# ============================================================================

resource "hcloud_floating_ip" "main" {
  type          = "ipv4"
  home_location = var.location
  description   = "Main floating IP for ${var.environment}"

  labels = {
    environment = var.environment
    purpose     = "public-access"
  }
}

resource "hcloud_floating_ip_assignment" "main" {
  floating_ip_id = hcloud_floating_ip.main.id
  server_id      = hcloud_server.app.id
}

# ============================================================================
# Load Balancer (Optional - for future scaling)
# ============================================================================

# Uncomment when scaling to multiple servers
# resource "hcloud_load_balancer" "lb" {
#   name               = "schlep-engine-lb-${var.environment}"
#   load_balancer_type = "lb11"  # 2 vCPU, 20k connections
#   location           = var.location
#
#   algorithm {
#     type = "round_robin"
#   }
#
#   labels = {
#     environment = var.environment
#   }
# }
#
# resource "hcloud_load_balancer_network" "lb_network" {
#   load_balancer_id = hcloud_load_balancer.lb.id
#   network_id       = hcloud_network.private.id
#   ip               = "10.0.1.5"
# }
#
# resource "hcloud_load_balancer_target" "lb_target" {
#   type             = "server"
#   load_balancer_id = hcloud_load_balancer.lb.id
#   server_id        = hcloud_server.app.id
# }
#
# resource "hcloud_load_balancer_service" "http" {
#   load_balancer_id = hcloud_load_balancer.lb.id
#   protocol         = "http"
#   listen_port      = 80
#   destination_port = 80
#
#   health_check {
#     protocol = "http"
#     port     = 8080
#     interval = 15
#     timeout  = 10
#     retries  = 3
#     http {
#       path         = "/health"
#       status_codes = ["2??", "3??"]
#     }
#   }
# }
#
# resource "hcloud_load_balancer_service" "https" {
#   load_balancer_id = hcloud_load_balancer.lb.id
#   protocol         = "https"
#   listen_port      = 443
#   destination_port = 443
#
#   http {
#     certificates = []  # Add SSL cert IDs
#   }
#
#   health_check {
#     protocol = "https"
#     port     = 443
#     interval = 15
#     timeout  = 10
#     retries  = 3
#     http {
#       path         = "/health"
#       status_codes = ["2??", "3??"]
#       tls          = true
#     }
#   }
# }

# ============================================================================
# Outputs
# ============================================================================

output "server_id" {
  description = "ID of the application server"
  value       = hcloud_server.app.id
}

output "server_name" {
  description = "Name of the application server"
  value       = hcloud_server.app.name
}

output "server_ipv4" {
  description = "Public IPv4 address"
  value       = hcloud_server.app.ipv4_address
}

output "server_ipv6" {
  description = "Public IPv6 address"
  value       = hcloud_server.app.ipv6_address
}

output "floating_ip" {
  description = "Floating IP address"
  value       = hcloud_floating_ip.main.ip_address
}

output "private_ip" {
  description = "Private network IP"
  value       = "10.0.1.10"
}

output "volume_id" {
  description = "ID of the data volume"
  value       = hcloud_volume.data.id
}

output "network_id" {
  description = "ID of the private network"
  value       = hcloud_network.private.id
}

output "ssh_command" {
  description = "SSH command to connect to server"
  value       = "ssh root@${hcloud_server.app.ipv4_address}"
}
