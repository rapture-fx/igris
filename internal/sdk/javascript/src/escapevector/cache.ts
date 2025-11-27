/**
 * Inertial Cache - 72-hour persistent Bayesian state storage
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { BayesianState, BayesianSigner, EncryptedBayesianState } from './bayesian-state';

/**
 * Inertial Cache Manager
 */
export class InertialCache {
  private cachePath: string;
  private signer: BayesianSigner;

  constructor(cacheDir?: string, signer?: BayesianSigner) {
    // Default cache directory
    if (!cacheDir) {
      const homeDir = os.homedir();
      cacheDir = path.join(homeDir, '.config', 'schlep');
    }

    this.cachePath = path.join(cacheDir, 'bayesian_state.enc');
    this.signer = signer || new BayesianSigner();
  }

  /**
   * Initialize with encryption key
   */
  async init(keyBytes: Uint8Array): Promise<void> {
    await this.signer.init(keyBytes);

    // Ensure cache directory exists
    const dir = path.dirname(this.cachePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  }

  /**
   * Save encrypted Bayesian state
   */
  async save(state: BayesianState): Promise<void> {
    // Encrypt state
    const encrypted = await this.signer.encryptState(state);

    // Serialize encrypted state
    const data = JSON.stringify({
      ciphertext: Buffer.from(encrypted.ciphertext).toString('base64'),
      iv: Buffer.from(encrypted.iv).toString('base64'),
      hmac: Buffer.from(encrypted.hmac).toString('base64'),
      version: encrypted.version,
      timestamp: encrypted.timestamp,
      expiresAt: encrypted.expiresAt,
    });

    // Write atomically
    const tempPath = this.cachePath + '.tmp';
    await fs.writeFile(tempPath, data, { mode: 0o600 });
    await fs.rename(tempPath, this.cachePath);
  }

  /**
   * Load and decrypt Bayesian state
   */
  async load(): Promise<BayesianState> {
    try {
      const data = await fs.readFile(this.cachePath, 'utf-8');
      const parsed = JSON.parse(data);

      const encrypted: EncryptedBayesianState = {
        ciphertext: Buffer.from(parsed.ciphertext, 'base64').buffer,
        iv: Buffer.from(parsed.iv, 'base64').buffer,
        hmac: Buffer.from(parsed.hmac, 'base64').buffer,
        version: parsed.version,
        timestamp: parsed.timestamp,
        expiresAt: parsed.expiresAt,
      };

      return await this.signer.decryptState(encrypted);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error('No cached state found');
      }
      throw new Error(
        `Failed to load cache (may be expired or tampered): ${(error as Error).message}`
      );
    }
  }

  /**
   * Check if cache exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.cachePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear cache
   */
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.cachePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw new Error(`Failed to clear cache: ${(error as Error).message}`);
      }
    }
  }
}
