# 🚀 Hetzner + Cloudflare Production Deployment

## Complete Setup for Schlep Engine

**Cost**: €4-20/month (80% cheaper than hybrid approach)
**Setup Time**: 1-2 hours
**Management**: SSH + Claude Code CLI

---

## 🎯 **QUICK START**

### **Prerequisites**
- [x] Domain: `schlep-engine.com` (owned)
- [ ] Hetzner VPS (€4.15/month CX11)
- [ ] Cloudflare account (free)
- [ ] GitHub repository access

### **Step 1: Get Hetzner VPS**
1. **Sign up** at [hetzner.com](https://hetzner.com)
2. **Create VPS**: CX11, Ubuntu 22.04, SSH key
3. **Note server IP**: `xxx.xxx.xxx.xxx`

### **Step 2: Initial Server Setup**
```bash
# Upload server setup script
scp infrastructure/hetzner/server-setup.sh root@YOUR_SERVER_IP:/root/

# SSH into server and run setup
ssh root@YOUR_SERVER_IP
chmod +x server-setup.sh
./server-setup.sh
```

### **Step 3: Configure Environment**
```bash
# SSH as deploy user
ssh deploy@YOUR_SERVER_IP

# Edit environment file
cd schlep-engine
nano infrastructure/hetzner/.env.production

# Generate secrets (use these in .env.production)
openssl rand -hex 32  # SECRET_KEY
openssl rand -hex 32  # JWT_SECRET_KEY
openssl rand -base64 32 # DATABASE PASSWORD
```

### **Step 4: Setup Cloudflare**
Follow instructions in: `infrastructure/hetzner/cloudflare-setup.md`

### **Step 5: Deploy Application**
```bash
# Make deploy script executable
chmod +x infrastructure/hetzner/deploy.sh

# Run deployment
./infrastructure/hetzner/deploy.sh
```

### **Step 6: Install Claude Code**
Follow instructions in: `infrastructure/hetzner/claude-code-setup.md`

---

## 📁 **FILE STRUCTURE**

```
infrastructure/hetzner/
├── README.md                           # This file
├── DEPLOYMENT_GUIDE.md                 # Detailed step-by-step guide
├── cloudflare-setup.md                 # Cloudflare configuration
├── claude-code-setup.md                # AI assistant setup
├── server-setup.sh                     # Initial server configuration
├── deploy.sh                           # Deployment automation
├── docker-compose.production.yml       # Production Docker setup
├── .env.production.template             # Environment variables template
├── nginx/
│   ├── nginx.conf                      # Main Nginx configuration
│   └── sites-enabled/
│       └── schlep-engine.conf          # Site-specific configuration
└── docker/
    ├── Dockerfile.api                  # API backend
    ├── Dockerfile.web-admin            # Admin dashboard
    ├── Dockerfile.web-landing          # Landing page
    └── Dockerfile.web-docs             # Documentation
```

---

## 🔧 **MANAGEMENT COMMANDS**

### **Deployment Aliases** (available after setup)
```bash
sl-deploy    # Deploy/update application
sl-logs      # View application logs  
sl-status    # Show container status
sl-restart   # Restart services
sl-stop      # Stop all services
sl-backup    # Create database backup
sl-update    # Pull latest code
```

### **System Monitoring**
```bash
status       # System overview
htop         # Resource usage
docker stats # Container resources
df -h        # Disk usage
```

### **Claude Code Assistant**
```bash
claude-assist      # Start AI assistant session
cc                 # Quick Claude chat
ccdeploy          # AI-assisted deployment
ccstatus          # AI system status check
```

---

## 🌐 **ARCHITECTURE**

```
Internet
    ↓
Cloudflare CDN (Free SSL, DDoS protection, Caching)
    ↓
Hetzner VPS (€4/month)
    ↓
Nginx (Reverse Proxy, Load Balancer)
    ↓
┌─────────────┬─────────────┬─────────────┬─────────────┐
│     API     │    Admin    │   Landing   │    Docs     │
│   :8000     │    :3002    │    :3000    │    :3001    │ 
│  FastAPI    │   Next.js   │   Next.js   │   Next.js   │
└─────────────┴─────────────┴─────────────┴─────────────┘
    ↓                           ↓
┌─────────────┐         ┌─────────────┐
│ PostgreSQL  │         │    Redis    │
│   :5432     │         │    :6379    │
└─────────────┘         └─────────────┘
```

---

## 💰 **COST COMPARISON**

| Solution | Monthly Cost | Performance | Control | Complexity |
|----------|-------------|-------------|---------|------------|
| **Hetzner + Cloudflare** | **€4-20** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Railway + Supabase | $85+ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| AWS EKS | $400-600 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Vercel + PlanetScale | $60-120 | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |

**Winner**: Hetzner + Cloudflare (Best value, performance, and control)

---

## 🔒 **SECURITY FEATURES**

✅ **Firewall**: UFW with minimal open ports
✅ **Fail2ban**: Brute force protection  
✅ **SSL**: Free Cloudflare certificates
✅ **DDoS**: Cloudflare protection
✅ **WAF**: Web Application Firewall
✅ **Auto-updates**: Security patches
✅ **Non-root**: Docker containers run as non-root
✅ **Rate limiting**: Nginx + Cloudflare

---

## 📈 **SCALING OPTIONS**

### **Phase 1: Startup** (Current)
- **Server**: CX11 (1 vCPU, 2GB RAM) - €4.15/month
- **Users**: 0-1,000
- **Requests**: <50,000/month

### **Phase 2: Growth**
- **Server**: CX31 (2 vCPU, 8GB RAM) - €15.40/month
- **Users**: 1,000-10,000  
- **Requests**: 50,000-500,000/month
- **Add**: Cloudflare Pro (advanced features)

### **Phase 3: Scale**
- **Load Balancer**: €5.83/month
- **Multiple servers**: CX41+ 
- **Database**: Dedicated server
- **CDN**: Cloudflare Business

---

## 🆘 **TROUBLESHOOTING**

### **Common Issues**

**Services won't start**:
```bash
# Check logs
sl-logs

# Check disk space
df -h

# Check memory
free -h
```

**SSL issues**:
```bash
# Verify certificates
openssl x509 -in infrastructure/hetzner/ssl/cloudflare.crt -text -noout

# Check nginx config
docker exec schlep-nginx nginx -t
```

**Database connection errors**:
```bash
# Test connection
docker exec schlep-postgres psql -U schlep_user -d schlep_engine -c "SELECT 1;"

# Check environment file
grep DATABASE_URL infrastructure/hetzner/.env.production
```

### **Emergency Contacts**
- **Hetzner Support**: 24/7 ticket system
- **Cloudflare Support**: Community forums
- **Claude Code**: AI assistant available 24/7

---

## 🎉 **SUCCESS!**

Your Schlep Engine is now deployed with:
- ⚡ **High Performance**: NVMe SSD, AMD EPYC processors
- 🌍 **Global CDN**: Cloudflare's 270+ data centers
- 🔒 **Enterprise Security**: DDoS protection, WAF, SSL
- 🤖 **AI Management**: Claude Code assistant
- 💰 **Ultra Low Cost**: €4/month startup pricing

**Total Setup Time**: ~2 hours
**Total Monthly Cost**: €4-20 vs $85+ for alternatives
**Performance**: Better than most managed solutions
**Control**: Full server access + AI assistant

Welcome to production! 🚀