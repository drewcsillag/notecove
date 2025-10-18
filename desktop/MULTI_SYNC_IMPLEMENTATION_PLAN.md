# Multiple Sync Directories Implementation Plan

## Overview
Add support for multiple sync directories (workspaces), where each directory has its own set of notes, folders, and settings. Users can switch between sync directories, and each appears as a top-level container in the folder tree.

## Completed
- ✅ Created `SyncDirectoryManager` class for managing multiple sync directories
  - File: `src/lib/sync-directory-manager.ts`
  - Handles CRUD operations for sync directories
  - Persists configuration to `.sync-directories.json` in user data directory
  - Supports both Electron and browser modes

## Architecture Changes Needed

### 1. Data Structure
Each sync directory has:
```typescript
{
  id: string;           // Unique identifier
  name: string;         // User-friendly name (e.g., "Work", "Personal")
  path: string;         // Filesystem path to .notecove directory
  created: string;      // ISO timestamp
  lastAccessed: string; // ISO timestamp
  isExpanded: boolean;  // UI state: whether directory is expanded in folder tree
  order: number;        // Display order (0-indexed)
}
```

**Important: ALL sync directories are active simultaneously** - users can see and work with notes from all directories at once.

### 2. Folder Tree UI Changes
Current structure:
```
📖 All Notes
📁 Folder 1
📁 Folder 2
🗑️ Recently Deleted
```

New structure with multiple sync directories:
```
💼 Work (sync directory)
  📖 All Notes
  📁 Work Folder 1
  📁 Work Folder 2
  🗑️ Recently Deleted

🏠 Personal (sync directory)
  📖 All Notes
  📁 Personal Folder 1
  🗑️ Recently Deleted
```

### 3. Settings Panel
Create a new settings panel accessible via:
- Menu item or settings icon in sidebar
- Keyboard shortcut (e.g., Cmd/Ctrl + ,)

Settings panel should include:
- **Sync Directories tab**
  - List of all sync directories with name and path
  - Add new sync directory button
  - Edit/rename sync directory
  - Remove sync directory (with confirmation)
  - Set active sync directory

### 4. Component Changes

#### A. Renderer (`src/renderer.ts`)
**Changes needed:**
1. Add `syncDirectoryManager: SyncDirectoryManager` property
2. Initialize sync directory manager in constructor
3. Modify `renderFolderTree()` to group folders by sync directory
4. Add sync directory switcher UI
5. Add settings panel methods:
   - `openSettings()`
   - `closeSettings()`
   - `renderSettingsPanel()`
   - `addSyncDirectory()`
   - `removeSyncDirectory()`
   - `renameSyncDirectory()`

#### B. NoteManager (`src/lib/note-manager.ts`)
**Changes needed:**
1. Change from single SyncManager to Map of SyncManagers (one per directory):
   ```typescript
   syncManagers: Map<string, SyncManager> = new Map();
   ```
2. Modify `loadNotes()` to load from ALL sync directories
3. Add `syncDirectoryId` to Note interface to track which directory each note belongs to
4. Update note operations to use correct SyncManager based on note's directory
5. Add methods:
   ```typescript
   async loadNotesFromDirectory(directoryId: string, path: string): Promise<void>
   async unloadNotesFromDirectory(directoryId: string): Promise<void>
   getSyncManagerForNote(noteId: string): SyncManager | null
   ```

#### C. SyncManager (`src/lib/sync-manager.ts`)
**Current:** Single `notesPath` property
**New:** Multiple SyncManager instances, one per sync directory

**Approach:** Create separate SyncManager instance for each sync directory
- Each SyncManager operates independently
- Each has its own sync interval and update tracking
- NoteManager coordinates between them using a Map

No changes needed to SyncManager class itself - it already works per-directory.
The complexity is in NoteManager coordinating multiple instances.

#### D. Main Process (`src/main.ts`)
**Changes needed:**
1. Store sync directories configuration in electron-store
2. On startup, load active sync directory or show directory selection
3. Handle IPC for:
   - Adding sync directory (may need directory picker dialog)
   - Removing sync directory
   - Switching sync directory

### 5. UI Implementation Details

#### Settings Panel HTML (add to `index.html`)
```html
<!-- Settings Panel -->
<div id="settingsPanel" class="settings-panel" style="display: none;">
  <div class="settings-overlay" onclick="app.closeSettings()"></div>
  <div class="settings-content">
    <div class="settings-header">
      <h2>Settings</h2>
      <button class="close-btn" onclick="app.closeSettings()">✕</button>
    </div>

    <div class="settings-tabs">
      <button class="settings-tab active" data-tab="sync-directories">Sync Directories</button>
      <button class="settings-tab" data-tab="general">General</button>
    </div>

    <div class="settings-body">
      <!-- Sync Directories Tab -->
      <div id="syncDirectoriesTab" class="settings-tab-content active">
        <div class="settings-section">
          <div class="settings-section-header">
            <h3>Sync Directories</h3>
            <button onclick="app.showAddSyncDirectoryDialog()" class="btn-primary">
              + Add Directory
            </button>
          </div>

          <div id="syncDirectoriesList" class="sync-directories-list">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>

      <!-- General Tab -->
      <div id="generalTab" class="settings-tab-content">
        <!-- Future settings go here -->
      </div>
    </div>
  </div>
</div>

<!-- Add Sync Directory Dialog -->
<div id="addSyncDirectoryDialog" class="modal" style="display: none;">
  <div class="modal-content">
    <h3>Add Sync Directory</h3>
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
    <div class="modal-actions">
      <button onclick="app.closeAddSyncDirectoryDialog()">Cancel</button>
      <button onclick="app.confirmAddSyncDirectory()" class="btn-primary">Add</button>
    </div>
  </div>
</div>
```

#### Settings Panel CSS (add to `index.html` styles)
```css
.settings-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.settings-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.settings-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 8px;
  width: 700px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.settings-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 0 24px;
}

.settings-tab {
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-weight: 500;
  color: var(--text-secondary);
}

.settings-tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.settings-body {
  padding: 24px;
  max-height: calc(80vh - 140px);
  overflow-y: auto;
}

.settings-tab-content {
  display: none;
}

.settings-tab-content.active {
  display: block;
}

.sync-directories-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.sync-directory-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}

.sync-directory-item.active {
  border-color: var(--primary-color);
  background: rgba(45, 88, 64, 0.05);
}

.sync-directory-info {
  flex: 1;
}

.sync-directory-name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 4px;
}

.sync-directory-path {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
}

.sync-directory-actions {
  display: flex;
  gap: 8px;
}

.sync-directory-badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--primary-color);
  color: white;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
}
```

#### Folder Tree Modifications
In `renderFolderTree()` method, wrap existing folder list with sync directory containers:

```typescript
renderFolderTree(): void {
  const syncDirs = this.syncDirectoryManager.getDirectories();
  const activeSyncDir = this.syncDirectoryManager.getActiveDirectory();

  if (syncDirs.length <= 1) {
    // Single sync directory - render as before (backwards compatible)
    this.renderStandardFolderTree();
    return;
  }

  // Multiple sync directories - render with grouping
  let html = '';
  for (const syncDir of syncDirs) {
    const isActive = syncDir.id === activeSyncDir?.id;
    const expanded = isActive; // Only expand active directory by default

    html += `
      <div class="sync-directory-group ${isActive ? 'active' : ''}">
        <div class="sync-directory-header"
             onclick="app.toggleSyncDirectory('${syncDir.id}')"
             data-sync-dir-id="${syncDir.id}">
          <span class="collapse-arrow">${expanded ? '▼' : '▶'}</span>
          <span class="sync-dir-icon">💼</span>
          <span class="sync-dir-name">${escapeHtml(syncDir.name)}</span>
        </div>
        ${expanded ? this.renderFoldersForSyncDirectory(syncDir.id) : ''}
      </div>
    `;
  }

  folderListElement.innerHTML = html;
}
```

### 6. IPC Additions for Electron

Add to `src/main.ts`:
```typescript
// Show directory picker for sync directory
ipcMain.handle('dialog:show-open-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  return result;
});
```

Add to `src/preload.ts`:
```typescript
dialog: {
  showOpenDialog: () => ipcRenderer.invoke('dialog:show-open-dialog')
}
```

### 7. Migration Strategy

For existing users with a single sync directory:
1. On first launch with new version, detect existing `notesPath`
2. Create default sync directory entry with name "My Notes"
3. Set it as active directory
4. User can add more directories later

Migration code (add to `SyncDirectoryManager.initialize()`):
```typescript
async initialize(): Promise<void> {
  await this.loadConfig();

  // Migration: If no directories exist, check for legacy notesPath
  if (this.config.directories.length === 0) {
    const legacyPath = await this.getLegacyNotesPath();
    if (legacyPath) {
      await this.addDirectory('My Notes', legacyPath);
      console.log('Migrated legacy notes path to sync directory');
    }
  }
}

private async getLegacyNotesPath(): Promise<string | null> {
  if (!this.isElectron) return null;

  try {
    const userDataPath = await window.electronAPI.fileSystem.getUserDataPath();
    // Check if there's an existing .notecove directory
    const exists = await window.electronAPI.fileSystem.exists(`${userDataPath}/.notecove`);
    return exists ? `${userDataPath}/.notecove` : null;
  } catch {
    return null;
  }
}
```

### 8. Testing Plan

#### Unit Tests
- `sync-directory-manager.test.ts`: Test CRUD operations
- Test configuration persistence
- Test active directory switching

#### E2E Tests
- Create multiple sync directories
- Switch between sync directories
- Verify notes are isolated per directory
- Test folder tree rendering with multiple directories
- Test sync across multiple directories

### 9. Next Steps (In Order)

1. ✅ Create `SyncDirectoryManager` class (DONE)
2. Add settings panel HTML and CSS to `index.html`
3. Implement settings panel methods in `renderer.ts`
4. Modify `renderFolderTree()` to support sync directory grouping
5. Update `NoteManager` to track sync directory per note
6. Update `SyncManager` to support directory switching
7. Add IPC handlers for directory picker
8. Implement migration for existing users
9. Add unit tests
10. Add E2E tests
11. Update documentation

### 10. Keyboard Shortcuts
- `Cmd/Ctrl + ,`: Open settings
- `Cmd/Ctrl + Shift + N`: New sync directory
- `Cmd/Ctrl + 1-9`: Switch to sync directory N

### 11. Future Enhancements
- Sync between directories (copy/move notes)
- Import/export sync directories
- Cloud sync configuration per directory
- Directory-specific themes
- Directory-specific keyboard shortcuts
