/**
 * TLS/Certificate Management for Web Server
 *
 * Handles self-signed certificate generation and loading
 * for HTTPS support over local network.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as forge from 'node-forge';

/**
 * TLS configuration
 */
export interface TLSConfig {
  /** Directory to store certificates */
  certDir: string;
  /** Certificate filename */
  certFilename: string;
  /** Private key filename */
  keyFilename: string;
}

/**
 * Default configuration
 */
export const DEFAULT_TLS_CONFIG: Omit<TLSConfig, 'certDir'> & { certDir?: string } = {
  certFilename: 'server.crt',
  keyFilename: 'server.key',
};

/**
 * Options for self-signed certificate generation
 */
export interface GenerateCertOptions {
  /** Common Name (hostname) for the certificate */
  commonName?: string;
  /** Number of days the certificate is valid */
  validDays?: number;
  /** Force regeneration even if certificate exists */
  force?: boolean;
  /** Subject Alternative Names (SANs) */
  altNames?: string[];
}

/**
 * Result of certificate generation
 */
export interface GenerateCertResult {
  certPath: string;
  keyPath: string;
}

/**
 * SSL/TLS credentials for server
 */
export interface TLSCredentials {
  cert: string;
  key: string;
}

/**
 * Certificate information
 */
export interface CertificateInfo {
  commonName: string;
  validFrom: Date;
  validTo: Date;
  isSelfSigned: boolean;
  fingerprint: string;
}

/**
 * Manages TLS certificates for the web server
 */
export class TLSManager {
  private config: TLSConfig;

  constructor(config: Partial<TLSConfig> = {}) {
    this.config = {
      certDir: config.certDir ?? process.cwd(),
      certFilename: config.certFilename ?? DEFAULT_TLS_CONFIG.certFilename,
      keyFilename: config.keyFilename ?? DEFAULT_TLS_CONFIG.keyFilename,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<TLSConfig> {
    return { ...this.config };
  }

  /**
   * Get the full path to the certificate file
   */
  getCertPath(): string {
    return path.join(this.config.certDir, this.config.certFilename);
  }

  /**
   * Get the full path to the private key file
   */
  getKeyPath(): string {
    return path.join(this.config.certDir, this.config.keyFilename);
  }

  /**
   * Check if a certificate exists
   */
  hasCertificate(): boolean {
    const certPath = this.getCertPath();
    const keyPath = this.getKeyPath();
    return fs.existsSync(certPath) && fs.existsSync(keyPath);
  }

  /**
   * Generate a self-signed certificate
   */
  generateSelfSignedCert(options: GenerateCertOptions = {}): GenerateCertResult {
    const {
      commonName = 'localhost',
      validDays = 365,
      force = false,
      altNames = ['localhost', '127.0.0.1'],
    } = options;

    const certPath = this.getCertPath();
    const keyPath = this.getKeyPath();

    // Check if certificate already exists
    if (!force && this.hasCertificate()) {
      console.log('[TLS] Certificate already exists, skipping generation');
      return { certPath, keyPath };
    }

    // Ensure directory exists
    if (!fs.existsSync(this.config.certDir)) {
      fs.mkdirSync(this.config.certDir, { recursive: true });
    }

    // Generate RSA key pair using node-forge
    const keys = forge.pki.rsa.generateKeyPair(2048);

    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01' + crypto.randomBytes(16).toString('hex');

    // Set validity
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + validDays);

    // Set subject and issuer (same for self-signed)
    const attrs = [
      { name: 'commonName', value: commonName },
      { name: 'organizationName', value: 'NoteCove' },
      { name: 'localityName', value: 'Local' },
      { name: 'countryName', value: 'US' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs); // Self-signed: issuer = subject

    // Build Subject Alternative Names for node-forge
    const altNamesForge = altNames.map((name) => {
      if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) {
        return { type: 7, ip: name }; // IP address
      }
      return { type: 2, value: name }; // DNS name
    });

    // Set extensions
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false,
      },
      {
        name: 'keyUsage',
        keyCertSign: false,
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
      },
      {
        name: 'subjectAltName',
        altNames: altNamesForge,
      },
    ]);

    // Self-sign the certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // Convert to PEM format
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

    // Write certificate and key files
    fs.writeFileSync(certPath, certPem, { mode: 0o644 });
    fs.writeFileSync(keyPath, keyPem, { mode: 0o600 });

    console.log(`[TLS] Generated self-signed certificate at ${certPath}`);

    return { certPath, keyPath };
  }

  /**
   * Load existing certificate credentials
   * Returns null if no certificate exists
   */
  loadCredentials(): TLSCredentials | null {
    if (!this.hasCertificate()) {
      return null;
    }

    const certPath = this.getCertPath();
    const keyPath = this.getKeyPath();

    return {
      cert: fs.readFileSync(certPath, 'utf8'),
      key: fs.readFileSync(keyPath, 'utf8'),
    };
  }

  /**
   * Get information about the current certificate
   * Returns null if no certificate exists
   */
  getCertificateInfo(): CertificateInfo | null {
    if (!this.hasCertificate()) {
      return null;
    }

    const certPem = fs.readFileSync(this.getCertPath(), 'utf8');

    // Parse certificate using Node's crypto module
    const cert = new crypto.X509Certificate(certPem);

    return {
      commonName: this.extractCN(cert.subject),
      validFrom: new Date(cert.validFrom),
      validTo: new Date(cert.validTo),
      isSelfSigned: cert.issuer === cert.subject,
      fingerprint: cert.fingerprint256,
    };
  }

  /**
   * Extract Common Name from certificate subject
   */
  private extractCN(subject: string): string {
    const cnRegex = /CN=([^,]+)/;
    const match = cnRegex.exec(subject);
    return match?.[1] ?? 'Unknown';
  }

  /**
   * Ensure a certificate exists, generating one if needed
   */
  ensureCertificate(options?: GenerateCertOptions): TLSCredentials {
    if (!this.hasCertificate()) {
      this.generateSelfSignedCert(options);
    }

    const creds = this.loadCredentials();
    if (!creds) {
      throw new Error('Failed to load certificate after generation');
    }

    return creds;
  }
}
