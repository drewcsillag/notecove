/**
 * Profile Picker Preload Script
 *
 * Exposes IPC methods to the profile picker renderer.
 * This is a separate preload from the main app to keep the picker isolated.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ProfileMode } from '@notecove/shared';

/** Profile type exposed to renderer */
interface Profile {
  id: string;
  name: string;
  isDev: boolean;
  mode?: ProfileMode;
  created: number;
  lastUsed: number;
}

/** Data returned by getProfiles */
interface ProfilesData {
  profiles: Profile[];
  defaultProfileId: string | null;
  skipPicker: boolean;
  isDevBuild: boolean;
}

// Expose profile picker API to renderer
contextBridge.exposeInMainWorld('profilePickerAPI', {
  /**
   * Get the list of profiles and configuration
   */
  getProfiles: (): Promise<ProfilesData> =>
    ipcRenderer.invoke('profile-picker:getProfiles') as Promise<ProfilesData>,

  /**
   * Select a profile and close the picker
   * @param profileId - The profile to select
   * @param skipPicker - Whether to skip the picker next time (production only)
   */
  selectProfile: (profileId: string, skipPicker: boolean): Promise<void> =>
    ipcRenderer.invoke('profile-picker:selectProfile', profileId, skipPicker) as Promise<void>,

  /**
   * Cancel profile selection and close the picker
   */
  cancel: (): Promise<void> => ipcRenderer.invoke('profile-picker:cancel') as Promise<void>,

  /**
   * Create a new profile (simple - used as fallback during development)
   * @param name - The display name for the new profile
   * @returns The newly created profile
   */
  createProfile: (name: string): Promise<Profile> =>
    ipcRenderer.invoke('profile-picker:createProfile', name) as Promise<Profile>,

  /**
   * Create a new profile with wizard configuration
   * @param config - Full wizard configuration
   * @returns The newly created profile
   */
  createProfileWithConfig: (config: {
    name: string;
    mode: ProfileMode;
    storagePath?: string;
    username?: string;
    handle?: string;
  }): Promise<Profile> =>
    ipcRenderer.invoke('profile-picker:createProfileWithConfig', config) as Promise<Profile>,

  /**
   * Delete a profile
   * @param profileId - The ID of the profile to delete
   */
  deleteProfile: (profileId: string): Promise<void> =>
    ipcRenderer.invoke('profile-picker:deleteProfile', profileId) as Promise<void>,

  /**
   * Rename a profile
   * @param profileId - The ID of the profile to rename
   * @param newName - The new display name
   */
  renameProfile: (profileId: string, newName: string): Promise<void> =>
    ipcRenderer.invoke('profile-picker:renameProfile', profileId, newName) as Promise<void>,

  /**
   * Get detected cloud storage paths
   * @returns Object mapping provider names to their paths (only includes existing paths)
   */
  getCloudStoragePaths: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('profile-picker:getCloudStoragePaths') as Promise<Record<string, string>>,

  /**
   * Get the default storage path for local mode (~/Documents/NoteCove)
   * @returns The default storage path
   */
  getDefaultStoragePath: (): Promise<string> =>
    ipcRenderer.invoke('profile-picker:getDefaultStoragePath') as Promise<string>,

  /**
   * Show directory picker dialog for custom storage path
   * @param defaultPath - Optional default path to start from
   * @returns Selected path or null if cancelled
   */
  selectStoragePath: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('profile-picker:selectStoragePath', defaultPath) as Promise<string | null>,
});

/** Wizard configuration for creating a profile */
interface WizardConfig {
  name: string;
  mode: ProfileMode;
  storagePath?: string;
  username?: string;
  handle?: string;
}

/** Profile picker API interface */
interface ProfilePickerAPI {
  getProfiles: () => Promise<ProfilesData>;
  selectProfile: (profileId: string, skipPicker: boolean) => Promise<void>;
  cancel: () => Promise<void>;
  createProfile: (name: string) => Promise<Profile>;
  createProfileWithConfig: (config: WizardConfig) => Promise<Profile>;
  deleteProfile: (profileId: string) => Promise<void>;
  renameProfile: (profileId: string, newName: string) => Promise<void>;
  getCloudStoragePaths: () => Promise<Record<string, string>>;
  getDefaultStoragePath: () => Promise<string>;
  selectStoragePath: (defaultPath?: string) => Promise<string | null>;
}

// Type declaration for window
declare global {
  interface Window {
    profilePickerAPI: ProfilePickerAPI | undefined;
  }
}
