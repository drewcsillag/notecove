/**
 * Link Display Preference Context
 *
 * Provides global access to the user's link display preference setting.
 * This setting determines how web links are displayed:
 * - 'none': Plain text links only
 * - 'chip': Compact chips with favicon and title
 * - 'unfurl': Full preview cards when oEmbed data is available
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { LinkDisplayPreference } from '@notecove/shared';
import { isElectron } from '../utils/platform';

interface LinkDisplayPreferenceContextValue {
  preference: LinkDisplayPreference;
  setPreference: (preference: LinkDisplayPreference) => Promise<void>;
  isLoading: boolean;
}

const LinkDisplayPreferenceContext = createContext<LinkDisplayPreferenceContextValue>({
  preference: 'unfurl',
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setPreference: async () => {},
  isLoading: true,
});

/**
 * Default preference when not set or in browser mode
 */
const DEFAULT_PREFERENCE: LinkDisplayPreference = 'unfurl';

interface LinkDisplayPreferenceProviderProps {
  children: React.ReactNode;
}

export const LinkDisplayPreferenceProvider: React.FC<LinkDisplayPreferenceProviderProps> = ({
  children,
}) => {
  const [preference, setPreferenceState] = useState<LinkDisplayPreference>(DEFAULT_PREFERENCE);
  const [isLoading, setIsLoading] = useState(true);

  // Load preference on mount
  useEffect(() => {
    const loadPreference = async (): Promise<void> => {
      if (!isElectron()) {
        setIsLoading(false);
        return;
      }

      try {
        const stored = await window.electronAPI.appState.get('linkDisplayPreference');
        if (
          stored &&
          (stored === 'none' || stored === 'chip' || stored === 'unfurl' || stored === 'secure')
        ) {
          setPreferenceState(stored);
        }
      } catch (err) {
        console.error('Failed to load link display preference:', err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPreference();
  }, []);

  // Listen for preference changes from other windows
  useEffect(() => {
    if (!isElectron()) return;

    // Currently there's no broadcast for preference changes,
    // but we could add one similar to theme if needed
  }, []);

  const setPreference = useCallback(async (newPreference: LinkDisplayPreference): Promise<void> => {
    setPreferenceState(newPreference);

    if (!isElectron()) return;

    try {
      await window.electronAPI.appState.set('linkDisplayPreference', newPreference);
    } catch (err) {
      console.error('Failed to save link display preference:', err);
    }
  }, []);

  return (
    <LinkDisplayPreferenceContext.Provider value={{ preference, setPreference, isLoading }}>
      {children}
    </LinkDisplayPreferenceContext.Provider>
  );
};

/**
 * Hook to access the link display preference
 */
export function useLinkDisplayPreference(): LinkDisplayPreferenceContextValue {
  return useContext(LinkDisplayPreferenceContext);
}

/**
 * Get the current preference synchronously (for use in non-React code)
 * This is populated after the context loads.
 */
let currentPreference: LinkDisplayPreference = DEFAULT_PREFERENCE;

export function getCurrentLinkDisplayPreference(): LinkDisplayPreference {
  return currentPreference;
}

/**
 * Set the current preference synchronously (called by the context provider)
 */
export function setCurrentLinkDisplayPreference(pref: LinkDisplayPreference): void {
  currentPreference = pref;
}

/**
 * Sync component that updates the module-level preference
 * Must be rendered inside LinkDisplayPreferenceProvider
 */
export const LinkDisplayPreferenceSync: React.FC = () => {
  const { preference } = useLinkDisplayPreference();

  useEffect(() => {
    setCurrentLinkDisplayPreference(preference);
  }, [preference]);

  return null;
};
