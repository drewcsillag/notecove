/**
 * Platform Adapter for API Access
 *
 * Automatically detects whether running in Electron or browser
 * and exports the appropriate API implementation.
 */

import { initWebClient, isAuthenticated, validateToken, setToken, clearToken } from './web-client';
import { initBrowserApiStub } from './browser-stub';

/**
 * Check if running in Electron environment
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return !isElectron();
}

/**
 * Initialize the API based on the detected platform.
 * Call this early in app bootstrap before components use window.electronAPI.
 */
export function initApi(): void {
  // If electronAPI is already defined (Electron preload), don't override
  if (isElectron()) {
    console.log('[API] Running in Electron environment');
    return;
  }

  // Check if user is authenticated
  if (isAuthenticated()) {
    console.log('[API] Running in browser environment (authenticated)');
    initWebClient();
  } else {
    console.log('[API] Running in browser environment (not authenticated)');
    // Use stub until authenticated - this allows the app to load
    initBrowserApiStub();
  }
}

/**
 * Switch to the real web client after authentication.
 * Call this after successfully validating a token.
 */
export function activateWebClient(): void {
  initWebClient();
}

// Re-export auth utilities for the login page
export { isAuthenticated, validateToken, setToken, clearToken };
