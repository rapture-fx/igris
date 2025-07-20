# Cloud Storage and CDN Setup Guide

This guide covers the setup and configuration of Google Cloud Storage and CDN integration for the Schlep-engine platform.

## Table of Contents

1. [Overview](#overview)
2. [Google Cloud Storage Setup](#google-cloud-storage-setup)
3. [CDN Configuration](#cdn-configuration)
4. [Environment Configuration](#environment-configuration)
5. [File Management Features](#file-management-features)
6. [Security Considerations](#security-considerations)
7. [Troubleshooting](#troubleshooting)

## Overview

The Schlep-engine platform now supports:
- **Google Cloud Storage**: Scalable file storage with automatic cleanup
- **CDN Integration**: Support for Cloudflare, AWS CloudFront, and Google Cloud CDN
- **File Validation**: Size limits, type validation, and security checks
- **Automatic Cleanup**: Configurable retention policies and batch cleanup

## Google Cloud Storage Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Cloud Storage API

### 2. Create a Service Account

1. Navigate to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Name: `schlep-engine-storage`
4. Description: `Service account for Schlep-engine file storage`
5. Click "Create and Continue"

### 3. Assign Permissions

Assign the following roles to the service account:
- **Storage Object Admin**: Full access to objects in buckets
- **Storage Object Viewer**: Read access to objects
- **Storage Legacy Bucket Owner**: Bucket management (if needed)

### 4. Create Storage Bucket

1. Navigate to "Cloud Storage" > "Buckets"
2. Click "Create Bucket"
3. Configure bucket settings:
   - **Name**: `schlep-engine-{env}-uploads` (e.g., `schlep-engine-dev-uploads`)
   - **Location**: Choose a region close to your users
   - **Storage Class**: Standard
   - **Access Control**: Uniform bucket-level access
   - **Protection**: Object versioning (optional)

### 5. Download Service Account Key

1. Go to the service account details
2. Click "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose JSON format
5. Download the key file
6. **IMPORTANT**: Keep this file secure and never commit it to version control

### 6. Configure Bucket Lifecycle

Set up automatic cleanup in the bucket:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 30,
          "matchesStorageClass": ["STANDARD"]
        }
      }
    ]
  }
}
```

## CDN Configuration

### Cloudflare Setup

1. **Create Cloudflare Account**:
   - Sign up at [cloudflare.com](https://cloudflare.com)
   - Add your domain

2. **Configure DNS**:
   - Add CNAME record: `cdn.yourdomain.com` → `your-gcs-bucket.c.storage.googleapis.com`

3. **Get API Token**:
   - Go to "My Profile" > "API Tokens"
   - Create custom token with Zone:Zone:Edit permissions

4. **Configure Cache Rules**:
   - Go to "Caching" > "Configuration"
   - Set cache level to "Standard"
   - Configure cache duration based on file types

### AWS CloudFront Setup

1. **Create Distribution**:
   - Origin: Your GCS bucket
   - Origin Access: Origin Access Control
   - Viewer Protocol Policy: Redirect HTTP to HTTPS

2. **Configure Behaviors**:
   - Path Pattern: `/*`
   - Cache Policy: CachingOptimized
   - Origin Request Policy: CORS-S3Origin

### Google Cloud CDN Setup

1. **Create Load Balancer**:
   - Backend: Cloud Storage bucket
   - Frontend: HTTPS with managed SSL certificate

2. **Configure Cache**:
   - Cache Mode: Cache all static content
   - TTL: Configure based on content type

## Environment Configuration

### 1. Update Environment Files

Copy the appropriate template and update with your values:

```bash
# Development
cp env.development.template .env.development
# Staging
cp env.staging.template .env.staging
# Production
cp env.production.template .env.production
```

### 2. Configure Cloud Storage Settings

```bash
# Enable cloud storage
CLOUD_STORAGE_ENABLED=true
CLOUD_STORAGE_PROVIDER=gcs

# GCS Configuration
GCS_BUCKET_NAME=schlep-engine-dev-uploads
GCS_PROJECT_ID=your-project-id
GCS_CREDENTIALS_PATH=./gcs-credentials.json
GCS_REGION=us-central1

# File retention
FILE_RETENTION_DAYS=30
ENABLE_AUTOMATIC_CLEANUP=true
CLEANUP_BATCH_SIZE=100
```

### 3. Configure CDN Settings

```bash
# Enable CDN
CDN_ENABLED=true
CDN_PROVIDER=cloudflare
CDN_DOMAIN=cdn.yourdomain.com
CDN_API_TOKEN=your-api-token

# Cache settings
CDN_CACHE_DURATION=3600
CDN_CACHE_HEADERS=true
```

### 4. Set Up Credentials

1. Copy the credentials template:
   ```bash
   cp gcs-credentials.template.json gcs-credentials.json
   ```

2. Replace placeholder values with your actual service account credentials

3. Set proper permissions:
   ```bash
   chmod 600 gcs-credentials.json
   ```

## File Management Features

### Upload Validation

The system automatically validates:
- File size limits (configurable per environment)
- File type restrictions
- Malware scanning (if enabled)
- Duplicate detection

### Automatic Cleanup

Configured cleanup features:
- **Retention Policy**: Files deleted after specified days
- **Batch Processing**: Configurable batch sizes for efficiency
- **Error Handling**: Failed deletions are logged and retried
- **Monitoring**: Cleanup metrics and alerts

### File Access Control

- **Public URLs**: Generated for public file access
- **Signed URLs**: Time-limited access for private files
- **Access Logging**: Track file access patterns
- **Rate Limiting**: Prevent abuse

## Security Considerations

### 1. Credential Security

- **Never commit credentials** to version control
- Use environment variables or secrets managers in production
- Rotate service account keys regularly
- Use least-privilege access

### 2. Bucket Security

- Enable uniform bucket-level access
- Configure CORS policies appropriately
- Set up bucket logging for audit trails
- Use object lifecycle policies for cleanup

### 3. CDN Security

- Enable HTTPS only
- Configure security headers
- Set up rate limiting
- Monitor for abuse

### 4. File Validation

- Validate file types server-side
- Scan for malware
- Implement size limits
- Use secure file naming

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify service account credentials
   - Check bucket permissions
   - Ensure credentials file path is correct

2. **Upload Failures**:
   - Check file size limits
   - Verify allowed file types
   - Check network connectivity
   - Review bucket quota

3. **CDN Issues**:
   - Verify DNS configuration
   - Check cache settings
   - Review API token permissions
   - Monitor cache hit rates

### Monitoring

1. **GCS Metrics**:
   - Storage usage
   - Request counts
   - Error rates
   - Bandwidth usage

2. **CDN Metrics**:
   - Cache hit ratio
   - Response times
   - Error rates
   - Geographic distribution

3. **Application Metrics**:
   - Upload success rates
   - File processing times
   - Cleanup job status
   - Error logs

### Debug Commands

```bash
# Test GCS connection
python -c "
from app.core.cloud_storage import GoogleCloudStorage
storage = GoogleCloudStorage()
print('GCS connection test:', storage.test_connection())
"

# Test CDN configuration
python -c "
from app.core.cdn_config import CDNConfig
cdn = CDNConfig()
print('CDN configuration test:', cdn.test_configuration())
"

# Check file cleanup
python -c "
from app.services.file_management_service import FileManagementService
service = FileManagementService()
print('Cleanup status:', service.get_cleanup_status())
"
```

## Next Steps

1. **Set up monitoring** for storage and CDN metrics
2. **Configure alerts** for quota limits and errors
3. **Implement backup strategies** for critical files
4. **Set up cost monitoring** to track usage
5. **Plan for scaling** as usage grows

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review application logs
3. Consult Google Cloud documentation
4. Contact the development team

---

**Note**: This setup provides a robust foundation for file storage and delivery. Regular monitoring and maintenance are essential for optimal performance and cost management. 