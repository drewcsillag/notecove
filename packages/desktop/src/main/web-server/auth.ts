/**
 * Authentication Module for Web Server
 *
 * Handles token generation, validation, and middleware for
 * authenticating browser clients.
 */

import * as crypto from 'crypto';

/**
 * Auth configuration
 */
export interface AuthConfig {
  /** Length of generated tokens (default: 8) */
  tokenLength: number;
}

/**
 * Default configuration
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  tokenLength: 8,
};

/**
 * Headers object type for token extraction
 */
export interface RequestHeaders {
  authorization?: string;
  'x-auth-token'?: string;
  [key: string]: string | undefined;
}

/**
 * Query parameters object type for token extraction
 */
export interface QueryParams {
  token?: string;
  [key: string]: string | undefined;
}

/**
 * Manages authentication for the web server
 */
export class AuthManager {
  private config: AuthConfig;
  private currentToken: string | null = null;

  // Alphanumeric characters for easy typing (no confusing chars like 0/O, 1/l)
  private static readonly TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<AuthConfig> {
    return { ...this.config };
  }

  /**
   * Generate a new random token
   */
  generateToken(): string {
    const chars = AuthManager.TOKEN_CHARS;
    const bytes = crypto.randomBytes(this.config.tokenLength);
    let token = '';

    for (let i = 0; i < this.config.tokenLength; i++) {
      const byteValue = bytes[i];
      if (byteValue !== undefined) {
        const charValue = chars[byteValue % chars.length];
        if (charValue !== undefined) {
          token += charValue;
        }
      }
    }

    return token;
  }

  /**
   * Get the current active token
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Set the current active token
   */
  setCurrentToken(token: string): void {
    this.currentToken = token;
  }

  /**
   * Generate a new token and set it as current
   */
  regenerateToken(): string {
    const token = this.generateToken();
    this.setCurrentToken(token);
    return token;
  }

  /**
   * Validate a token against the current token
   * Uses timing-safe comparison to prevent timing attacks
   */
  validateToken(token: string): boolean {
    if (!token || !this.currentToken) {
      return false;
    }

    // Convert to buffers for timing-safe comparison
    const tokenBuf = Buffer.from(token);
    const currentBuf = Buffer.from(this.currentToken);

    // If lengths don't match, still do a comparison to prevent timing leaks
    if (tokenBuf.length !== currentBuf.length) {
      // Compare against itself to maintain constant time
      crypto.timingSafeEqual(currentBuf, currentBuf);
      return false;
    }

    return crypto.timingSafeEqual(tokenBuf, currentBuf);
  }

  /**
   * Extract token from request headers or query parameters
   *
   * Checks in order:
   * 1. Authorization header (Bearer token)
   * 2. X-Auth-Token header
   * 3. Query parameter 'token'
   */
  extractToken(headers: RequestHeaders, query?: QueryParams): string | null {
    // Check Authorization header (Bearer scheme)
    const authHeader = headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        return token;
      }
    }

    // Check X-Auth-Token header
    const xAuthToken = headers['x-auth-token'];
    if (xAuthToken) {
      return xAuthToken;
    }

    // Check query parameter
    if (query?.token) {
      return query.token;
    }

    return null;
  }
}
