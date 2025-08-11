# 🤖 Claude Code Setup on Hetzner Server

## Why Claude Code on Your Server?

**Direct Management**: Deploy, debug, and manage your production environment directly
**Real-time Fixes**: Fix issues instantly without local development setup
**System Administration**: Manage server configuration and Docker containers
**Emergency Response**: Quickly resolve production issues 24/7

---

## Step 1: Install Claude Code CLI

```bash
# SSH into your server as deploy user
ssh deploy@YOUR_SERVER_IP

# Install Node.js (if not already done by setup script)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Claude Code CLI globally
sudo npm install -g @anthropic/claude-code-cli

# Verify installation
claude-code --version
```

## Step 2: Configure Claude Code

```bash
# Initialize Claude Code configuration
claude-code auth

# Follow the prompts:
# 1. Enter your Anthropic API key
# 2. Choose your preferred model (claude-3-sonnet recommended)
# 3. Set working directory to /home/deploy/schlep-engine
```

## Step 3: Create Claude Code Workspace

```bash
# Navigate to your project
cd /home/deploy/schlep-engine

# Create Claude Code workspace configuration
cat > .claude-code.json << 'EOF'
{
  "workingDirectory": "/home/deploy/schlep-engine",
  "environment": "production",
  "context": {
    "deployment": "hetzner",
    "architecture": "docker-compose",
    "services": [
      "postgres",
      "redis", 
      "api",
      "web-admin",
      "web-landing",
      "web-docs",
      "nginx"
    ]
  },
  "shortcuts": {
    "deploy": "./infrastructure/hetzner/deploy.sh",
    "logs": "docker-compose -f infrastructure/hetzner/docker-compose.production.yml logs -f",
    "status": "docker-compose -f infrastructure/hetzner/docker-compose.production.yml ps",
    "restart": "docker-compose -f infrastructure/hetzner/docker-compose.production.yml restart"
  }
}
EOF
```

## Step 4: Create Management Scripts

```bash
# Create Claude Code helper script
cat > /home/deploy/claude-assist << 'EOF'
#!/bin/bash
# Quick access to Claude Code for Schlep Engine management

cd /home/deploy/schlep-engine

echo "🤖 Starting Claude Code session for Schlep Engine management"
echo "Working directory: $(pwd)"
echo "Available shortcuts: deploy, logs, status, restart"
echo ""

claude-code chat
EOF

chmod +x /home/deploy/claude-assist

# Add to PATH
echo 'export PATH=$PATH:/home/deploy' >> ~/.bashrc
source ~/.bashrc
```

## Step 5: Common Claude Code Use Cases

### **Deployment Management**

```bash
# Start Claude Code session
claude-assist

# In Claude Code chat:
"Deploy the latest version of the application"
"Check the status of all services"
"Show me the API logs for the last 10 minutes"
"Restart the API service"
```

### **Debugging Issues**

```bash
# In Claude Code chat:
"The API is returning 500 errors, help me debug"
"Check database connection issues"
"Analyze nginx error logs"
"Why is the Redis container not starting?"
```

### **Performance Monitoring**

```bash
# In Claude Code chat:
"Show me system resource usage"
"Check database performance metrics"
"Analyze nginx access logs for traffic patterns"
"Optimize Docker container resource allocation"
```

### **Security Management**

```bash
# In Claude Code chat:
"Check for security issues in the current deployment"
"Update SSL certificates"
"Review firewall configuration"
"Scan for vulnerable dependencies"
```

## Step 6: Advanced Configuration

### **Environment-Specific Context**

```bash
# Create production context file
cat > .claude-production-context.md << 'EOF'
# Schlep Engine Production Environment

## Server Details
- **Provider**: Hetzner Cloud
- **OS**: Ubuntu 22.04 LTS
- **Instance**: CX11 (1 vCPU, 2GB RAM, 20GB SSD)
- **Location**: Nuremberg, Germany

## Application Architecture
- **API**: FastAPI with Gunicorn (port 8000)
- **Frontend**: Next.js applications (ports 3000, 3001, 3002)
- **Database**: PostgreSQL 15 (port 5432)
- **Cache**: Redis 7 (port 6379)
- **Reverse Proxy**: Nginx (ports 80, 443)

## Domain Configuration
- **Main**: https://schlep-engine.com
- **API**: https://api.schlep-engine.com  
- **Admin**: https://admin.schlep-engine.com
- **Docs**: https://docs.schlep-engine.com

## Key Paths
- **Project**: /home/deploy/schlep-engine
- **Logs**: /home/deploy/schlep-engine/infrastructure/hetzner/logs
- **Backups**: /home/deploy/schlep-engine/backups
- **SSL**: /home/deploy/schlep-engine/infrastructure/hetzner/ssl

## Common Commands
- **Deploy**: ./infrastructure/hetzner/deploy.sh
- **Logs**: docker-compose -f infrastructure/hetzner/docker-compose.production.yml logs -f
- **Status**: docker-compose -f infrastructure/hetzner/docker-compose.production.yml ps
- **Backup**: ./infrastructure/hetzner/deploy.sh backup

## Monitoring
- **System Status**: system-status
- **Docker Stats**: docker stats
- **Disk Usage**: df -h
- **Memory**: free -h
EOF
```

### **Custom Prompts**

```bash
# Create custom prompts for common tasks
mkdir -p ~/.claude-code/prompts

cat > ~/.claude-code/prompts/deploy.txt << 'EOF'
You are helping manage a production Schlep Engine deployment on Hetzner Cloud.

Please:
1. Check current service status
2. Create database backup
3. Deploy latest code changes
4. Verify all services are healthy
5. Show final status report

Be thorough and explain each step.
EOF

cat > ~/.claude-code/prompts/debug.txt << 'EOF'
You are debugging a production issue on Schlep Engine.

Please:
1. Check all container logs for errors
2. Verify database connectivity
3. Test API endpoints
4. Check system resources
5. Provide specific recommendations

Focus on identifying root cause and providing actionable solutions.
EOF
```

## Step 7: Security Considerations

### **API Key Security**

```bash
# Store API key securely
chmod 600 ~/.claude-code/config.json

# Create backup of configuration
cp ~/.claude-code/config.json ~/.claude-code/config.json.backup
```

### **Access Logging**

```bash
# Enable Claude Code session logging
echo 'CLAUDE_CODE_LOG_LEVEL=info' >> ~/.bashrc
echo 'CLAUDE_CODE_LOG_FILE=/home/deploy/.claude-code.log' >> ~/.bashrc
source ~/.bashrc
```

## Step 8: Integration with Monitoring

### **Webhook for Critical Issues**

```bash
# Create webhook script for Claude Code notifications
cat > /home/deploy/claude-webhook << 'EOF'
#!/bin/bash
# Send system alerts to Claude Code

ISSUE="$1"
SEVERITY="$2"

if [ "$SEVERITY" = "critical" ]; then
    echo "🚨 CRITICAL: $ISSUE" | claude-code chat --input-file -
fi
EOF

chmod +x /home/deploy/claude-webhook
```

## Step 9: Useful Aliases

```bash
# Add to ~/.bashrc
cat >> ~/.bashrc << 'EOF'

# Claude Code aliases
alias cc='claude-code chat'
alias ccd='claude-code chat --context-file .claude-production-context.md'
alias cchelp='claude-code --help'
alias ccstatus='claude-code chat --prompt "Check the status of all Schlep Engine services"'
alias cclogs='claude-code chat --prompt "Show me recent error logs from all services"'
alias ccdeploy='claude-code chat --prompt "Deploy the latest version safely"'

EOF

source ~/.bashrc
```

## Benefits You Get

✅ **24/7 AI Assistant** for production management
✅ **Instant Debugging** without context switching  
✅ **Automated Deployments** with safety checks
✅ **Real-time Monitoring** analysis and alerts
✅ **Emergency Response** for critical issues
✅ **Knowledge Retention** across team members
✅ **Best Practices** enforcement

## Sample Workflows

### **Daily Deployment**

```bash
# Start Claude session
ccd

# In chat:
"Good morning! Please check system health, deploy any pending updates, and give me a status report."
```

### **Issue Response**

```bash
# When you get an alert
ccd

# In chat:
"I'm getting 502 errors on api.schlep-engine.com. Please investigate and fix the issue."
```

### **Performance Optimization**

```bash
ccd

# In chat:
"The application feels slow. Please analyze performance metrics and suggest optimizations."
```

This gives you an AI-powered production management system that's always available to help maintain your Schlep Engine deployment!