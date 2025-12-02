/// <reference types="vite/client" />

/**
 * Type definitions for Vite's import.meta.env
 * This prevents TypeScript linting errors when accessing import.meta.env properties
 */

interface ImportMetaEnv {
  /**
   * Whether the app is running in development mode
   */
  readonly DEV: boolean;

  /**
   * Whether the app is running in production mode
   */
  readonly PROD: boolean;

  /**
   * Whether the app is running in SSR mode
   */
  readonly SSR: boolean;

  /**
   * The base URL the app is being served from
   */
  readonly BASE_URL: string;

  /**
   * The mode the app is running in (development, production, test, etc.)
   */
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
