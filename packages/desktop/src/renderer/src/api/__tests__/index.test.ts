/**
 * Tests for Platform Adapter for API Access
 */

import { isElectron, isBrowser, initApi, activateWebClient } from '../index';
import { initWebClient, isAuthenticated } from '../web-client';
import { initBrowserApiStub } from '../browser-stub';

// Mock dependencies
jest.mock('../web-client', () => ({
  initWebClient: jest.fn(),
  isAuthenticated: jest.fn(),
  validateToken: jest.fn(),
  setToken: jest.fn(),
  clearToken: jest.fn(),
}));

jest.mock('../browser-stub', () => ({
  initBrowserApiStub: jest.fn(),
}));

describe('Platform Adapter', () => {
  // Store original window.electronAPI
  const originalElectronAPI = (window as unknown as Record<string, unknown>)['electronAPI'];

  afterEach(() => {
    // Restore original state
    if (originalElectronAPI !== undefined) {
      (window as unknown as Record<string, unknown>)['electronAPI'] = originalElectronAPI;
    } else {
      delete (window as unknown as Record<string, unknown>)['electronAPI'];
    }
    jest.clearAllMocks();
  });

  describe('isElectron', () => {
    it('should return true when electronAPI is present', () => {
      (window as unknown as Record<string, unknown>)['electronAPI'] = {};

      expect(isElectron()).toBe(true);
    });

    it('should return false when electronAPI is not present', () => {
      delete (window as unknown as Record<string, unknown>)['electronAPI'];

      expect(isElectron()).toBe(false);
    });
  });

  describe('isBrowser', () => {
    it('should return false when electronAPI is present', () => {
      (window as unknown as Record<string, unknown>)['electronAPI'] = {};

      expect(isBrowser()).toBe(false);
    });

    it('should return true when electronAPI is not present', () => {
      delete (window as unknown as Record<string, unknown>)['electronAPI'];

      expect(isBrowser()).toBe(true);
    });
  });

  describe('initApi', () => {
    it('should not initialize anything in Electron environment', () => {
      (window as unknown as Record<string, unknown>)['electronAPI'] = {};
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      initApi();

      expect(initWebClient).not.toHaveBeenCalled();
      expect(initBrowserApiStub).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('[API] Running in Electron environment');

      consoleSpy.mockRestore();
    });

    it('should initialize web client when authenticated in browser', () => {
      delete (window as unknown as Record<string, unknown>)['electronAPI'];
      (isAuthenticated as jest.Mock).mockReturnValue(true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      initApi();

      expect(initWebClient).toHaveBeenCalled();
      expect(initBrowserApiStub).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[API] Running in browser environment (authenticated)'
      );

      consoleSpy.mockRestore();
    });

    it('should initialize browser stub when not authenticated in browser', () => {
      delete (window as unknown as Record<string, unknown>)['electronAPI'];
      (isAuthenticated as jest.Mock).mockReturnValue(false);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      initApi();

      expect(initWebClient).not.toHaveBeenCalled();
      expect(initBrowserApiStub).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[API] Running in browser environment (not authenticated)'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('activateWebClient', () => {
    it('should initialize web client', () => {
      activateWebClient();

      expect(initWebClient).toHaveBeenCalled();
    });
  });
});
