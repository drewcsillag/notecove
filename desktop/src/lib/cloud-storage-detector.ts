/**
 * Cloud Storage Detector
 * Detects and provides quick access to popular cloud storage providers
 */

export interface CloudProvider {
  id: string;
  name: string;
  icon: string;
  defaultPath: string | null;
  isAvailable: boolean;
  detectedPaths: string[];
}

export class CloudStorageDetector {
  private isElectron: boolean;

  constructor() {
    this.isElectron = window.electronAPI?.isElectron || false;
  }

  /**
   * Detect all available cloud storage providers
   */
  async detectProviders(): Promise<CloudProvider[]> {
    if (!this.isElectron) {
      // In browser mode, no cloud storage detection
      return [];
    }

    const providers: CloudProvider[] = [];

    // Detect each provider in parallel
    const detections = await Promise.all([
      this.detectDropbox(),
      this.detectOneDrive(),
      this.detectICloudDrive(),
      this.detectGoogleDrive(),
      this.detectBox(),
      this.detectProtonDrive(),
    ]);

    providers.push(...detections);

    // Return only available providers
    return providers.filter(p => p.isAvailable);
  }

  /**
   * Detect Dropbox
   */
  private async detectDropbox(): Promise<CloudProvider> {
    const platform = await this.getPlatform();
    const paths: string[] = [];

    if (platform === 'darwin' || platform === 'linux') {
      const dropboxPath = await this.expandPath('~/Dropbox');
      if (await this.pathExists(dropboxPath)) {
        paths.push(dropboxPath);
      }
    } else if (platform === 'win32') {
      const dropboxPath = await this.expandPath('%USERPROFILE%\\Dropbox');
      if (await this.pathExists(dropboxPath)) {
        paths.push(dropboxPath);
      }
    }

    return {
      id: 'dropbox',
      name: 'Dropbox',
      icon: '📦',
      defaultPath: paths[0] || null,
      isAvailable: paths.length > 0,
      detectedPaths: paths
    };
  }

  /**
   * Detect OneDrive (supports multiple accounts)
   */
  private async detectOneDrive(): Promise<CloudProvider> {
    const platform = await this.getPlatform();
    const paths: string[] = [];

    if (platform === 'darwin') {
      // Check CloudStorage location (newer versions)
      const cloudPath = await this.expandPath('~/Library/CloudStorage');
      if (await this.pathExists(cloudPath)) {
        try {
          const dirs = await this.listDirectory(cloudPath);
          const oneDriveDirs = dirs.filter(d => d.startsWith('OneDrive-'));
          for (const dir of oneDriveDirs) {
            paths.push(`${cloudPath}/${dir}`);
          }
        } catch (error) {
          console.warn('Failed to list CloudStorage directory:', error);
        }
      }

      // Also check legacy location
      const oneDrivePath = await this.expandPath('~/OneDrive');
      if (await this.pathExists(oneDrivePath) && !paths.includes(oneDrivePath)) {
        paths.push(oneDrivePath);
      }
    } else if (platform === 'win32') {
      const oneDrivePath = await this.expandPath('%USERPROFILE%\\OneDrive');
      if (await this.pathExists(oneDrivePath)) {
        paths.push(oneDrivePath);
      }

      // TODO: Check for business/work accounts
      // const onedriveCommercial = await this.expandPath('%USERPROFILE%\\OneDrive - ');
      // Would need to enumerate to find exact names
    }

    return {
      id: 'onedrive',
      name: 'OneDrive',
      icon: '☁️',
      defaultPath: paths[0] || null,
      isAvailable: paths.length > 0,
      detectedPaths: paths
    };
  }

  /**
   * Detect iCloud Drive
   */
  private async detectICloudDrive(): Promise<CloudProvider> {
    const platform = await this.getPlatform();
    const paths: string[] = [];

    if (platform === 'darwin') {
      const iCloudPath = await this.expandPath('~/Library/Mobile Documents/com~apple~CloudDocs');
      if (await this.pathExists(iCloudPath)) {
        paths.push(iCloudPath);
      }
    } else if (platform === 'win32') {
      const iCloudPath = await this.expandPath('%USERPROFILE%\\iCloudDrive');
      if (await this.pathExists(iCloudPath)) {
        paths.push(iCloudPath);
      }
    }

    return {
      id: 'icloud',
      name: 'iCloud Drive',
      icon: '☁️',
      defaultPath: paths[0] || null,
      isAvailable: paths.length > 0,
      detectedPaths: paths
    };
  }

  /**
   * Detect Google Drive
   */
  private async detectGoogleDrive(): Promise<CloudProvider> {
    const platform = await this.getPlatform();
    const paths: string[] = [];

    if (platform === 'darwin') {
      // Google Drive for Desktop uses CloudStorage
      const cloudPath = await this.expandPath('~/Library/CloudStorage');
      if (await this.pathExists(cloudPath)) {
        try {
          const dirs = await this.listDirectory(cloudPath);
          const gdriveDirs = dirs.filter(d => d.startsWith('GoogleDrive-'));
          for (const dir of gdriveDirs) {
            const myDrivePath = `${cloudPath}/${dir}/My Drive`;
            if (await this.pathExists(myDrivePath)) {
              paths.push(myDrivePath);
            }
          }
        } catch (error) {
          console.warn('Failed to detect Google Drive:', error);
        }
      }
    } else if (platform === 'win32') {
      // Check common location
      const gdrivePath = await this.expandPath('%USERPROFILE%\\Google Drive');
      if (await this.pathExists(gdrivePath)) {
        paths.push(gdrivePath);
      }

      // Also check for "My Drive" subfolder
      const myDrivePath = await this.expandPath('%USERPROFILE%\\Google Drive\\My Drive');
      if (await this.pathExists(myDrivePath) && !paths.includes(myDrivePath)) {
        paths.push(myDrivePath);
      }
    }

    return {
      id: 'googledrive',
      name: 'Google Drive',
      icon: '📁',
      defaultPath: paths[0] || null,
      isAvailable: paths.length > 0,
      detectedPaths: paths
    };
  }

  /**
   * Detect Box
   */
  private async detectBox(): Promise<CloudProvider> {
    const platform = await this.getPlatform();
    const paths: string[] = [];

    if (platform === 'darwin') {
      const cloudPath = await this.expandPath('~/Library/CloudStorage');
      if (await this.pathExists(cloudPath)) {
        try {
          const dirs = await this.listDirectory(cloudPath);
          const boxDirs = dirs.filter(d => d.startsWith('Box-'));
          for (const dir of boxDirs) {
            paths.push(`${cloudPath}/${dir}`);
          }
        } catch (error) {
          console.warn('Failed to detect Box:', error);
        }
      }

      // Also check legacy location
      const boxPath = await this.expandPath('~/Box');
      if (await this.pathExists(boxPath) && !paths.includes(boxPath)) {
        paths.push(boxPath);
      }
    } else if (platform === 'win32') {
      const boxPath = await this.expandPath('%USERPROFILE%\\Box');
      if (await this.pathExists(boxPath)) {
        paths.push(boxPath);
      }
    }

    return {
      id: 'box',
      name: 'Box',
      icon: '📦',
      defaultPath: paths[0] || null,
      isAvailable: paths.length > 0,
      detectedPaths: paths
    };
  }

  /**
   * Detect ProtonDrive (currently in beta, paths TBD)
   */
  private async detectProtonDrive(): Promise<CloudProvider> {
    // ProtonDrive desktop sync is still in development
    // Will need to update when paths are known
    return {
      id: 'protondrive',
      name: 'ProtonDrive',
      icon: '🔒',
      defaultPath: null,
      isAvailable: false,
      detectedPaths: []
    };
  }

  /**
   * Helper: Get current platform
   */
  private async getPlatform(): Promise<string> {
    if (!this.isElectron) return 'browser';
    try {
      return await window.electronAPI?.system.getPlatform() || 'unknown';
    } catch (error) {
      console.error('Failed to get platform:', error);
      return 'unknown';
    }
  }

  /**
   * Helper: Check if path exists
   */
  private async pathExists(path: string): Promise<boolean> {
    if (!this.isElectron) return false;
    try {
      return await window.electronAPI?.fileSystem.exists(path) || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Helper: Expand ~ and environment variables in path
   */
  private async expandPath(path: string): Promise<string> {
    if (!this.isElectron) return path;
    try {
      return await window.electronAPI?.fileSystem.expandPath(path) || path;
    } catch (error) {
      console.error('Failed to expand path:', error);
      return path;
    }
  }

  /**
   * Helper: List directory contents
   */
  private async listDirectory(path: string): Promise<string[]> {
    if (!this.isElectron) return [];
    try {
      return await window.electronAPI?.fileSystem.listDirectory(path) || [];
    } catch (error) {
      console.error('Failed to list directory:', error);
      return [];
    }
  }

  /**
   * Get suggested path for a provider (creates NoteCove subfolder)
   */
  getSuggestedPath(provider: CloudProvider): string {
    if (!provider.defaultPath) return '';
    return `${provider.defaultPath}/NoteCove`;
  }

  /**
   * Get suggested name for a provider
   */
  getSuggestedName(provider: CloudProvider): string {
    const names: Record<string, string> = {
      dropbox: 'Dropbox Notes',
      onedrive: 'OneDrive Notes',
      icloud: 'iCloud Notes',
      googledrive: 'Google Drive Notes',
      box: 'Box Notes',
      protondrive: 'ProtonDrive Notes'
    };
    return names[provider.id] || `${provider.name} Notes`;
  }
}
