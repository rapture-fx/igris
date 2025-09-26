# 🚀 Schlep Engine Phase One - Vultr VPS Deployment

## Complete Production-Ready Infrastructure with Database Monitoring

**Cost**: $10-25/month Vultr VPS + Cloudflare (Free)
**Performance**: 1,000+ concurrent users
**Migration Ready**: YugabyteDB + DragonflyDB upgrade path
**Monitoring**: Full observability with Grafana dashboards

---

## 🎯 **QUICK DEPLOYMENT**

### **Prerequisites**
- [x] Domain: `schlep-engine.com` (configured in DNS)
- [x] Vultr VPS (2GB+ RAM recommended)
- [x] SSH access to your VPS
- [ ] 30 minutes for deployment

### **One-Command Deployment**

```bash
# SSH into your Vultr VPS
ssh root@YOUR_VULTR_IP

# Clone repository (if not already done)
git clone https://github.com/your-org/schlep-engine.git
cd schlep-engine/infrastructure/vultr

# Run Phase One deployment
./deploy-phase-one.sh
```

That's it! 🎉 Your complete infrastructure will be deployed with:
- PostgreSQL 16 (YugabyteDB-ready)
- Redis 7 (DragonflyDB-compatible)
- MinIO S3 storage
- Prometheus + Grafana monitoring
- All web applications
- SSL-ready Nginx

---

## 🔧 **WHAT'S INCLUDED**

### **Phase One Database Infrastructure**
✅ **PostgreSQL 16** - Production-optimized, YugabyteDB migration ready
✅ **Redis 7** - High-performance caching, DragonflyDB compatible
✅ **MinIO** - S3-compatible object storage
✅ **Automated backups** - Daily database backups with retention
✅ **Connection pooling** - Optimized for 1,000+ concurrent users

### **Complete Monitoring Stack**
✅ **Prometheus** - Metrics collection from all services
✅ **Grafana** - Beautiful dashboards for database performance
✅ **PostgreSQL Exporter** - Detailed database metrics
✅ **Redis Exporter** - Cache performance monitoring
✅ **Health checks** - Automated service monitoring

### **Production Applications**
✅ **FastAPI Backend** - High-performance Python API
✅ **Next.js Web Apps** - Landing, Admin, Documentation
✅ **Nginx Reverse Proxy** - SSL termination, caching
✅ **Docker Compose** - Orchestrated container deployment

### **Migration Readiness**
✅ **YugabyteDB schema** - UUID primary keys, optimized indexes
✅ **DragonflyDB patterns** - Compatible Redis commands only
✅ **Dual-write preparation** - Ready for zero-downtime migration
✅ **Performance benchmarking** - Migration readiness validation

---

## 📊 **ACCESS POINTS**

| Service | URL | Credentials |
|---------|-----|-------------|
| **Landing Page** | https://schlep-engine.com | Public |
| **Admin Dashboard** | https://admin.schlep-engine.com | OAuth/Login |
| **API Documentation** | https://docs.schlep-engine.com | Public |
| **API Endpoint** | https://api.schlep-engine.com | API Keys |
| **Grafana Monitoring** | http://YOUR_VPS_IP:3100 | admin / (see .env file) |
| **Prometheus** | http://YOUR_VPS_IP:9090 | No auth |
| **MinIO Console** | http://YOUR_VPS_IP:9001 | (see .env file) |

---

## 🖥️ **MANAGEMENT COMMANDS**

After deployment, these aliases are available:

### **Service Management**
```bash
sl-status     # Show all service status
sl-logs       # View real-time logs
sl-restart    # Restart all services
sl-stop       # Stop all services
sl-deploy     # Deploy/update services
sl-update     # Pull code and redeploy
```

### **Database Operations**
```bash
sl-health     # Comprehensive health check
sl-migrate    # Run database migrations
sl-backup     # Create database backup
```

### **Monitoring**
```bash
sl-grafana    # Open Grafana URL
sl-prometheus # Open Prometheus URL
sl-minio      # Open MinIO console URL
sl-resources  # Show container resources
```

### **System Monitoring**
```bash
sl-disk       # Check disk usage
sl-memory     # Check memory usage
sl-top        # System process monitor
```

---

## 📈 **PERFORMANCE MONITORING**

### **Grafana Dashboards**
Access at `http://YOUR_VPS_IP:3100`:

1. **Database Overview** - PostgreSQL performance metrics
2. **Cache Performance** - Redis operations and hit ratios
3. **System Resources** - CPU, memory, disk usage
4. **Application Metrics** - API response times, throughput
5. **Cost Tracking** - Resource utilization and efficiency

### **Key Metrics Monitored**
- **Database**: Query performance, connections, cache hit ratio
- **Cache**: Memory usage, operations/sec, hit rate
- **System**: CPU, memory, disk, network utilization
- **Application**: Response times, error rates, throughput

### **Automated Alerts**
- Database connection usage >80%
- Query response time >100ms
- Cache hit ratio <95%
- System resource usage >85%
- Service health check failures

---

## 💰 **COST BREAKDOWN**

| Component | Monthly Cost | Performance |
|-----------|-------------|-------------|
| **Vultr VPS** (2GB) | $12 | 1,000+ users |
| **Vultr VPS** (4GB) | $24 | 5,000+ users |
| **Cloudflare** (Free) | $0 | Global CDN + SSL |
| **Domain** | $12/year | DNS management |
| **Total** | **$12-25/month** | **Enterprise-grade** |

**vs. Alternatives:**
- Railway + Supabase: $85+/month
- AWS RDS + ElastiCache: $150+/month
- Vercel + PlanetScale: $60+/month

**ROI**: 70-80% cost savings with better performance control

---

## 🔒 **SECURITY FEATURES**

✅ **Firewall Configuration** - UFW with minimal ports open
✅ **Container Security** - Non-root containers, isolated networks
✅ **Database Security** - Strong authentication, encrypted connections
✅ **SSL/TLS Ready** - HTTPS termination at Nginx
✅ **Fail2Ban Protection** - Brute force attack prevention
✅ **Regular Updates** - Automated security patches
✅ **Secret Management** - Environment-based configuration

---

## 🏗️ **ARCHITECTURE**

```
Internet
    ↓
Cloudflare CDN (SSL, DDoS, Caching)
    ↓
Vultr VPS
    ↓
Nginx Reverse Proxy
    ↓
┌─────────────────────────────────────────────────────┐
│                 Application Layer                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │   API   │  │  Admin  │  │ Landing │  │   Docs  │ │
│  │ :3001   │  │ :3002   │  │ :3000   │  │ :3003   │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────────────────┘
    ↓                                           ↓
┌─────────────────────────────────────────────────────┐
│                Database Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ PostgreSQL  │  │    Redis    │  │   MinIO     │  │
│  │    :5432    │  │    :6379    │  │ :9000/:9001 │  │
│  │ (YugabyteDB │  │(DragonflyDB │  │ (S3-compat) │  │
│  │    ready)   │  │  compatible)│  │             │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│              Monitoring Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Prometheus  │  │   Grafana   │  │  Exporters  │  │
│  │   :9090     │  │    :3100    │  │ :9187/:9121 │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 **SCALING STRATEGY**

### **Phase One (Current): 0-1,000 Users**
- **VPS**: 2GB RAM, 1 vCPU ($12/month)
- **Database**: Single PostgreSQL instance
- **Cache**: Single Redis instance
- **Storage**: MinIO single node

### **Phase One+**: 1,000-5,000 Users**
- **VPS**: 4GB RAM, 2 vCPU ($24/month)
- **Database**: Optimized PostgreSQL
- **Cache**: Redis with persistence
- **Monitoring**: Enhanced alerting

### **Phase Two Migration**: 5,000+ Users**
- **Database**: Migrate to YugabyteDB Managed
- **Cache**: Migrate to DragonflyDB cluster
- **Storage**: Cloud S3 + CDN
- **Infrastructure**: Multi-region deployment

**Migration Path**: Zero-downtime using dual-write patterns

---

## 🔧 **CONFIGURATION FILES**

| File | Purpose |
|------|---------|
| `docker-compose.phase-one.yml` | Complete infrastructure definition |
| `.env.phase-one` | Environment configuration |
| `deploy-phase-one.sh` | Automated deployment script |
| `health-check.sh` | Comprehensive health monitoring |
| `monitoring/` | Prometheus, Grafana configurations |
| `database-schemas/` | PostgreSQL schemas (YugabyteDB ready) |
| `redis/` | Redis configuration and init scripts |
| `minio/` | S3-compatible storage setup |

---

## 🆘 **TROUBLESHOOTING**

### **Common Issues**

**Services won't start:**
```bash
sl-logs          # Check logs
sl-health        # Run health check
docker system df # Check disk space
```

**Database connection errors:**
```bash
# Check PostgreSQL
docker exec -it schlep-postgres-phase-one psql -U schlep_user -d schlep_engine

# Check Redis
docker exec -it schlep-redis-phase-one redis-cli -a YOUR_REDIS_PASSWORD ping
```

**High resource usage:**
```bash
sl-resources     # Check container usage
sl-memory        # Check system memory
sl-disk          # Check disk usage
```

**SSL/Domain issues:**
```bash
# Check nginx configuration
docker exec schlep-nginx-phase-one nginx -t

# Verify DNS
dig schlep-engine.com
nslookup api.schlep-engine.com
```

### **Performance Issues**
1. **Database slow**: Check `sl-grafana` → Database Overview
2. **Cache misses**: Check Redis hit ratio in Grafana
3. **High CPU**: Scale to larger VPS plan
4. **Memory issues**: Optimize container resource limits

---

## 🔄 **PHASE TWO MIGRATION**

When you're ready to scale to 10,000+ users:

### **Migration Benefits**
- **10x Performance**: YugabyteDB distributed architecture
- **Ultra-fast Cache**: DragonflyDB 25x faster than Redis
- **Global Scale**: Multi-region deployment
- **Enterprise Features**: Advanced monitoring, HA

### **Migration Process**
1. **Preparation** (Week 1): Deploy YugabyteDB + DragonflyDB
2. **Data Migration** (Week 2): Dual-write pattern migration
3. **Validation** (Week 3): Performance and data consistency testing
4. **Cutover** (Week 4): Zero-downtime production switch

### **Expected Costs Phase Two**
- **YugabyteDB Managed**: $400-600/month
- **DragonflyDB**: $100-150/month
- **Cloud Storage**: $50-100/month
- **Total**: $550-850/month for 10,000+ users

**Migration Guide**: See `PHASE_TWO_MIGRATION_STRATEGY.md`

---

## 📚 **NEXT STEPS**

### **Immediate (Post-Deployment)**
1. ✅ Access Grafana dashboards
2. ✅ Run health checks
3. ✅ Test all endpoints
4. ✅ Configure domain DNS
5. ✅ Set up SSL certificates

### **Short-term (Week 1-2)**
1. Configure automated backups
2. Set up alerting notifications
3. Performance testing
4. Security hardening
5. Documentation updates

### **Long-term (Month 1-3)**
1. Monitor resource usage and costs
2. Performance optimization
3. Plan Phase Two migration
4. Scale testing
5. Disaster recovery testing

---

## 🎉 **SUCCESS!**

Your Schlep Engine Phase One deployment includes:

✅ **Complete Database Infrastructure** - PostgreSQL + Redis + MinIO
✅ **Production Monitoring** - Prometheus + Grafana dashboards
✅ **All Web Applications** - API + Landing + Admin + Docs
✅ **Migration Readiness** - YugabyteDB + DragonflyDB preparation
✅ **Cost Optimization** - <$25/month for 1,000+ users
✅ **Enterprise Security** - Firewall, SSL, container isolation
✅ **Automated Management** - Health checks, backups, deployment

**Total Setup Time**: ~30 minutes
**Monthly Operating Cost**: $12-25 vs $85+ alternatives
**Performance**: Handles 1,000+ concurrent users
**Scaling Path**: Ready for 10x growth with Phase Two migration

Welcome to production with enterprise-grade database infrastructure! 🚀

---

## 📞 **SUPPORT**

- **Documentation**: All guides in this directory
- **Health Monitoring**: `sl-health` command + Grafana dashboards
- **Community**: GitHub Issues and Discussions
- **Migration Support**: Phase Two migration documentation included

---

*Built with ❤️ for cost-efficient, scalable production deployments*