/**
 * Profile Mode Context
 *
 * Provides global access to the current profile's mode.
 * This determines privacy settings and available features:
 * - 'local': Standard local storage, all features available
 * - 'cloud': Cloud storage, all features available
 * - 'paranoid': Maximum privacy, link previews disabled, no user info
 * - 'custom': User-specified storage, all features available
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ProfileMode } from '@notecove/shared';
import { isElectron } from '../utils/platform';

interface ProfileModeContextValue {
  /** The current profile's mode */
  mode: ProfileMode;
  /** Whether the mode is still loading */
  isLoading: boolean;
}

const ProfileModeContext = createContext<ProfileModeContextValue>({
  mode: 'local',
  isLoading: true,
});

interface ProfileModeProviderProps {
  children: React.ReactNode;
}

export const ProfileModeProvider: React.FC<ProfileModeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ProfileMode>('local');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProfileMode = async (): Promise<void> => {
      if (!isElectron()) {
        setIsLoading(false);
        return;
      }

      try {
        const profileMode = await window.electronAPI.user.getProfileMode();
        setMode(profileMode);
      } catch (err) {
        console.error('Failed to load profile mode:', err);
        // Default to 'local' on error
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfileMode();
  }, []);

  return (
    <ProfileModeContext.Provider value={{ mode, isLoading }}>
      {children}
    </ProfileModeContext.Provider>
  );
};

/**
 * Hook to access the profile mode
 */
export function useProfileMode(): ProfileModeContextValue {
  return useContext(ProfileModeContext);
}

/**
 * Check if the current profile is in paranoid mode
 * This is a convenience hook for common paranoid mode checks
 */
export function useIsParanoidMode(): boolean {
  const { mode } = useProfileMode();
  return mode === 'paranoid';
}
