#!/bin/bash

# SCHLEP-ENGINE DEPLOYMENT SCRIPT
# Run this script to execute today's deployment
# Created: 2025-07-29

set -e

echo "🚀 Starting Schlep-Engine Architecture Migration Deployment"
echo "Target: $145/month architecture (71% cost reduction)"

# Check if we're in the right directory
if [ ! -f "ARCHITECTURE_IMPLEMENTATION_SUMMARY.md" ]; then
    echo "❌ Error: Must run from Schlep-engine root directory"
    exit 1
fi

# Phase 1: Pre-Flight Checks
echo "📋 Phase 1: Pre-Flight Validation (30 minutes)"
read -p "Have you set all environment variables? (AWS_DATABASE_URL, SUPABASE_DATABASE_URL, RAILWAY_TOKEN, etc.) [y/N]: " env_ready
if [[ ! $env_ready =~ ^[Yy]$ ]]; then
    echo "❌ Please set environment variables first. See ARCHITECTURE_IMPLEMENTATION_SUMMARY.md"
    exit 1
fi

echo "Running pre-migration validation..."
./infrastructure/scripts/validate_migration.sh pre-migration

# Phase 2: Database Migration
echo "📊 Phase 2: Database Migration (45 minutes)"
read -p "Proceed with database migration from AWS RDS to Supabase? [y/N]: " db_ready
if [[ $db_ready =~ ^[Yy]$ ]]; then
    cd infrastructure/scripts
    if [ ! -f "migration_config.env" ]; then
        echo "Setting up migration config..."
        cp migration_config.example.env migration_config.env
        echo "❌ Please edit migration_config.env with your database URLs, then re-run this script"
        exit 1
    fi
    
    echo "Starting database migration..."
    ./run_migration.sh migrate
    cd ../..
fi

# Phase 3: Service Deployment
echo "🚢 Phase 3: Service Deployment (60 minutes)"
read -p "Proceed with Railway backend deployment? [y/N]: " railway_ready
if [[ $railway_ready =~ ^[Yy]$ ]]; then
    echo "Deploying to Railway..."
    cd infrastructure/railway
    ./deploy-railway.sh --env production
    cd ../..
fi

read -p "Proceed with Vercel admin deployment? [y/N]: " vercel_ready
if [[ $vercel_ready =~ ^[Yy]$ ]]; then
    echo "Deploying admin to Vercel..."
    cd apps/web-admin
    npx vercel --prod
    cd ../..
fi

echo "📝 For Cloudflare Pages (Landing/Docs), setup via dashboard:"
echo "   - Connect to GitHub repo"
echo "   - Build command: npm run build"
echo "   - Output directory: out"

# Phase 4: Final Validation
echo "✅ Phase 4: Final Validation (30 minutes)"
read -p "Run final validation? [y/N]: " validate_ready
if [[ $validate_ready =~ ^[Yy]$ ]]; then
    echo "Running comprehensive validation..."
    ./infrastructure/scripts/validate_migration.sh full
fi

echo "🎉 Deployment Complete!"
echo "💰 Expected monthly cost: $145 (71% reduction)"
echo "📊 Monitor costs at: /api/v1/cost/summary"
echo "📋 For detailed status, see: ARCHITECTURE_IMPLEMENTATION_SUMMARY.md"

# Emergency rollback info
echo ""
echo "🚨 If issues occur, emergency rollback:"
echo "   ./infrastructure/scripts/rollback_migration.sh emergency"