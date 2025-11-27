/**
 * Thompson Sampling Router - Local fallback with Bayesian optimization
 */

import fetch from 'node-fetch';
import { BanditArm, BayesianState, BetaSampler } from './bayesian-state';

export interface InferRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface InferResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Circuit Breaker - tracks provider health with atomic operations
 */
class CircuitBreaker {
  private failures = 0;
  private isOpen = false;
  private lastOpened = 0;

  constructor(private threshold: number) {}

  recordSuccess(): void {
    this.failures = 0;
    this.isOpen = false;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.isOpen = true;
      this.lastOpened = Date.now();
    }
  }

  getIsOpen(): boolean {
    // Auto-reset after 30 seconds
    if (this.isOpen && Date.now() - this.lastOpened > 30000) {
      this.isOpen = false;
      this.failures = 0;
    }
    return this.isOpen;
  }
}

/**
 * Thompson Sampling Router
 */
export class ThompsonRouter {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(private state: BayesianState) {
    // Initialize circuit breakers
    for (const arm of state.arms) {
      this.circuitBreakers.set(
        arm.providerId,
        new CircuitBreaker(state.circuitBreakerThreshold)
      );
    }
  }

  /**
   * Perform inference using Thompson Sampling
   */
  async infer(req: InferRequest): Promise<InferResponse> {
    if (this.state.speculativeExecution) {
      return this.speculativeInfer(req);
    }

    // Standard Thompson Sampling with retries
    const maxRetries = this.state.maxRetries || 2;
    let lastError: Error | null = null;

    for (let retry = 0; retry <= maxRetries; retry++) {
      const arm = this.selectArmThompsonSampling();
      if (!arm) {
        throw new Error('No healthy providers available');
      }

      try {
        const startTime = Date.now();
        const response = await this.inferWithArm(arm, req);
        const latencyMs = Date.now() - startTime;

        // Update Bayesian parameters on success
        this.updateArmSuccess(arm, latencyMs);
        this.circuitBreakers.get(arm.providerId)!.recordSuccess();

        return response;
      } catch (error) {
        const latencyMs = Date.now() - Date.now();
        this.updateArmFailure(arm, latencyMs);
        this.circuitBreakers.get(arm.providerId)!.recordFailure();
        lastError = error as Error;

        // Exponential backoff
        if (retry < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * Math.pow(2, retry))
          );
        }
      }
    }

    throw new Error(
      `All providers failed after ${maxRetries} retries: ${lastError?.message}`
    );
  }

  /**
   * Thompson Sampling selection
   */
  private selectArmThompsonSampling(): BanditArm | null {
    const healthyArms = this.getHealthyArms();
    if (healthyArms.length === 0) {
      return null;
    }

    // Exploration with probability ε
    if (Math.random() < this.state.explorationRate) {
      return healthyArms[Math.floor(Math.random() * healthyArms.length)];
    }

    // Exploitation: Sample from Beta(α, β) for each arm
    let bestArm: BanditArm | null = null;
    let maxSample = -1;

    for (const arm of healthyArms) {
      const sample = BetaSampler.sample(arm.alpha, arm.beta);
      if (sample > maxSample) {
        maxSample = sample;
        bestArm = arm;
      }
    }

    return bestArm;
  }

  /**
   * Speculative execution - race multiple providers
   */
  private async speculativeInfer(req: InferRequest): Promise<InferResponse> {
    const arms = this.getTopArmsByMean(3);
    if (arms.length === 0) {
      throw new Error('No healthy providers for speculative execution');
    }

    // Create abort controllers for each request
    const controllers = arms.map(() => new AbortController());

    // Launch parallel requests
    const promises = arms.map((arm, index) =>
      this.inferWithArm(arm, req, controllers[index].signal).then(
        (response) => ({
          response,
          armId: arm.providerId,
          latencyMs: Date.now(),
          error: null,
        }),
        (error) => ({
          response: null,
          armId: arm.providerId,
          latencyMs: Date.now(),
          error,
        })
      )
    );

    // Wait for first successful response
    const results = await Promise.allSettled(promises);

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') {
        const result = (results[i] as PromiseFulfilledResult<any>).value;
        if (result.response) {
          // Cancel other requests
          controllers.forEach((c, idx) => {
            if (idx !== i) c.abort();
          });

          // Update winner
          const arm = arms[i];
          this.updateArmSuccess(arm, 0);
          this.circuitBreakers.get(arm.providerId)!.recordSuccess();

          return result.response;
        }
      }
    }

    throw new Error('All speculative requests failed');
  }

  /**
   * Make inference request to specific arm
   */
  private async inferWithArm(
    arm: BanditArm,
    req: InferRequest,
    signal?: AbortSignal
  ): Promise<InferResponse> {
    const endpoint = `${arm.endpoint}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(arm.apiKey ? { Authorization: `Bearer ${arm.apiKey}` } : {}),
      },
      body: JSON.stringify(req),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Provider returned error ${response.status}: ${text}`);
    }

    return (await response.json()) as InferResponse;
  }

  /**
   * Update arm on success
   */
  private updateArmSuccess(arm: BanditArm, latencyMs: number): void {
    arm.alpha += 1.0;
    arm.totalSelections++;
    arm.totalSuccesses++;

    // Update composite rewards
    const latencyScore = this.normalizeLatency(latencyMs);
    arm.avgLatencyScore = this.updateMovingAverage(
      arm.avgLatencyScore,
      latencyScore,
      arm.totalSelections
    );
    arm.avgSuccessRate = arm.totalSuccesses / arm.totalSelections;
    arm.updatedAt = Date.now();
  }

  /**
   * Update arm on failure
   */
  private updateArmFailure(arm: BanditArm, latencyMs: number): void {
    arm.beta += 1.0;
    arm.totalSelections++;
    arm.totalFailures++;

    const latencyScore = this.normalizeLatency(latencyMs);
    arm.avgLatencyScore = this.updateMovingAverage(
      arm.avgLatencyScore,
      latencyScore,
      arm.totalSelections
    );
    arm.avgSuccessRate = arm.totalSuccesses / arm.totalSelections;
    arm.updatedAt = Date.now();
  }

  /**
   * Normalize latency to 0-1 score
   */
  private normalizeLatency(latencyMs: number): number {
    if (latencyMs <= 0) return 1.0;
    const score = 1.0 - latencyMs / this.state.maxLatencyMs;
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Exponential moving average
   */
  private updateMovingAverage(
    current: number,
    newValue: number,
    count: number
  ): number {
    if (count === 1) return newValue;
    const alpha = 2.0 / (count + 1);
    return alpha * newValue + (1 - alpha) * current;
  }

  /**
   * Get healthy arms (circuit breakers closed)
   */
  private getHealthyArms(): BanditArm[] {
    return this.state.arms.filter(
      (arm) => !this.circuitBreakers.get(arm.providerId)?.getIsOpen()
    );
  }

  /**
   * Get top N arms by expected value
   */
  private getTopArmsByMean(n: number): BanditArm[] {
    const healthy = this.getHealthyArms();
    healthy.sort((a, b) => {
      const meanA = a.alpha / (a.alpha + a.beta);
      const meanB = b.alpha / (b.alpha + b.beta);
      return meanB - meanA;
    });
    return healthy.slice(0, n);
  }

  /**
   * Update state (called when control plane returns)
   */
  updateState(state: BayesianState): void {
    this.state = state;

    // Update circuit breakers for new arms
    for (const arm of state.arms) {
      if (!this.circuitBreakers.has(arm.providerId)) {
        this.circuitBreakers.set(
          arm.providerId,
          new CircuitBreaker(state.circuitBreakerThreshold)
        );
      }
    }
  }

  /**
   * Get current state
   */
  getState(): BayesianState {
    return this.state;
  }
}
