# Cloud Storage Integration

## Overview
Make it easy for users to store their NoteCove sync directories in popular cloud storage services, while still allowing custom path selection.

## Supported Cloud Storage Providers

### Tier 1: Primary Focus
These are the most commonly used cloud storage services:

1. **Dropbox**
   - macOS: `~/Dropbox/`
   - Windows: `%USERPROFILE%\Dropbox\`
   - Linux: `~/Dropbox/`

2. **OneDrive**
   - macOS: `~/Library/CloudStorage/OneDrive-Personal/` or `~/OneDrive/`
   - Windows: `%USERPROFILE%\OneDrive\`
   - Linux: Not officially supported, but users may have custom paths

3. **iCloud Drive**
   - macOS: `~/Library/Mobile Documents/com~apple~CloudDocs/`
   - Windows: `%USERPROFILE%\iCloudDrive\`
   - Linux: Not supported

4. **Google Drive**
   - macOS: `~/Library/CloudStorage/GoogleDrive-{email}/My Drive/` (Google Drive for Desktop)
   - Windows: `%USERPROFILE%\Google Drive\` or drive letter (e.g., `G:\`)
   - Linux: Custom paths via `google-drive-ocamlfuse` or similar

5. **ProtonDrive**
   - Currently desktop sync is in beta
   - Expected path patterns TBD (similar to Dropbox likely)

### Tier 2: Additional Providers to Consider

6. **Box**
   - macOS: `~/Box/` or `~/Library/CloudStorage/Box-{email}/`
   - Windows: `%USERPROFILE%\Box\`
   - Popular in enterprise

7. **Sync.com**
   - Privacy-focused, zero-knowledge encryption
   - Similar path patterns to Dropbox

8. **pCloud**
   - European alternative with encryption
   - Mounts as virtual drive on all platforms

9. **MEGA**
   - Privacy-focused with E2E encryption
   - Desktop sync available: MEGAsync

10. **Nextcloud/ownCloud**
    - Self-hosted options
    - Custom paths configured by user

11. **SpiderOak**
    - Zero-knowledge privacy focus
    - Less common but security-conscious users

## Implementation Approach

### 1. Cloud Provider Detection

Create a utility to detect installed cloud storage services:

```typescript
// src/lib/cloud-storage-detector.ts

export interface CloudProvider {
  id: string;
  name: string;
  icon: string; // Emoji or icon identifier
  defaultPath: string | null;
  isAvailable: boolean;
  detectedPaths: string[]; // Multiple accounts support
}

export class CloudStorageDetector {
  /**
   * Detect all available cloud storage providers
   */
  async detectProviders(): Promise<CloudProvider[]> {
    const providers: CloudProvider[] = [];

    // Detect each provider
    providers.push(await this.detectDropbox());
    providers.push(await this.detectOneDrive());
    providers.push(await this.detectICloudDrive());
    providers.push(await this.detectGoogleDrive());
    providers.push(await this.detectProtonDrive());
    providers.push(await this.detectBox());
    // Add more as needed

    return providers.filter(p => p.isAvailable);
  }

  private async detectDropbox(): Promise<CloudProvider> {
    const platform = await this.getPlatform();
    let paths: string[] = [];

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

  private async detectOneDrive(): Promise<CloudProvider> {
    const platform = await this.getPlatform();
    let paths: string[] = [];

    if (platform === 'darwin') {
      // Check both locations
      const cloudPath = await this.expandPath('~/Library/CloudStorage');
      if (await this.pathExists(cloudPath)) {
        // Look for OneDrive folders
        const dirs = await this.listDirectory(cloudPath);
        const oneDriveDirs = dirs.filter(d => d.startsWith('OneDrive-'));
        paths.push(...oneDriveDirs.map(d => `${cloudPath}/${d}`));
      }

      // Also check legacy location
      const oneDrivePath = await this.expandPath('~/OneDrive');
      if (await this.pathExists(oneDrivePath)) {
        paths.push(oneDrivePath);
      }
    } else if (platform === 'win32') {
      const oneDrivePath = await this.expandPath('%USERPROFILE%\\OneDrive');
      if (await this.pathExists(oneDrivePath)) {
        paths.push(oneDrivePath);
      }
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

  private async detectICloudDrive(): Promise<CloudProvider> {
    const platform = await this.getPlatform();
    let paths: string[] = [];

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

  private async detectGoogleDrive(): Promise<CloudProvider> {
    const platform = await this.getPlatform();
    let paths: string[] = [];

    if (platform === 'darwin') {
      const cloudPath = await this.expandPath('~/Library/CloudStorage');
      if (await this.pathExists(cloudPath)) {
        const dirs = await this.listDirectory(cloudPath);
        const gdriveDirs = dirs.filter(d => d.startsWith('GoogleDrive-'));
        paths.push(...gdriveDirs.map(d => `${cloudPath}/${d}/My Drive`));
      }
    } else if (platform === 'win32') {
      // Check common locations
      const gdrivePath = await this.expandPath('%USERPROFILE%\\Google Drive');
      if (await this.pathExists(gdrivePath)) {
        paths.push(gdrivePath);
      }

      // Also check for mounted drive letters (G:, etc.)
      // This would need additional Windows-specific logic
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

  private async detectProtonDrive(): Promise<CloudProvider> {
    // ProtonDrive desktop sync is in beta
    // Will need to update paths when officially released
    return {
      id: 'protondrive',
      name: 'ProtonDrive',
      icon: '🔒',
      defaultPath: null,
      isAvailable: false,
      detectedPaths: []
    };
  }

  private async detectBox(): Promise<CloudProvider> {
    const platform = await this.getPlatform();
    let paths: string[] = [];

    if (platform === 'darwin') {
      const cloudPath = await this.expandPath('~/Library/CloudStorage');
      if (await this.pathExists(cloudPath)) {
        const dirs = await this.listDirectory(cloudPath);
        const boxDirs = dirs.filter(d => d.startsWith('Box-'));
        paths.push(...boxDirs.map(d => `${cloudPath}/${d}`));
      }

      // Also check legacy location
      const boxPath = await this.expandPath('~/Box');
      if (await this.pathExists(boxPath)) {
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

  // Helper methods
  private async getPlatform(): Promise<string> {
    if (window.electronAPI?.isElectron) {
      return await window.electronAPI.system.getPlatform();
    }
    return 'browser';
  }

  private async pathExists(path: string): Promise<boolean> {
    if (!window.electronAPI?.isElectron) return false;
    try {
      return await window.electronAPI.fileSystem.exists(path);
    } catch {
      return false;
    }
  }

  private async expandPath(path: string): Promise<string> {
    if (!window.electronAPI?.isElectron) return path;
    // Would need to add IPC method to expand ~ and %USERPROFILE%
    return await window.electronAPI.fileSystem.expandPath(path);
  }

  private async listDirectory(path: string): Promise<string[]> {
    if (!window.electronAPI?.isElectron) return [];
    try {
      return await window.electronAPI.fileSystem.listDirectory(path);
    } catch {
      return [];
    }
  }
}
```

### 2. Enhanced Add Sync Directory UI

Update the "Add Sync Directory" dialog to show detected cloud providers:

```html
<div id="addSyncDirectoryDialog" class="modal">
  <div class="modal-content">
    <h3>Add Sync Directory</h3>

    <!-- Cloud Provider Quick Selection -->
    <div class="cloud-providers-section">
      <h4>Quick Setup with Cloud Storage</h4>
      <div id="cloudProvidersList" class="cloud-providers-list">
        <!-- Dynamically populated with detected providers -->
        <button class="cloud-provider-btn" data-provider-id="dropbox">
          <span class="cloud-icon">📦</span>
          <span class="cloud-name">Dropbox</span>
          <span class="cloud-path">/Users/you/Dropbox</span>
        </button>

        <button class="cloud-provider-btn" data-provider-id="icloud">
          <span class="cloud-icon">☁️</span>
          <span class="cloud-name">iCloud Drive</span>
          <span class="cloud-path">/Users/you/Library/Mobile Documents/...</span>
        </button>
      </div>
    </div>

    <div class="divider">
      <span>OR</span>
    </div>

    <!-- Manual Path Selection -->
    <div class="manual-path-section">
      <h4>Choose Custom Location</h4>
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="syncDirName" placeholder="e.g., Work, Personal">
      </div>
      <div class="form-group">
        <label>Path</label>
        <div class="path-input-group">
          <input type="text" id="syncDirPath" readonly>
          <button onclick="app.chooseSyncDirectoryPath()">Browse...</button>
        </div>
      </div>
    </div>

    <div class="modal-actions">
      <button onclick="app.closeAddSyncDirectoryDialog()">Cancel</button>
      <button onclick="app.confirmAddSyncDirectory()" class="btn-primary">Add</button>
    </div>
  </div>
</div>
```

### 3. CSS for Cloud Provider Selection

```css
.cloud-providers-section {
  margin-bottom: 24px;
}

.cloud-providers-section h4 {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-secondary);
}

.cloud-providers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cloud-provider-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.cloud-provider-btn:hover {
  background: white;
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.cloud-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.cloud-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
  flex-shrink: 0;
}

.cloud-path {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.divider {
  position: relative;
  text-align: center;
  margin: 24px 0;
}

.divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--border);
}

.divider span {
  position: relative;
  background: white;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.manual-path-section h4 {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-secondary);
}

.cloud-provider-btn.not-detected {
  opacity: 0.5;
  cursor: not-allowed;
  position: relative;
}

.cloud-provider-btn.not-detected::after {
  content: 'Not Installed';
  position: absolute;
  right: 16px;
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
}
```

### 4. Renderer Integration

Add methods to renderer.ts:

```typescript
async showAddSyncDirectoryDialog(): Promise<void> {
  // Detect cloud providers
  const detector = new CloudStorageDetector();
  const providers = await detector.detectProviders();

  // Populate cloud providers list
  this.renderCloudProviders(providers);

  // Show dialog
  const dialog = document.getElementById('addSyncDirectoryDialog');
  if (dialog) {
    dialog.style.display = 'flex';
  }
}

renderCloudProviders(providers: CloudProvider[]): void {
  const list = document.getElementById('cloudProvidersList');
  if (!list) return;

  const html = providers.map(provider => `
    <button class="cloud-provider-btn ${!provider.isAvailable ? 'not-detected' : ''}"
            data-provider-id="${provider.id}"
            ${!provider.isAvailable ? 'disabled' : ''}
            onclick="app.selectCloudProvider('${provider.id}', '${escapeHtml(provider.defaultPath || '')}')">
      <span class="cloud-icon">${provider.icon}</span>
      <span class="cloud-name">${escapeHtml(provider.name)}</span>
      <span class="cloud-path">${escapeHtml(provider.defaultPath || 'Not installed')}</span>
    </button>
  `).join('');

  list.innerHTML = html;
}

async selectCloudProvider(providerId: string, defaultPath: string): Promise<void> {
  // Auto-fill the name based on provider
  const nameInput = document.getElementById('syncDirName') as HTMLInputElement;
  const pathInput = document.getElementById('syncDirPath') as HTMLInputElement;

  if (nameInput && !nameInput.value) {
    // Suggest name based on provider
    const providerNames: Record<string, string> = {
      dropbox: 'Dropbox Notes',
      onedrive: 'OneDrive Notes',
      icloud: 'iCloud Notes',
      googledrive: 'Google Drive Notes',
      protondrive: 'ProtonDrive Notes',
      box: 'Box Notes'
    };
    nameInput.value = providerNames[providerId] || 'My Notes';
  }

  if (pathInput) {
    // Create NoteCove subfolder in the cloud storage
    const notecovePath = `${defaultPath}/NoteCove`;
    pathInput.value = notecovePath;
  }
}
```

### 5. IPC Methods Needed

Add to preload.ts:

```typescript
fileSystem: {
  // ... existing methods
  expandPath: (path: string) => ipcRenderer.invoke('fs:expand-path', path),
  listDirectory: (path: string) => ipcRenderer.invoke('fs:list-directory', path),
}

system: {
  getPlatform: () => ipcRenderer.invoke('system:get-platform')
}
```

Add handlers to main.ts:

```typescript
// Expand ~ and environment variables in paths
ipcMain.handle('fs:expand-path', async (_event, path: string) => {
  const os = require('os');
  const expanded = path
    .replace(/^~/, os.homedir())
    .replace(/%([^%]+)%/g, (_, n) => process.env[n] || '');
  return expanded;
});

// List directory contents
ipcMain.handle('fs:list-directory', async (_event, dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (error) {
    console.error('Failed to list directory:', error);
    return [];
  }
});

// Get platform
ipcMain.handle('system:get-platform', () => {
  return process.platform;
});
```

## Important Considerations

### 1. Path Validation
- Verify cloud storage path is actually syncing (check for sync indicators)
- Warn if path appears offline or not syncing
- Test write permissions before allowing selection

### 2. Conflict Prevention
- Add `.notecove-sync-id` file to each directory to identify it
- Warn if trying to add same directory twice
- Check for existing NoteCove data before overwriting

### 3. Performance
- Cloud storage may have slower I/O
- Consider adding sync status indicators per directory
- Warn about bandwidth usage for large attachments

### 4. Security Warnings
- Display warning about cloud storage provider's encryption
- Recommend providers with zero-knowledge encryption for sensitive data
- Consider adding optional local encryption layer

### 5. User Guidance
Documentation should include:
- Pros/cons of each cloud provider
- Sync conflict resolution strategies
- Best practices for multi-device usage
- Backup recommendations

## Recommendation Priority

**High Priority (Include in MVP):**
1. Dropbox (most popular, reliable sync)
2. iCloud Drive (macOS native, excellent performance)
3. OneDrive (Windows native, enterprise usage)
4. Google Drive (very popular)
5. Custom path (always allow manual selection)

**Medium Priority (Post-MVP):**
6. ProtonDrive (privacy-focused, growing user base)
7. Box (enterprise market)

**Low Priority (If requested):**
8. Sync.com, pCloud, MEGA, etc.

## Testing Strategy

1. **Mock cloud provider detection** for automated tests
2. **Manual testing on each platform** with actual cloud storage installed
3. **Test sync conflicts** between devices
4. **Test offline scenarios** (what happens when cloud storage is offline)
5. **Performance testing** with large note collections
