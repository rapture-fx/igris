# 🚀 Schlep-engine Cloud Deployment Instructions

## 📋 Prerequisites Checklist

### ✅ Security Requirements (COMPLETED)
- [x] Removed hardcoded secrets from repository
- [x] Created secure environment variable templates
- [x] Generated cryptographically secure secrets
- [x] Revoked compromised LemonSqueezy API key
- [x] Re-enabled security middleware with error handling
- [x] Enhanced JWT configuration with proper claims

### ✅ Infrastructure Requirements (COMPLETED)
- [x] Created CI/CD pipeline with security scanning
- [x] Added cloud-specific configuration files
- [x] Created production Dockerfile
- [x] Set up health checks and monitoring

---

## 🔐 Step 1: Set Up Secrets Management

### Generate New Secrets (if not done)
```bash
cd apps/api
python3 scripts/generate_secrets.py
```

### Required Environment Variables

**For Railway (API Backend):**
```bash
# Core Application
SECRET_KEY=your_generated_secret_key
JWT_SECRET_KEY=your_generated_jwt_key
ENCRYPTION_KEY=your_generated_encryption_key
ENVIRONMENT=production
DEBUG=false
APP_VERSION=1.0.0

# Database (Railway will provide DATABASE_URL)
DATABASE_URL=postgresql://user:pass@host:port/db

# Redis (Railway will provide REDIS_URL)
REDIS_URL=redis://user:pass@host:port

# External APIs (replace with your new keys)
LEMONSQUEEZY_API_KEY=your_new_lemonsqueezy_key
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret
LEMONSQUEEZY_STORE_ID=your_store_id

# OAuth (replace with your actual keys)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# CORS Settings
ALLOWED_ORIGINS=["https://admin.yourdomain.com","https://yourdomain.com","https://docs.yourdomain.com"]
ALLOWED_HOSTS=["*.yourdomain.com"]
```

**For Vercel (Frontend Apps):**
```bash
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXT_PUBLIC_ENVIRONMENT=production
```

---

## 🏗️ Step 2: Deploy to Railway (API Backend)

### 2.1 Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Connect your GitHub repository
4. Select the Schlep-engine repository

### 2.2 Configure Railway Services
1. **Add PostgreSQL Database:**
   - Click "Add Service" → "Database" → "PostgreSQL"
   - Railway auto-generates `DATABASE_URL`

2. **Add Redis Cache:**
   - Click "Add Service" → "Database" → "Redis"
   - Railway auto-generates `REDIS_URL`

3. **Configure API Service:**
   - Set root directory: `apps/api`
   - Set build command: Use `Dockerfile.production`
   - Add all environment variables from Step 1

### 2.3 Deploy API
```bash
# Railway will automatically deploy when you push to main branch
git add .
git commit -m "Configure Railway deployment"
git push origin main
```

---

## ▲ Step 3: Deploy to Vercel (Frontend Apps)

### 3.1 Deploy Admin Dashboard
```bash
cd apps/web-admin
npx vercel --prod

# Configure environment variables in Vercel dashboard:
# NEXT_PUBLIC_API_URL=https://your-api.railway.app
# NEXT_PUBLIC_ENVIRONMENT=production
```

### 3.2 Deploy Landing Page
```bash
cd apps/web-landing
npx vercel --prod
```

### 3.3 Deploy Documentation
```bash
cd apps/web-docs
npx vercel --prod
```

---

## ☁️ Step 4: Add Cloudflare (Recommended)

### 4.1 Add Domain to Cloudflare
1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain
3. Update nameservers at your domain registrar

### 4.2 Configure DNS Records
```
Type    Name    Target                          Proxied
A       @       your-landing-vercel-url         Yes
CNAME   api     your-railway-app-url            Yes
CNAME   admin   your-admin-vercel-url           Yes
CNAME   docs    your-docs-vercel-url            Yes
```

### 4.3 Configure Security Settings
1. **SSL/TLS:** Set to "Full (Strict)"
2. **Security Level:** Medium
3. **Bot Fight Mode:** Enable
4. **Always Use HTTPS:** Enable

---

## 🧪 Step 5: Testing Deployment

### 5.1 Health Check Endpoints
```bash
# API Health Check
curl https://api.yourdomain.com/health

# Frontend Health Checks
curl -I https://yourdomain.com
curl -I https://admin.yourdomain.com
curl -I https://docs.yourdomain.com
```

### 5.2 Database Migration
```bash
# SSH into Railway or run locally with production DATABASE_URL
cd apps/api
python -m alembic upgrade head
```

### 5.3 Functional Testing
1. **Authentication Flow**
   - Sign up / Sign in
   - JWT token generation
   - API authentication

2. **Core Features**
   - File upload
   - Data processing
   - ML pipeline

3. **Payment Integration**
   - LemonSqueezy webhook
   - Subscription handling

---

## 📊 Step 6: Monitoring Setup

### 6.1 Railway Monitoring
- Check Railway dashboard for metrics
- Set up log aggregation
- Configure alerting

### 6.2 Vercel Analytics
- Enable Vercel Analytics
- Monitor function execution
- Track performance metrics

### 6.3 Cloudflare Analytics
- Monitor security events
- Track performance improvements
- Set up rate limiting alerts

---

## 🚨 Step 7: Security Verification

### 7.1 Security Headers Check
```bash
curl -I https://yourdomain.com | grep -E "(X-|Strict-|Content-Security)"
```

### 7.2 SSL Check
```bash
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### 7.3 API Security Test
```bash
# Test rate limiting
for i in {1..20}; do curl https://api.yourdomain.com/health; done

# Test CORS
curl -H "Origin: https://malicious-site.com" https://api.yourdomain.com/health
```

---

## 💰 Expected Costs

**Startup Phase ($10/month):**
- Railway Starter: $10/month
- Vercel Hobby: $0/month
- Supabase Free: $0/month
- Cloudflare Free: $0/month

**Growth Phase ($67/month):**
- Railway Growth: $50/month
- Vercel Pro: $20/month
- Cloudflare Pro: $20/month
- Supabase Pro: $25/month (when needed)

---

## 🔄 Rollback Plan

If deployment fails:

1. **Revert Railway Deployment:**
   ```bash
   # Railway keeps previous deployments
   # Use Railway dashboard to rollback
   ```

2. **Revert Vercel Deployment:**
   ```bash
   vercel rollback
   ```

3. **DNS Rollback:**
   - Change Cloudflare DNS back to old targets
   - Or disable Cloudflare proxy temporarily

---

## ✅ Post-Deployment Checklist

- [ ] All services are healthy
- [ ] Database migration completed
- [ ] Authentication works end-to-end
- [ ] File uploads working
- [ ] Payment webhooks configured
- [ ] Monitoring alerts configured
- [ ] SSL certificates valid
- [ ] Security headers present
- [ ] Performance benchmarks met
- [ ] Backup procedures tested

---

## 🆘 Troubleshooting

### Common Issues:

**1. Environment Variables Not Loading**
- Check Railway/Vercel environment variable settings
- Ensure no typos in variable names
- Restart services after adding variables

**2. Database Connection Errors**
- Verify DATABASE_URL format
- Check Railway PostgreSQL service status
- Ensure database migrations are applied

**3. CORS Errors**
- Update ALLOWED_ORIGINS in Railway
- Check Cloudflare proxy settings
- Verify frontend API URLs

**4. 502/503 Errors**
- Check Railway service logs
- Verify health check endpoints
- Check resource limits

---

Your Schlep-engine is now ready for secure, scalable cloud deployment! 🚀