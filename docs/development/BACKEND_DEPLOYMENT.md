# Backend Deployment Guide for Schlep-engine

Since Vercel is primarily for frontend applications, you'll need to deploy the Python FastAPI backend separately. This guide covers deployment options for the backend.

## Deployment Options

### 1. Railway (Recommended)

Railway is a modern platform that makes it easy to deploy Python applications with automatic scaling.

#### Prerequisites
- Railway account at [railway.app](https://railway.app)
- Railway CLI: `npm install -g @railway/cli`

#### Deployment Steps

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Navigate to backend directory**
   ```bash
   cd packages/backend
   ```

4. **Initialize Railway project**
   ```bash
   railway init
   ```

5. **Deploy**
   ```bash
   railway up
   ```

6. **Get the deployment URL**
   ```bash
   railway domain
   ```

#### Environment Variables in Railway

Set these environment variables in Railway dashboard:

```env
DATABASE_URL=your-database-url
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
BACKEND_CORS_ORIGINS=https://your-frontend-domain.vercel.app
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
```

### 2. Render

Render provides a free tier and is great for Python applications.

#### Prerequisites
- Render account at [render.com](https://render.com)

#### Deployment Steps

1. **Connect your GitHub repository**
2. **Create a new Web Service**
3. **Configure the service:**
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment**: Python 3.11

#### Environment Variables in Render

Set the same environment variables as listed above in the Render dashboard.

### 3. Heroku

Heroku is a traditional choice for Python applications.

#### Prerequisites
- Heroku account at [heroku.com](https://heroku.com)
- Heroku CLI: `npm install -g heroku`

#### Deployment Steps

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Navigate to backend directory**
   ```bash
   cd packages/backend
   ```

4. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

5. **Add buildpacks**
   ```bash
   heroku buildpacks:add heroku/python
   ```

6. **Deploy**
   ```bash
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   ```

#### Environment Variables in Heroku

```bash
heroku config:set DATABASE_URL=your-database-url
heroku config:set SECRET_KEY=your-secret-key
heroku config:set ALGORITHM=HS256
heroku config:set ACCESS_TOKEN_EXPIRE_MINUTES=30
heroku config:set BACKEND_CORS_ORIGINS=https://your-frontend-domain.vercel.app
```

### 4. DigitalOcean App Platform

DigitalOcean App Platform provides good performance and pricing.

#### Prerequisites
- DigitalOcean account at [digitalocean.com](https://digitalocean.com)

#### Deployment Steps

1. **Connect your GitHub repository**
2. **Create a new App**
3. **Select Python as the environment**
4. **Configure:**
   - **Build Command**: `pip install -r requirements.txt`
   - **Run Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Database Setup

### Option 1: Railway PostgreSQL

1. Create a new PostgreSQL service in Railway
2. Get the connection string
3. Set as `DATABASE_URL` environment variable

### Option 2: Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Get the connection string from Settings > Database
3. Set as `DATABASE_URL` environment variable

### Option 3: PlanetScale

1. Create a database at [planetscale.com](https://planetscale.com)
2. Get the connection string
3. Set as `DATABASE_URL` environment variable

## Environment Variables Reference

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Security
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
BACKEND_CORS_ORIGINS=https://your-frontend-domain.vercel.app

# Supabase (if using)
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key

# Optional
DEBUG=false
LOG_LEVEL=INFO
```

### Optional Environment Variables

```env
# Email (if using email features)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# File Storage (if using cloud storage)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket-name

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

## Health Check Endpoint

The backend includes a health check endpoint at `/health` that you can use to verify deployment:

```bash
curl https://your-backend-url.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## CORS Configuration

Make sure to update the `BACKEND_CORS_ORIGINS` environment variable with your frontend domain:

```env
BACKEND_CORS_ORIGINS=https://your-app.vercel.app,https://your-admin.vercel.app
```

## Monitoring and Logs

### Railway
```bash
railway logs
```

### Render
- View logs in the Render dashboard
- Set up log forwarding to external services

### Heroku
```bash
heroku logs --tail
```

### DigitalOcean
- View logs in the DigitalOcean dashboard
- Set up log forwarding

## Scaling Considerations

### Railway
- Automatic scaling based on traffic
- Manual scaling available in dashboard

### Render
- Free tier: 750 hours/month
- Paid plans for more resources

### Heroku
- Free tier discontinued
- Paid plans start at $7/month

### DigitalOcean
- Pay-as-you-go pricing
- Automatic scaling available

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Python version compatibility
   - Verify all dependencies in requirements.txt
   - Check for missing system dependencies

2. **Database Connection Issues**
   - Verify DATABASE_URL format
   - Check database accessibility
   - Ensure SSL requirements are met

3. **CORS Errors**
   - Verify BACKEND_CORS_ORIGINS includes frontend domain
   - Check for trailing slashes in URLs
   - Ensure HTTPS is used in production

4. **Environment Variables**
   - Verify all required variables are set
   - Check for typos in variable names
   - Ensure sensitive data is properly encrypted

### Debug Commands

```bash
# Check application status
curl https://your-backend-url.com/health

# Check logs
# (Use platform-specific commands above)

# Test database connection
# (Add database connection test to your application)
```

## Security Best Practices

1. **Environment Variables**: Never commit sensitive data
2. **Database**: Use connection pooling and SSL
3. **CORS**: Restrict origins to your domains only
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **Monitoring**: Set up error tracking and monitoring

## Cost Optimization

1. **Railway**: Pay-per-use, good for variable traffic
2. **Render**: Free tier available, good for small projects
3. **Heroku**: Traditional choice, predictable pricing
4. **DigitalOcean**: Good performance/price ratio

## Next Steps

After backend deployment:

1. Update frontend environment variables with backend URL
2. Test API connectivity from frontend
3. Set up monitoring and alerting
4. Configure CI/CD for automatic deployments
5. Set up staging environment 