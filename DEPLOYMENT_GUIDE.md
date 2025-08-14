# Schlep Engine VPS Deployment Guide

## 🚀 Complete Production Deployment for Vultr VPS

**VPS IP:** 45.77.44.216  
**Domain:** schlep-engine.com  
**Architecture:** Docker Compose with FastAPI + Next.js + PostgreSQL + Redis + Nginx

---

## 📋 Pre-Deployment Checklist

### 1. Domain Configuration
Ensure your Cloudflare DNS is configured with these A records:
```
A    schlep-engine.com      45.77.44.216
A    api.schlep-engine.com  45.77.44.216  
A    admin.schlep-engine.com 45.77.44.216
A    docs.schlep-engine.com 45.77.44.216
```

### 2. OAuth Applications Setup
Before deployment, create OAuth applications:

**Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `https://api.schlep-engine.com/api/v1/auth/oauth/google/callback`

**GitHub OAuth:**
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth App
3. Set Authorization callback URL:
   - `https://api.schlep-engine.com/api/v1/auth/oauth/github/callback`

---

## 🛠 Deployment Steps

### Step 1: Connect to Your VPS
```bash
ssh root@45.77.44.216
```

### Step 2: Upload Deployment Files
Transfer these files to your VPS:
```bash
# On your local machine
scp -r ~/Desktop/schlep-engine/ root@45.77.44.216:/tmp/

# On VPS
ssh root@45.77.44.216
mv /tmp/schlep-engine /opt/
cd /opt/schlep-engine
```

### Step 3: Run Deployment Script
```bash
cd /opt/schlep-engine
chmod +x deploy.sh
sudo ./deploy.sh
```

### Step 4: Configure Environment Variables
Edit the generated `.env` file:
```bash
nano .env
```

Update these values with your OAuth credentials:
```env
GOOGLE_CLIENT_ID=your-actual-google-client-id
GOOGLE_CLIENT_SECRET=your-actual-google-client-secret
GITHUB_CLIENT_ID=your-actual-github-client-id
GITHUB_CLIENT_SECRET=your-actual-github-client-secret
```

### Step 5: Setup SSL Certificates
```bash
chmod +x ssl-setup.sh
sudo ./ssl-setup.sh
```

### Step 6: Restart Services
```bash
docker-compose restart
```

---

## 🔧 Service Configuration

### Port Mapping
- **PostgreSQL**: 5432 (internal)
- **Redis**: 6379 (internal)  
- **FastAPI Backend**: 3001 → 8000 (container)
- **Next.js Admin**: 3002 → 3000 (container)
- **Next.js Landing**: 3000 → 3000 (container)
- **Next.js Docs**: 3003 → 3000 (container)
- **Nginx**: 80, 443

### Domain Routing
```
https://schlep-engine.com → Landing Page (port 3000)
https://api.schlep-engine.com → FastAPI Backend (port 3001)
https://admin.schlep-engine.com → Admin Dashboard (port 3002)
https://docs.schlep-engine.com → Documentation (port 3003)
```

---

## 🏥 Health Checks & Monitoring

### Check Service Status
```bash
cd /opt/schlep-engine
docker-compose ps
docker-compose logs -f [service-name]
```

### Health Endpoints
- API Health: `https://api.schlep-engine.com/health`
- API Docs: `https://api.schlep-engine.com/docs`
- Landing Page: `https://schlep-engine.com`

### Useful Commands
```bash
# View all logs
docker-compose logs -f

# Restart specific service
docker-compose restart [service-name]

# Rebuild specific service
docker-compose build [service-name]
docker-compose up -d [service-name]

# Check SSL certificate status
openssl s_client -servername schlep-engine.com -connect schlep-engine.com:443 -showcerts
```

---

## 🔒 Security Features

### SSL/TLS Configuration
- Let's Encrypt certificates with auto-renewal
- TLS 1.2+ only
- HSTS headers
- Secure cipher suites

### Security Headers
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- X-Content-Type-Options: nosniff
- Strict-Transport-Security
- Content-Security-Policy

### Rate Limiting
- API endpoints: 100 requests/minute
- General endpoints: 200 requests/minute
- Configurable burst limits

### CORS Configuration
- Restricted to schlep-engine.com subdomains
- Proper preflight handling
- Secure headers exposure

---

## 🔧 Troubleshooting

### Common Issues

**1. SSL Certificate Issues**
```bash
# Check certificate status
docker-compose logs certbot

# Force certificate renewal
docker-compose run --rm certbot renew --force-renewal
docker-compose restart nginx
```

**2. Database Connection Issues**
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Access PostgreSQL directly
docker-compose exec postgres psql -U schlep_user -d schlep_engine
```

**3. Service Won't Start**
```bash
# Check service logs
docker-compose logs [service-name]

# Rebuild service
docker-compose build [service-name]
docker-compose up -d [service-name]
```

**4. Port Conflicts**
```bash
# Check what's using ports
netstat -tlnp | grep :80
netstat -tlnp | grep :443

# Stop conflicting services
systemctl stop apache2  # if installed
systemctl stop nginx    # if system nginx is running
```

### Backup and Recovery
```bash
# Backup database
docker-compose exec postgres pg_dump -U schlep_user schlep_engine > backup.sql

# Backup all data
docker run --rm -v /opt/schlep-engine:/data -v $(pwd):/backup ubuntu tar czf /backup/schlep-engine-backup.tar.gz /data
```

---

## 📊 Monitoring

### Log Locations
```
/opt/schlep-engine/
├── logs/               # Application logs
├── certbot/conf/       # SSL certificates
├── postgres-data/      # Database data
└── redis-data/         # Cache data
```

### Resource Monitoring
```bash
# Docker resource usage
docker stats

# System resource usage
htop
df -h
free -m
```

---

## 🔄 Updates and Maintenance

### Updating Code
```bash
cd /opt/schlep-engine
git pull origin main
docker-compose build
docker-compose up -d
```

### Certificate Renewal
Certificates auto-renew via cron job. Manual renewal:
```bash
docker-compose run --rm certbot renew
docker-compose restart nginx
```

---

## ✅ Deployment Verification

After deployment, verify these endpoints:
- [ ] https://schlep-engine.com (Landing page loads)
- [ ] https://api.schlep-engine.com/health (Returns {"status":"healthy"})
- [ ] https://api.schlep-engine.com/docs (API documentation loads)
- [ ] https://admin.schlep-engine.com (Admin dashboard loads)
- [ ] https://docs.schlep-engine.com (Documentation loads)
- [ ] SSL certificates valid (no browser warnings)
- [ ] All services showing as healthy in docker-compose ps

---

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review service logs: `docker-compose logs -f`
3. Verify environment variables in `.env`
4. Ensure DNS records are properly configured in Cloudflare
5. Check firewall settings allow ports 80 and 443

**Your Schlep Engine deployment should now be fully operational! 🎉**