/**
 * mDNS/Bonjour Service Advertisement
 *
 * Advertises the NoteCove web server on the local network so devices
 * can discover it without manually entering the IP address.
 */

import { Bonjour, Service } from 'bonjour-service';
import { hostname } from 'os';

/**
 * mDNS service configuration
 */
export interface MDNSConfig {
  /** Port to advertise */
  port: number;
  /** Whether TLS is enabled */
  tlsEnabled: boolean;
  /** Optional custom name (defaults to hostname) */
  name?: string;
}

/**
 * Manages mDNS/Bonjour service advertisement
 */
export class MDNSManager {
  private bonjour: Bonjour | null = null;
  private service: Service | null = null;
  private isAdvertising = false;

  /**
   * Start advertising the service
   */
  start(config: MDNSConfig): boolean {
    if (this.isAdvertising) {
      console.log('[mDNS] Already advertising');
      return true;
    }

    try {
      // Create Bonjour instance
      this.bonjour = new Bonjour();

      // Determine service name
      const deviceName = config.name ?? hostname();
      const serviceName = `NoteCove on ${deviceName}`;

      // Use _http._tcp or _https._tcp depending on TLS mode
      const type = config.tlsEnabled ? 'https' : 'http';

      // Publish the service
      this.service = this.bonjour.publish({
        name: serviceName,
        type,
        port: config.port,
        txt: {
          path: '/',
          // Include a hint that auth is required
          auth: 'token',
        },
      });

      this.isAdvertising = true;
      console.log(
        `[mDNS] Advertising service: ${serviceName} (type: _${type}._tcp, port: ${config.port})`
      );

      return true;
    } catch (error) {
      console.warn('[mDNS] Failed to start advertising:', error);
      this.cleanup();
      return false;
    }
  }

  /**
   * Stop advertising the service
   */
  stop(): void {
    if (!this.isAdvertising) {
      return;
    }

    this.cleanup();
    console.log('[mDNS] Stopped advertising');
  }

  /**
   * Check if currently advertising
   */
  isRunning(): boolean {
    return this.isAdvertising;
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.service) {
      try {
        // Service.stop may not exist on all versions, check before calling
        if ('stop' in this.service && typeof this.service.stop === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          this.service.stop();
        }
      } catch {
        // Ignore errors during cleanup
      }
      this.service = null;
    }

    if (this.bonjour) {
      try {
        this.bonjour.destroy();
      } catch {
        // Ignore errors during cleanup
      }
      this.bonjour = null;
    }

    this.isAdvertising = false;
  }
}
