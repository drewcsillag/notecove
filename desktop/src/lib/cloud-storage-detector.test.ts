import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { CloudStorageDetector } from './cloud-storage-detector';

interface MockFileSystemAPI {
  exists: Mock<[string], Promise<boolean>>;
  expandPath: Mock<[string], Promise<string>>;
  listDirectory: Mock<[string], Promise<string[]>>;
}

interface MockSystemAPI {
  getPlatform: Mock<[], Promise<string>>;
}

describe('CloudStorageDetector', () => {
  let detector: CloudStorageDetector;
  let mockFileSystemAPI: MockFileSystemAPI;
  let mockSystemAPI: MockSystemAPI;

  beforeEach(() => {
    // Mock Electron APIs
    mockFileSystemAPI = {
      exists: vi.fn(),
      expandPath: vi.fn(),
      listDirectory: vi.fn()
    };

    mockSystemAPI = {
      getPlatform: vi.fn()
    };

    // Setup global mocks
    (global as any).window = {
      electronAPI: {
        isElectron: true,
        fileSystem: mockFileSystemAPI,
        system: mockSystemAPI
      }
    };

    detector = new CloudStorageDetector();
  });

  describe('detectProviders', () => {
    it('should return empty array in browser mode', async () => {
      (global as any).window.electronAPI.isElectron = false;
      detector = new CloudStorageDetector();

      const providers = await detector.detectProviders();

      expect(providers).toEqual([]);
    });

    it('should detect multiple providers on macOS', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockImplementation((path: string) => {
        if (path === '~/Dropbox') return Promise.resolve('/Users/test/Dropbox');
        if (path === '~/Library/CloudStorage') return Promise.resolve('/Users/test/Library/CloudStorage');
        if (path === '~/Library/Mobile Documents/com~apple~CloudDocs') {
          return Promise.resolve('/Users/test/Library/Mobile Documents/com~apple~CloudDocs');
        }
        return Promise.resolve(path);
      });

      mockFileSystemAPI.exists.mockImplementation((path: string) => {
        if (path === '/Users/test/Dropbox') return Promise.resolve(true);
        if (path === '/Users/test/Library/Mobile Documents/com~apple~CloudDocs') {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      mockFileSystemAPI.listDirectory.mockResolvedValue([]);

      const providers = await detector.detectProviders();

      expect(providers.length).toBeGreaterThan(0);
      const dropbox = providers.find(p => p.id === 'dropbox');
      const icloud = providers.find(p => p.id === 'icloud');

      expect(dropbox).toBeDefined();
      expect(dropbox?.isAvailable).toBe(true);
      expect(dropbox?.defaultPath).toBe('/Users/test/Dropbox');

      expect(icloud).toBeDefined();
      expect(icloud?.isAvailable).toBe(true);
    });

    it('should detect multiple providers on Windows', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('win32');
      mockFileSystemAPI.expandPath.mockImplementation((path: string) => {
        if (path === '%USERPROFILE%\\Dropbox') return Promise.resolve('C:\\Users\\test\\Dropbox');
        if (path === '%USERPROFILE%\\OneDrive') return Promise.resolve('C:\\Users\\test\\OneDrive');
        return Promise.resolve(path);
      });

      mockFileSystemAPI.exists.mockImplementation((path: string) => {
        if (path === 'C:\\Users\\test\\Dropbox') return Promise.resolve(true);
        if (path === 'C:\\Users\\test\\OneDrive') return Promise.resolve(true);
        return Promise.resolve(false);
      });

      const providers = await detector.detectProviders();

      expect(providers.length).toBeGreaterThan(0);
      const dropbox = providers.find(p => p.id === 'dropbox');
      const onedrive = providers.find(p => p.id === 'onedrive');

      expect(dropbox).toBeDefined();
      expect(dropbox?.isAvailable).toBe(true);

      expect(onedrive).toBeDefined();
      expect(onedrive?.isAvailable).toBe(true);
    });

    it('should only return available providers', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockImplementation((path: string) => Promise.resolve(path));
      mockFileSystemAPI.exists.mockResolvedValue(false);
      mockFileSystemAPI.listDirectory.mockResolvedValue([]);

      const providers = await detector.detectProviders();

      // ProtonDrive is always unavailable (in development)
      expect(providers).toEqual([]);
    });
  });

  describe('detectDropbox', () => {
    it('should detect Dropbox on macOS', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockResolvedValue('/Users/test/Dropbox');
      mockFileSystemAPI.exists.mockResolvedValue(true);

      const providers = await detector.detectProviders();
      const dropbox = providers.find(p => p.id === 'dropbox');

      expect(dropbox).toBeDefined();
      expect(dropbox?.name).toBe('Dropbox');
      expect(dropbox?.icon).toBe('📦');
      expect(dropbox?.isAvailable).toBe(true);
      expect(dropbox?.defaultPath).toBe('/Users/test/Dropbox');
      expect(dropbox?.detectedPaths).toEqual(['/Users/test/Dropbox']);
    });

    it('should detect Dropbox on Windows', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('win32');
      mockFileSystemAPI.expandPath.mockResolvedValue('C:\\Users\\test\\Dropbox');
      mockFileSystemAPI.exists.mockResolvedValue(true);

      const providers = await detector.detectProviders();
      const dropbox = providers.find(p => p.id === 'dropbox');

      expect(dropbox).toBeDefined();
      expect(dropbox?.defaultPath).toBe('C:\\Users\\test\\Dropbox');
    });

    it('should return unavailable if Dropbox not installed', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockResolvedValue('/Users/test/Dropbox');
      mockFileSystemAPI.exists.mockResolvedValue(false);
      mockFileSystemAPI.listDirectory.mockResolvedValue([]);

      const providers = await detector.detectProviders();
      const dropbox = providers.find(p => p.id === 'dropbox');

      expect(dropbox).toBeUndefined(); // Filtered out since not available
    });
  });

  describe('detectOneDrive', () => {
    it('should detect OneDrive on macOS', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockImplementation((path: string) => {
        if (path === '~/Library/CloudStorage') return Promise.resolve('/Users/test/Library/CloudStorage');
        if (path === '~/OneDrive') return Promise.resolve('/Users/test/OneDrive');
        return Promise.resolve(path);
      });

      mockFileSystemAPI.exists.mockImplementation((path: string) => {
        if (path === '/Users/test/Library/CloudStorage') return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFileSystemAPI.listDirectory.mockResolvedValue(['OneDrive-Personal', 'OneDrive-Business']);

      const providers = await detector.detectProviders();
      const onedrive = providers.find(p => p.id === 'onedrive');

      expect(onedrive).toBeDefined();
      expect(onedrive?.isAvailable).toBe(true);
      expect(onedrive?.detectedPaths).toEqual([
        '/Users/test/Library/CloudStorage/OneDrive-Personal',
        '/Users/test/Library/CloudStorage/OneDrive-Business'
      ]);
    });

    it('should detect legacy OneDrive location on macOS', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockImplementation((path: string) => {
        if (path === '~/Library/CloudStorage') return Promise.resolve('/Users/test/Library/CloudStorage');
        if (path === '~/OneDrive') return Promise.resolve('/Users/test/OneDrive');
        return Promise.resolve(path);
      });

      mockFileSystemAPI.exists.mockImplementation((path: string) => {
        if (path === '/Users/test/OneDrive') return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFileSystemAPI.listDirectory.mockResolvedValue([]);

      const providers = await detector.detectProviders();
      const onedrive = providers.find(p => p.id === 'onedrive');

      expect(onedrive).toBeDefined();
      expect(onedrive?.defaultPath).toBe('/Users/test/OneDrive');
    });

    it('should detect OneDrive on Windows', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('win32');
      mockFileSystemAPI.expandPath.mockResolvedValue('C:\\Users\\test\\OneDrive');
      mockFileSystemAPI.exists.mockResolvedValue(true);

      const providers = await detector.detectProviders();
      const onedrive = providers.find(p => p.id === 'onedrive');

      expect(onedrive).toBeDefined();
      expect(onedrive?.defaultPath).toBe('C:\\Users\\test\\OneDrive');
    });
  });

  describe('detectGoogleDrive', () => {
    it('should detect Google Drive on macOS', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockResolvedValue('/Users/test/Library/CloudStorage');

      mockFileSystemAPI.exists.mockImplementation((path: string) => {
        if (path === '/Users/test/Library/CloudStorage') return Promise.resolve(true);
        if (path === '/Users/test/Library/CloudStorage/GoogleDrive-test@gmail.com/My Drive') {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      mockFileSystemAPI.listDirectory.mockResolvedValue(['GoogleDrive-test@gmail.com']);

      const providers = await detector.detectProviders();
      const gdrive = providers.find(p => p.id === 'googledrive');

      expect(gdrive).toBeDefined();
      expect(gdrive?.isAvailable).toBe(true);
      expect(gdrive?.defaultPath).toBe('/Users/test/Library/CloudStorage/GoogleDrive-test@gmail.com/My Drive');
    });

    it('should detect Google Drive on Windows', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('win32');
      mockFileSystemAPI.expandPath.mockImplementation((path: string) => {
        if (path === '%USERPROFILE%\\Google Drive') return Promise.resolve('C:\\Users\\test\\Google Drive');
        if (path === '%USERPROFILE%\\Google Drive\\My Drive') {
          return Promise.resolve('C:\\Users\\test\\Google Drive\\My Drive');
        }
        return Promise.resolve(path);
      });

      mockFileSystemAPI.exists.mockImplementation((path: string) => {
        if (path === 'C:\\Users\\test\\Google Drive') return Promise.resolve(true);
        return Promise.resolve(false);
      });

      const providers = await detector.detectProviders();
      const gdrive = providers.find(p => p.id === 'googledrive');

      expect(gdrive).toBeDefined();
      expect(gdrive?.defaultPath).toBe('C:\\Users\\test\\Google Drive');
    });
  });

  describe('detectICloudDrive', () => {
    it('should detect iCloud Drive on macOS', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockResolvedValue(
        '/Users/test/Library/Mobile Documents/com~apple~CloudDocs'
      );
      mockFileSystemAPI.exists.mockResolvedValue(true);

      const providers = await detector.detectProviders();
      const icloud = providers.find(p => p.id === 'icloud');

      expect(icloud).toBeDefined();
      expect(icloud?.name).toBe('iCloud Drive');
      expect(icloud?.isAvailable).toBe(true);
      expect(icloud?.defaultPath).toBe('/Users/test/Library/Mobile Documents/com~apple~CloudDocs');
    });

    it('should detect iCloud Drive on Windows', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('win32');
      mockFileSystemAPI.expandPath.mockResolvedValue('C:\\Users\\test\\iCloudDrive');
      mockFileSystemAPI.exists.mockResolvedValue(true);

      const providers = await detector.detectProviders();
      const icloud = providers.find(p => p.id === 'icloud');

      expect(icloud).toBeDefined();
      expect(icloud?.defaultPath).toBe('C:\\Users\\test\\iCloudDrive');
    });
  });

  describe('detectBox', () => {
    it('should detect Box on macOS', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockImplementation((path: string) => {
        if (path === '~/Library/CloudStorage') return Promise.resolve('/Users/test/Library/CloudStorage');
        if (path === '~/Box') return Promise.resolve('/Users/test/Box');
        return Promise.resolve(path);
      });

      mockFileSystemAPI.exists.mockImplementation((path: string) => {
        if (path === '/Users/test/Library/CloudStorage') return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFileSystemAPI.listDirectory.mockResolvedValue(['Box-test@company.com']);

      const providers = await detector.detectProviders();
      const box = providers.find(p => p.id === 'box');

      expect(box).toBeDefined();
      expect(box?.isAvailable).toBe(true);
      expect(box?.detectedPaths).toEqual(['/Users/test/Library/CloudStorage/Box-test@company.com']);
    });

    it('should detect legacy Box location on macOS', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockImplementation((path: string) => {
        if (path === '~/Library/CloudStorage') return Promise.resolve('/Users/test/Library/CloudStorage');
        if (path === '~/Box') return Promise.resolve('/Users/test/Box');
        return Promise.resolve(path);
      });

      mockFileSystemAPI.exists.mockImplementation((path: string) => {
        if (path === '/Users/test/Box') return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFileSystemAPI.listDirectory.mockResolvedValue([]);

      const providers = await detector.detectProviders();
      const box = providers.find(p => p.id === 'box');

      expect(box).toBeDefined();
      expect(box?.defaultPath).toBe('/Users/test/Box');
    });
  });

  describe('detectProtonDrive', () => {
    it('should always return unavailable', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockResolvedValue('/Users/test');
      mockFileSystemAPI.exists.mockResolvedValue(true);
      mockFileSystemAPI.listDirectory.mockResolvedValue([]);

      const providers = await detector.detectProviders();
      const proton = providers.find(p => p.id === 'protondrive');

      // ProtonDrive should not be in the list since it's not available
      expect(proton).toBeUndefined();
    });
  });

  describe('getSuggestedPath', () => {
    it('should return path with /NoteCove suffix', () => {
      const provider = {
        id: 'dropbox',
        name: 'Dropbox',
        icon: '📦',
        defaultPath: '/Users/test/Dropbox',
        isAvailable: true,
        detectedPaths: ['/Users/test/Dropbox']
      };

      const suggestedPath = detector.getSuggestedPath(provider);

      expect(suggestedPath).toBe('/Users/test/Dropbox/NoteCove');
    });

    it('should return empty string if no default path', () => {
      const provider = {
        id: 'protondrive',
        name: 'ProtonDrive',
        icon: '🔒',
        defaultPath: null,
        isAvailable: false,
        detectedPaths: []
      };

      const suggestedPath = detector.getSuggestedPath(provider);

      expect(suggestedPath).toBe('');
    });
  });

  describe('getSuggestedName', () => {
    it('should return provider-specific name for Dropbox', () => {
      const provider = {
        id: 'dropbox',
        name: 'Dropbox',
        icon: '📦',
        defaultPath: '/Users/test/Dropbox',
        isAvailable: true,
        detectedPaths: []
      };

      const name = detector.getSuggestedName(provider);

      expect(name).toBe('Dropbox Notes');
    });

    it('should return provider-specific name for OneDrive', () => {
      const provider = {
        id: 'onedrive',
        name: 'OneDrive',
        icon: '☁️',
        defaultPath: '/Users/test/OneDrive',
        isAvailable: true,
        detectedPaths: []
      };

      const name = detector.getSuggestedName(provider);

      expect(name).toBe('OneDrive Notes');
    });

    it('should return provider-specific name for iCloud', () => {
      const provider = {
        id: 'icloud',
        name: 'iCloud Drive',
        icon: '☁️',
        defaultPath: '/Users/test/Library/Mobile Documents/com~apple~CloudDocs',
        isAvailable: true,
        detectedPaths: []
      };

      const name = detector.getSuggestedName(provider);

      expect(name).toBe('iCloud Notes');
    });

    it('should return provider-specific name for Google Drive', () => {
      const provider = {
        id: 'googledrive',
        name: 'Google Drive',
        icon: '📁',
        defaultPath: '/Users/test/Google Drive',
        isAvailable: true,
        detectedPaths: []
      };

      const name = detector.getSuggestedName(provider);

      expect(name).toBe('Google Drive Notes');
    });

    it('should return generic name for unknown provider', () => {
      const provider = {
        id: 'unknown',
        name: 'Unknown Storage',
        icon: '💾',
        defaultPath: '/some/path',
        isAvailable: true,
        detectedPaths: []
      };

      const name = detector.getSuggestedName(provider);

      expect(name).toBe('Unknown Storage Notes');
    });
  });

  describe('error handling', () => {
    it('should handle platform detection errors gracefully', async () => {
      mockSystemAPI.getPlatform.mockRejectedValue(new Error('Platform detection failed'));
      mockFileSystemAPI.expandPath.mockResolvedValue('/test');
      mockFileSystemAPI.exists.mockResolvedValue(false);
      mockFileSystemAPI.listDirectory.mockResolvedValue([]);

      const providers = await detector.detectProviders();

      // Should return empty array or unavailable providers
      expect(providers).toBeDefined();
      expect(Array.isArray(providers)).toBe(true);
    });

    it('should handle path expansion errors gracefully', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockRejectedValue(new Error('Path expansion failed'));
      mockFileSystemAPI.exists.mockResolvedValue(false);
      mockFileSystemAPI.listDirectory.mockResolvedValue([]);

      const providers = await detector.detectProviders();

      // Should still complete without crashing
      expect(providers).toBeDefined();
    });

    it('should handle directory listing errors gracefully', async () => {
      mockSystemAPI.getPlatform.mockResolvedValue('darwin');
      mockFileSystemAPI.expandPath.mockResolvedValue('/Users/test/Library/CloudStorage');
      mockFileSystemAPI.exists.mockResolvedValue(true);
      mockFileSystemAPI.listDirectory.mockRejectedValue(new Error('Permission denied'));

      const providers = await detector.detectProviders();

      // Should still complete without crashing
      expect(providers).toBeDefined();
    });
  });
});
