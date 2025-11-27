"""
EscapeVector Mode - Thompson Sampling-powered resilience for Python

Maintains Bayesian optimization even during total control plane outages.
"""

import hashlib
import json
import os
import time
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes, hmac
import numpy as np


# Constants
INERTIAL_TTL = 72 * 60 * 60  # 72 hours in seconds
MAX_CLOCK_SKEW = 5 * 60  # 5 minutes in seconds


@dataclass
class BanditArm:
    """Bandit arm representing a provider with Thompson Sampling parameters"""
    provider_id: str
    name: str
    endpoint: str
    api_key: Optional[str] = None

    # Thompson Sampling parameters
    alpha: float = 1.0
    beta: float = 1.0

    # Performance tracking
    total_selections: int = 0
    total_successes: int = 0
    total_failures: int = 0

    # Composite reward components (0-1 normalized)
    avg_latency_score: float = 0.0
    avg_cost_efficiency: float = 0.0
    avg_success_rate: float = 0.0

    # Reward weights
    weight_latency: float = 0.33
    weight_cost: float = 0.33
    weight_success: float = 0.34

    # Last updated timestamp
    updated_at: int = field(default_factory=lambda: int(time.time()))

    def get_mean(self) -> float:
        """Get expected value of Beta distribution"""
        if self.alpha + self.beta == 0:
            return 0.5
        return self.alpha / (self.alpha + self.beta)

    def get_variance(self) -> float:
        """Get variance of Beta distribution"""
        if self.alpha + self.beta == 0:
            return 0.25
        sum_params = self.alpha + self.beta
        return (self.alpha * self.beta) / (sum_params ** 2 * (sum_params + 1))

    def sample_beta(self) -> float:
        """Sample from Beta(α, β) distribution"""
        if self.alpha <= 0 or self.beta <= 0:
            return 0.5

        mean = self.get_mean()
        variance = self.get_variance()

        # Add Gaussian noise for exploration
        noise = np.random.normal(0, np.sqrt(variance))
        sample = mean + noise

        # Clamp to [0, 1]
        return max(0.0, min(1.0, sample))


@dataclass
class BayesianState:
    """Complete Bayesian state for Thompson Sampling"""
    version: int
    timestamp: int
    arms: List[BanditArm]

    # Configuration
    exploration_rate: float = 0.1
    circuit_breaker_threshold: int = 5
    timeout_ms: int = 10000
    max_retries: int = 2
    speculative_execution: bool = False

    # Normalization parameters
    max_latency_ms: float = 5000.0
    max_cost_usd: float = 1.0


@dataclass
class EncryptedBayesianState:
    """Encrypted Bayesian state with HMAC signature"""
    ciphertext: bytes
    nonce: bytes
    hmac_sig: bytes
    version: int
    timestamp: int
    expires_at: int


class BayesianSigner:
    """Handles encryption and signing of Bayesian state"""

    def __init__(self, key: bytes):
        if len(key) != 32:
            raise ValueError("Key must be 32 bytes for AES-256")
        self.key = key
        self.aesgcm = AESGCM(key)

    def encrypt_state(self, state: BayesianState) -> EncryptedBayesianState:
        """Encrypt and sign Bayesian state"""
        # Serialize state
        state_dict = asdict(state)
        plaintext = json.dumps(state_dict).encode('utf-8')

        # Generate nonce
        nonce = os.urandom(12)

        # Encrypt
        ciphertext = self.aesgcm.encrypt(nonce, plaintext, None)

        # Calculate HMAC
        h = hmac.HMAC(self.key, hashes.SHA256())
        h.update(ciphertext)
        h.update(nonce)
        hmac_sig = h.finalize()

        now = int(time.time())
        return EncryptedBayesianState(
            ciphertext=ciphertext,
            nonce=nonce,
            hmac_sig=hmac_sig,
            version=state.version,
            timestamp=now,
            expires_at=now + INERTIAL_TTL,
        )

    def decrypt_state(self, encrypted: EncryptedBayesianState) -> BayesianState:
        """Decrypt and verify Bayesian state"""
        now = int(time.time())

        # Detect clock tampering
        if encrypted.timestamp > now + MAX_CLOCK_SKEW:
            raise ValueError("State timestamp in future - clock tampered")

        # Check expiration (72-hour inertial quorum)
        if now > encrypted.expires_at:
            raise ValueError(
                f"Bayesian state expired at {encrypted.expires_at} "
                f"(current: {now}) - force Gold Code Override"
            )

        # Verify HMAC
        h = hmac.HMAC(self.key, hashes.SHA256())
        h.update(encrypted.ciphertext)
        h.update(encrypted.nonce)
        try:
            h.verify(encrypted.hmac_sig)
        except Exception:
            raise ValueError("HMAC verification failed - state may be tampered")

        # Decrypt
        plaintext = self.aesgcm.decrypt(encrypted.nonce, encrypted.ciphertext, None)

        # Deserialize
        state_dict = json.loads(plaintext.decode('utf-8'))

        # Reconstruct BanditArms
        arms = [BanditArm(**arm) for arm in state_dict['arms']]

        return BayesianState(
            version=state_dict['version'],
            timestamp=state_dict['timestamp'],
            arms=arms,
            exploration_rate=state_dict.get('exploration_rate', 0.1),
            circuit_breaker_threshold=state_dict.get('circuit_breaker_threshold', 5),
            timeout_ms=state_dict.get('timeout_ms', 10000),
            max_retries=state_dict.get('max_retries', 2),
            speculative_execution=state_dict.get('speculative_execution', False),
            max_latency_ms=state_dict.get('max_latency_ms', 5000.0),
            max_cost_usd=state_dict.get('max_cost_usd', 1.0),
        )


def get_default_bayesian_state() -> BayesianState:
    """Get default Bayesian state for Gold Code Override"""
    now = int(time.time())
    return BayesianState(
        version=0,
        timestamp=now,
        arms=[
            BanditArm(
                provider_id="openai",
                name="openai",
                endpoint="https://api.openai.com/v1",
                updated_at=now,
            ),
            BanditArm(
                provider_id="anthropic",
                name="anthropic",
                endpoint="https://api.anthropic.com/v1",
                updated_at=now,
            ),
            BanditArm(
                provider_id="google",
                name="google",
                endpoint="https://generativelanguage.googleapis.com/v1",
                updated_at=now,
            ),
        ],
    )


def derive_encryption_key(api_key: str = "") -> bytes:
    """Derive 32-byte encryption key from API key using SHA-256"""
    if not api_key:
        api_key = "schlep-default-encryption-key-change-me"
    return hashlib.sha256(api_key.encode('utf-8')).digest()
