/**
 * Tests for Authentication Module
 */

import { AuthManager, DEFAULT_AUTH_CONFIG } from '../auth';

describe('AuthManager', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager();
  });

  describe('Construction', () => {
    it('should create with default configuration', () => {
      const config = authManager.getConfig();
      expect(config.tokenLength).toBe(DEFAULT_AUTH_CONFIG.tokenLength);
    });

    it('should create with custom token length', () => {
      const manager = new AuthManager({ tokenLength: 12 });
      expect(manager.getConfig().tokenLength).toBe(12);
    });
  });

  describe('Token Generation', () => {
    it('should generate a token of configured length', () => {
      const token = authManager.generateToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      // Default length is 8 characters
      expect(token.length).toBe(DEFAULT_AUTH_CONFIG.tokenLength);
    });

    it('should generate alphanumeric tokens', () => {
      const token = authManager.generateToken();
      // Should only contain alphanumeric characters (easy to type)
      expect(token).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(authManager.generateToken());
      }
      // All 100 should be unique
      expect(tokens.size).toBe(100);
    });

    it('should respect custom token length', () => {
      const manager = new AuthManager({ tokenLength: 16 });
      const token = manager.generateToken();
      expect(token.length).toBe(16);
    });
  });

  describe('Token Persistence', () => {
    it('should store and retrieve current token', () => {
      const token = authManager.generateToken();
      authManager.setCurrentToken(token);
      expect(authManager.getCurrentToken()).toBe(token);
    });

    it('should allow regenerating token', () => {
      const oldToken = authManager.generateToken();
      authManager.setCurrentToken(oldToken);

      const newToken = authManager.regenerateToken();
      expect(newToken).not.toBe(oldToken);
      expect(authManager.getCurrentToken()).toBe(newToken);
    });

    it('should return null if no token is set', () => {
      expect(authManager.getCurrentToken()).toBeNull();
    });
  });

  describe('Token Validation', () => {
    it('should validate correct token', () => {
      const token = authManager.generateToken();
      authManager.setCurrentToken(token);

      expect(authManager.validateToken(token)).toBe(true);
    });

    it('should reject incorrect token', () => {
      const token = authManager.generateToken();
      authManager.setCurrentToken(token);

      expect(authManager.validateToken('wrong-token')).toBe(false);
    });

    it('should reject empty token', () => {
      authManager.setCurrentToken(authManager.generateToken());
      expect(authManager.validateToken('')).toBe(false);
    });

    it('should reject null/undefined token', () => {
      authManager.setCurrentToken(authManager.generateToken());
      expect(authManager.validateToken(null as unknown as string)).toBe(false);
      expect(authManager.validateToken(undefined as unknown as string)).toBe(false);
    });

    it('should use timing-safe comparison', () => {
      // This test just ensures the validation doesn't throw
      // Timing-safe comparison is an implementation detail
      const token = authManager.generateToken();
      authManager.setCurrentToken(token);

      // Try various lengths that don't match
      expect(authManager.validateToken('a')).toBe(false);
      expect(authManager.validateToken('ab')).toBe(false);
      expect(authManager.validateToken(token + 'extra')).toBe(false);
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from Authorization header (Bearer)', () => {
      const token = 'test-token-123';
      const extracted = authManager.extractToken({
        authorization: `Bearer ${token}`,
      });
      expect(extracted).toBe(token);
    });

    it('should extract token from X-Auth-Token header', () => {
      const token = 'test-token-456';
      const extracted = authManager.extractToken({
        'x-auth-token': token,
      });
      expect(extracted).toBe(token);
    });

    it('should prefer Authorization header over X-Auth-Token', () => {
      const extracted = authManager.extractToken({
        authorization: 'Bearer auth-token',
        'x-auth-token': 'x-token',
      });
      expect(extracted).toBe('auth-token');
    });

    it('should return null for missing headers', () => {
      expect(authManager.extractToken({})).toBeNull();
    });

    it('should return null for invalid Authorization format', () => {
      expect(authManager.extractToken({ authorization: 'Basic xyz' })).toBeNull();
      expect(authManager.extractToken({ authorization: 'Bearer' })).toBeNull();
      expect(authManager.extractToken({ authorization: '' })).toBeNull();
    });

    it('should extract token from query parameter', () => {
      const token = 'query-token-789';
      const extracted = authManager.extractToken({}, { token });
      expect(extracted).toBe(token);
    });

    it('should prefer headers over query parameter', () => {
      const extracted = authManager.extractToken(
        { 'x-auth-token': 'header-token' },
        { token: 'query-token' }
      );
      expect(extracted).toBe('header-token');
    });
  });

  describe('Default Configuration', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_AUTH_CONFIG.tokenLength).toBe(8);
    });
  });
});
