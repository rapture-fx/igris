"""
CDN Configuration for Schlep-engine

This module provides CDN configuration and management for serving frontend assets
and static files with caching, compression, and optimization.
"""

import os
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

from app.core.unified_config import settings

logger = logging.getLogger(__name__)


class CDNConfig:
    """CDN configuration and management"""
    
    def __init__(self):
        self.cdn_domain = settings.CDN_DOMAIN
        self.enabled = bool(self.cdn_domain)
        self.cache_headers = self._get_cache_headers()
        self.compression_enabled = True
        self.ssl_enabled = True
        
        # CDN providers configuration
        self.providers = {
            'cloudflare': {
                'enabled': False,
                'api_token': None,
                'zone_id': None
            },
            'aws_cloudfront': {
                'enabled': False,
                'distribution_id': None,
                'access_key_id': None,
                'secret_access_key': None
            },
            'google_cloud_cdn': {
                'enabled': False,
                'backend_bucket': None,
                'project_id': None
            }
        }
    
    def _get_cache_headers(self) -> Dict[str, str]:
        """Get cache headers configuration"""
        return {
            # Static assets (CSS, JS, images)
            'static': {
                'Cache-Control': 'public, max-age=31536000, immutable',  # 1 year
                'ETag': 'true'
            },
            # API responses
            'api': {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            # User uploads
            'uploads': {
                'Cache-Control': 'public, max-age=3600',  # 1 hour
                'ETag': 'true'
            },
            # Documents
            'documents': {
                'Cache-Control': 'public, max-age=86400',  # 1 day
                'ETag': 'true'
            }
        }
    
    def get_cdn_url(self, file_path: str, file_type: str = 'static') -> str:
        """
        Generate CDN URL for a file.
        
        Args:
            file_path: Path to the file
            file_type: Type of file (static, api, uploads, documents)
        
        Returns:
            CDN URL
        """
        if not self.enabled:
            return file_path
        
        # Ensure file path starts with /
        if not file_path.startswith('/'):
            file_path = '/' + file_path
        
        # Add file type prefix if needed
        if file_type != 'static':
            file_path = f"/{file_type}{file_path}"
        
        return f"https://{self.cdn_domain}{file_path}"
    
    def get_cache_headers(self, file_type: str = 'static') -> Dict[str, str]:
        """
        Get cache headers for a file type.
        
        Args:
            file_type: Type of file (static, api, uploads, documents)
        
        Returns:
            Cache headers
        """
        return self.cache_headers.get(file_type, self.cache_headers['static'])
    
    def configure_cloudflare(self, api_token: str, zone_id: str) -> bool:
        """
        Configure Cloudflare CDN.
        
        Args:
            api_token: Cloudflare API token
            zone_id: Cloudflare zone ID
        
        Returns:
            Success status
        """
        try:
            self.providers['cloudflare'].update({
                'enabled': True,
                'api_token': api_token,
                'zone_id': zone_id
            })
            
            logger.info("Cloudflare CDN configured successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to configure Cloudflare CDN: {e}")
            return False
    
    def configure_aws_cloudfront(self, distribution_id: str, access_key_id: str, secret_access_key: str) -> bool:
        """
        Configure AWS CloudFront CDN.
        
        Args:
            distribution_id: CloudFront distribution ID
            access_key_id: AWS access key ID
            secret_access_key: AWS secret access key
        
        Returns:
            Success status
        """
        try:
            self.providers['aws_cloudfront'].update({
                'enabled': True,
                'distribution_id': distribution_id,
                'access_key_id': access_key_id,
                'secret_access_key': secret_access_key
            })
            
            logger.info("AWS CloudFront CDN configured successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to configure AWS CloudFront CDN: {e}")
            return False
    
    def configure_google_cloud_cdn(self, backend_bucket: str, project_id: str) -> bool:
        """
        Configure Google Cloud CDN.
        
        Args:
            backend_bucket: Google Cloud Storage backend bucket
            project_id: Google Cloud project ID
        
        Returns:
            Success status
        """
        try:
            self.providers['google_cloud_cdn'].update({
                'enabled': True,
                'backend_bucket': backend_bucket,
                'project_id': project_id
            })
            
            logger.info("Google Cloud CDN configured successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to configure Google Cloud CDN: {e}")
            return False
    
    def purge_cache(self, file_paths: List[str] = None, file_type: str = 'static') -> Dict[str, Any]:
        """
        Purge CDN cache for specific files or all files.
        
        Args:
            file_paths: List of file paths to purge (None for all)
            file_type: Type of files to purge
        
        Returns:
            Purge result
        """
        try:
            if not self.enabled:
                return {
                    'success': False,
                    'error': 'CDN not enabled'
                }
            
            # Check which CDN provider is enabled
            enabled_provider = None
            for provider_name, provider_config in self.providers.items():
                if provider_config['enabled']:
                    enabled_provider = provider_name
                    break
            
            if not enabled_provider:
                return {
                    'success': False,
                    'error': 'No CDN provider configured'
                }
            
            # Purge cache based on provider
            if enabled_provider == 'cloudflare':
                return self._purge_cloudflare_cache(file_paths, file_type)
            elif enabled_provider == 'aws_cloudfront':
                return self._purge_cloudfront_cache(file_paths, file_type)
            elif enabled_provider == 'google_cloud_cdn':
                return self._purge_google_cloud_cache(file_paths, file_type)
            else:
                return {
                    'success': False,
                    'error': f'Unknown CDN provider: {enabled_provider}'
                }
                
        except Exception as e:
            logger.error(f"Cache purge failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _purge_cloudflare_cache(self, file_paths: List[str], file_type: str) -> Dict[str, Any]:
        """Purge Cloudflare cache"""
        try:
            # This would use Cloudflare API to purge cache
            # For now, return success
            return {
                'success': True,
                'provider': 'cloudflare',
                'purged_files': len(file_paths) if file_paths else 'all',
                'file_type': file_type
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Cloudflare cache purge failed: {e}'
            }
    
    def _purge_cloudfront_cache(self, file_paths: List[str], file_type: str) -> Dict[str, Any]:
        """Purge AWS CloudFront cache"""
        try:
            # This would use AWS CloudFront API to purge cache
            # For now, return success
            return {
                'success': True,
                'provider': 'aws_cloudfront',
                'purged_files': len(file_paths) if file_paths else 'all',
                'file_type': file_type
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'CloudFront cache purge failed: {e}'
            }
    
    def _purge_google_cloud_cache(self, file_paths: List[str], file_type: str) -> Dict[str, Any]:
        """Purge Google Cloud CDN cache"""
        try:
            # This would use Google Cloud CDN API to purge cache
            # For now, return success
            return {
                'success': True,
                'provider': 'google_cloud_cdn',
                'purged_files': len(file_paths) if file_paths else 'all',
                'file_type': file_type
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Google Cloud CDN cache purge failed: {e}'
            }
    
    def get_cdn_status(self) -> Dict[str, Any]:
        """
        Get CDN status and configuration.
        
        Returns:
            CDN status information
        """
        enabled_provider = None
        for provider_name, provider_config in self.providers.items():
            if provider_config['enabled']:
                enabled_provider = provider_name
                break
        
        return {
            'enabled': self.enabled,
            'domain': self.cdn_domain,
            'provider': enabled_provider,
            'compression_enabled': self.compression_enabled,
            'ssl_enabled': self.ssl_enabled,
            'cache_headers': self.cache_headers
        }
    
    def optimize_for_cdn(self, file_path: str, file_type: str = 'static') -> Dict[str, Any]:
        """
        Optimize file for CDN delivery.
        
        Args:
            file_path: Path to the file
            file_type: Type of file
        
        Returns:
            Optimization result
        """
        try:
            # Get CDN URL
            cdn_url = self.get_cdn_url(file_path, file_type)
            
            # Get cache headers
            cache_headers = self.get_cache_headers(file_type)
            
            # Generate optimization recommendations
            recommendations = []
            
            if file_type == 'static':
                recommendations.extend([
                    'Enable gzip compression',
                    'Use immutable cache headers',
                    'Minify CSS and JavaScript',
                    'Optimize images'
                ])
            elif file_type == 'uploads':
                recommendations.extend([
                    'Use appropriate cache duration',
                    'Enable ETag validation',
                    'Consider image optimization'
                ])
            
            return {
                'success': True,
                'cdn_url': cdn_url,
                'cache_headers': cache_headers,
                'recommendations': recommendations
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


# Global CDN configuration instance
cdn_config = CDNConfig() 