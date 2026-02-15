/**
 * EscapeVector Mode - Thompson Sampling-powered resilience for TypeScript/JavaScript
 *
 * Maintains Bayesian optimization even during total control plane outages.
 */

import { webcrypto } from 'crypto';

/**
 * Bandit arm representing a provider with Thompson Sampling parameters
 */
export interface BanditArm {
  providerId: string;
  name: string;
  endpoint: string;
  apiKey?: string;

  // Thompson Sampling parameters
  alpha: number;  // Success parameter
  beta: number;   // Failure parameter

  // Performance tracking
  totalSelections: number;
  totalSuccesses: number;
  totalFailures: number;

  // Composite reward components (0-1 normalized)
  avgLatencyScore: number;
  avgCostEfficiency: number;
  avgSuccessRate: number;

  // Reward weights
  weightLatency: number;  // α - latency weight
  weightCost: number;     // β - cost weight
  weightSuccess: number;  // γ - success weight

  // Last updated timestamp
  updatedAt: number;
}

/**
 * Complete Bayesian state for Thompson Sampling
 */
export interface BayesianState {
  version: number;
  timestamp: number;
  arms: BanditArm[];

  // Configuration
  explorationRate: number;
  circuitBreakerThreshold: number;
  timeoutMs: number;
  maxRetries: number;
  speculativeExecution: boolean;

  // Normalization parameters
  maxLatencyMs: number;
  maxCostUsd: number;
}

/**
 * Encrypted Bayesian state with HMAC signature
 */
export interface EncryptedBayesianState {
  ciphertext: ArrayBuffer;
  iv: ArrayBuffer;
  hmac: ArrayBuffer;
  version: number;
  timestamp: number;
  expiresAt: number;
}

/**
 * Inertial TTL - 72 hours
 */
export const INERTIAL_TTL = 72 * 60 * 60 * 1000; // 72 hours in ms

/**
 * Max clock skew for tamper detection
 */
export const MAX_CLOCK_SKEW = 5 * 60 * 1000; // 5 minutes in ms

/**
 * Bayesian state signer - handles encryption and HMAC
 */
export class BayesianSigner {
  private key: CryptoKey | null = null;
  private hmacKey: CryptoKey | null = null;

  /**
   * Initialize signer with 32-byte key
   */
  async init(keyBytes: Uint8Array): Promise<void> {
    if (keyBytes.length !== 32) {
      throw new Error('Key must be 32 bytes for AES-256');
    }

    // Import encryption key
    this.key = await webcrypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );

    // Import HMAC key
    this.hmacKey = await webcrypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }

  /**
   * Encrypt and sign Bayesian state
   */
  async encryptState(state: BayesianState): Promise<EncryptedBayesianState> {
    if (!this.key || !this.hmacKey) {
      throw new Error('Signer not initialized');
    }

    // Serialize state
    const plaintext = new TextEncoder().encode(JSON.stringify(state));

    // Generate IV
    const iv = webcrypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const ciphertext = await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      plaintext
    );

    // Calculate HMAC
    const hmacData = new Uint8Array(ciphertext.byteLength + iv.length);
    hmacData.set(new Uint8Array(ciphertext), 0);
    hmacData.set(iv, ciphertext.byteLength);

    const hmac = await webcrypto.subtle.sign(
      'HMAC',
      this.hmacKey,
      hmacData
    );

    const now = Date.now();
    return {
      ciphertext,
      iv: iv.buffer,
      hmac,
      version: state.version,
      timestamp: now,
      expiresAt: now + INERTIAL_TTL,
    };
  }

  /**
   * Decrypt and verify Bayesian state
   */
  async decryptState(encrypted: EncryptedBayesianState): Promise<BayesianState> {
    if (!this.key || !this.hmacKey) {
      throw new Error('Signer not initialized');
    }

    const now = Date.now();

    // Detect clock tampering
    if (encrypted.timestamp > now + MAX_CLOCK_SKEW) {
      throw new Error('State timestamp in future - clock tampered');
    }

    // Check expiration (72-hour inertial quorum)
    if (now > encrypted.expiresAt) {
      throw new Error(
        `Bayesian state expired at ${encrypted.expiresAt} (current: ${now}) - force Gold Code Override`
      );
    }

    // Verify HMAC
    const hmacData = new Uint8Array(
      encrypted.ciphertext.byteLength + encrypted.iv.byteLength
    );
    hmacData.set(new Uint8Array(encrypted.ciphertext), 0);
    hmacData.set(new Uint8Array(encrypted.iv), encrypted.ciphertext.byteLength);

    const valid = await webcrypto.subtle.verify(
      'HMAC',
      this.hmacKey,
      encrypted.hmac,
      hmacData
    );

    if (!valid) {
      throw new Error('HMAC verification failed - state may be tampered');
    }

    // Decrypt
    const plaintext = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.iv },
      this.key,
      encrypted.ciphertext
    );

    // Deserialize
    const json = new TextDecoder().decode(plaintext);
    return JSON.parse(json);
  }
}

/**
 * Beta distribution sampling helper
 */
export class BetaSampler {
  /**
   * Sample from Beta(α, β) using mean approximation with Gaussian noise
   */
  static sample(alpha: number, beta: number): number {
    if (alpha <= 0 || beta <= 0) {
      return 0.5;
    }

    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));

    // Add Gaussian noise for exploration
    const noise = this.gaussianNoise() * Math.sqrt(variance);
    const sample = mean + noise;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, sample));
  }

  /**
   * Generate Gaussian noise using Box-Muller transform
   */
  private static gaussianNoise(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

/**
 * Get default Bayesian state for Gold Code Override
 */
export function getDefaultBayesianState(): BayesianState {
  const now = Date.now();
  return {
    version: 0,
    timestamp: now,
    arms: [
      {
        providerId: 'openai',
        name: 'openai',
        endpoint: 'https://api.openai.com/v1',
        alpha: 1.0,
        beta: 1.0,
        totalSelections: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        avgLatencyScore: 0,
        avgCostEfficiency: 0,
        avgSuccessRate: 0,
        weightLatency: 0.33,
        weightCost: 0.33,
        weightSuccess: 0.34,
        updatedAt: now,
      },
      {
        providerId: 'anthropic',
        name: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1',
        alpha: 1.0,
        beta: 1.0,
        totalSelections: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        avgLatencyScore: 0,
        avgCostEfficiency: 0,
        avgSuccessRate: 0,
        weightLatency: 0.33,
        weightCost: 0.33,
        weightSuccess: 0.34,
        updatedAt: now,
      },
      {
        providerId: 'google',
        name: 'google',
        endpoint: 'https://generativelanguage.googleapis.com/v1',
        alpha: 1.0,
        beta: 1.0,
        totalSelections: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        avgLatencyScore: 0,
        avgCostEfficiency: 0,
        avgSuccessRate: 0,
        weightLatency: 0.33,
        weightCost: 0.33,
        weightSuccess: 0.34,
        updatedAt: now,
      },
    ],
    explorationRate: 0.1,
    circuitBreakerThreshold: 5,
    timeoutMs: 10000,
    maxRetries: 2,
    speculativeExecution: false,
    maxLatencyMs: 5000.0,
    maxCostUsd: 1.0,
  };
}

/**
 * Derive encryption key from API key using SHA-256
 */
export async function deriveEncryptionKey(apiKey: string): Promise<Uint8Array> {
  const key = apiKey || 'igris-default-encryption-key-change-me';
  const hash = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return new Uint8Array(hash);
}
