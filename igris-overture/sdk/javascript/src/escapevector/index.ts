/**
 * EscapeVector Mode - Complete integration for TypeScript SDK
 */

import {
  BayesianState,
  getDefaultBayesianState,
  deriveEncryptionKey,
} from './bayesian-state';
import { ThompsonRouter, InferRequest, InferResponse } from './thompson-router';
import { InertialCache } from './cache';

/**
 * Timeout threshold - 500ms
 */
const TIMEOUT_THRESHOLD = 500;

/**
 * Consecutive timeouts before triggering EscapeVector Mode
 */
const CONSECUTIVE_TIMEOUTS = 3;

/**
 * Control Plane Detector
 */
class ControlPlaneDetector {
  private consecutiveTimeouts = 0;
  private isInEscapeMode = false;
  private lastSuccessTime = Date.now();

  recordSuccess(latency: number): void {
    if (latency < TIMEOUT_THRESHOLD) {
      this.consecutiveTimeouts = 0;
      this.isInEscapeMode = false;
      this.lastSuccessTime = Date.now();
    }
  }

  recordFailure(latency: number): boolean {
    if (latency >= TIMEOUT_THRESHOLD) {
      this.consecutiveTimeouts++;

      if (this.consecutiveTimeouts >= CONSECUTIVE_TIMEOUTS) {
        this.isInEscapeMode = true;
        return true;
      }
    }
    return false;
  }

  getIsInEscapeMode(): boolean {
    return this.isInEscapeMode;
  }

  getConsecutiveTimeouts(): number {
    return this.consecutiveTimeouts;
  }

  getLastSuccessTime(): number {
    return this.lastSuccessTime;
  }

  reset(): void {
    this.consecutiveTimeouts = 0;
    this.isInEscapeMode = false;
    this.lastSuccessTime = Date.now();
  }
}

/**
 * EscapeVector Mode Manager
 */
export class EscapeVectorMode {
  private detector: ControlPlaneDetector;
  private thompsonRouter: ThompsonRouter;
  private cache: InertialCache;
  private goldCodeMode: boolean;
  private totalEscapeRequests = 0;
  private totalNormalRequests = 0;
  private lastModeSwitch = Date.now();

  private constructor(
    detector: ControlPlaneDetector,
    router: ThompsonRouter,
    cache: InertialCache,
    goldCodeMode: boolean
  ) {
    this.detector = detector;
    this.thompsonRouter = router;
    this.cache = cache;
    this.goldCodeMode = goldCodeMode;
  }

  /**
   * Initialize EscapeVector Mode
   */
  static async create(apiKey?: string, cacheDir?: string): Promise<EscapeVectorMode> {
    // Check for Gold Code Override
    const goldCodeMode = process.env.BYOK_BYPASS_CONTROL_PLANE === 'true';

    // Derive encryption key
    const encryptionKey = await deriveEncryptionKey(apiKey || '');

    // Initialize cache
    const cache = new InertialCache(cacheDir);
    await cache.init(encryptionKey);

    // Load or create Bayesian state
    let state: BayesianState;
    try {
      if (await cache.exists()) {
        state = await cache.load();
      } else {
        state = getDefaultBayesianState();
      }
    } catch (error) {
      // Cache expired or tampered - use default
      state = getDefaultBayesianState();
    }

    const detector = new ControlPlaneDetector();
    const router = new ThompsonRouter(state);

    // Save initial state
    try {
      await cache.save(state);
    } catch (error) {
      // Non-fatal - continue with in-memory state
      console.warn('Failed to save initial state:', error);
    }

    return new EscapeVectorMode(detector, router, cache, goldCodeMode);
  }

  /**
   * Should use EscapeVector Mode?
   */
  shouldUseEscapeVector(): boolean {
    if (this.goldCodeMode) {
      return true;
    }
    return this.detector.getIsInEscapeMode();
  }

  /**
   * Record control plane request result
   */
  recordControlPlaneRequest(latency: number, error: Error | null): void {
    this.totalNormalRequests++;

    if (error || latency >= TIMEOUT_THRESHOLD) {
      const triggered = this.detector.recordFailure(latency);
      if (triggered) {
        this.lastModeSwitch = Date.now();
      }
    } else {
      this.detector.recordSuccess(latency);
    }
  }

  /**
   * Perform inference using Thompson Sampling fallback
   */
  async infer(req: InferRequest): Promise<InferResponse> {
    this.totalEscapeRequests++;
    return this.thompsonRouter.infer(req);
  }

  /**
   * Sync state from control plane
   */
  async syncStateFromControlPlane(state: BayesianState): Promise<void> {
    this.thompsonRouter.updateState(state);
    await this.cache.save(state);
  }

  /**
   * Get metrics
   */
  getMetrics(): Record<string, any> {
    return {
      goldCodeMode: this.goldCodeMode,
      isInEscapeMode: this.detector.getIsInEscapeMode(),
      consecutiveTimeouts: this.detector.getConsecutiveTimeouts(),
      totalEscapeRequests: this.totalEscapeRequests,
      totalNormalRequests: this.totalNormalRequests,
      lastModeSwitch: this.lastModeSwitch,
      lastControlPlaneSuccess: this.detector.getLastSuccessTime(),
    };
  }
}

// Export all types and classes
export * from './bayesian-state';
export * from './thompson-router';
export * from './cache';
export { RustThompsonRouter, RustCircuitBreaker, RustBayesianSigner, deriveEncryptionKeyRust } from './wasm-wrapper';
