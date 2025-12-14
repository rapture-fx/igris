#!/usr/bin/env python3
"""Simple test script for Igris SDK"""

from igris import Client, IgrisError

def test_sdk_import():
    """Test that SDK can be imported"""
    print("✓ SDK imported successfully")

def test_client_creation():
    """Test client creation"""
    client = Client(base_url="http://localhost:8081")
    print(f"✓ Client created with base_url: {client.base_url}")

def test_health_check():
    """Test health check (will fail if API not running)"""
    client = Client(base_url="http://localhost:8081")
    try:
        health = client.health()
        print(f"✓ Health check successful: {health}")
    except Exception as e:
        print(f"⚠ Health check failed (API not running): {e}")

def test_context_manager():
    """Test context manager"""
    with Client(base_url="http://localhost:8081") as client:
        print(f"✓ Context manager works")

if __name__ == "__main__":
    print("Testing Schlep Python SDK\n")
    print("-" * 50)

    test_sdk_import()
    test_client_creation()
    test_context_manager()
    test_health_check()

    print("-" * 50)
    print("\n✓ SDK tests completed!")
