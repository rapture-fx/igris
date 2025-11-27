"""Thompson Sampling Router - Local fallback with Bayesian optimization"""

import time
import requests
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from .bayesian_state import BanditArm, BayesianState


@dataclass
class InferRequest:
    """Inference request"""
    model: str
    messages: List[Dict[str, str]]
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None


@dataclass
class InferResponse:
    """Inference response"""
    id: Optional[str] = None
    object: Optional[str] = None
    created: Optional[int] = None
    model: str = ""
    choices: List[Dict[str, Any]] = None
    usage: Optional[Dict[str, int]] = None

    def __post_init__(self):
        if self.choices is None:
            self.choices = []


class CircuitBreaker:
    """Circuit breaker for provider health tracking"""

    def __init__(self, threshold: int):
        self.threshold = threshold
        self.failures = 0
        self.is_open = False
        self.last_opened = 0

    def record_success(self):
        """Reset circuit breaker on success"""
        self.failures = 0
        self.is_open = False

    def record_failure(self):
        """Increment failure count"""
        self.failures += 1
        if self.failures >= self.threshold:
            self.is_open = True
            self.last_opened = time.time()

    def get_is_open(self) -> bool:
        """Check if circuit is open (auto-reset after 30s)"""
        if self.is_open and time.time() - self.last_opened > 30:
            self.is_open = False
            self.failures = 0
        return self.is_open


class ThompsonRouter:
    """Thompson Sampling Router"""

    def __init__(self, state: BayesianState):
        self.state = state
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}

        # Initialize circuit breakers
        for arm in state.arms:
            self.circuit_breakers[arm.provider_id] = CircuitBreaker(
                state.circuit_breaker_threshold
            )

        # Session for HTTP requests
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def infer(self, req: InferRequest) -> InferResponse:
        """Perform inference using Thompson Sampling"""
        if self.state.speculative_execution:
            return self._speculative_infer(req)

        # Standard Thompson Sampling with retries
        max_retries = self.state.max_retries or 2
        last_error = None

        for retry in range(max_retries + 1):
            arm = self._select_arm_thompson_sampling()
            if not arm:
                raise RuntimeError("No healthy providers available")

            try:
                start_time = time.time()
                response = self._infer_with_arm(arm, req)
                latency_ms = int((time.time() - start_time) * 1000)

                # Update Bayesian parameters on success
                self._update_arm_success(arm, latency_ms)
                self.circuit_breakers[arm.provider_id].record_success()

                return response

            except Exception as error:
                latency_ms = 0
                self._update_arm_failure(arm, latency_ms)
                self.circuit_breakers[arm.provider_id].record_failure()
                last_error = error

                # Exponential backoff
                if retry < max_retries:
                    time.sleep(0.1 * (2 ** retry))

        raise RuntimeError(
            f"All providers failed after {max_retries} retries: {last_error}"
        )

    def _select_arm_thompson_sampling(self) -> Optional[BanditArm]:
        """Thompson Sampling selection"""
        healthy_arms = self._get_healthy_arms()
        if not healthy_arms:
            return None

        # Exploration with probability ε
        import random
        if random.random() < self.state.exploration_rate:
            return random.choice(healthy_arms)

        # Exploitation: Sample from Beta(α, β) for each arm
        best_arm = None
        max_sample = -1.0

        for arm in healthy_arms:
            sample = arm.sample_beta()
            if sample > max_sample:
                max_sample = sample
                best_arm = arm

        return best_arm

    def _speculative_infer(self, req: InferRequest) -> InferResponse:
        """Speculative execution - race multiple providers"""
        # Get top 3 arms by expected value
        arms = self._get_top_arms_by_mean(3)
        if not arms:
            raise RuntimeError("No healthy providers for speculative execution")

        # Launch parallel requests (simplified - not truly parallel in Python)
        results = []
        for arm in arms:
            try:
                start_time = time.time()
                response = self._infer_with_arm(arm, req)
                latency_ms = int((time.time() - start_time) * 1000)
                results.append((response, arm, latency_ms, None))
                break  # Return first success
            except Exception as error:
                results.append((None, arm, 0, error))

        # Return first successful response
        for response, arm, latency_ms, error in results:
            if response:
                self._update_arm_success(arm, latency_ms)
                self.circuit_breakers[arm.provider_id].record_success()
                return response

        raise RuntimeError("All speculative requests failed")

    def _infer_with_arm(self, arm: BanditArm, req: InferRequest) -> InferResponse:
        """Make inference request to specific arm"""
        endpoint = f"{arm.endpoint}/chat/completions"

        headers = {}
        if arm.api_key:
            headers['Authorization'] = f"Bearer {arm.api_key}"

        payload = {
            "model": req.model,
            "messages": req.messages,
        }
        if req.max_tokens:
            payload["max_tokens"] = req.max_tokens
        if req.temperature:
            payload["temperature"] = req.temperature
        if req.top_p:
            payload["top_p"] = req.top_p

        response = self.session.post(
            endpoint,
            json=payload,
            headers=headers,
            timeout=self.state.timeout_ms / 1000,
        )

        if response.status_code >= 400:
            raise RuntimeError(
                f"Provider returned error {response.status_code}: {response.text}"
            )

        data = response.json()
        return InferResponse(**data)

    def _update_arm_success(self, arm: BanditArm, latency_ms: int):
        """Update arm on success"""
        arm.alpha += 1.0
        arm.total_selections += 1
        arm.total_successes += 1

        # Update composite rewards
        latency_score = self._normalize_latency(latency_ms)
        arm.avg_latency_score = self._update_moving_average(
            arm.avg_latency_score, latency_score, arm.total_selections
        )
        arm.avg_success_rate = arm.total_successes / arm.total_selections
        arm.updated_at = int(time.time())

    def _update_arm_failure(self, arm: BanditArm, latency_ms: int):
        """Update arm on failure"""
        arm.beta += 1.0
        arm.total_selections += 1
        arm.total_failures += 1

        latency_score = self._normalize_latency(latency_ms)
        arm.avg_latency_score = self._update_moving_average(
            arm.avg_latency_score, latency_score, arm.total_selections
        )
        arm.avg_success_rate = arm.total_successes / arm.total_selections
        arm.updated_at = int(time.time())

    def _normalize_latency(self, latency_ms: float) -> float:
        """Normalize latency to 0-1 score (lower = better)"""
        if latency_ms <= 0:
            return 1.0
        score = 1.0 - (latency_ms / self.state.max_latency_ms)
        return max(0.0, min(1.0, score))

    def _update_moving_average(
        self, current: float, new_value: float, count: int
    ) -> float:
        """Exponential moving average"""
        if count == 1:
            return new_value
        alpha = 2.0 / (count + 1)
        return alpha * new_value + (1 - alpha) * current

    def _get_healthy_arms(self) -> List[BanditArm]:
        """Get arms with circuit breakers closed"""
        return [
            arm
            for arm in self.state.arms
            if not self.circuit_breakers[arm.provider_id].get_is_open()
        ]

    def _get_top_arms_by_mean(self, n: int) -> List[BanditArm]:
        """Get top N arms by expected value"""
        healthy = self._get_healthy_arms()
        healthy.sort(key=lambda a: a.get_mean(), reverse=True)
        return healthy[:n]

    def update_state(self, state: BayesianState):
        """Update state (called when control plane returns)"""
        self.state = state

        # Update circuit breakers for new arms
        for arm in state.arms:
            if arm.provider_id not in self.circuit_breakers:
                self.circuit_breakers[arm.provider_id] = CircuitBreaker(
                    state.circuit_breaker_threshold
                )

    def get_state(self) -> BayesianState:
        """Get current state"""
        return self.state
