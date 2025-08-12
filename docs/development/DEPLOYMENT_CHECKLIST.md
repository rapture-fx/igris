# Deployment Checklist for Schlep-engine

Use this checklist to ensure a successful deployment of your Schlep-engine application.

## Pre-Deployment Checklist

### ✅ Environment Setup
- [ ] Node.js 18+ installed
- [ ] pnpm 8+ installed
- [ ] Vercel CLI installed (`npm install -g vercel`)
- [ ] Vercel account created and logged in
- [ ] Backend deployment platform account (Railway/Render/Heroku)

### ✅ Code Preparation
- [ ] All tests passing (`pnpm test`)
- [ ] Build successful locally (`pnpm build`)
- [ ] No TypeScript errors (`pnpm type-check`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Code committed to Git repository

### ✅ Configuration Files
- [ ] `vercel.json` created in root
- [ ] `packages/frontend/vercel.json` created
- [ ] `packages/admin/vercel.json` created
- [ ] `.vercelignore` created
- [ ] Environment variables documented

## Frontend Deployment (Vercel)

### ✅ Vercel Setup
- [ ] Vercel CLI installed and logged in
- [ ] Project linked to Vercel (`vercel link`)
- [ ] Environment variables configured in Vercel dashboard

### ✅ Frontend Deployment
- [ ] Navigate to `packages/frontend`
- [ ] Run `vercel --prod`
- [ ] Note the deployment URL
- [ ] Test the deployed application

### ✅ Admin Deployment
- [ ] Navigate to `packages/admin`
- [ ] Run `vercel --prod`
- [ ] Note the deployment URL
- [ ] Test the admin interface

### ✅ Environment Variables (Frontend)
- [ ] `NEXT_PUBLIC_APP_ENV=production`
- [ ] `NEXT_PUBLIC_API_URL=https://your-backend-url.com`
- [ ] `NEXT_PUBLIC_SUPABASE_URL=your-supabase-url`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key`
- [ ] `BACKEND_API_URL=https://your-backend-url.com`

## Backend Deployment

### ✅ Choose Platform
- [ ] Railway (recommended)
- [ ] Render
- [ ] Heroku
- [ ] DigitalOcean App Platform

### ✅ Backend Deployment Steps
- [ ] Platform CLI installed and logged in
- [ ] Navigate to `packages/backend`
- [ ] Deploy backend application
- [ ] Note the backend URL
- [ ] Test health endpoint (`/health`)

### ✅ Environment Variables (Backend)
- [ ] `DATABASE_URL=your-database-url`
- [ ] `SECRET_KEY=your-secret-key`
- [ ] `ALGORITHM=HS256`
- [ ] `ACCESS_TOKEN_EXPIRE_MINUTES=30`
- [ ] `BACKEND_CORS_ORIGINS=https://your-frontend-domain.vercel.app`
- [ ] `SUPABASE_URL=your-supabase-url`
- [ ] `SUPABASE_KEY=your-supabase-key`

## Database Setup

### ✅ Database Configuration
- [ ] Database created (PostgreSQL recommended)
- [ ] Connection string obtained
- [ ] Database URL set in backend environment variables
- [ ] Database migrations run successfully
- [ ] Test database connection

## Integration Testing

### ✅ API Connectivity
- [ ] Frontend can connect to backend API
- [ ] Admin can connect to backend API
- [ ] CORS properly configured
- [ ] Authentication working
- [ ] File upload functionality working

### ✅ End-to-End Testing
- [ ] User registration/login flow
- [ ] Data upload and processing
- [ ] Admin dashboard functionality
- [ ] Error handling and user feedback
- [ ] Mobile responsiveness

## Post-Deployment

### ✅ Monitoring Setup
- [ ] Vercel Analytics enabled
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Uptime monitoring set up
- [ ] Performance monitoring configured

### ✅ Security
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Environment variables encrypted
- [ ] API rate limiting configured
- [ ] CORS origins restricted

### ✅ Documentation
- [ ] Deployment URLs documented
- [ ] Environment variables documented
- [ ] Troubleshooting guide created
- [ ] Team access configured

## Custom Domain Setup (Optional)

### ✅ Domain Configuration
- [ ] Custom domain purchased
- [ ] DNS records configured
- [ ] SSL certificate obtained
- [ ] Domain verified in Vercel
- [ ] Domain tested and working

## Performance Optimization

### ✅ Optimization Checks
- [ ] Images optimized
- [ ] Code splitting configured
- [ ] Caching headers set
- [ ] Bundle size analyzed
- [ ] Core Web Vitals optimized

## Backup and Recovery

### ✅ Backup Strategy
- [ ] Database backup configured
- [ ] Environment variables backed up
- [ ] Recovery procedures documented
- [ ] Rollback plan created

## Team Access

### ✅ Access Management
- [ ] Team members added to Vercel
- [ ] Backend platform access configured
- [ ] Database access configured
- [ ] Monitoring access configured

## Final Verification

### ✅ Production Readiness
- [ ] All functionality working in production
- [ ] Performance acceptable
- [ ] Security measures in place
- [ ] Monitoring active
- [ ] Team trained on deployment process

## Troubleshooting Notes

### Common Issues and Solutions

1. **Build Failures**
   - Check Node.js version
   - Verify all dependencies
   - Check for TypeScript errors

2. **API Connection Issues**
   - Verify backend URL
   - Check CORS configuration
   - Test backend health endpoint

3. **Environment Variables**
   - Verify all variables set
   - Check for typos
   - Ensure proper prefixes (`NEXT_PUBLIC_`)

4. **Database Issues**
   - Verify connection string
   - Check database accessibility
   - Run migrations

## Emergency Contacts

- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Backend Platform Support**: (Platform-specific)
- **Database Provider Support**: (Provider-specific)

## Deployment URLs

- **Frontend**: `https://your-app.vercel.app`
- **Admin**: `https://your-admin.vercel.app`
- **Backend**: `https://your-backend-url.com`
- **Documentation**: `https://your-docs-url.com`

---

**Last Updated**: [Date]
**Deployed By**: [Name]
**Version**: [Version Number] 