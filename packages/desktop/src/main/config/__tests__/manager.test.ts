/**
 * ConfigManager Tests
 */

import { rm, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock electron before importing ConfigManager
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/userData'),
  },
}));

import { ConfigManager, type AppConfig, type WebServerConfig } from '../manager';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let testDir: string;
  let configPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `config-test-${Date.now()}-${Math.random()}`);
    await mkdir(testDir, { recursive: true });
    configPath = join(testDir, 'config.json');
    configManager = new ConfigManager(configPath);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('load', () => {
    it('should return empty config when file does not exist', async () => {
      const config = await configManager.load();
      expect(config).toEqual({});
    });

    it('should load config from file', async () => {
      const testConfig: AppConfig = {
        databasePath: '/test/db.sqlite',
      };
      await configManager.save(testConfig);

      // Create new manager to clear cache
      const newManager = new ConfigManager(configPath);
      const loadedConfig = await newManager.load();
      expect(loadedConfig.databasePath).toBe('/test/db.sqlite');
    });

    it('should cache loaded config', async () => {
      const config1 = await configManager.load();
      const config2 = await configManager.load();
      expect(config1).toBe(config2); // Same object reference
    });
  });

  describe('save', () => {
    it('should save config to file', async () => {
      const testConfig: AppConfig = {
        databasePath: '/test/path',
        webServer: {
          enabled: true,
          port: 8080,
        },
      };
      await configManager.save(testConfig);

      const fileContent = await readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(fileContent);
      expect(savedConfig.databasePath).toBe('/test/path');
      expect(savedConfig.webServer.enabled).toBe(true);
      expect(savedConfig.webServer.port).toBe(8080);
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = join(testDir, 'nested', 'dir', 'config.json');
      const nestedManager = new ConfigManager(nestedPath);

      await nestedManager.save({ databasePath: '/test' });

      const fileContent = await readFile(nestedPath, 'utf-8');
      expect(JSON.parse(fileContent).databasePath).toBe('/test');
    });
  });

  describe('get/set', () => {
    it('should get a specific config value', async () => {
      await configManager.save({ databasePath: '/test/db' });
      const dbPath = await configManager.get('databasePath');
      expect(dbPath).toBe('/test/db');
    });

    it('should return undefined for non-existent key', async () => {
      const value = await configManager.get('databasePath');
      expect(value).toBeUndefined();
    });

    it('should set a specific config value', async () => {
      await configManager.set('databasePath', '/new/path');
      const dbPath = await configManager.get('databasePath');
      expect(dbPath).toBe('/new/path');
    });
  });

  describe('getDatabasePath', () => {
    it('should return custom path if set', async () => {
      await configManager.set('databasePath', '/custom/db.sqlite');
      const dbPath = await configManager.getDatabasePath();
      expect(dbPath).toBe('/custom/db.sqlite');
    });

    it('should return default path if not set', async () => {
      const dbPath = await configManager.getDatabasePath();
      expect(dbPath).toBe('/mock/userData/notecove.db');
    });
  });

  describe('setDatabasePath', () => {
    it('should set database path', async () => {
      await configManager.setDatabasePath('/new/db.sqlite');
      const dbPath = await configManager.get('databasePath');
      expect(dbPath).toBe('/new/db.sqlite');
    });
  });

  describe('getWebServerConfig', () => {
    it('should return empty object when not configured', async () => {
      const webConfig = await configManager.getWebServerConfig();
      expect(webConfig).toEqual({});
    });

    it('should return web server config when set', async () => {
      const testConfig: WebServerConfig = {
        enabled: true,
        port: 8080,
        token: 'test-token',
        localhostOnly: true,
      };
      await configManager.save({ webServer: testConfig });

      const webConfig = await configManager.getWebServerConfig();
      expect(webConfig).toEqual(testConfig);
    });
  });

  describe('setWebServerConfig', () => {
    it('should merge with existing config', async () => {
      await configManager.save({
        webServer: {
          enabled: true,
          port: 8080,
        },
      });

      await configManager.setWebServerConfig({ token: 'new-token' });

      const webConfig = await configManager.getWebServerConfig();
      expect(webConfig.enabled).toBe(true);
      expect(webConfig.port).toBe(8080);
      expect(webConfig.token).toBe('new-token');
    });

    it('should create web server config if not exists', async () => {
      await configManager.setWebServerConfig({ enabled: true, port: 9000 });

      const webConfig = await configManager.getWebServerConfig();
      expect(webConfig.enabled).toBe(true);
      expect(webConfig.port).toBe(9000);
    });
  });
});
