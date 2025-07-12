#!/bin/bash

# Schlep-engine Cloud Storage and CDN Setup Script
# This script helps set up Google Cloud Storage and CDN configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if file exists
file_exists() {
    [ -f "$1" ]
}

# Function to create directory if it doesn't exist
create_dir() {
    if [ ! -d "$1" ]; then
        mkdir -p "$1"
        print_status "Created directory: $1"
    fi
}

# Function to backup existing file
backup_file() {
    if file_exists "$1"; then
        cp "$1" "$1.backup.$(date +%Y%m%d_%H%M%S)"
        print_status "Backed up existing file: $1"
    fi
}

# Function to validate environment
validate_environment() {
    print_status "Validating environment..."
    
    # Check if we're in the backend directory
    if [ ! -f "requirements.txt" ]; then
        print_error "This script must be run from the backend directory"
        exit 1
    fi
    
    # Check if Python is available
    if ! command_exists python3; then
        print_error "Python 3 is required but not installed"
        exit 1
    fi
    
    # Check if pip is available
    if ! command_exists pip3; then
        print_error "pip3 is required but not installed"
        exit 1
    fi
    
    print_success "Environment validation passed"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing cloud storage dependencies..."
    
    # Install Google Cloud Storage
    pip3 install google-cloud-storage==2.10.0
    
    # Update requirements.txt if not already present
    if ! grep -q "google-cloud-storage" requirements.txt; then
        echo "google-cloud-storage==2.10.0  # Google Cloud Storage support" >> requirements.txt
        print_status "Added google-cloud-storage to requirements.txt"
    fi
    
    print_success "Dependencies installed"
}

# Function to setup environment files
setup_environment_files() {
    print_status "Setting up environment files..."
    
    # Create environment directory if it doesn't exist
    create_dir "env"
    
    # Copy environment templates
    for env in development staging production; do
        if file_exists "env.${env}.template"; then
            if ! file_exists ".env.${env}"; then
                cp "env.${env}.template" ".env.${env}"
                print_status "Created .env.${env} from template"
            else
                print_warning ".env.${env} already exists, skipping"
            fi
        fi
    done
    
    print_success "Environment files setup complete"
}

# Function to setup GCS credentials
setup_gcs_credentials() {
    print_status "Setting up Google Cloud Storage credentials..."
    
    # Check if credentials template exists
    if ! file_exists "gcs-credentials.template.json"; then
        print_error "gcs-credentials.template.json not found"
        exit 1
    fi
    
    # Create credentials file if it doesn't exist
    if ! file_exists "gcs-credentials.json"; then
        cp "gcs-credentials.template.json" "gcs-credentials.json"
        print_warning "Created gcs-credentials.json from template"
        print_warning "Please update gcs-credentials.json with your actual service account credentials"
    else
        print_warning "gcs-credentials.json already exists"
    fi
    
    # Set proper permissions
    chmod 600 gcs-credentials.json
    print_status "Set secure permissions on gcs-credentials.json"
    
    print_success "GCS credentials setup complete"
}

# Function to create test script
create_test_script() {
    print_status "Creating test script..."
    
    cat > test_cloud_storage.py << 'EOF'
#!/usr/bin/env python3
"""
Test script for cloud storage and CDN configuration
"""

import os
import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.insert(0, str(Path(__file__).parent / "app"))

def test_imports():
    """Test if all required modules can be imported"""
    try:
        from app.core.cloud_storage import GoogleCloudStorage
        from app.core.cdn_config import CDNConfig
        from app.services.file_management_service import FileManagementService
        print("✓ All modules imported successfully")
        return True
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False

def test_configuration():
    """Test configuration loading"""
    try:
        from app.core.unified_config import get_settings
        settings = get_settings()
        
        print(f"✓ Cloud storage enabled: {settings.cloud_storage_enabled}")
        print(f"✓ CDN enabled: {settings.cdn_enabled}")
        print(f"✓ GCS bucket: {settings.gcs_bucket_name}")
        
        return True
    except Exception as e:
        print(f"✗ Configuration error: {e}")
        return False

def test_gcs_connection():
    """Test GCS connection"""
    try:
        from app.core.cloud_storage import GoogleCloudStorage
        storage = GoogleCloudStorage()
        result = storage.test_connection()
        print(f"✓ GCS connection test: {result}")
        return result
    except Exception as e:
        print(f"✗ GCS connection error: {e}")
        return False

def test_cdn_configuration():
    """Test CDN configuration"""
    try:
        from app.core.cdn_config import CDNConfig
        cdn = CDNConfig()
        result = cdn.test_configuration()
        print(f"✓ CDN configuration test: {result}")
        return result
    except Exception as e:
        print(f"✗ CDN configuration error: {e}")
        return False

def main():
    """Run all tests"""
    print("Testing cloud storage and CDN configuration...\n")
    
    tests = [
        ("Module Imports", test_imports),
        ("Configuration Loading", test_configuration),
        ("GCS Connection", test_gcs_connection),
        ("CDN Configuration", test_cdn_configuration),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"Running {test_name}...")
        result = test_func()
        results.append((test_name, result))
        print()
    
    # Summary
    print("Test Summary:")
    print("=" * 50)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Cloud storage and CDN are ready to use.")
    else:
        print("⚠️  Some tests failed. Please check the configuration.")

if __name__ == "__main__":
    main()
EOF
    
    chmod +x test_cloud_storage.py
    print_success "Created test_cloud_storage.py"
}

# Function to display next steps
display_next_steps() {
    echo
    echo "=" * 60
    echo "🎉 Cloud Storage and CDN Setup Complete!"
    echo "=" * 60
    echo
    echo "Next steps:"
    echo
    echo "1. 📝 Update environment configuration:"
    echo "   - Edit .env.development, .env.staging, or .env.production"
    echo "   - Set CLOUD_STORAGE_ENABLED=true"
    echo "   - Configure GCS_BUCKET_NAME and GCS_PROJECT_ID"
    echo "   - Set CDN_ENABLED=true if using CDN"
    echo
    echo "2. 🔐 Configure GCS credentials:"
    echo "   - Update gcs-credentials.json with your service account key"
    echo "   - Ensure the service account has proper permissions"
    echo
    echo "3. 🧪 Test the configuration:"
    echo "   python3 test_cloud_storage.py"
    echo
    echo "4. 📚 Read the documentation:"
    echo "   docs/CLOUD_STORAGE_CDN_SETUP.md"
    echo
    echo "5. 🚀 Deploy and monitor:"
    echo "   - Set up monitoring for storage metrics"
    echo "   - Configure alerts for quota limits"
    echo   "   - Monitor CDN performance"
    echo
    echo "For detailed setup instructions, see:"
    echo "docs/CLOUD_STORAGE_CDN_SETUP.md"
    echo
}

# Main execution
main() {
    echo "Schlep-engine Cloud Storage and CDN Setup"
    echo "=========================================="
    echo
    
    # Validate environment
    validate_environment
    
    # Install dependencies
    install_dependencies
    
    # Setup environment files
    setup_environment_files
    
    # Setup GCS credentials
    setup_gcs_credentials
    
    # Create test script
    create_test_script
    
    # Display next steps
    display_next_steps
}

# Run main function
main "$@" 