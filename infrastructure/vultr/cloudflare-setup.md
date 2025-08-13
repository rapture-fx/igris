# 🌐 Cloudflare Setup for Schlep Engine

## Step 1: Add Domain to Cloudflare

1. **Sign up** at [cloudflare.com](https://cloudflare.com) if you haven't already
2. **Add Site**: Enter `schlep-engine.com`
3. **Choose Plan**: Free tier is sufficient for startup
4. **Review DNS Records**: Cloudflare will scan existing records

## Step 2: Update Nameservers

**At Namecheap**:
1. **Login** to Namecheap account
2. **Domain List** → `schlep-engine.com` → **Manage**
3. **Nameservers** → **Custom DNS**
4. **Enter Cloudflare nameservers** (provided by Cloudflare):
   ```
   anya.ns.cloudflare.com
   chad.ns.cloudflare.com
   ```
5. **Save changes** (takes 24-48 hours to propagate)

## Step 3: Configure DNS Records

**In Cloudflare Dashboard** → DNS → Records:

```
Type    Name      Content                    TTL     Proxy
A       @         45.77.44.216               Auto    ✅ Proxied
CNAME   www       schlep-engine.com          Auto    ✅ Proxied
CNAME   api       schlep-engine.com          Auto    ✅ Proxied
CNAME   admin     schlep-engine.com          Auto    ✅ Proxied
CNAME   docs      schlep-engine.com          Auto    ✅ Proxied
```

**Note**: All subdomains point to the main domain, Nginx on your server will handle routing.

## Step 4: SSL Configuration

**Cloudflare** → SSL/TLS → Overview:
1. **Encryption mode**: **Full (Strict)**
2. **Always Use HTTPS**: **On**
3. **Automatic HTTPS Rewrites**: **On**
4. **Minimum TLS Version**: **TLS 1.2**

## Step 5: Generate Origin Certificate

**Cloudflare** → SSL/TLS → Origin Server:
1. **Create Certificate**
2. **Hostnames**: 
   ```
   schlep-engine.com
   *.schlep-engine.com
   ```
3. **Key type**: RSA (2048)
4. **Certificate Validity**: 15 years
5. **Download** both certificate and private key

**Save certificates on your server**:
```bash
# On your Hetzner server
sudo mkdir -p /home/deploy/schlep-engine/infrastructure/hetzner/ssl

# Copy the certificate content to:
sudo nano /home/deploy/schlep-engine/infrastructure/hetzner/ssl/cloudflare.crt

# Copy the private key content to:
sudo nano /home/deploy/schlep-engine/infrastructure/hetzner/ssl/cloudflare.key

# Set proper permissions
sudo chown -R deploy:deploy /home/deploy/schlep-engine/infrastructure/hetzner/ssl
sudo chmod 600 /home/deploy/schlep-engine/infrastructure/hetzner/ssl/*
```

## Step 6: Security Settings

**Cloudflare** → Security:

### **WAF (Web Application Firewall)**
- **Managed Rules**: Enable
- **Rate Limiting**: 10,000 requests per 10 minutes per IP

### **Bot Fight Mode**
- **Enable Bot Fight Mode**

### **Security Level**
- **Set to**: Medium

### **DDoS Protection**
- **Enabled by default** (no configuration needed)

## Step 7: Performance Optimization

**Cloudflare** → Speed:

### **Optimization**
- **Auto Minify**: Enable CSS, JavaScript, HTML
- **Rocket Loader**: Enable
- **Mirage**: Enable (Pro plan feature)

### **Caching**
- **Caching Level**: Standard
- **Browser Cache TTL**: 4 hours
- **Always Online**: Enable

## Step 8: Page Rules (Optional - Free tier gets 3 rules)

**Cloudflare** → Rules → Page Rules:

1. **API Caching Rule**:
   ```
   URL: api.schlep-engine.com/api/v1/static/*
   Settings: Cache Level = Cache Everything, Edge Cache TTL = 1 month
   ```

2. **Admin Security Rule**:
   ```
   URL: admin.schlep-engine.com/*
   Settings: Security Level = High, Browser Integrity Check = On
   ```

3. **Landing Page Cache**:
   ```
   URL: schlep-engine.com/*
   Settings: Cache Level = Standard, Browser Cache TTL = 4 hours
   ```

## Step 9: Analytics & Monitoring

**Cloudflare** → Analytics:
- **Enable Web Analytics**: Free insights into traffic
- **Set up Email Alerts**: For security events

## Step 10: Verification

Once nameservers propagate (24-48 hours):

```bash
# Check DNS propagation
nslookup schlep-engine.com
nslookup api.schlep-engine.com
nslookup admin.schlep-engine.com
nslookup docs.schlep-engine.com

# Check SSL
curl -I https://schlep-engine.com
curl -I https://api.schlep-engine.com
```

## Benefits You Get

✅ **Free SSL certificates** for all subdomains
✅ **DDoS protection** and bot mitigation
✅ **CDN acceleration** worldwide
✅ **DNS management** with 100% uptime SLA
✅ **Web Application Firewall**
✅ **Analytics and monitoring**
✅ **Bandwidth savings** (gzip, minification)
✅ **Always Online** mode during server maintenance

## Cost Comparison

**Cloudflare Free**: $0/month
- SSL certificates
- Basic DDoS protection  
- Global CDN
- 3 Page Rules
- Basic analytics

**Cloudflare Pro**: $20/month
- Advanced security
- Image optimization
- Mobile optimization
- 20 Page Rules
- Detailed analytics

**Without Cloudflare**: You'd need:
- SSL certificates: ~$50/year
- DDoS protection: ~$50/month
- CDN service: ~$30/month
- **Total**: ~$110/month vs $0-20/month with Cloudflare

This setup gives you enterprise-grade CDN and security for free!