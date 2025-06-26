# Pollarbase Quick Deployment Guide
**Updated:** December 2024  
**Status:** ✅ **Production Ready**

## 🚀 **Development Setup (5 minutes)**

### **Prerequisites**
- Node.js 18+
- Python 3.11+
- PostgreSQL
- Redis (optional)
- pnpm

### **Quick Start**
```bash
# 1. Clone and install dependencies
git clone <repository>
cd pollarbase
pnpm install

# 2. Backend setup
cd packages/backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Environment setup
cp environment.env .env.development
# Edit .env.development with your database settings

# 4. Database setup
alembic upgrade head

# 5. Start backend
python working_server.py

# 6. Start frontend (new terminal)
cd packages/frontend
pnpm run dev
```

### **Access Points**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

---

## 🐳 **Production Deployment (Docker)**

### **Prerequisites**
- Docker & Docker Compose
- Domain name (optional)
- SSL certificates (optional)

### **1. Environment Configuration**
```bash
cd packages/backend
cp environment.production.example environment.production

# Edit environment.production with your production values:
# - Database passwords
# - JWT secrets
# - API keys
# - Domain settings
```

### **2. Start Production Stack**
```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f pollarbase-api
```

### **3. Database Migration**
```bash
# Run migrations on production
docker-compose -f docker-compose.production.yml exec pollarbase-api alembic upgrade head
```

### **4. Access Production Services**
- **Application**: http://localhost:8000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/your_grafana_password)

---

## 🔧 **Service Configuration**

### **Database (PostgreSQL)**
```yaml
# Default configuration in docker-compose.production.yml
POSTGRES_DB: pollarbase_prod
POSTGRES_USER: pollarbase
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

### **Cache/Queue (Redis)**
```yaml
# Configuration
REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
```

### **Application (FastAPI)**
```yaml
# Key environment variables
DATABASE_URL: postgresql://pollarbase:${POSTGRES_PASSWORD}@postgres:5432/pollarbase_prod
JWT_SECRET_KEY: ${JWT_SECRET_KEY}
ENVIRONMENT: production
DEBUG: false
```

---

## 📊 **Monitoring & Health Checks**

### **Health Check Endpoints**
```bash
# Application health
curl http://localhost:8000/health

# Database health
curl http://localhost:8000/api/v1/auth/status

# Service status
docker-compose -f docker-compose.production.yml ps
```

### **Monitoring Dashboard**
1. **Grafana**: http://localhost:3001
   - Username: admin
   - Password: (from environment.production)

2. **Prometheus**: http://localhost:9090
   - Metrics collection and alerting

### **Log Monitoring**
```bash
# Application logs
docker-compose -f docker-compose.production.yml logs -f pollarbase-api

# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f postgres
```

---

## 🔐 **Security Configuration**

### **JWT Configuration**
```bash
# Generate secure JWT secret (32+ characters)
JWT_SECRET_KEY="your-super-secure-jwt-secret-key-here"

# Token expiration (minutes)
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### **Database Security**
```bash
# Strong passwords required
POSTGRES_PASSWORD="your-secure-database-password"
REDIS_PASSWORD="your-secure-redis-password"
```

### **SSL/TLS (Production)**
```nginx
# Add to nginx.conf for HTTPS
server {
    listen 443 ssl;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://pollarbase-api:8000;
    }
}
```

---

## 🔄 **API Testing**

### **Authentication Flow**
```bash
# 1. Register user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "securepassword123",
    "first_name": "Test",
    "last_name": "User"
  }'

# 2. Login (get token)
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@example.com",
    "password": "securepassword123"
  }'

# 3. Use token
export TOKEN="your-access-token"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/auth/me
```

### **Data Processing Flow**
```bash
# 1. Upload file
curl -X POST http://localhost:8000/api/v1/data/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample.csv" \
  -F "name=Test Analysis" \
  -F "description=Sample data analysis"

# 2. List investigations
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/data/investigations

# 3. Get investigation details
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/data/investigations/{investigation_id}

# 4. Get quick insights
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/data/quick-insights/{investigation_id}
```

---

## 🐛 **Troubleshooting**

### **Common Issues**

#### **Database Connection Error**
```bash
# Check database status
docker-compose -f docker-compose.production.yml logs postgres

# Restart database
docker-compose -f docker-compose.production.yml restart postgres
```

#### **Authentication Issues**
```bash
# Check JWT secret configuration
echo $JWT_SECRET_KEY

# Verify user exists
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U pollarbase -d pollarbase_prod -c "SELECT * FROM users LIMIT 5;"
```

#### **File Upload Issues**
```bash
# Check upload directory permissions
docker-compose -f docker-compose.production.yml exec pollarbase-api \
  ls -la /app/uploads

# Check disk space
df -h
```

#### **Background Job Issues**
```bash
# Check Celery worker status
docker-compose -f docker-compose.production.yml logs celery-worker

# Restart workers
docker-compose -f docker-compose.production.yml restart celery-worker
```

### **Performance Issues**
```bash
# Check system resources
docker stats

# Scale workers
docker-compose -f docker-compose.production.yml up -d --scale celery-worker=4

# Monitor database performance
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U pollarbase -d pollarbase_prod -c "SELECT * FROM pg_stat_activity;"
```

---

## 📈 **Scaling & Optimization**

### **Horizontal Scaling**
```bash
# Scale API instances
docker-compose -f docker-compose.production.yml up -d --scale pollarbase-api=3

# Scale Celery workers
docker-compose -f docker-compose.production.yml up -d --scale celery-worker=6
```

### **Database Optimization**
```sql
-- Common optimizations
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_investigations_user_id ON data_investigations(created_by_id);
CREATE INDEX CONCURRENTLY idx_investigations_status ON data_investigations(status);
```

### **Redis Optimization**
```bash
# Monitor Redis
docker-compose -f docker-compose.production.yml exec redis redis-cli INFO memory

# Configure persistence
redis-server --appendonly yes --appendfsync everysec
```

---

## 🔄 **Backup & Recovery**

### **Database Backup**
```bash
# Create backup
docker-compose -f docker-compose.production.yml exec postgres \
  pg_dump -U pollarbase pollarbase_prod > backup_$(date +%Y%m%d).sql

# Restore backup
docker-compose -f docker-compose.production.yml exec -T postgres \
  psql -U pollarbase pollarbase_prod < backup_20241215.sql
```

### **File Backup**
```bash
# Backup uploaded files
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz ./uploads

# Backup configuration
tar -czf config_backup_$(date +%Y%m%d).tar.gz environment.production docker-compose.production.yml
```

---

## ✅ **Deployment Checklist**

### **Pre-Deployment**
- [ ] Environment variables configured
- [ ] Database credentials set
- [ ] JWT secrets generated
- [ ] SSL certificates ready (if using HTTPS)
- [ ] Backup strategy in place

### **Deployment**
- [ ] Docker services running
- [ ] Database migrations completed
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] SSL/TLS configured (production)

### **Post-Deployment**
- [ ] Create admin user
- [ ] Test authentication flow
- [ ] Test file upload/processing
- [ ] Verify monitoring dashboards
- [ ] Schedule backups
- [ ] Document access credentials

---

## 📞 **Support**

### **Logs Location**
- **Application**: `./logs/`
- **Docker**: `docker-compose logs`
- **Nginx**: `/var/log/nginx/`

### **Configuration Files**
- **Environment**: `environment.production`
- **Docker**: `docker-compose.production.yml`
- **Database**: `alembic.ini`

### **Monitoring**
- **Health**: `/health` endpoint
- **Metrics**: Prometheus dashboard
- **Dashboards**: Grafana interface

---

*For additional support or advanced configuration, refer to the Phase 1 Implementation Summary in the docs folder.* 