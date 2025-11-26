/**
 * Profile Picker Preload Script
 *
 * Exposes IPC methods to the profile picker renderer.
 * This is a separate preload from the main app to keep the picker isolated.
 */

import { contextBridge, ipcRenderer } from 'electron';

/** Profile type exposed to renderer */
interface Profile {
  id: string;
  name: string;
  isDev: boolean;
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
  cancel: (): Promise<void> =>
    ipcRenderer.invoke('profile-picker:cancel') as Promise<void>,

  /**
   * Create a new profile
   * @param name - The display name for the new profile
   * @returns The newly created profile
   */
  createProfile: (name: string): Promise<Profile> =>
    ipcRenderer.invoke('profile-picker:createProfile', name) as Promise<Profile>,
});

// Type declaration for window
declare global {
  interface Window {
    profilePickerAPI: {
      getProfiles: () => Promise<ProfilesData>;
      selectProfile: (profileId: string, skipPicker: boolean) => Promise<void>;
      cancel: () => Promise<void>;
      createProfile: (name: string) => Promise<Profile>;
    };
  }
}
