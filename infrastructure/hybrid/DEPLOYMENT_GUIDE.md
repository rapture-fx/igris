# 🚀 Hybrid Deployment Guide
## Railway + Supabase Implementation for Schlep Engine

> **Complete step-by-step guide for deploying Schlep Engine using hybrid architecture**

---

## 📋 **PREREQUISITES CHECKLIST**

Before starting the deployment, ensure you have:

- [ ] **Domain**: schlep-engine.com (already purchased on Namecheap)
- [ ] **GitHub Account** with repository access
- [ ] **Credit Card** for platform signups (most have free tiers)
- [ ] **Command Line Tools**: git, curl, node.js
- [ ] **Email Access** for account verification

**Estimated Setup Time**: 2-3 hours  
**Monthly Cost**: $30-50 (startup phase)

---

## 🏗️ **PHASE 1: PLATFORM SETUP (30-45 minutes)**

### **Step 1: Create Supabase Project**

1. **Visit** [Supabase.com](https://supabase.com)
2. **Sign up** with GitHub account
3. **Create new project**:
   - **Name**: `schlep-engine-production`
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to your users
   - **Plan**: Start with Free, upgrade to Pro ($25/month) when ready

4. **Save these values** (you'll need them later):
   ```
   Project URL: https://[project-id].supabase.co
   Anon Key: eyJ... (public key)
   Service Role Key: eyJ... (private key - keep secret!)
   JWT Secret: [your-jwt-secret]
   Database URL: postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
   ```

### **Step 2: Create Railway Account**

1. **Visit** [Railway.app](https://railway.app)
2. **Sign up** with GitHub account
3. **Create new project**:
   - **Name**: `schlep-engine-api`
   - **Connect** your GitHub repository
   - **Add Redis** service (click "Add Service" → "Redis")

4. **Save these values**:
   ```
   Project ID: [railway-project-id]
   Redis URL: (will be provided automatically as ${{Redis.REDIS_URL}})
   ```

### **Step 3: Create Vercel Account**

1. **Visit** [Vercel.com](https://vercel.com)
2. **Sign up** with GitHub account
3. **Import** your repository (we'll configure apps later)

### **Step 4: Create Cloudflare Account**

1. **Visit** [Cloudflare.com](https://cloudflare.com)
2. **Sign up** and verify email
3. **Add domain**: schlep-engine.com
4. **Note the nameservers** (you'll update Namecheap later)

---

## 🗄️ **PHASE 2: DATABASE SETUP (20-30 minutes)**

### **Step 1: Configure Supabase Database**

1. **Open Supabase Dashboard** → Your Project → SQL Editor

2. **Run the database schema**:
   ```sql
   -- Copy the entire content from infrastructure/hybrid/supabase-schema.sql
   -- and paste it into the SQL Editor, then click "Run"
   ```

3. **Enable Real-time** (Database → Replication):
   - **Add table**: `jobs`
   - **Add table**: `user_profiles`
   - **Add table**: `api_usage`

4. **Configure Authentication** (Authentication → Settings):
   - **Site URL**: `https://admin.schlep-engine.com`
   - **Redirect URLs**: 
     ```
     https://admin.schlep-engine.com/auth/callback
     https://schlep-engine.com/auth/callback
     ```

5. **Enable OAuth Providers** (Authentication → Providers):
   - **Google**: Enable and configure with your Google OAuth credentials
   - **GitHub**: Enable and configure with your GitHub OAuth credentials

6. **Create Storage Bucket** (Storage):
   - **Bucket name**: `schlep-engine-documents`
   - **Public**: No
   - **File size limit**: 100MB
   - **Allowed file types**: `image/*, application/pdf, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### **Step 2: Set up Row Level Security**

1. **Go to** Authentication → Policies
2. **Verify** that RLS policies are active (they should be created by the schema)
3. **Test** by creating a test user in Authentication → Users

---

## 🚀 **PHASE 3: RAILWAY DEPLOYMENT (25-35 minutes)**

### **Step 1: Configure Environment Variables**

1. **Open Railway Dashboard** → Your Project → Variables

2. **Add these environment variables**:

   ```bash
   # Core Configuration
   ENVIRONMENT=production
   APP_VERSION=1.0.0
   LOG_LEVEL=INFO
   
   # Domain Configuration
   CORS_ORIGINS=https://schlep-engine.com,https://admin.schlep-engine.com,https://docs.schlep-engine.com,https://api.schlep-engine.com
   ALLOWED_HOSTS=api.schlep-engine.com,*.railway.app
   
   # Supabase Configuration (replace with your actual values)
   SUPABASE_URL=https://[your-project-id].supabase.co
   SUPABASE_ANON_KEY=[your-anon-key]
   SUPABASE_SERVICE_KEY=[your-service-role-key]
   SUPABASE_JWT_SECRET=[your-jwt-secret]
   DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
   
   # Security
   SECRET_KEY=[generate-a-32-character-random-string]
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   
   # ML Configuration
   ML_WORKERS=2
   ML_BATCH_SIZE=16
   TENSORFLOW_INTER_OP_PARALLELISM_THREADS=2
   TENSORFLOW_INTRA_OP_PARALLELISM_THREADS=2
   
   # Features
   ENABLE_ML_PROCESSING=true
   ENABLE_DOCUMENT_EXTRACTION=true
   ENABLE_SUPABASE_REALTIME=true
   ENABLE_VECTOR_SEARCH=true
   
   # Storage
   SUPABASE_STORAGE_BUCKET=schlep-engine-documents
   ENABLE_LOCAL_STORAGE=false
   
   # Rate Limiting
   RATE_LIMIT_ENABLED=true
   RATE_LIMIT_REQUESTS=1000
   RATE_LIMIT_PERIOD=60
   ```

### **Step 2: Deploy Railway Configuration**

1. **Copy railway config** to your project root:
   ```bash
   cp infrastructure/hybrid/railway-supabase.toml railway.toml
   ```

2. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

3. **Link your project**:
   ```bash
   railway link [your-project-id]
   ```

4. **Deploy**:
   ```bash
   railway up
   ```

### **Step 3: Set up Custom Domain**

1. **Railway Dashboard** → Settings → Domains
2. **Add custom domain**: `api.schlep-engine.com`
3. **Note the CNAME target** (something like `xxx.up.railway.app`)

---

## 🌐 **PHASE 4: FRONTEND DEPLOYMENT (30-40 minutes)**

### **Step 1: Deploy Landing Page**

1. **Vercel Dashboard** → Import Project
2. **Select** `apps/web-landing` directory
3. **Configure**:
   - **Framework**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

4. **Environment Variables**:
   ```bash
   NEXT_PUBLIC_API_URL=https://api.schlep-engine.com
   NEXT_PUBLIC_SUPABASE_URL=[your-supabase-url]
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
   ```

5. **Custom Domain**: `schlep-engine.com` and `www.schlep-engine.com`

### **Step 2: Deploy Admin Dashboard**

1. **Vercel Dashboard** → Import Project
2. **Select** `apps/web-admin` directory
3. **Configure** similar to landing page
4. **Environment Variables**:
   ```bash
   NEXT_PUBLIC_API_URL=https://api.schlep-engine.com
   NEXT_PUBLIC_SUPABASE_URL=[your-supabase-url]
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
   NEXT_PUBLIC_ENVIRONMENT=production
   ```

5. **Custom Domain**: `admin.schlep-engine.com`

### **Step 3: Deploy Documentation**

1. **Vercel Dashboard** → Import Project
2. **Select** `apps/web-docs` directory
3. **Custom Domain**: `docs.schlep-engine.com`

---

## ☁️ **PHASE 5: CLOUDFLARE CONFIGURATION (15-20 minutes)**

### **Step 1: Configure DNS Records**

1. **Cloudflare Dashboard** → DNS → Records
2. **Add these records**:

   ```
   Type    Name      Content                          TTL    Proxy
   A       @         [vercel-ip-for-landing]          Auto   ✅
   CNAME   www       schlep-engine.com                Auto   ✅
   CNAME   admin     [vercel-url-for-admin]           Auto   ✅
   CNAME   docs      [vercel-url-for-docs]            Auto   ✅
   CNAME   api       [railway-url]                    Auto   ✅
   ```

### **Step 2: Update Namecheap Nameservers**

1. **Login to Namecheap**
2. **Domain List** → schlep-engine.com → Manage
3. **Nameservers** → Custom DNS
4. **Add Cloudflare nameservers** (from Cloudflare DNS setup)

### **Step 3: Configure Security Settings**

1. **SSL/TLS** → Overview → Full (strict)
2. **Security** → WAF → Enable
3. **Speed** → Optimization → Enable Auto Minify
4. **Caching** → Configuration → Standard

---

## 🔧 **PHASE 6: INTEGRATION TESTING (20-30 minutes)**

### **Step 1: Test API Endpoints**

```bash
# Health check
curl https://api.schlep-engine.com/health

# API documentation
curl https://api.schlep-engine.com/docs

# Test authentication
curl -X POST https://api.schlep-engine.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### **Step 2: Test Frontend Applications**

1. **Visit** https://schlep-engine.com (landing page)
2. **Visit** https://admin.schlep-engine.com (admin dashboard)
3. **Visit** https://docs.schlep-engine.com (documentation)
4. **Test** user registration and login
5. **Test** file upload functionality

### **Step 3: Test Real-time Features**

1. **Login** to admin dashboard
2. **Upload** a test file
3. **Verify** real-time job status updates
4. **Check** Supabase dashboard for data

---

## 📊 **PHASE 7: MONITORING SETUP (15-20 minutes)**

### **Step 1: Configure Sentry (Optional)**

1. **Create** Sentry account
2. **Add** to Railway environment variables:
   ```bash
   SENTRY_DSN=[your-sentry-dsn]
   SENTRY_ENVIRONMENT=production
   ```

### **Step 2: Set up Monitoring Dashboard**

1. **Supabase** → Project → Logs (built-in monitoring)
2. **Railway** → Project → Observability
3. **Vercel** → Project → Analytics
4. **Cloudflare** → Analytics & Logs

---

## 🎯 **FINAL VERIFICATION CHECKLIST**

- [ ] **Landing page** loads at https://schlep-engine.com
- [ ] **Admin dashboard** loads at https://admin.schlep-engine.com
- [ ] **Documentation** loads at https://docs.schlep-engine.com
- [ ] **API** responds at https://api.schlep-engine.com/health
- [ ] **User registration** works on admin dashboard
- [ ] **File upload** functionality works
- [ ] **Real-time updates** work in admin dashboard
- [ ] **SSL certificates** are valid (green lock icon)
- [ ] **Database** contains test data in Supabase
- [ ] **Redis cache** is working (check Railway logs)

---

## 💰 **COST BREAKDOWN**

### **Month 1 (Free Tiers)**
- **Supabase**: Free (up to 500MB, 2GB bandwidth)
- **Railway**: $5/month (Starter plan)
- **Vercel**: Free (Hobby plan)
- **Cloudflare**: Free
- **Total**: **$5/month**

### **Growth Phase (Pro Tiers)**
- **Supabase Pro**: $25/month
- **Railway Pro**: $20/month
- **Vercel Pro**: $20/month
- **Cloudflare Pro**: $20/month
- **Total**: **$85/month**

---

## 🚨 **TROUBLESHOOTING**

### **Common Issues and Solutions**

#### **Database Connection Errors**
```bash
# Check database URL format
echo $DATABASE_URL
# Should be: postgresql://postgres:password@db.project.supabase.co:5432/postgres

# Test connection
python -c "import psycopg2; psycopg2.connect('$DATABASE_URL')"
```

#### **CORS Errors**
1. **Check** CORS_ORIGINS environment variable
2. **Verify** domains match exactly (no trailing slashes)
3. **Update** Supabase auth settings

#### **Real-time Not Working**
1. **Check** Supabase Replication settings
2. **Verify** table names in REALTIME_TABLES
3. **Test** WebSocket connection in browser dev tools

#### **File Upload Errors**
1. **Check** Supabase Storage bucket permissions
2. **Verify** SUPABASE_STORAGE_BUCKET name
3. **Test** bucket access with Supabase client

---

## 🔄 **BACKUP AND DISASTER RECOVERY**

### **Automated Backups**
- **Supabase**: Automatic daily backups (Pro plan)
- **Railway**: Code deployed from Git (version controlled)
- **Vercel**: Deployments from Git (rollback available)

### **Manual Backup Process**
```bash
# Export Supabase data
supabase db dump --file backup.sql

# Backup environment variables
railway variables --json > variables-backup.json
```

---

## 📈 **SCALING STRATEGY**

### **Phase 1: Current Setup**
- **Users**: 0-1,000
- **Requests**: <10,000/month
- **Cost**: $5-30/month

### **Phase 2: Growth**
- **Users**: 1,000-10,000
- **Requests**: 10,000-100,000/month
- **Upgrades**: Supabase Pro, Railway Pro
- **Cost**: $85/month

### **Phase 3: Scale**
- **Users**: 10,000+
- **Requests**: 100,000+/month
- **Upgrades**: Multiple Railway services, Supabase Team
- **Cost**: $200-600/month

---

## 📞 **SUPPORT AND RESOURCES**

### **Platform Support**
- **Supabase**: [Discord](https://discord.supabase.com) | [Docs](https://supabase.com/docs)
- **Railway**: [Discord](https://discord.gg/railway) | [Docs](https://docs.railway.app)
- **Vercel**: [Community](https://github.com/vercel/vercel/discussions) | [Docs](https://vercel.com/docs)
- **Cloudflare**: [Community](https://community.cloudflare.com) | [Docs](https://developers.cloudflare.com)

### **Emergency Contacts**
- **Database Issues**: Supabase Support
- **API Downtime**: Railway Support
- **DNS Issues**: Cloudflare Support
- **Frontend Issues**: Vercel Support

---

🎉 **Congratulations!** Your Schlep Engine hybrid architecture is now live and ready to handle enterprise-grade data processing workloads!

**Next Steps**:
1. **Set up monitoring alerts**
2. **Create user documentation**
3. **Plan marketing launch**
4. **Monitor usage and costs**
5. **Scale as needed**