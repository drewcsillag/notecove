/**
 * Telemetry Configuration
 *
 * Dual-mode telemetry system:
 * - Local mode: Always on, console/file logging for development
 * - Remote mode: Optional, user-controlled export to Datadog
 */

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { app } from 'electron';

export interface TelemetryConfig {
  /** Enable console metrics logging (local debugging) */
  consoleMetricsEnabled: boolean;

  /** Enable remote metrics export to Datadog */
  remoteMetricsEnabled: boolean;

  /** Datadog API endpoint (US1 by default) */
  datadogEndpoint?: string;

  /** Datadog API key (required if remoteMetricsEnabled) */
  datadogApiKey?: string;

  /** Export interval in milliseconds (default: 60s) */
  exportIntervalMs?: number;

  /** Service name for telemetry */
  serviceName?: string;

  /** Development mode - verbose logging */
  devMode?: boolean;
}

export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  consoleMetricsEnabled: false,
  remoteMetricsEnabled: false,
  datadogEndpoint: 'https://api.datadoghq.com',
  exportIntervalMs: 60000, // 1 minute
  serviceName: 'notecove',
  devMode: process.env['NODE_ENV'] !== 'production',
};

export class TelemetryManager {
  private sdk: NodeSDK | null = null;
  private config: TelemetryConfig;
  private initialized = false;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_TELEMETRY_CONFIG, ...config };
  }

  /**
   * Initialize OpenTelemetry SDK
   * This sets up both local (console) and optionally remote (Datadog) exporters
   */
  initialize(): void {
    if (this.initialized) {
      console.warn('[Telemetry] Already initialized');
      return;
    }

    // Set up diagnostic logging for OTel itself
    if (this.config.devMode) {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
    }

    // Create resource with service metadata (uses OpenTelemetry semantic conventions)
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: this.config.serviceName ?? 'notecove',
      [ATTR_SERVICE_VERSION]: app.getVersion(),
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: this.config.devMode ? 'development' : 'production',
    });

    // Set up metric readers
    const metricReaders: PeriodicExportingMetricReader[] = [];
    const exportInterval = this.config.exportIntervalMs ?? 60000;

    // Local exporter (optional, user-controlled)
    if (this.config.consoleMetricsEnabled) {
      const consoleReader = new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: exportInterval,
      });
      metricReaders.push(consoleReader);
      console.log('[Telemetry] Console metrics enabled');
    } else {
      console.log('[Telemetry] Console metrics disabled');
    }

    // Remote exporter (optional, user-controlled)
    if (this.config.remoteMetricsEnabled) {
      if (!this.config.datadogApiKey) {
        console.error('[Telemetry] Remote metrics enabled but no API key provided');
      } else {
        const otlpExporter = new OTLPMetricExporter({
          url: `${this.config.datadogEndpoint}/api/v2/otlp/v1/metrics`,
          headers: {
            'DD-API-KEY': this.config.datadogApiKey,
          },
          timeoutMillis: 10000,
        });

        const otlpReader = new PeriodicExportingMetricReader({
          exporter: otlpExporter,
          exportIntervalMillis: exportInterval,
        });
        metricReaders.push(otlpReader);

        console.log('[Telemetry] Remote metrics enabled - exporting to Datadog');
      }
    } else {
      console.log('[Telemetry] Local mode only - remote metrics disabled');
    }

    // Create SDK with configuration (NodeSDK type is not fully typed)
    // Pass all metric readers to avoid deprecation warning
    this.sdk = new NodeSDK({
      resource,
      metricReaders,
    });

    try {
      this.sdk.start();
      this.initialized = true;
      console.log('[Telemetry] OpenTelemetry SDK initialized');
    } catch (error) {
      console.error('[Telemetry] Failed to initialize SDK:', error);
      throw error;
    }
  }

  /**
   * Update configuration (e.g., when user toggles metrics settings)
   */
  async updateConfig(newConfig: Partial<TelemetryConfig>): Promise<void> {
    const oldConsoleEnabled = this.config.consoleMetricsEnabled;
    const oldRemoteEnabled = this.config.remoteMetricsEnabled;
    this.config = { ...this.config, ...newConfig };

    // If any metrics setting changed, reinitialize
    const consoleChanged = oldConsoleEnabled !== this.config.consoleMetricsEnabled;
    const remoteChanged = oldRemoteEnabled !== this.config.remoteMetricsEnabled;
    if (consoleChanged || remoteChanged) {
      console.log('[Telemetry] Metrics settings changed, reinitializing...');
      await this.shutdown();
      this.initialize();
    }
  }

  /**
   * Shutdown telemetry system gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.initialized || !this.sdk) {
      return;
    }

    try {
      await this.sdk.shutdown();
      this.initialized = false;
      console.log('[Telemetry] OpenTelemetry SDK shut down');
    } catch (error) {
      console.error('[Telemetry] Error shutting down SDK:', error);
    }
  }

  /**
   * Check if telemetry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<TelemetryConfig> {
    return { ...this.config };
  }
}

// Global instance
let globalTelemetryManager: TelemetryManager | null = null;

/**
 * Get global telemetry manager instance
 */
export function getTelemetryManager(): TelemetryManager {
  globalTelemetryManager ??= new TelemetryManager();
  return globalTelemetryManager;
}

/**
 * Initialize global telemetry with config
 */
export async function initializeTelemetry(config?: Partial<TelemetryConfig>): Promise<void> {
  const manager = getTelemetryManager();
  if (config) {
    await manager.updateConfig(config);
  }
  manager.initialize();
}

/**
 * Shutdown global telemetry
 */
export async function shutdownTelemetry(): Promise<void> {
  if (globalTelemetryManager) {
    await globalTelemetryManager.shutdown();
  }
}
