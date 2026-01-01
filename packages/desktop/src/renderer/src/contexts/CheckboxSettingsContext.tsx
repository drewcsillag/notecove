/**
 * Checkbox Settings Context
 *
 * Provides global access to checkbox behavior settings:
 * - strikethrough: Apply strikethrough to completed items
 * - autoReorder: Move completed items to bottom of list
 * - nopeEnabled: Enable 3-state checkbox with nope state
 *
 * Also provides sync getters for non-React code (like TipTap extensions).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isElectron } from '../utils/platform';

interface CheckboxSettingsContextValue {
  strikethrough: boolean;
  autoReorder: boolean;
  nopeEnabled: boolean;
  setStrikethrough: (value: boolean) => Promise<void>;
  setAutoReorder: (value: boolean) => Promise<void>;
  setNopeEnabled: (value: boolean) => Promise<void>;
  isLoading: boolean;
}

const CheckboxSettingsContext = createContext<CheckboxSettingsContextValue>({
  strikethrough: true,
  autoReorder: true,
  nopeEnabled: true,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setStrikethrough: async () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setAutoReorder: async () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setNopeEnabled: async () => {},
  isLoading: true,
});

// Module-level sync store for non-React code (e.g., TipTap extensions)
let currentStrikethrough = true;
let currentAutoReorder = true;
let currentNopeEnabled = true;

/**
 * Get strikethrough setting synchronously (for TipTap extensions)
 */
export function getCheckboxStrikethrough(): boolean {
  return currentStrikethrough;
}

/**
 * Get auto-reorder setting synchronously (for TipTap extensions)
 */
export function getCheckboxAutoReorder(): boolean {
  return currentAutoReorder;
}

/**
 * Get nope-enabled setting synchronously (for TipTap extensions)
 */
export function getCheckboxNopeEnabled(): boolean {
  return currentNopeEnabled;
}

/**
 * Update the module-level sync store (called by CheckboxSettingsSync)
 */
function updateSyncStore(strikethrough: boolean, autoReorder: boolean, nopeEnabled: boolean): void {
  currentStrikethrough = strikethrough;
  currentAutoReorder = autoReorder;
  currentNopeEnabled = nopeEnabled;
}

interface CheckboxSettingsProviderProps {
  children: React.ReactNode;
}

export const CheckboxSettingsProvider: React.FC<CheckboxSettingsProviderProps> = ({ children }) => {
  const [strikethrough, setStrikethroughState] = useState(true);
  const [autoReorder, setAutoReorderState] = useState(true);
  const [nopeEnabled, setNopeEnabledState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from storage
  const loadSettings = useCallback(async (): Promise<void> => {
    if (!isElectron()) {
      setIsLoading(false);
      return;
    }

    try {
      const [strikethroughVal, autoReorderVal, nopeEnabledVal] = await Promise.all([
        window.electronAPI.appState.get('checkboxStrikethrough'),
        window.electronAPI.appState.get('checkboxAutoReorder'),
        window.electronAPI.appState.get('checkboxNopeEnabled'),
      ]);

      // Default to true if not set
      setStrikethroughState(strikethroughVal !== 'false');
      setAutoReorderState(autoReorderVal !== 'false');
      setNopeEnabledState(nopeEnabledVal !== 'false');
    } catch (err) {
      console.error('Failed to load checkbox settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Listen for broadcasts from other windows
  useEffect(() => {
    if (!isElectron()) return;

    const unsubscribe = window.electronAPI.checkboxSettings.onChanged(() => {
      void loadSettings();
    });

    return unsubscribe;
  }, [loadSettings]);

  const setStrikethrough = useCallback(async (value: boolean): Promise<void> => {
    setStrikethroughState(value);

    if (!isElectron()) return;

    try {
      await window.electronAPI.appState.set('checkboxStrikethrough', value ? 'true' : 'false');
    } catch (err) {
      console.error('Failed to save checkbox strikethrough setting:', err);
    }
  }, []);

  const setAutoReorder = useCallback(async (value: boolean): Promise<void> => {
    setAutoReorderState(value);

    if (!isElectron()) return;

    try {
      await window.electronAPI.appState.set('checkboxAutoReorder', value ? 'true' : 'false');
    } catch (err) {
      console.error('Failed to save checkbox auto-reorder setting:', err);
    }
  }, []);

  const setNopeEnabled = useCallback(async (value: boolean): Promise<void> => {
    setNopeEnabledState(value);

    if (!isElectron()) return;

    try {
      await window.electronAPI.appState.set('checkboxNopeEnabled', value ? 'true' : 'false');
    } catch (err) {
      console.error('Failed to save checkbox nope-enabled setting:', err);
    }
  }, []);

  return (
    <CheckboxSettingsContext.Provider
      value={{
        strikethrough,
        autoReorder,
        nopeEnabled,
        setStrikethrough,
        setAutoReorder,
        setNopeEnabled,
        isLoading,
      }}
    >
      {children}
    </CheckboxSettingsContext.Provider>
  );
};

/**
 * Hook to access checkbox settings
 */
export function useCheckboxSettings(): CheckboxSettingsContextValue {
  return useContext(CheckboxSettingsContext);
}

/**
 * Sync component that updates the module-level store
 * Must be rendered inside CheckboxSettingsProvider
 */
export const CheckboxSettingsSync: React.FC = () => {
  const { strikethrough, autoReorder, nopeEnabled } = useCheckboxSettings();

  useEffect(() => {
    updateSyncStore(strikethrough, autoReorder, nopeEnabled);
  }, [strikethrough, autoReorder, nopeEnabled]);

  return null;
};
