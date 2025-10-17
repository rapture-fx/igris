# Vercel Deployment Guide for Schlep-engine

This guide will help you deploy the Schlep-engine frontend and admin applications to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm install -g vercel`
3. **Node.js**: Version 18 or higher
4. **pnpm**: Version 8 or higher

## Project Structure

```
Schlep-engine/
├── packages/
│   ├── frontend/     # Main Next.js application
│   ├── admin/        # Admin Next.js application
│   └── backend/      # Python FastAPI (deploy separately)
├── vercel.json       # Root Vercel configuration
└── scripts/
    └── deploy-vercel.sh  # Deployment script
```

## Quick Deployment

### Option 1: Using the Deployment Script

```bash
# Make sure you're in the project root
cd /path/to/Schlep-engine

# Run the deployment script
./scripts/deploy-vercel.sh
```

### Option 2: Manual Deployment

```bash
# Install dependencies
pnpm install

# Build applications
pnpm build

# Deploy frontend
cd packages/frontend
vercel --prod

# Deploy admin
cd ../admin
vercel --prod
```

## Environment Variables

Set these environment variables in your Vercel dashboard:

### Frontend Environment Variables

```env
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
BACKEND_API_URL=https://your-backend-url.com
```

### Admin Environment Variables

```env
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_API_URL=https://your-backend-url.com
BACKEND_API_URL=https://your-backend-url.com
```

## Backend Deployment

Since Vercel is primarily for frontend applications, you'll need to deploy the Python FastAPI backend separately. Recommended platforms:

1. **Railway**: Easy deployment with automatic scaling
2. **Render**: Free tier available, good for Python apps
3. **Heroku**: Traditional choice for Python applications
4. **DigitalOcean App Platform**: Good performance and pricing

### Backend Deployment Steps

1. Deploy the backend to your chosen platform
2. Get the production URL
3. Update the `BACKEND_API_URL` environment variable in Vercel
4. Update the `NEXT_PUBLIC_API_URL` environment variable

## Custom Domains

### Setting up Custom Domains

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings > Domains
4. Add your custom domain
5. Update DNS records as instructed

### Recommended Domain Structure

- Frontend: `app.yourdomain.com` or `yourdomain.com`
- Admin: `admin.yourdomain.com`

## Configuration Files

### Root vercel.json

```json
{
  "version": 2,
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "functions": {
    "packages/frontend/src/app/api/**/*.ts": {
      "runtime": "nodejs18.x"
    },
    "packages/admin/src/app/api/**/*.ts": {
      "runtime": "nodejs18.x"
    }
  },
  "rewrites": [
    {
      "source": "/admin/(.*)",
      "destination": "/packages/admin/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Frontend vercel.json

```json
{
  "version": 2,
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "src/app/api/**/*.ts": {
      "runtime": "nodejs18.x"
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version (should be 18+)
   - Ensure all dependencies are installed
   - Check for TypeScript errors

2. **Environment Variables**
   - Verify all required env vars are set in Vercel dashboard
   - Check that `NEXT_PUBLIC_` prefix is used for client-side variables

3. **API Connection Issues**
   - Ensure backend is deployed and accessible
   - Check CORS configuration on backend
   - Verify API URLs are correct

4. **Monorepo Issues**
   - Ensure pnpm workspaces are configured correctly
   - Check that all packages have proper build scripts

### Debug Commands

```bash
# Check Vercel CLI version
vercel --version

# Check if logged in
vercel whoami

# List projects
vercel ls

# Check build logs
vercel logs

# Pull environment variables
vercel env pull
```

## Performance Optimization

### Vercel-specific Optimizations

1. **Image Optimization**: Use Next.js Image component with Vercel's image optimization
2. **Edge Functions**: Consider using Edge Functions for API routes
3. **Caching**: Configure appropriate cache headers
4. **CDN**: Vercel automatically provides global CDN

### Monitoring

1. **Vercel Analytics**: Enable in dashboard for performance insights
2. **Error Tracking**: Set up error monitoring (Sentry, etc.)
3. **Uptime Monitoring**: Use external services for uptime monitoring

## Security Considerations

1. **Environment Variables**: Never commit sensitive data
2. **API Keys**: Use Vercel's environment variable encryption
3. **CORS**: Configure CORS properly on backend
4. **Headers**: Use security headers (already configured in next.config.js)

## Cost Optimization

1. **Free Tier**: Vercel provides generous free tier
2. **Pro Plan**: Consider for custom domains and team features
3. **Enterprise**: For large-scale deployments

## Support

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js Documentation**: [nextjs.org/docs](https://nextjs.org/docs)
- **Project Issues**: Check GitHub issues for project-specific problems

## Next Steps

After successful deployment:

1. Set up monitoring and analytics
2. Configure CI/CD pipeline
3. Set up staging environment
4. Implement backup strategies
5. Plan for scaling 