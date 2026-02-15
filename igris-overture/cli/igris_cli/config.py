"""Configuration management for Igris CLI"""

import json
import os
from pathlib import Path
from typing import Optional


class Config:
    """Manage CLI configuration stored in ~/.igris/config.json"""

    CONFIG_DIR = Path.home() / ".igris"
    CONFIG_FILE = CONFIG_DIR / "config.json"

    @classmethod
    def ensure_config_dir(cls):
        """Create config directory if it doesn't exist"""
        cls.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        # Set restrictive permissions (owner read/write only)
        os.chmod(cls.CONFIG_DIR, 0o700)

    @classmethod
    def load(cls) -> dict:
        """Load configuration from file"""
        if not cls.CONFIG_FILE.exists():
            return {
                "base_url": "http://localhost:8081",
                "api_key": None,
                "provider_keys": {}
            }

        try:
            with open(cls.CONFIG_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {
                "base_url": "http://localhost:8081",
                "api_key": None,
                "provider_keys": {}
            }

    @classmethod
    def save(cls, config: dict):
        """Save configuration to file"""
        cls.ensure_config_dir()

        with open(cls.CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)

        # Set restrictive permissions (owner read/write only)
        os.chmod(cls.CONFIG_FILE, 0o600)

    @classmethod
    def get(cls, key: str, default=None):
        """Get a configuration value"""
        config = cls.load()
        return config.get(key, default)

    @classmethod
    def set(cls, key: str, value):
        """Set a configuration value"""
        config = cls.load()
        config[key] = value
        cls.save(config)

    @classmethod
    def get_base_url(cls) -> str:
        """Get the configured base URL"""
        return cls.get("base_url", "http://localhost:8081")

    @classmethod
    def get_api_key(cls) -> Optional[str]:
        """Get the configured API key"""
        return cls.get("api_key")

    @classmethod
    def set_api_key(cls, api_key: str):
        """Set the API key"""
        cls.set("api_key", api_key)

    @classmethod
    def add_provider_key(cls, provider: str, key: str):
        """Add a provider API key"""
        config = cls.load()
        if "provider_keys" not in config:
            config["provider_keys"] = {}
        config["provider_keys"][provider] = key
        cls.save(config)

    @classmethod
    def get_provider_keys(cls) -> dict:
        """Get all provider keys"""
        return cls.get("provider_keys", {})

    @classmethod
    def remove_provider_key(cls, provider: str):
        """Remove a provider API key"""
        config = cls.load()
        if "provider_keys" in config and provider in config["provider_keys"]:
            del config["provider_keys"][provider]
            cls.save(config)
