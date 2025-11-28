/**
 * Emergency Policy Fetcher - Polls for signed policy updates during outages
 *
 * This allows the SDK to receive routing updates even when the control plane
 * is completely dead. Updates are served from static endpoints (S3 + Cloudflare).
 */

export interface EmergencyPolicy {
  policy: string;         // Encrypted policy blob
  signature: string;      // Ed25519 signature
  version: number;        // Monotonically increasing version
  expires_at: number;     // Unix milliseconds
  issuer?: string;        // For audit trail
  reason?: string;        // For audit trail
}

export type PolicyUpdateCallback = (policy: EmergencyPolicy) => void;

/**
 * Emergency fetcher - polls for policy updates
 */
export class EmergencyFetcher {
  private endpoint: string;
  private checkInterval: number;
  private currentVersion: number = 0;
  private lastCheck: number = 0;
  private intervalHandle: NodeJS.Timeout | null = null;
  private stopped = false;

  private onPolicyUpdate: PolicyUpdateCallback;

  constructor(
    endpoint: string,
    checkInterval: number = 30000, // 30 seconds default
    onPolicyUpdate: PolicyUpdateCallback
  ) {
    this.endpoint = endpoint;
    this.checkInterval = checkInterval;
    this.onPolicyUpdate = onPolicyUpdate;
  }

  /**
   * Start polling for emergency policy updates
   */
  start(): void {
    if (this.stopped) {
      return;
    }

    // Immediate check on start
    this.checkForUpdate();

    // Set up periodic polling
    this.intervalHandle = setInterval(() => {
      this.checkForUpdate();
    }, this.checkInterval);
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.stopped = true;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Check for a new emergency policy
   */
  private async checkForUpdate(): Promise<void> {
    if (this.stopped) {
      return;
    }

    try {
      // Build URL with 'since' parameter
      const url = `${this.endpoint}?since=${this.currentVersion}`;

      // Fetch with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // 204 = no new policy
      if (response.status === 204) {
        this.lastCheck = Date.now();
        return;
      }

      // 200 = new policy available
      if (response.status === 200) {
        const policy: EmergencyPolicy = await response.json();

        // Update current version
        this.currentVersion = policy.version;
        this.lastCheck = Date.now();

        // Call callback
        if (this.onPolicyUpdate) {
          this.onPolicyUpdate(policy);
        }
      }

      // Other status codes are ignored (network errors, etc.)
    } catch (error) {
      // Network error - control plane may be down, which is expected
      // Don't crash the fetcher
      this.lastCheck = Date.now();
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): Record<string, any> {
    return {
      currentVersion: this.currentVersion,
      lastCheck: this.lastCheck,
      checkInterval: this.checkInterval,
      stopped: this.stopped,
    };
  }

  /**
   * Get current version
   */
  getCurrentVersion(): number {
    return this.currentVersion;
  }
}
