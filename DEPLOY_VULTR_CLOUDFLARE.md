# 🚀 Complete Vultr + Cloudflare Deployment Guide

## 📋 **CURRENT SETUP**
- ✅ **Domain**: schlep-engine.com (owned)
- ✅ **Vultr VPS**: `45.77.44.216` (running)
- ✅ **Local Dev**: API (3001) + Admin (3002) working
- ❌ **DNS**: Currently on Vercel nameservers
- ❌ **Production**: Not deployed yet

---

## 🎯 **STEP 1: CLOUDFLARE SETUP (15 minutes)**

### **1.1 Create Cloudflare Account**
1. Go to [cloudflare.com](https://cloudflare.com)
2. **Sign up** with your email
3. **Add Site**: Enter `schlep-engine.com`
4. **Choose Plan**: Free (sufficient for startup)

### **1.2 Configure DNS Records** 
**In Cloudflare Dashboard → DNS → Records, add:**

```
Type    Name      Content           TTL     Proxy Status
A       @         45.77.44.216      Auto    🟠 Proxied
CNAME   www       schlep-engine.com Auto    🟠 Proxied  
CNAME   api       schlep-engine.com Auto    🟠 Proxied
CNAME   admin     schlep-engine.com Auto    🟠 Proxied
CNAME   docs      schlep-engine.com Auto    🟠 Proxied
```

### **1.3 Get Nameservers**
**Copy the Cloudflare nameservers** (something like):
```
anya.ns.cloudflare.com
chad.ns.cloudflare.com  
```

---

## 🎯 **STEP 2: TRANSFER DNS FROM VERCEL (5 minutes)**

### **2.1 Update Domain Nameservers**
**Where you bought the domain (Namecheap, GoDaddy, etc.)**:

1. **Login** to your domain registrar
2. **Find** schlep-engine.com → Domain Management
3. **Change Nameservers** from:
   - `ns1.vercel-dns.com` 
   - `ns2.vercel-dns.com`
   
   **To Cloudflare nameservers**:
   - `anya.ns.cloudflare.com` (use your actual ones)
   - `chad.ns.cloudflare.com`

4. **Save Changes** (takes 24-48 hours to propagate)

---

## 🎯 **STEP 3: PREPARE VPS DEPLOYMENT (10 minutes)**

### **3.1 Test VPS Connection**
```bash
# Test if VPS is accessible
ping 45.77.44.216

# SSH into VPS (replace with your SSH key/password)
ssh root@45.77.44.216
```

### **3.2 Create Environment File**
**On your local machine**, create the production environment:

```bash
# Copy environment template
cp infrastructure/vultr/.env.production.template infrastructure/vultr/.env.production

# Edit with your settings
nano infrastructure/vultr/.env.production
```

**Add these values to `.env.production`**:
```bash
# Core Configuration
ENVIRONMENT=production
SECRET_KEY=your-32-char-secret-here
JWT_SECRET_KEY=your-32-char-jwt-secret-here

# Database
DATABASE_URL=postgresql://schlep_user:your-db-password@postgres:5432/schlep_engine
POSTGRES_USER=schlep_user
POSTGRES_PASSWORD=your-db-password
POSTGRES_DB=schlep_engine

# Redis
REDIS_URL=redis://redis:6379

# Domain Configuration  
ALLOWED_ORIGINS=https://schlep-engine.com,https://admin.schlep-engine.com,https://docs.schlep-engine.com,https://api.schlep-engine.com
ALLOWED_HOSTS=schlep-engine.com,api.schlep-engine.com,admin.schlep-engine.com,docs.schlep-engine.com

# Application URLs
API_URL=https://api.schlep-engine.com
FRONTEND_URL=https://schlep-engine.com

# Features
ENABLE_ML_PROCESSING=true
ENABLE_DOCUMENT_EXTRACTION=true
```

**Generate secrets**:
```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Generate JWT_SECRET_KEY  
openssl rand -hex 32

# Generate DB password
openssl rand -base64 32
```

---

## 🎯 **STEP 4: DEPLOY TO VULTR VPS (20 minutes)**

### **4.1 Upload Code to VPS**
```bash
# Option A: If VPS has Git access
ssh root@45.77.44.216
git clone https://github.com/your-username/schlep-engine.git
cd schlep-engine

# Option B: Upload via SCP
scp -r . root@45.77.44.216:/root/schlep-engine/
```

### **4.2 Install Dependencies on VPS**
```bash
# SSH into VPS
ssh root@45.77.44.216

# Update system
apt update && apt upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

### **4.3 Upload Environment File**
```bash
# From your local machine, upload the .env file
scp infrastructure/vultr/.env.production root@45.77.44.216:/root/schlep-engine/infrastructure/vultr/

# Verify on VPS
ssh root@45.77.44.216
ls -la /root/schlep-engine/infrastructure/vultr/.env.production
```

### **4.4 Deploy Services**
```bash
# On VPS
cd /root/schlep-engine
chmod +x infrastructure/vultr/deploy.sh

# Run deployment
./infrastructure/vultr/deploy.sh
```

---

## 🎯 **STEP 5: CLOUDFLARE SSL SETUP (10 minutes)**

### **5.1 SSL Configuration**
**In Cloudflare Dashboard**:

1. **SSL/TLS** → **Overview**:
   - **Encryption Mode**: "Full (Strict)"
   - **Always Use HTTPS**: ON

2. **SSL/TLS** → **Origin Server**:
   - **Create Certificate** for:
     - `schlep-engine.com`
     - `*.schlep-engine.com`
   - **Download** certificate and private key

### **5.2 Install SSL Certificates on VPS**
```bash  
# SSH into VPS
ssh root@45.77.44.216

# Create SSL directory
mkdir -p /root/schlep-engine/infrastructure/vultr/ssl

# Create certificate file (paste Cloudflare certificate content)
nano /root/schlep-engine/infrastructure/vultr/ssl/cloudflare.crt

# Create private key file (paste Cloudflare private key content)  
nano /root/schlep-engine/infrastructure/vultr/ssl/cloudflare.key

# Set permissions
chmod 600 /root/schlep-engine/infrastructure/vultr/ssl/*

# Restart Nginx
docker-compose -f infrastructure/vultr/docker-compose.production.yml restart nginx
```

---

## 🎯 **STEP 6: VERIFICATION & TESTING (15 minutes)**

### **6.1 Wait for DNS Propagation**
```bash
# Check DNS propagation (may take up to 48 hours)
nslookup schlep-engine.com
nslookup api.schlep-engine.com

# Should show: 45.77.44.216
```

### **6.2 Test All Services**
Once DNS propagates:

```bash
# Test main domain
curl -I https://schlep-engine.com

# Test API
curl https://api.schlep-engine.com/health

# Test admin dashboard
curl -I https://admin.schlep-engine.com

# Test docs
curl -I https://docs.schlep-engine.com
```

### **6.3 Verify in Browser**
- 🌐 **Landing**: https://schlep-engine.com
- 🔧 **Admin**: https://admin.schlep-engine.com  
- 📚 **Docs**: https://docs.schlep-engine.com
- 🔗 **API**: https://api.schlep-engine.com/docs

---

## 🎯 **STEP 7: CLOUDFLARE OPTIMIZATION (5 minutes)**

### **7.1 Security Settings**
**Cloudflare** → **Security**:
- **Security Level**: Medium
- **Bot Fight Mode**: ON
- **WAF**: Enable Managed Rules

### **7.2 Performance Settings**  
**Cloudflare** → **Speed**:
- **Auto Minify**: CSS, JS, HTML ✅
- **Brotli**: ON
- **Caching Level**: Standard

---

## ✅ **SUCCESS CHECKLIST**

- [ ] Cloudflare account created and domain added
- [ ] DNS records configured with VPS IP (45.77.44.216)
- [ ] Nameservers transferred from Vercel to Cloudflare
- [ ] Environment variables configured
- [ ] Services deployed on Vultr VPS
- [ ] SSL certificates installed
- [ ] DNS propagation complete (24-48 hours)
- [ ] All domains responding with SSL ✅
- [ ] API health checks passing ✅

---

## 💰 **MONTHLY COSTS**

| Service | Cost | Features |
|---------|------|----------|
| **Vultr VPS** | $5-10 | 1-2 vCPU, 2-4GB RAM |
| **Cloudflare** | $0 | Free SSL, CDN, DDoS protection |
| **Total** | **$5-10/month** | Full production setup |

**vs. Vercel + Railway**: $85+/month

---

## 🆘 **TROUBLESHOOTING**

### **DNS Not Propagating**
```bash
# Check current nameservers
dig NS schlep-engine.com

# Should show Cloudflare nameservers after propagation
```

### **SSL Issues**
```bash
# Check SSL certificate on VPS
docker exec schlep-nginx nginx -t

# Recreate SSL certificate if needed
```

### **Services Not Starting**
```bash  
# Check logs on VPS
ssh root@45.77.44.216
cd /root/schlep-engine
docker-compose -f infrastructure/vultr/docker-compose.production.yml logs -f
```

---

## 🎉 **DEPLOYMENT COMPLETE!**

Your Schlep Engine is now running on:
- **🏠 Landing**: https://schlep-engine.com
- **⚡ API**: https://api.schlep-engine.com  
- **🔧 Admin**: https://admin.schlep-engine.com
- **📚 Docs**: https://docs.schlep-engine.com

**Enterprise features for $5/month**:
- ✅ Global CDN (Cloudflare)
- ✅ DDoS Protection  
- ✅ Free SSL Certificates
- ✅ Web Application Firewall
- ✅ High Performance VPS