#!/usr/bin/env python3
"""
SSL Certificate Generator for Schlep-engine

This script generates self-signed SSL certificates for development and testing.
For production, use proper certificates from a Certificate Authority.

Usage:
    python scripts/generate_ssl_cert.py [development|staging|production]
"""

import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
import argparse

def generate_self_signed_cert(environment: str, cert_dir: Path) -> dict:
    """
    Generate a self-signed SSL certificate for the specified environment.
    
    Args:
        environment: Environment name (development, staging, production)
        cert_dir: Directory to store certificates
    
    Returns:
        Dictionary with certificate paths
    """
    
    # Create certificate directory
    cert_dir.mkdir(parents=True, exist_ok=True)
    
    # Certificate file paths
    cert_file = cert_dir / f"{environment}.crt"
    key_file = cert_dir / f"{environment}.key"
    ca_file = cert_dir / f"{environment}_ca.crt"
    
    # Certificate details
    common_name = f"schlep-engine-{environment}.local"
    if environment == "production":
        common_name = "schlep-engine.com"
    elif environment == "staging":
        common_name = "staging.schlep-engine.com"
    
    # Validity period
    validity_days = 365 if environment == "development" else 90
    
    print(f"Generating SSL certificate for {environment} environment...")
    print(f"Common Name: {common_name}")
    print(f"Validity: {validity_days} days")
    
    # Generate private key
    print("Generating private key...")
    subprocess.run([
        "openssl", "genrsa",
        "-out", str(key_file),
        "2048"
    ], check=True)
    
    # Create certificate signing request (CSR)
    csr_file = cert_dir / f"{environment}.csr"
    print("Creating certificate signing request...")
    
    # Create OpenSSL config
    config_file = cert_dir / f"{environment}.conf"
    with open(config_file, 'w') as f:
        f.write(f"""[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = California
L = San Francisco
O = Schlep-engine
OU = Development
CN = {common_name}

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = {common_name}
DNS.2 = *.{common_name}
DNS.3 = localhost
IP.1 = 127.0.0.1
""")
    
    # Generate CSR
    subprocess.run([
        "openssl", "req", "-new",
        "-key", str(key_file),
        "-out", str(csr_file),
        "-config", str(config_file)
    ], check=True)
    
    # Generate self-signed certificate
    print("Generating self-signed certificate...")
    subprocess.run([
        "openssl", "x509", "-req",
        "-in", str(csr_file),
        "-signkey", str(key_file),
        "-out", str(cert_file),
        "-days", str(validity_days),
        "-extensions", "v3_req",
        "-extfile", str(config_file)
    ], check=True)
    
    # Generate CA certificate for development
    if environment == "development":
        print("Generating CA certificate for development...")
        ca_key_file = cert_dir / "ca.key"
        
        # Generate CA private key
        subprocess.run([
            "openssl", "genrsa",
            "-out", str(ca_key_file),
            "2048"
        ], check=True)
        
        # Generate CA certificate
        subprocess.run([
            "openssl", "req", "-new", "-x509",
            "-key", str(ca_key_file),
            "-out", str(ca_file),
            "-days", "365",
            "-subj", "/C=US/ST=California/L=San Francisco/O=Schlep-engine CA/OU=Development/CN=Schlep-engine Development CA"
        ], check=True)
    
    # Clean up temporary files
    csr_file.unlink(missing_ok=True)
    config_file.unlink(missing_ok=True)
    
    # Set proper permissions
    os.chmod(cert_file, 0o644)
    os.chmod(key_file, 0o600)
    if ca_file.exists():
        os.chmod(ca_file, 0o644)
    
    print(f"✓ SSL certificate generated successfully!")
    print(f"  Certificate: {cert_file}")
    print(f"  Private Key: {key_file}")
    if ca_file.exists():
        print(f"  CA Certificate: {ca_file}")
    
    return {
        "cert_file": str(cert_file),
        "key_file": str(key_file),
        "ca_file": str(ca_file) if ca_file.exists() else None
    }

def validate_certificate(cert_file: str, key_file: str) -> bool:
    """
    Validate the generated SSL certificate.
    
    Args:
        cert_file: Path to certificate file
        key_file: Path to private key file
    
    Returns:
        True if certificate is valid, False otherwise
    """
    try:
        # Check certificate details
        result = subprocess.run([
            "openssl", "x509", "-in", cert_file, "-text", "-noout"
        ], capture_output=True, text=True, check=True)
        
        print("Certificate details:")
        print(result.stdout)
        
        # Verify certificate and key match
        subprocess.run([
            "openssl", "x509", "-noout", "-modulus",
            "-in", cert_file
        ], capture_output=True, check=True)
        
        subprocess.run([
            "openssl", "rsa", "-noout", "-modulus",
            "-in", key_file
        ], capture_output=True, check=True)
        
        print("✓ Certificate validation successful!")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Certificate validation failed: {e}")
        return False

def update_env_file(environment: str, cert_paths: dict) -> None:
    """
    Update environment file with SSL certificate paths.
    
    Args:
        environment: Environment name
        cert_paths: Dictionary with certificate paths
    """
    env_file = Path(f".env.{environment}")
    
    if not env_file.exists():
        print(f"⚠️  Environment file {env_file} not found. Please create it first.")
        return
    
    # Read current content
    with open(env_file, 'r') as f:
        content = f.read()
    
    # Add SSL configuration
    ssl_config = f"""
# ==================== SSL/TLS CONFIGURATION ====================
SSL_CERT_PATH={cert_paths['cert_file']}
SSL_KEY_PATH={cert_paths['key_file']}
"""
    
    if cert_paths['ca_file']:
        ssl_config += f"SSL_CA_PATH={cert_paths['ca_file']}\n"
    
    # Check if SSL config already exists
    if "SSL_CERT_PATH=" not in content:
        content += ssl_config
    else:
        # Replace existing SSL config
        lines = content.split('\n')
        new_lines = []
        skip_ssl_section = False
        
        for line in lines:
            if line.startswith("# ==================== SSL/TLS CONFIGURATION"):
                skip_ssl_section = True
                new_lines.append(line)
                new_lines.extend(ssl_config.strip().split('\n'))
            elif skip_ssl_section and line.startswith("# ===================="):
                skip_ssl_section = False
                new_lines.append(line)
            elif not skip_ssl_section:
                new_lines.append(line)
        
        content = '\n'.join(new_lines)
    
    # Write updated content
    with open(env_file, 'w') as f:
        f.write(content)
    
    print(f"✓ Updated {env_file} with SSL configuration")

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Generate SSL certificates for Schlep-engine")
    parser.add_argument("environment", choices=["development", "staging", "production"],
                       help="Environment to generate certificate for")
    parser.add_argument("--cert-dir", default="./ssl",
                       help="Directory to store certificates (default: ./ssl)")
    parser.add_argument("--no-validate", action="store_true",
                       help="Skip certificate validation")
    parser.add_argument("--no-update-env", action="store_true",
                       help="Skip updating environment file")
    
    args = parser.parse_args()
    
    # Check if OpenSSL is available
    try:
        subprocess.run(["openssl", "version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ OpenSSL is not installed or not available in PATH")
        print("Please install OpenSSL and try again.")
        sys.exit(1)
    
    # Generate certificate
    cert_dir = Path(args.cert_dir)
    cert_paths = generate_self_signed_cert(args.environment, cert_dir)
    
    # Validate certificate
    if not args.no_validate:
        validate_certificate(cert_paths['cert_file'], cert_paths['key_file'])
    
    # Update environment file
    if not args.no_update_env:
        update_env_file(args.environment, cert_paths)
    
    print(f"\n🎉 SSL certificate generation complete for {args.environment}!")
    print(f"\nNext steps:")
    print(f"  1. Restart your application to use the new certificates")
    print(f"  2. For production, replace with certificates from a trusted CA")
    print(f"  3. Configure your reverse proxy (Nginx) to use these certificates")

if __name__ == "__main__":
    main() 