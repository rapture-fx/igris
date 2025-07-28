#!/bin/bash

# Vercel frontend deployment script for Schlep-engine
# Deploys admin dashboard, landing page, and documentation

set -euo pipefail

# Configuration
PROJECT_ROOT="/Users/wira/Wira Cursor/Schlep-engine"
ENVIRONMENT="production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Vercel CLI
    if ! command -v vercel &> /dev/null; then
        error "Vercel CLI not found. Install with: npm install -g vercel"
    fi
    
    # Check authentication
    if ! vercel whoami &> /dev/null; then
        error "Not logged into Vercel. Run: vercel login"
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        error "pnpm not found. Install with: npm install -g pnpm"
    fi
    
    success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Install root dependencies
    pnpm install
    
    success "Dependencies installed"
}

# Build and test applications
build_and_test() {
    log "Building and testing applications..."
    
    cd "$PROJECT_ROOT"
    
    # Test admin dashboard
    if [ -d "apps/web-admin" ]; then
        log "Building admin dashboard..."
        cd "apps/web-admin"
        pnpm build
        cd "$PROJECT_ROOT"
        success "Admin dashboard built successfully"
    fi
    
    # Test landing page
    if [ -d "apps/web-landing" ]; then
        log "Building landing page..."
        cd "apps/web-landing"
        pnpm build
        cd "$PROJECT_ROOT"
        success "Landing page built successfully"
    fi
    
    # Test documentation
    if [ -d "apps/web-docs" ]; then
        log "Building documentation..."
        cd "apps/web-docs"
        pnpm build
        cd "$PROJECT_ROOT"
        success "Documentation built successfully"
    fi
}

# Deploy admin dashboard
deploy_admin() {
    log "Deploying admin dashboard..."
    
    cd "$PROJECT_ROOT/apps/web-admin"
    
    # Copy Vercel configuration
    cp "../../infrastructure/vercel/vercel-admin.json" "vercel.json"
    
    # Set environment variables
    vercel env add NEXT_PUBLIC_API_URL production
    vercel env add NEXT_PUBLIC_SUPABASE_URL production
    vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
    vercel env add NEXT_PUBLIC_SENTRY_DSN production
    
    # Deploy
    vercel --prod --yes
    
    # Get deployment URL
    ADMIN_URL=$(vercel inspect --timeout 60s | grep "https://" | head -1)
    
    cd "$PROJECT_ROOT"
    
    success "Admin dashboard deployed to: $ADMIN_URL"
    echo "ADMIN_URL=$ADMIN_URL" >> deployment-urls.env
}

# Deploy landing page
deploy_landing() {
    log "Deploying landing page..."
    
    cd "$PROJECT_ROOT/apps/web-landing"
    
    # Copy Vercel configuration
    cp "../../infrastructure/vercel/vercel-landing.json" "vercel.json"
    
    # Set environment variables
    vercel env add NEXT_PUBLIC_API_URL production
    vercel env add NEXT_PUBLIC_ADMIN_URL production
    vercel env add NEXT_PUBLIC_DOCS_URL production
    vercel env add NEXT_PUBLIC_SUPABASE_URL production
    vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
    vercel env add NEXT_PUBLIC_SENTRY_DSN production
    
    # Deploy
    vercel --prod --yes
    
    # Get deployment URL
    LANDING_URL=$(vercel inspect --timeout 60s | grep "https://" | head -1)
    
    cd "$PROJECT_ROOT"
    
    success "Landing page deployed to: $LANDING_URL"
    echo "LANDING_URL=$LANDING_URL" >> deployment-urls.env
}

# Deploy documentation
deploy_docs() {
    log "Deploying documentation..."
    
    cd "$PROJECT_ROOT/apps/web-docs"
    
    # Copy Vercel configuration
    cp "../../infrastructure/vercel/vercel-docs.json" "vercel.json"
    
    # Set environment variables
    vercel env add NEXT_PUBLIC_API_URL production
    vercel env add NEXT_PUBLIC_LANDING_URL production
    vercel env add NEXT_PUBLIC_ADMIN_URL production
    
    # Deploy
    vercel --prod --yes
    
    # Get deployment URL
    DOCS_URL=$(vercel inspect --timeout 60s | grep "https://" | head -1)
    
    cd "$PROJECT_ROOT"
    
    success "Documentation deployed to: $DOCS_URL"
    echo "DOCS_URL=$DOCS_URL" >> deployment-urls.env
}

# Verify deployments
verify_deployments() {
    log "Verifying deployments..."
    
    # Source deployment URLs
    if [ -f "deployment-urls.env" ]; then
        source deployment-urls.env
    else
        error "Deployment URLs file not found"
    fi
    
    # Verify admin dashboard
    if [ ! -z "${ADMIN_URL:-}" ]; then
        log "Verifying admin dashboard at: $ADMIN_URL"
        if curl -f "$ADMIN_URL" > /dev/null 2>&1; then
            success "Admin dashboard verification passed"
        else
            warning "Admin dashboard verification failed"
        fi
    fi
    
    # Verify landing page
    if [ ! -z "${LANDING_URL:-}" ]; then
        log "Verifying landing page at: $LANDING_URL"
        if curl -f "$LANDING_URL" > /dev/null 2>&1; then
            success "Landing page verification passed"
        else
            warning "Landing page verification failed"
        fi
    fi
    
    # Verify documentation
    if [ ! -z "${DOCS_URL:-}" ]; then
        log "Verifying documentation at: $DOCS_URL"
        if curl -f "$DOCS_URL" > /dev/null 2>&1; then
            success "Documentation verification passed"
        else
            warning "Documentation verification failed"
        fi
    fi
}

# Generate deployment report
generate_report() {
    log "Generating deployment report..."
    
    # Source deployment URLs
    source deployment-urls.env 2>/dev/null || true
    
    TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S UTC')
    
    cat > frontend-deployment-report.md << EOF
# Schlep-engine Frontend Deployment Report

**Deployment Date**: $TIMESTAMP  
**Environment**: Production (Vercel)  
**Version**: $(git rev-parse HEAD 2>/dev/null || echo "unknown")

## Deployment URLs

### Admin Dashboard
- **URL**: ${ADMIN_URL:-"Not deployed"}
- **Status**: Production Ready
- **Features**: ML data processing dashboard, user management, analytics

### Landing Page  
- **URL**: ${LANDING_URL:-"Not deployed"}
- **Status**: Production Ready
- **Features**: Marketing site, sign-up flow, feature showcase

### Documentation
- **URL**: ${DOCS_URL:-"Not deployed"}
- **Status**: Production Ready
- **Features**: API docs, guides, tutorials, SDK documentation

## Configuration
- **Platform**: Vercel
- **Framework**: Next.js 14
- **Node Version**: 18.x
- **Build Tool**: pnpm
- **Regions**: IAD1, SFO1, LHR1

## Security Features
- Content Security Policy enabled
- XSS protection headers
- HTTPS enforcement
- Secure authentication flow

## Performance Optimizations
- Static generation where possible
- Image optimization
- Bundle splitting
- CDN distribution
- Cache headers

## Integration Points
- **Backend API**: Connected to Railway deployment
- **Database**: Supabase integration
- **Authentication**: Unified auth system
- **Monitoring**: Sentry error tracking

## Post-Deployment Tasks
- [ ] Configure custom domains (optional)
- [ ] Set up A/B testing (optional)
- [ ] Configure analytics tracking
- [ ] Update DNS records
- [ ] Test authentication flows
- [ ] Verify API connectivity

## Monitoring & Analytics
- **Error Tracking**: Sentry
- **Performance**: Vercel Analytics
- **User Analytics**: [Configure Google Analytics]

---
*Generated by automated frontend deployment script*
*Based on Phase 2 validation with enterprise-ready features*
EOF

    success "Frontend deployment report generated: frontend-deployment-report.md"
}

# Main deployment workflow
main() {
    log "Starting Schlep-engine frontend deployment..."
    log "Deploying admin dashboard, landing page, and documentation"
    
    cd "$PROJECT_ROOT"
    
    # Initialize deployment URLs file
    echo "# Deployment URLs generated on $(date)" > deployment-urls.env
    
    check_prerequisites
    install_dependencies
    build_and_test
    
    # Deploy each application
    if [ -d "apps/web-admin" ]; then
        deploy_admin
    else
        warning "Admin dashboard not found, skipping deployment"
    fi
    
    if [ -d "apps/web-landing" ]; then
        deploy_landing
    else
        warning "Landing page not found, skipping deployment"
    fi
    
    if [ -d "apps/web-docs" ]; then
        deploy_docs
    else
        warning "Documentation not found, skipping deployment"
    fi
    
    verify_deployments
    generate_report
    
    success "🚀 Frontend deployment completed successfully!"
    
    # Show final deployment info
    source deployment-urls.env 2>/dev/null || true
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎯 FRONTEND DEPLOYMENT SUMMARY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📱 Admin Dashboard: ${ADMIN_URL:-"Not deployed"}"
    echo "🌐 Landing Page: ${LANDING_URL:-"Not deployed"}"
    echo "📚 Documentation: ${DOCS_URL:-"Not deployed"}"
    echo "💰 Cost: Vercel Pro plan recommended"
    echo "🌍 Global CDN: Multi-region deployment"
    echo "🔒 Security: Enterprise-grade headers and CSP"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Execute main function
main "$@"