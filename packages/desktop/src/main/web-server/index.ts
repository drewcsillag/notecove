/**
 * Web Server Module
 *
 * Exports for the web server that provides browser access to NoteCove.
 */

export { WebServer, DEFAULT_WEB_SERVER_CONFIG } from './server';
export type { WebServerConfig, ServerAddress, ConnectedClientInfo } from './server';

export { TLSManager, DEFAULT_TLS_CONFIG } from './tls';
export type {
  TLSConfig,
  TLSCredentials,
  GenerateCertOptions,
  GenerateCertResult,
  CertificateInfo,
} from './tls';

export { AuthManager, DEFAULT_AUTH_CONFIG } from './auth';
export type { AuthConfig, RequestHeaders, QueryParams } from './auth';
