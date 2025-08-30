#!/usr/bin/env python3
"""
Debug JWT Issue
"""

import os
import sys
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

# Set up test environment variables
os.environ["SECRET_KEY"] = "test_secret_key_for_security_validation_32_chars_long_12345678"
os.environ["JWT_ALGORITHM"] = "RS256"

# Generate test RSA keys
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)
public_key = private_key.public_key()

private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

os.environ["JWT_PRIVATE_KEY"] = private_pem.decode()
os.environ["JWT_PUBLIC_KEY"] = public_pem.decode()

# Add app to path
sys.path.append(os.path.dirname(__file__))

from app.auth.security import (
    get_signing_key, get_verification_key, create_access_token,
    verify_token, ALGORITHM
)
from jose import jwt

print("🔍 Debugging JWT Issue")
print("=" * 30)

test_data = {"sub": "test_user", "role": "user"}

print(f"Algorithm: {ALGORITHM}")

# Get keys
signing_key = get_signing_key()
verification_key = get_verification_key()

print(f"Signing key type: {type(signing_key)}")
print(f"Verification key type: {type(verification_key)}")

# Create token
token = create_access_token(test_data)
print(f"Token created: {token[:50]}...")

# Try to decode manually
try:
    payload = jwt.decode(token, verification_key, algorithms=[ALGORITHM])
    print(f"Manual decode successful: {payload}")
except Exception as e:
    print(f"Manual decode failed: {e}")

# Try verify_token function
try:
    payload2 = verify_token(token)
    print(f"verify_token result: {payload2}")
except Exception as e:
    print(f"verify_token failed: {e}")