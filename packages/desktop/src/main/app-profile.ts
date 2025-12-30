/**
 * Profile Selection and Lock Management
 *
 * Handles profile picker UI, CLI argument processing, and profile locking
 * to ensure single-instance per profile.
 */

import { app, dialog } from 'electron';
import { ProfileLock, type ProfileMode, getProfileMode } from '@notecove/shared';
import { NodeFileSystemAdapter } from './storage/node-fs-adapter';
import { showProfilePicker, getProfileStorage } from './profile-picker';
import type { CliArgs } from './cli/cli-parser';

export interface ProfileSelectionResult {
  profileId: string;
  profileName: string | null;
  /** Profile mode for determining privacy/feature settings */
  profileMode: ProfileMode;
  profileLock: ProfileLock;
  /** Initial storage path from wizard (undefined if not set or already applied) */
  initialStoragePath?: string;
  /** Initial username from wizard (undefined if not set or already applied) */
  initialUsername?: string;
  /** Initial handle from wizard (undefined if not set or already applied) */
  initialHandle?: string;
}

/**
 * Select a profile based on CLI arguments or user interaction
 */
export async function selectProfile(
  cliArgs: CliArgs,
  isTestMode: boolean
): Promise<ProfileSelectionResult | null> {
  const appDataDir = app.getPath('userData');
  const isDevBuild = !app.isPackaged;
  const profileStorage = getProfileStorage(appDataDir);

  // In test mode, handle CLI profile lookup but skip UI dialogs
  if (isTestMode) {
    console.log('[Profile] Test mode - checking for CLI profile...');

    // Handle --profile=<name> in test mode (e.g., paranoid mode E2E tests)
    if (cliArgs.profileName) {
      const config = await profileStorage.loadProfiles();
      const profile = config.profiles.find((p) => p.name === cliArgs.profileName);

      if (profile) {
        console.log(
          `[Profile] Test mode: Using profile "${profile.name}" (${profile.id}, mode: ${getProfileMode(profile)})`
        );

        // Return the profile without UI dialogs or locks
        // In test mode we don't need locking since tests manage their own isolation
        const fsAdapter = new NodeFileSystemAdapter();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        const dummyLock = new ProfileLock(fsAdapter as any);

        const result: ProfileSelectionResult = {
          profileId: profile.id,
          profileName: profile.name,
          profileMode: getProfileMode(profile),
          profileLock: dummyLock,
        };

        // Only include initialization data if present
        if (profile.initialStoragePath) {
          result.initialStoragePath = profile.initialStoragePath;
        }
        if (profile.initialUsername) {
          result.initialUsername = profile.initialUsername;
        }
        if (profile.initialHandle) {
          result.initialHandle = profile.initialHandle;
        }

        return result;
      } else {
        console.warn(`[Profile] Test mode: Profile "${cliArgs.profileName}" not found`);
      }
    }

    console.log('[Profile] Test mode - skipping profile picker');
    return null;
  }

  let selectedProfileId: string | null = null;

  // Handle --reset-picker CLI flag (clears "don't ask again" preference)
  if (cliArgs.resetPicker) {
    console.log('[Profile] CLI: Resetting picker preference...');
    await profileStorage.clearSkipPicker();
  }

  // Handle --profile-id=<id> CLI argument (used by Switch Profile restart)
  if (cliArgs.profileId) {
    console.log(`[Profile] CLI: Using profile ID "${cliArgs.profileId}"...`);
    const config = await profileStorage.loadProfiles();
    const profile = config.profiles.find((p) => p.id === cliArgs.profileId);

    if (!profile) {
      // Profile not found - this shouldn't happen but handle gracefully
      console.error(`[Profile] CLI: Profile ID "${cliArgs.profileId}" not found, showing picker`);
      // Fall through to show picker
    } else {
      // Check dev/prod compatibility
      if (!isDevBuild && profile.isDev) {
        dialog.showErrorBox(
          'Cannot Access Development Profile',
          `The profile "${profile.name}" is a development profile and cannot be accessed from a production build.`
        );
        app.quit();
        return null;
      }

      // Dev build warning when accessing production profile
      if (isDevBuild && !profile.isDev) {
        const result = await dialog.showMessageBox({
          type: 'warning',
          title: 'Access Production Data?',
          message: "You're about to access production data with a development build.",
          detail: `The profile "${profile.name}" is a production profile. Development builds may have bugs that could corrupt your data. Are you sure you want to continue?`,
          buttons: ['Cancel', 'Continue Anyway'],
          defaultId: 0,
          cancelId: 0,
        });

        if (result.response === 0) {
          // User cancelled - show picker instead
          console.log('[Profile] CLI: User cancelled accessing production profile');
          // Fall through to show picker
        } else {
          selectedProfileId = profile.id;
          console.log(
            `[Profile] CLI: User confirmed accessing production profile "${profile.name}" (${profile.id})`
          );
        }
      } else {
        selectedProfileId = profile.id;
      }

      if (selectedProfileId) {
        console.log(`[Profile] CLI: Using profile "${profile.name}" (${profile.id})`);

        // Update lastUsed
        await profileStorage.updateLastUsed(profile.id);
      }
    }
  }

  // Handle --profile=<name> CLI argument
  if (!selectedProfileId && cliArgs.profileName) {
    console.log(`[Profile] CLI: Looking for profile "${cliArgs.profileName}"...`);
    const config = await profileStorage.loadProfiles();
    const profile = config.profiles.find((p) => p.name === cliArgs.profileName);

    if (!profile) {
      // Profile not found - show error dialog
      dialog.showErrorBox(
        'Profile Not Found',
        `The profile "${cliArgs.profileName}" does not exist.\n\nAvailable profiles:\n${config.profiles.map((p) => `  - ${p.name}`).join('\n') || '  (none)'}`
      );
      app.quit();
      return null;
    }

    // Check dev/prod compatibility
    if (!isDevBuild && profile.isDev) {
      dialog.showErrorBox(
        'Cannot Access Development Profile',
        `The profile "${profile.name}" is a development profile and cannot be accessed from a production build.`
      );
      app.quit();
      return null;
    }

    // Dev build warning when accessing production profile
    if (isDevBuild && !profile.isDev) {
      const result = await dialog.showMessageBox({
        type: 'warning',
        title: 'Access Production Data?',
        message: "You're about to access production data with a development build.",
        detail: `The profile "${profile.name}" is a production profile. Development builds may have bugs that could corrupt your data. Are you sure you want to continue?`,
        buttons: ['Cancel', 'Continue Anyway'],
        defaultId: 0,
        cancelId: 0,
      });

      if (result.response === 0) {
        // User cancelled - quit app
        app.quit();
        return null;
      }
    }

    selectedProfileId = profile.id;
    console.log(`[Profile] CLI: Selected profile "${profile.name}" (${profile.id})`);

    // Update lastUsed
    await profileStorage.updateLastUsed(profile.id);
  }

  // --skip-picker: use default or first available profile
  if (!selectedProfileId && cliArgs.skipPicker) {
    console.log('[Profile] CLI: Skipping picker, using default profile...');
    const config = await profileStorage.loadProfiles();

    // Filter profiles based on build type
    const availableProfiles = isDevBuild
      ? config.profiles
      : config.profiles.filter((p) => !p.isDev);

    if (availableProfiles.length === 0) {
      // No profiles available - create a default one
      console.log('[Profile] No profiles available, creating default...');
      const newProfile = await profileStorage.createProfile(
        isDevBuild ? 'Development' : 'Default',
        isDevBuild
      );
      selectedProfileId = newProfile.id;
    } else if (config.defaultProfileId) {
      // Use the saved default if it exists and is compatible
      const defaultProfile = availableProfiles.find((p) => p.id === config.defaultProfileId);
      if (defaultProfile) {
        selectedProfileId = defaultProfile.id;
        await profileStorage.updateLastUsed(defaultProfile.id);
      } else {
        // Default is incompatible, use first available
        const firstProfile = availableProfiles[0];
        if (firstProfile) {
          selectedProfileId = firstProfile.id;
          await profileStorage.updateLastUsed(firstProfile.id);
        }
      }
    } else {
      // No default, use first available
      const firstProfile = availableProfiles[0];
      if (firstProfile) {
        selectedProfileId = firstProfile.id;
        await profileStorage.updateLastUsed(firstProfile.id);
      }
    }

    console.log(`[Profile] CLI: Using profile: ${selectedProfileId}`);
  }

  // Show profile picker if no profile selected yet
  if (!selectedProfileId) {
    console.log('[Profile] Showing profile picker...');
    const result = await showProfilePicker({
      isDevBuild,
      appDataDir,
    });

    if (result.profileId === null) {
      // User cancelled - quit the app
      console.log('[Profile] User cancelled profile selection, quitting...');
      app.quit();
      return null;
    }

    selectedProfileId = result.profileId;
    console.log(`[Profile] Selected profile: ${selectedProfileId}`);
  }

  // Get profile name and mode, and acquire lock
  const config = await profileStorage.loadProfiles();
  const profile = config.profiles.find((p) => p.id === selectedProfileId);
  const selectedProfileName = profile?.name ?? null;
  const selectedProfileMode = profile ? getProfileMode(profile) : 'local';

  // Acquire profile lock to ensure single-instance per profile
  const fsAdapter = new NodeFileSystemAdapter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  const profileLock = new ProfileLock(fsAdapter as any);
  const profileDataDir = profileStorage.getProfileDataDir(selectedProfileId);
  const lockAcquired = await profileLock.acquire(profileDataDir);

  if (!lockAcquired) {
    // Show error dialog and quit
    await dialog.showMessageBox({
      type: 'error',
      title: 'Profile Already In Use',
      message: `The profile "${selectedProfileName ?? selectedProfileId}" is already open in another NoteCove window.`,
      detail: 'Please close that window first, or choose a different profile.',
      buttons: ['OK'],
    });
    app.quit();
    return null;
  }

  console.log(
    `[Profile] Acquired lock for profile: ${selectedProfileId} (mode: ${selectedProfileMode})`
  );

  // Build result with initialization data from wizard (if present)
  const result: ProfileSelectionResult = {
    profileId: selectedProfileId,
    profileName: selectedProfileName,
    profileMode: selectedProfileMode,
    profileLock,
  };

  // Include initialization data if present
  if (profile?.initialStoragePath) {
    result.initialStoragePath = profile.initialStoragePath;
  }
  if (profile?.initialUsername) {
    result.initialUsername = profile.initialUsername;
  }
  if (profile?.initialHandle) {
    result.initialHandle = profile.initialHandle;
  }

  return result;
}
