/**
 * Feature Flag Handlers Tests
 *
 * Tests for feature flag IPC handlers.
 */

import { FeatureFlag, FEATURE_FLAG_METADATA } from '@notecove/shared';

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
  },
  app: {
    getPath: jest.fn((name: string) => {
      if (name === 'userData') {
        return '/mock/user/data';
      }
      return `/mock/${name}`;
    }),
  },
}));

import { ipcMain } from 'electron';
import {
  registerFeatureFlagHandlers,
  unregisterFeatureFlagHandlers,
} from '../../handlers/feature-flag-handlers';
import { createMockConfigManager, createMockEvent, type MockConfigManager } from './test-utils';
import type { HandlerContext } from '../../handlers/types';

describe('Feature Flag Handlers', () => {
  let mockConfigManager: MockConfigManager;
  let mockBroadcastToAll: jest.Mock;
  let ctx: HandlerContext;
  let registeredHandlers: Map<string, (...args: unknown[]) => Promise<unknown>>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mocks
    mockConfigManager = createMockConfigManager();
    mockBroadcastToAll = jest.fn();

    // Create minimal context for feature flag handlers
    ctx = {
      configManager: mockConfigManager as any,
      broadcastToAll: mockBroadcastToAll,
      // Other required fields (not used by feature flag handlers)
      crdtManager: {} as any,
      database: {} as any,
      storageManager: {} as any,
      noteMoveManager: {} as any,
      diagnosticsManager: {} as any,
      backupManager: {} as any,
      profileId: 'test-profile',
      discoverImageAcrossSDs: jest.fn() as any,
    };

    // Capture registered handlers
    registeredHandlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: unknown) => {
      registeredHandlers.set(channel, handler as (...args: unknown[]) => Promise<unknown>);
    });

    // Register handlers
    registerFeatureFlagHandlers(ctx);
  });

  afterEach(() => {
    unregisterFeatureFlagHandlers();
  });

  describe('featureFlags:getAll', () => {
    it('should return all feature flags with metadata', async () => {
      const mockFlags = {
        telemetry: true,
        viewHistory: false,
        webServer: true,
      };
      mockConfigManager.getFeatureFlags.mockResolvedValue(mockFlags);

      const handler = registeredHandlers.get('featureFlags:getAll');
      expect(handler).toBeDefined();

      const mockEvent = createMockEvent();
      const result = await handler!(mockEvent);

      expect(result).toEqual([
        {
          flag: FeatureFlag.Telemetry,
          enabled: true,
          metadata: FEATURE_FLAG_METADATA[FeatureFlag.Telemetry],
        },
        {
          flag: FeatureFlag.ViewHistory,
          enabled: false,
          metadata: FEATURE_FLAG_METADATA[FeatureFlag.ViewHistory],
        },
        {
          flag: FeatureFlag.WebServer,
          enabled: true,
          metadata: FEATURE_FLAG_METADATA[FeatureFlag.WebServer],
        },
      ]);
    });

    it('should return default values when no flags configured', async () => {
      mockConfigManager.getFeatureFlags.mockResolvedValue({
        telemetry: false,
        viewHistory: false,
        webServer: false,
      });

      const handler = registeredHandlers.get('featureFlags:getAll');
      const mockEvent = createMockEvent();
      const result = await handler!(mockEvent);

      expect(result).toHaveLength(3);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ flag: FeatureFlag.Telemetry, enabled: false }),
          expect.objectContaining({ flag: FeatureFlag.ViewHistory, enabled: false }),
          expect.objectContaining({ flag: FeatureFlag.WebServer, enabled: false }),
        ])
      );
    });
  });

  describe('featureFlags:get', () => {
    it('should return specific feature flag value', async () => {
      mockConfigManager.getFeatureFlag.mockResolvedValue(true);

      const handler = registeredHandlers.get('featureFlags:get');
      expect(handler).toBeDefined();

      const mockEvent = createMockEvent();
      const result = await handler!(mockEvent, FeatureFlag.Telemetry);

      expect(result).toBe(true);
      expect(mockConfigManager.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.Telemetry);
    });

    it('should throw for invalid feature flag', async () => {
      const handler = registeredHandlers.get('featureFlags:get');
      const mockEvent = createMockEvent();

      await expect(handler!(mockEvent, 'invalidFlag')).rejects.toThrow(
        'Invalid feature flag: invalidFlag'
      );
    });
  });

  describe('featureFlags:set', () => {
    it('should set feature flag and broadcast change', async () => {
      const handler = registeredHandlers.get('featureFlags:set');
      expect(handler).toBeDefined();

      const mockEvent = createMockEvent();
      const result = await handler!(mockEvent, FeatureFlag.Telemetry, true);

      expect(mockConfigManager.setFeatureFlag).toHaveBeenCalledWith(FeatureFlag.Telemetry, true);
      expect(mockBroadcastToAll).toHaveBeenCalledWith('featureFlags:changed', {
        flag: FeatureFlag.Telemetry,
        enabled: true,
      });
      expect(result).toEqual({
        success: true,
        requiresRestart: FEATURE_FLAG_METADATA[FeatureFlag.Telemetry].requiresRestart,
      });
    });

    it('should return requiresRestart based on metadata', async () => {
      const handler = registeredHandlers.get('featureFlags:set');
      const mockEvent = createMockEvent();

      // ViewHistory requires restart
      const result = await handler!(mockEvent, FeatureFlag.ViewHistory, true);
      expect(result).toEqual({
        success: true,
        requiresRestart: true,
      });
    });

    it('should throw for invalid feature flag', async () => {
      const handler = registeredHandlers.get('featureFlags:set');
      const mockEvent = createMockEvent();

      await expect(handler!(mockEvent, 'invalidFlag', true)).rejects.toThrow(
        'Invalid feature flag: invalidFlag'
      );
    });
  });

  describe('handler registration', () => {
    it('should register all handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('featureFlags:getAll', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('featureFlags:get', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('featureFlags:set', expect.any(Function));
    });

    it('should unregister all handlers', () => {
      unregisterFeatureFlagHandlers();

      expect(ipcMain.removeHandler).toHaveBeenCalledWith('featureFlags:getAll');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('featureFlags:get');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('featureFlags:set');
    });
  });
});
