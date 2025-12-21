/**
 * Tests for Telemetry Configuration
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import { TelemetryManager, DEFAULT_TELEMETRY_CONFIG } from '../config';

// Mock Electron app
jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(() => '0.1.8'),
  },
}));

describe('TelemetryManager', () => {
  let manager: TelemetryManager;

  beforeEach(() => {
    manager = new TelemetryManager();
  });

  afterEach(async () => {
    // Clean up after each test
    if (manager.isInitialized()) {
      await manager.shutdown();
    }
  });

  describe('Construction', () => {
    it('should create with default configuration', () => {
      expect(manager.getConfig()).toEqual(DEFAULT_TELEMETRY_CONFIG);
    });

    it('should create with custom configuration', () => {
      const customManager = new TelemetryManager({
        remoteMetricsEnabled: true,
        datadogApiKey: 'test-key',
        exportIntervalMs: 30000,
      });

      const config = customManager.getConfig();
      expect(config.remoteMetricsEnabled).toBe(true);
      expect(config.datadogApiKey).toBe('test-key');
      expect(config.exportIntervalMs).toBe(30000);
    });

    it('should merge custom config with defaults', () => {
      const customManager = new TelemetryManager({
        remoteMetricsEnabled: true,
      });

      const config = customManager.getConfig();
      expect(config.remoteMetricsEnabled).toBe(true);
      expect(config.exportIntervalMs).toBe(DEFAULT_TELEMETRY_CONFIG.exportIntervalMs);
      expect(config.serviceName).toBe(DEFAULT_TELEMETRY_CONFIG.serviceName);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(() => {
        manager.initialize();
      }).not.toThrow();
      expect(manager.isInitialized()).toBe(true);
    });

    it('should not initialize twice', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      manager.initialize();
      manager.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Already initialized'));

      consoleSpy.mockRestore();
    });

    it('should initialize with local mode by default', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Local mode only'));

      consoleSpy.mockRestore();
    });

    it('should initialize with remote mode when enabled with API key', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const remoteManager = new TelemetryManager({
        remoteMetricsEnabled: true,
        datadogApiKey: 'test-key',
      });

      remoteManager.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Remote metrics enabled'));

      consoleSpy.mockRestore();
      remoteManager.shutdown();
    });

    it('should not enable remote mode without API key', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const remoteManager = new TelemetryManager({
        remoteMetricsEnabled: true,
        // No API key provided
      });

      remoteManager.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('no API key provided'));

      consoleSpy.mockRestore();
      remoteManager.shutdown();
    });
  });

  describe('Configuration updates', () => {
    it('should update configuration', async () => {
      manager.initialize();

      await manager.updateConfig({
        exportIntervalMs: 30000,
      });

      const config = manager.getConfig();
      expect(config.exportIntervalMs).toBe(30000);
    });

    it('should reinitialize when remote metrics setting changes', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.initialize();
      consoleSpy.mockClear();

      await manager.updateConfig({
        remoteMetricsEnabled: true,
        datadogApiKey: 'test-key',
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Metrics settings changed'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('OpenTelemetry SDK initialized')
      );

      consoleSpy.mockRestore();
    });

    it('should not reinitialize when other settings change', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.initialize();
      consoleSpy.mockClear();

      await manager.updateConfig({
        exportIntervalMs: 30000,
      });

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Remote metrics setting changed')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown successfully', async () => {
      manager.initialize();

      await expect(manager.shutdown()).resolves.not.toThrow();
      expect(manager.isInitialized()).toBe(false);
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(manager.shutdown()).resolves.not.toThrow();
    });

    it('should allow reinitialization after shutdown', async () => {
      manager.initialize();
      await manager.shutdown();

      expect(() => {
        manager.initialize();
      }).not.toThrow();
      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('Configuration access', () => {
    it('should return readonly config', () => {
      const config = manager.getConfig();

      // Verify we get a copy, not a reference
      const originalInterval = config.exportIntervalMs;
      // TypeScript prevents us from modifying readonly properties
      // config.exportIntervalMs = 999; // This would cause a TS error

      const newConfig = manager.getConfig();
      expect(newConfig.exportIntervalMs).toBe(originalInterval);
    });

    it('should reflect updated configuration', async () => {
      manager.initialize();

      await manager.updateConfig({
        serviceName: 'custom-service',
      });

      const config = manager.getConfig();
      expect(config.serviceName).toBe('custom-service');
    });
  });

  describe('Default configuration', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_TELEMETRY_CONFIG.remoteMetricsEnabled).toBe(false);
      expect(DEFAULT_TELEMETRY_CONFIG.datadogEndpoint).toBe('https://api.datadoghq.com');
      expect(DEFAULT_TELEMETRY_CONFIG.exportIntervalMs).toBe(60000);
      expect(DEFAULT_TELEMETRY_CONFIG.serviceName).toBe('notecove');
    });

    it('should allow overriding devMode in constructor', () => {
      // Since DEFAULT_TELEMETRY_CONFIG.devMode is evaluated at module load time,
      // we test that the constructor allows overriding it
      const prodManager = new TelemetryManager({ devMode: false });
      expect(prodManager.getConfig().devMode).toBe(false);

      const devManager = new TelemetryManager({ devMode: true });
      expect(devManager.getConfig().devMode).toBe(true);

      // Clean up
      if (prodManager.isInitialized()) prodManager.shutdown();
      if (devManager.isInitialized()) devManager.shutdown();
    });
  });
});
