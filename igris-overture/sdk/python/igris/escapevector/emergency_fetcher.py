"""
Emergency Policy Fetcher - Polls for signed policy updates during outages

This allows the SDK to receive routing updates even when the control plane
is completely dead. Updates are served from static endpoints (S3 + Cloudflare).
"""

import time
import threading
from typing import Optional, Callable, Dict, Any
import requests
from dataclasses import dataclass


@dataclass
class EmergencyPolicy:
    """Emergency policy blob with signature"""
    policy: str  # Encrypted policy blob
    signature: str  # Ed25519 signature
    version: int  # Monotonically increasing version
    expires_at: int  # Unix milliseconds
    issuer: Optional[str] = None  # For audit trail
    reason: Optional[str] = None  # For audit trail


PolicyUpdateCallback = Callable[[EmergencyPolicy], None]


class EmergencyFetcher:
    """
    Emergency fetcher - polls for policy updates

    Example:
        >>> def on_policy(policy):
        ...     print(f"New policy version {policy.version}")
        >>>
        >>> fetcher = EmergencyFetcher(
        ...     endpoint="https://emergency.igris.ai/v1/emergency/policy",
        ...     check_interval=30.0,
        ...     on_policy_update=on_policy
        ... )
        >>> fetcher.start()
    """

    def __init__(
        self,
        endpoint: str,
        check_interval: float = 30.0,  # 30 seconds default
        on_policy_update: Optional[PolicyUpdateCallback] = None
    ):
        self.endpoint = endpoint
        self.check_interval = check_interval
        self.on_policy_update = on_policy_update

        self.current_version = 0
        self.last_check = 0.0
        self.stopped = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    def start(self) -> None:
        """Start polling for emergency policy updates"""
        with self._lock:
            if self.stopped:
                return

            # Start background thread
            self._thread = threading.Thread(target=self._poll_loop, daemon=True)
            self._thread.start()

    def stop(self) -> None:
        """Stop polling"""
        with self._lock:
            self.stopped = True

    def _poll_loop(self) -> None:
        """Background polling loop"""
        # Immediate check on start
        self._check_for_update()

        # Periodic polling
        while not self.stopped:
            time.sleep(self.check_interval)
            if not self.stopped:
                self._check_for_update()

    def _check_for_update(self) -> None:
        """Check for a new emergency policy"""
        if self.stopped:
            return

        try:
            # Build URL with 'since' parameter
            url = f"{self.endpoint}?since={self.current_version}"

            # Fetch with timeout
            response = requests.get(url, timeout=10.0)

            # 204 = no new policy
            if response.status_code == 204:
                with self._lock:
                    self.last_check = time.time()
                return

            # 200 = new policy available
            if response.status_code == 200:
                data = response.json()

                policy = EmergencyPolicy(
                    policy=data["policy"],
                    signature=data["signature"],
                    version=data["version"],
                    expires_at=data["expires_at"],
                    issuer=data.get("issuer"),
                    reason=data.get("reason"),
                )

                # Update current version
                with self._lock:
                    self.current_version = policy.version
                    self.last_check = time.time()

                # Call callback
                if self.on_policy_update:
                    self.on_policy_update(policy)

            # Other status codes are ignored
        except Exception:
            # Network error - control plane may be down, which is expected
            # Don't crash the fetcher
            with self._lock:
                self.last_check = time.time()

    def get_metrics(self) -> Dict[str, Any]:
        """Get metrics"""
        with self._lock:
            return {
                "current_version": self.current_version,
                "last_check": self.last_check,
                "check_interval": self.check_interval,
                "stopped": self.stopped,
            }

    def get_current_version(self) -> int:
        """Get current version"""
        with self._lock:
            return self.current_version
