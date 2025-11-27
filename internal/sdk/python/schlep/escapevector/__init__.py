"""
EscapeVector Mode - Complete integration for Python SDK

Thompson Sampling-powered resilience that continues Bayesian optimization
even during total control plane outages.
"""

import json
import os
import time
from pathlib import Path
from typing import Optional, Dict, Any

from .bayesian_state import (
    BayesianState,
    BayesianSigner,
    EncryptedBayesianState,
    get_default_bayesian_state,
    derive_encryption_key,
)
from .thompson_router import ThompsonRouter, InferRequest, InferResponse


# Constants
TIMEOUT_THRESHOLD = 500  # ms
CONSECUTIVE_TIMEOUTS = 3


class ControlPlaneDetector:
    """Monitors control plane health"""

    def __init__(self):
        self.consecutive_timeouts = 0
        self.is_in_escape_mode = False
        self.last_success_time = time.time()

    def record_success(self, latency_ms: float):
        """Record successful control plane request"""
        if latency_ms < TIMEOUT_THRESHOLD:
            self.consecutive_timeouts = 0
            self.is_in_escape_mode = False
            self.last_success_time = time.time()

    def record_failure(self, latency_ms: float) -> bool:
        """Record failed/slow control plane request"""
        if latency_ms >= TIMEOUT_THRESHOLD:
            self.consecutive_timeouts += 1

            if self.consecutive_timeouts >= CONSECUTIVE_TIMEOUTS:
                self.is_in_escape_mode = True
                return True

        return False

    def get_is_in_escape_mode(self) -> bool:
        """Check if EscapeVector Mode is active"""
        return self.is_in_escape_mode


class InertialCache:
    """72-hour persistent Bayesian state cache"""

    def __init__(self, cache_dir: Optional[str] = None):
        if not cache_dir:
            home = Path.home()
            cache_dir = str(home / ".config" / "schlep")

        self.cache_dir = Path(cache_dir)
        self.cache_path = self.cache_dir / "bayesian_state.enc"
        self.signer: Optional[BayesianSigner] = None

    def init(self, key_bytes: bytes):
        """Initialize with encryption key"""
        self.signer = BayesianSigner(key_bytes)

        # Ensure cache directory exists
        self.cache_dir.mkdir(parents=True, exist_ok=True, mode=0o700)

    def save(self, state: BayesianState):
        """Save encrypted Bayesian state"""
        if not self.signer:
            raise RuntimeError("Cache not initialized")

        # Encrypt state
        encrypted = self.signer.encrypt_state(state)

        # Serialize
        data = json.dumps({
            "ciphertext": encrypted.ciphertext.hex(),
            "nonce": encrypted.nonce.hex(),
            "hmac": encrypted.hmac_sig.hex(),
            "version": encrypted.version,
            "timestamp": encrypted.timestamp,
            "expires_at": encrypted.expires_at,
        })

        # Write atomically
        temp_path = self.cache_path.with_suffix('.tmp')
        temp_path.write_text(data, encoding='utf-8')
        os.chmod(temp_path, 0o600)
        temp_path.replace(self.cache_path)

    def load(self) -> BayesianState:
        """Load and decrypt Bayesian state"""
        if not self.signer:
            raise RuntimeError("Cache not initialized")

        if not self.cache_path.exists():
            raise FileNotFoundError("No cached state found")

        # Read and deserialize
        data = json.loads(self.cache_path.read_text(encoding='utf-8'))

        encrypted = EncryptedBayesianState(
            ciphertext=bytes.fromhex(data["ciphertext"]),
            nonce=bytes.fromhex(data["nonce"]),
            hmac_sig=bytes.fromhex(data["hmac"]),
            version=data["version"],
            timestamp=data["timestamp"],
            expires_at=data["expires_at"],
        )

        return self.signer.decrypt_state(encrypted)

    def exists(self) -> bool:
        """Check if cache exists"""
        return self.cache_path.exists()

    def clear(self):
        """Clear cache"""
        if self.cache_path.exists():
            self.cache_path.unlink()


class EscapeVectorMode:
    """Complete EscapeVector Mode manager"""

    def __init__(
        self,
        detector: ControlPlaneDetector,
        router: ThompsonRouter,
        cache: InertialCache,
        gold_code_mode: bool,
    ):
        self.detector = detector
        self.thompson_router = router
        self.cache = cache
        self.gold_code_mode = gold_code_mode
        self.total_escape_requests = 0
        self.total_normal_requests = 0
        self.last_mode_switch = time.time()

    @classmethod
    def create(
        cls, api_key: Optional[str] = None, cache_dir: Optional[str] = None
    ) -> "EscapeVectorMode":
        """Create EscapeVector Mode instance"""
        # Check for Gold Code Override
        gold_code_mode = os.environ.get("BYOK_BYPASS_CONTROL_PLANE") == "true"

        # Derive encryption key
        encryption_key = derive_encryption_key(api_key or "")

        # Initialize cache
        cache = InertialCache(cache_dir)
        cache.init(encryption_key)

        # Load or create Bayesian state
        try:
            if cache.exists():
                state = cache.load()
            else:
                state = get_default_bayesian_state()
        except Exception:
            # Cache expired or tampered - use default
            state = get_default_bayesian_state()

        detector = ControlPlaneDetector()
        router = ThompsonRouter(state)

        # Save initial state
        try:
            cache.save(state)
        except Exception as e:
            # Non-fatal - continue with in-memory state
            print(f"Warning: Failed to save initial state: {e}")

        return cls(detector, router, cache, gold_code_mode)

    def should_use_escape_vector(self) -> bool:
        """Should use EscapeVector Mode?"""
        if self.gold_code_mode:
            return True
        return self.detector.get_is_in_escape_mode()

    def record_control_plane_request(self, latency_ms: float, error: Optional[Exception]):
        """Record control plane request result"""
        self.total_normal_requests += 1

        if error or latency_ms >= TIMEOUT_THRESHOLD:
            triggered = self.detector.record_failure(latency_ms)
            if triggered:
                self.last_mode_switch = time.time()
        else:
            self.detector.record_success(latency_ms)

    def infer(self, req: InferRequest) -> InferResponse:
        """Perform inference using Thompson Sampling fallback"""
        self.total_escape_requests += 1
        return self.thompson_router.infer(req)

    def sync_state_from_control_plane(self, state: BayesianState):
        """Sync state from control plane"""
        self.thompson_router.update_state(state)
        self.cache.save(state)

    def get_metrics(self) -> Dict[str, Any]:
        """Get metrics"""
        return {
            "gold_code_mode": self.gold_code_mode,
            "is_in_escape_mode": self.detector.get_is_in_escape_mode(),
            "consecutive_timeouts": self.detector.consecutive_timeouts,
            "total_escape_requests": self.total_escape_requests,
            "total_normal_requests": self.total_normal_requests,
            "last_mode_switch": self.last_mode_switch,
            "last_control_plane_success": self.detector.last_success_time,
        }


# Export all
__all__ = [
    "EscapeVectorMode",
    "BayesianState",
    "InferRequest",
    "InferResponse",
    "get_default_bayesian_state",
]
