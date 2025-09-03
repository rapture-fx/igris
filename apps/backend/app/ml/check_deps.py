#!/usr/bin/env python3
"""Check available dependencies."""

packages = ['numpy', 'pandas', 'scipy', 'sklearn', 'statsmodels']

for pkg in packages:
    try:
        __import__(pkg)
        print(f"✓ {pkg} available")
    except ImportError:
        print(f"✗ {pkg} not available")