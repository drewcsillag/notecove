/**
 * Configuration Manager
 *
 * Manages application configuration stored outside the database.
 * This is needed for settings like database path that can't be stored
 * in the database itself.
 */

import { app } from 'electron';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

export interface WebServerConfig {
  enabled?: boolean;
  port?: number;
  token?: string;
}

export interface AppConfig {
  databasePath?: string;
  webServer?: WebServerConfig;
}

export class ConfigManager {
  private configPath: string;
  private config: AppConfig | null = null;

  constructor(configPath?: string) {
    // Use provided path or default to userData/config.json
    this.configPath = configPath ?? join(app.getPath('userData'), 'config.json');
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(data) as AppConfig;
      return this.config;
    } catch (error) {
      // Config file doesn't exist or is invalid, return defaults
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.config = {};
        return this.config;
      }
      throw error;
    }
  }

  /**
   * Save configuration to disk
   */
  async save(config: AppConfig): Promise<void> {
    this.config = config;

    // Ensure directory exists
    const dir = dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });

    // Write config with pretty formatting
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Get a specific config value
   */
  async get<K extends keyof AppConfig>(key: K): Promise<AppConfig[K] | undefined> {
    const config = await this.load();
    return config[key];
  }

  /**
   * Set a specific config value
   */
  async set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<void> {
    const config = await this.load();
    config[key] = value;
    await this.save(config);
  }

  /**
   * Get the database path from config, or return default
   */
  async getDatabasePath(): Promise<string> {
    const customPath = await this.get('databasePath');
    if (customPath) {
      return customPath;
    }
    // Default path
    return join(app.getPath('userData'), 'notecove.db');
  }

  /**
   * Set the database path in config
   */
  async setDatabasePath(path: string): Promise<void> {
    await this.set('databasePath', path);
  }

  /**
   * Get web server configuration
   */
  async getWebServerConfig(): Promise<WebServerConfig> {
    const config = await this.load();
    return config.webServer ?? {};
  }

  /**
   * Update web server configuration (merges with existing)
   */
  async setWebServerConfig(webServerConfig: Partial<WebServerConfig>): Promise<void> {
    const config = await this.load();
    config.webServer = { ...config.webServer, ...webServerConfig };
    await this.save(config);
  }
}
