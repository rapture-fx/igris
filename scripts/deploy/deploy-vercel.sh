#!/bin/bash

# Schlep-engine Vercel Deployment Script
# This script deploys the frontend and admin applications to Vercel

set -e

echo "Starting Vercel deployment for Schlep-engine..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Vercel CLI is not installed. Please install it first:"
    echo "npm install -g vercel"
    exit 1
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "Not logged in to Vercel. Please run 'vercel login' first."
    exit 1
fi

# Set environment variables
export NODE_ENV=production

# Install dependencies
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Build the applications
echo "Building applications..."
pnpm build

# Deploy frontend
echo "Deploying frontend application..."
cd packages/frontend
vercel --prod --yes

# Deploy admin
echo "Deploying admin application..."
cd ../admin
vercel --prod --yes

echo "Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Set up environment variables in Vercel dashboard"
echo "2. Configure custom domains if needed"
echo "3. Set up backend deployment (Railway, Render, etc.)"
echo "4. Update API endpoints in frontend configuration" 