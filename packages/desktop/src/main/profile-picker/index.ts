/**
 * Profile Picker Window
 *
 * Main process module for showing the profile picker dialog.
 * This creates a separate BrowserWindow that displays the profile picker UI
 * and returns the selected profile ID.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { ProfileStorage, type Profile } from '@notecove/shared';
import { NodeFileSystemAdapter } from '../storage/node-fs-adapter';

/**
 * Check if app.getAppPath() returns dist-electron/main (vs package root or asar).
 *
 * This varies by launch method:
 * - Dev mode (`pnpm dev`): package root → use dist-electron/preload/...
 * - Test with `args: ['.']`: package root → use dist-electron/preload/...
 * - Test with explicit main path: dist-electron/main → use ../preload/...
 * - Production (asar): path to asar file → use dist-electron/preload/...
 *
 * Note: asar mode uses the same paths as dev mode because app.getAppPath()
 * returns the asar file path, and Electron's virtual filesystem allows
 * accessing files inside via asar-path/dist-electron/...
 */
function isAppPathInDistElectronMain(): boolean {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron/main');
}

/**
 * Get the path to the profile picker preload script.
 */
function getProfilePickerPreloadPath(): string {
  if (isAppPathInDistElectronMain()) {
    return join(app.getAppPath(), '..', 'preload/profile-picker.js');
  }
  return join(app.getAppPath(), 'dist-electron/preload/profile-picker.js');
}

/**
 * Get the path to the profile picker HTML file.
 */
function getProfilePickerRendererPath(): string {
  if (isAppPathInDistElectronMain()) {
    return join(app.getAppPath(), '..', 'renderer/profile-picker/index.html');
  }
  return join(app.getAppPath(), 'dist-electron/renderer/profile-picker/index.html');
}

/** Result from showing the profile picker */
export interface ProfilePickerResult {
  /** Selected profile ID, or null if cancelled */
  profileId: string | null;
  /** Whether to skip picker in future (production only) */
  skipPicker: boolean;
}

/** Options for showing the profile picker */
export interface ProfilePickerOptions {
  /** Whether this is a dev build */
  isDevBuild: boolean;
  /** Path to the app data directory */
  appDataDir: string;
}

let pickerWindow: BrowserWindow | null = null;
let profileStorage: ProfileStorage | null = null;
let resolveSelection: ((result: ProfilePickerResult) => void) | null = null;

/**
 * Initialize profile storage
 */
function initProfileStorage(appDataDir: string): ProfileStorage {
  if (!profileStorage) {
    const fs = new NodeFileSystemAdapter();
    profileStorage = new ProfileStorage(fs, appDataDir);
  }
  return profileStorage;
}

/**
 * Register IPC handlers for the profile picker
 */
function registerIPCHandlers(options: ProfilePickerOptions): void {
  const storage = initProfileStorage(options.appDataDir);

  // Get list of profiles
  ipcMain.handle('profile-picker:getProfiles', async () => {
    const config = await storage.loadProfiles();
    return {
      profiles: config.profiles,
      defaultProfileId: config.defaultProfileId,
      skipPicker: config.skipPicker,
      isDevBuild: options.isDevBuild,
    };
  });

  // Select a profile
  ipcMain.handle(
    'profile-picker:selectProfile',
    async (_event, profileId: string, skipPicker: boolean) => {
      // Update lastUsed timestamp and save config
      const config = await storage.loadProfiles();
      const profile = config.profiles.find((p) => p.id === profileId);

      if (profile) {
        profile.lastUsed = Date.now();

        // Only allow skipPicker in production builds
        if (!options.isDevBuild && skipPicker) {
          config.skipPicker = true;
          config.defaultProfileId = profileId;
        }

        await storage.saveProfiles(config);
      }

      // Resolve the promise with the selection
      if (resolveSelection) {
        resolveSelection({ profileId, skipPicker });
        resolveSelection = null;
      }

      // Close the picker window
      if (pickerWindow && !pickerWindow.isDestroyed()) {
        pickerWindow.close();
      }
    }
  );

  // Cancel selection (close window without selecting)
  ipcMain.handle('profile-picker:cancel', () => {
    if (resolveSelection) {
      resolveSelection({ profileId: null, skipPicker: false });
      resolveSelection = null;
    }

    if (pickerWindow && !pickerWindow.isDestroyed()) {
      pickerWindow.close();
    }
  });

  // Create a new profile
  ipcMain.handle('profile-picker:createProfile', async (_event, name: string) => {
    const config = await storage.loadProfiles();

    // Create profile with isDev matching build type
    const newProfile: Profile = {
      id: generateProfileId(),
      name,
      isDev: options.isDevBuild,
      created: Date.now(),
      lastUsed: Date.now(),
    };

    config.profiles.push(newProfile);
    await storage.saveProfiles(config);

    // Ensure profile data directory exists
    await storage.ensureProfileDataDir(newProfile.id);

    return newProfile;
  });

  // Delete a profile
  ipcMain.handle('profile-picker:deleteProfile', async (_event, profileId: string) => {
    await storage.deleteProfile(profileId);
  });

  // Rename a profile
  ipcMain.handle(
    'profile-picker:renameProfile',
    async (_event, profileId: string, newName: string) => {
      await storage.renameProfile(profileId, newName);
    }
  );
}

/**
 * Unregister IPC handlers
 */
function unregisterIPCHandlers(): void {
  ipcMain.removeHandler('profile-picker:getProfiles');
  ipcMain.removeHandler('profile-picker:selectProfile');
  ipcMain.removeHandler('profile-picker:cancel');
  ipcMain.removeHandler('profile-picker:createProfile');
  ipcMain.removeHandler('profile-picker:deleteProfile');
  ipcMain.removeHandler('profile-picker:renameProfile');
}

/**
 * Generate a unique profile ID (UUID v4)
 */
function generateProfileId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Show the profile picker window and wait for selection
 *
 * @param options - Configuration options
 * @returns Promise that resolves with the selected profile ID
 */
export async function showProfilePicker(
  options: ProfilePickerOptions
): Promise<ProfilePickerResult> {
  // Check if we should skip the picker
  const storage = initProfileStorage(options.appDataDir);
  const config = await storage.loadProfiles();

  // In production, check if user wants to skip picker
  if (!options.isDevBuild && config.skipPicker && config.defaultProfileId) {
    // Verify the default profile still exists
    const defaultProfile = config.profiles.find((p) => p.id === config.defaultProfileId);
    if (defaultProfile && !defaultProfile.isDev) {
      // Update lastUsed and return
      defaultProfile.lastUsed = Date.now();
      await storage.saveProfiles(config);
      return { profileId: config.defaultProfileId, skipPicker: true };
    }
  }

  // Auto-create Development profile if in dev mode and no profiles exist
  if (options.isDevBuild && config.profiles.length === 0) {
    const devProfile: Profile = {
      id: generateProfileId(),
      name: 'Development',
      isDev: true,
      created: Date.now(),
      lastUsed: Date.now(),
    };
    config.profiles.push(devProfile);
    await storage.saveProfiles(config);
    await storage.ensureProfileDataDir(devProfile.id);
    console.log('[ProfilePicker] Auto-created Development profile');
  }

  // Register IPC handlers
  registerIPCHandlers(options);

  return new Promise((resolve) => {
    resolveSelection = resolve;

    // Create the picker window
    pickerWindow = new BrowserWindow({
      width: 480,
      height: 475,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: 'Select Profile - NoteCove',
      show: false,
      webPreferences: {
        preload: getProfilePickerPreloadPath(),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    pickerWindow.on('ready-to-show', () => {
      if (pickerWindow) {
        pickerWindow.show();
        pickerWindow.focus();
      }
    });

    pickerWindow.on('closed', () => {
      pickerWindow = null;
      unregisterIPCHandlers();

      // If window was closed without selection, resolve with null
      if (resolveSelection) {
        resolveSelection({ profileId: null, skipPicker: false });
        resolveSelection = null;
      }
    });

    // Load the picker renderer
    if (process.env['NODE_ENV'] === 'test' || !is.dev || !process.env['ELECTRON_RENDERER_URL']) {
      void pickerWindow.loadFile(getProfilePickerRendererPath());
    } else {
      void pickerWindow.loadURL(
        `${process.env['ELECTRON_RENDERER_URL']}/profile-picker/index.html`
      );
    }
  });
}

/**
 * Check if profile picker should be shown
 *
 * @param options - Configuration options
 * @returns Whether to show the picker
 */
export async function shouldShowProfilePicker(options: ProfilePickerOptions): Promise<boolean> {
  // Dev builds always show picker
  if (options.isDevBuild) {
    return true;
  }

  // Check if skipPicker is set
  const storage = initProfileStorage(options.appDataDir);
  const config = await storage.loadProfiles();

  if (config.skipPicker && config.defaultProfileId) {
    // Verify the profile exists and is not a dev profile
    const profile = config.profiles.find((p) => p.id === config.defaultProfileId);
    if (profile && !profile.isDev) {
      return false;
    }
  }

  return true;
}

/**
 * Get the profile storage instance
 */
export function getProfileStorage(appDataDir: string): ProfileStorage {
  return initProfileStorage(appDataDir);
}
