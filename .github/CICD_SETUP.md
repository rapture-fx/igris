# 🚀 CI/CD Automation Setup Guide

## Overview

This guide sets up complete CI/CD automation for Igris Overture with GitHub Actions to automatically deploy to your Vultr VPS when code is pushed to the main branch.

## 🔧 Prerequisites

### 1. Vultr VPS Requirements
- **VPS IP Address**: Your Vultr server IP
- **SSH Access**: SSH key-based authentication
- **Docker & Docker Compose**: Installed on VPS
- **Deploy User**: Non-root user with sudo privileges

### 2. GitHub Repository
- **Admin Access**: To configure secrets and environments
- **Container Registry**: GitHub Container Registry access

## 🔐 GitHub Secrets Configuration

Add these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

### Production VPS Secrets
```bash
# Required for Vultr VPS deployment
VPS_HOST=your.vultr.vps.ip.address        # Your Vultr VPS IP
VPS_USER=deploy                            # SSH user (recommend 'deploy')
VPS_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----   # SSH private key content
                                          # (Generate with: ssh-keygen -t ed25519)

# Production Environment Variables
PRODUCTION_SECRET_KEY=your-super-secret-key-here
PRODUCTION_JWT_SECRET=your-jwt-secret-key-here
PRODUCTION_DB_PASSWORD=your-secure-db-password

# External Service API Keys (Production)
PRODUCTION_OPENAI_API_KEY=sk-...
PRODUCTION_ANTHROPIC_API_KEY=ant_...
LEMONSQUEEZY_API_KEY=your-lemonsqueezy-key
```

### Staging Environment Secrets (Optional)
```bash
# Staging VPS (if different from production)
STAGING_HOST=staging.vultr.ip.address
STAGING_USER=deploy
STAGING_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----

# Staging Environment Variables
STAGING_SECRET_KEY=staging-secret-key
STAGING_JWT_SECRET=staging-jwt-secret
STAGING_DB_PASSWORD=staging-db-password

# External Services (Sandbox/Test versions)
STAGING_OPENAI_API_KEY=sk-test...
STAGING_ANTHROPIC_API_KEY=ant-test...
```

### Notification Secrets (Optional)
```bash
# Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Email notifications
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Notification targets
NOTIFICATION_EMAIL=team@igris-inertial.com
```

## 🏗️ VPS Setup

### 1. Create Deploy User on Vultr VPS

```bash
# SSH to your Vultr VPS as root
ssh root@your.vultr.vps.ip

# Create deploy user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
sudo usermod -aG sudo deploy

# Setup SSH key for deploy user
sudo mkdir -p /home/deploy/.ssh
sudo cp /root/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# Test SSH access
exit
ssh deploy@your.vultr.vps.ip
```

### 2. Prepare Deployment Directory

```bash
# On VPS as deploy user
mkdir -p /home/deploy/igris-inertial
cd /home/deploy/igris-inertial

# Clone repository (if not done already)
git clone https://github.com/your-username/igris-inertial.git .

# Create environment file from template
cp apps/api/env.production.template .env.production

# Edit with your production values
nano .env.production
```

### 3. Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker if not installed
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install additional tools
sudo apt install -y jq curl git rsync
```

## 🔄 Workflow Configuration

### 1. GitHub Environments

Create these environments in GitHub (`Settings > Environments`):

#### Production Environment
- **Environment name**: `production`
- **Deployment protection**: Require manual approval
- **Environment secrets**: All production secrets listed above

#### Staging Environment  
- **Environment name**: `staging`
- **Deployment protection**: None (auto-deploy)
- **Environment secrets**: All staging secrets listed above

### 2. Branch Protection

Configure branch protection for `main` branch:
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Require review from code owners
- ✅ Include administrators

## 📋 Deployment Workflow

### Automated Deployment Triggers

#### Production Deployment
```bash
# Triggers on push to main branch
git push origin main
```
**Process:**
1. 🧪 Run full test suite
2. 🔒 Security scanning
3. 🏗️ Build Docker images
4. 🚀 Deploy to Vultr VPS
5. 🔍 Health checks
6. 📧 Send notifications

#### Staging Deployment
```bash
# Triggers on push to develop branch
git push origin develop
```
**Process:**
1. 🧪 Run tests
2. 🏗️ Build staging images
3. 🚀 Deploy to staging environment
4. 🔍 Performance testing
5. 🔒 Security scanning

#### Manual Deployment
```bash
# Via GitHub Actions UI
# Go to Actions > Deploy to Production > Run workflow
```

### Manual Deployment Commands

If you need to deploy manually on the VPS:

```bash
# SSH to VPS
ssh deploy@your.vultr.vps.ip

# Navigate to project
cd /home/deploy/igris-inertial

# Pull latest changes
git pull origin main

# Run deployment script
./infrastructure/vultr/deploy.sh

# Check status
./infrastructure/vultr/deploy.sh status
```

## 🔍 Monitoring & Troubleshooting

### Health Check Endpoints

After deployment, verify these endpoints:

```bash
# API Health
curl https://api.igris-inertial.com/health

# Frontend
curl https://igris-inertial.com

# Admin Dashboard
curl https://admin.igris-inertial.com

# Documentation
curl https://docs.igris-inertial.com
```

### Log Monitoring

```bash
# On VPS, check deployment logs
ssh deploy@your.vultr.vps.ip
cd /home/deploy/igris-inertial
docker-compose -f infrastructure/vultr/docker-compose.production.yml logs -f

# Check specific service
docker-compose logs -f api
docker-compose logs -f nginx
```

### Rollback Procedure

```bash
# Automatic rollback (on deployment failure)
# GitHub Actions will automatically rollback if health checks fail

# Manual rollback on VPS
ssh deploy@your.vultr.vps.ip
cd /home/deploy/igris-inertial

# List available backups
ls -la backup-*/

# Rollback to previous version
sudo mv current failed-$(date +%Y%m%d-%H%M%S)
sudo mv backup-YYYYMMDD-HHMMSS current
cd current
docker-compose -f infrastructure/vultr/docker-compose.production.yml up -d
```

## 🚨 Troubleshooting Common Issues

### 1. SSH Connection Failed
```bash
# Check SSH key is correctly added to GitHub secrets
# Verify VPS user has correct permissions
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2. Docker Permission Denied
```bash
# Add user to docker group
sudo usermod -aG docker deploy
# Logout and login again
```

### 3. Environment Variables Not Found
```bash
# Check .env.production file exists and has correct values
ls -la /home/deploy/igris-inertial/.env.production
```

### 4. Health Check Failed
```bash
# Check service status
docker ps
docker-compose logs api

# Check nginx configuration
docker-compose logs nginx
```

## 🔐 Security Best Practices

### 1. SSH Key Management
- Use ED25519 keys (`ssh-keygen -t ed25519`)
- Different keys for different environments
- Regular key rotation (quarterly)

### 2. Secret Rotation
- Rotate production secrets monthly
- Use GitHub secret scanning
- Monitor for exposed secrets

### 3. VPS Security
```bash
# Update firewall rules
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Disable root SSH login
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

## 📈 Performance Optimization

### 1. Docker Image Optimization
- Multi-stage builds
- Image layer caching
- Minimize image size

### 2. Deployment Speed
- Parallel deployments
- Rolling updates
- Health check optimization

### 3. Resource Monitoring
- CPU/Memory usage alerts
- Disk space monitoring
- Network performance tracking

## 🎯 Next Steps

1. **Configure Secrets**: Add all required secrets to GitHub
2. **Test Staging**: Push to develop branch to test staging deployment
3. **Production Deploy**: Push to main branch for production deployment
4. **Monitor**: Set up monitoring and alerting
5. **Optimize**: Fine-tune deployment performance

## 📞 Support

If you encounter issues:

1. Check GitHub Actions logs
2. Verify VPS connectivity
3. Review environment variables
4. Check service health endpoints
5. Contact support with specific error messages

---

**✅ Your CI/CD pipeline is now ready for automated deployments to Vultr VPS!**