/**
 * Tests for TLS/Certificate Management
 */

import { TLSManager, DEFAULT_TLS_CONFIG } from '../tls';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TLSManager', () => {
  let tlsManager: TLSManager;
  let tempDir: string;

  beforeEach(() => {
    // Create a temp directory for test certificates
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-tls-test-'));
    tlsManager = new TLSManager({ certDir: tempDir });
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Construction', () => {
    it('should create with default configuration', () => {
      const manager = new TLSManager();
      expect(manager.getConfig()).toMatchObject({
        certFilename: DEFAULT_TLS_CONFIG.certFilename,
        keyFilename: DEFAULT_TLS_CONFIG.keyFilename,
      });
    });

    it('should create with custom cert directory', () => {
      expect(tlsManager.getConfig().certDir).toBe(tempDir);
    });

    it('should create with custom filenames', () => {
      const manager = new TLSManager({
        certDir: tempDir,
        certFilename: 'custom.crt',
        keyFilename: 'custom.key',
      });
      expect(manager.getConfig().certFilename).toBe('custom.crt');
      expect(manager.getConfig().keyFilename).toBe('custom.key');
    });
  });

  describe('Self-signed Certificate Generation', () => {
    it('should generate self-signed certificate', () => {
      const result = tlsManager.generateSelfSignedCert();

      expect(result.certPath).toBe(path.join(tempDir, DEFAULT_TLS_CONFIG.certFilename));
      expect(result.keyPath).toBe(path.join(tempDir, DEFAULT_TLS_CONFIG.keyFilename));

      // Verify files were created
      expect(fs.existsSync(result.certPath)).toBe(true);
      expect(fs.existsSync(result.keyPath)).toBe(true);
    });

    it('should generate certificate with custom common name', () => {
      const result = tlsManager.generateSelfSignedCert({
        commonName: 'notecove.test',
      });

      expect(result.certPath).toBeDefined();
      expect(fs.existsSync(result.certPath)).toBe(true);
    });

    it('should generate certificate with valid days', () => {
      const result = tlsManager.generateSelfSignedCert({
        validDays: 365,
      });

      expect(result.certPath).toBeDefined();
    });

    it('should overwrite existing certificate if forced', async () => {
      // Generate first cert
      const first = tlsManager.generateSelfSignedCert();
      const firstStat = fs.statSync(first.certPath);

      // Wait a bit and generate again
      await new Promise((r) => setTimeout(r, 100));

      // Generate second cert with force
      const second = tlsManager.generateSelfSignedCert({ force: true });
      const secondStat = fs.statSync(second.certPath);

      expect(secondStat.mtime.getTime()).toBeGreaterThan(firstStat.mtime.getTime());
    });
  });

  describe('Certificate Loading', () => {
    it('should check if certificate exists', () => {
      expect(tlsManager.hasCertificate()).toBe(false);

      tlsManager.generateSelfSignedCert();

      expect(tlsManager.hasCertificate()).toBe(true);
    });

    it('should load existing certificate', () => {
      tlsManager.generateSelfSignedCert();

      const creds = tlsManager.loadCredentials();
      expect(creds).toBeDefined();
      expect(creds!.cert).toBeDefined();
      expect(creds!.key).toBeDefined();
    });

    it('should return null when no certificate exists', () => {
      const creds = tlsManager.loadCredentials();
      expect(creds).toBeNull();
    });

    it('should load user-provided certificate', () => {
      // Create mock certificate files
      const certContent = '-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----';
      const keyContent = '-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----';

      fs.writeFileSync(path.join(tempDir, 'server.crt'), certContent);
      fs.writeFileSync(path.join(tempDir, 'server.key'), keyContent);

      const creds = tlsManager.loadCredentials();
      expect(creds).toBeDefined();
      expect(creds!.cert).toContain('CERTIFICATE');
      expect(creds!.key).toContain('RSA PRIVATE KEY');
    });
  });

  describe('Certificate Information', () => {
    it('should get certificate info after generation', () => {
      tlsManager.generateSelfSignedCert();

      const info = tlsManager.getCertificateInfo();
      expect(info).toBeDefined();
      expect(info!.commonName).toBeDefined();
      expect(info!.validFrom).toBeInstanceOf(Date);
      expect(info!.validTo).toBeInstanceOf(Date);
      expect(info!.isSelfSigned).toBe(true);
    });

    it('should return null when no certificate exists', () => {
      const info = tlsManager.getCertificateInfo();
      expect(info).toBeNull();
    });
  });

  describe('Default Configuration', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_TLS_CONFIG.certFilename).toBe('server.crt');
      expect(DEFAULT_TLS_CONFIG.keyFilename).toBe('server.key');
    });
  });
});
