/**
 * Feature Flags Context
 *
 * Provides feature flag state to React components.
 * Loads flags on mount and subscribes to changes.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type FeatureFlagName = 'telemetry' | 'viewHistory' | 'webServer';

interface FeatureFlagsState {
  telemetry: boolean;
  viewHistory: boolean;
  webServer: boolean;
  loading: boolean;
}

interface FeatureFlagsContextValue extends FeatureFlagsState {
  /** Check if a specific feature flag is enabled */
  isEnabled: (flag: FeatureFlagName) => boolean;
  /** Refresh flags from the backend */
  refresh: () => Promise<void>;
}

const defaultState: FeatureFlagsState = {
  telemetry: false,
  viewHistory: false,
  webServer: false,
  loading: true,
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  ...defaultState,
  isEnabled: () => false,
  refresh: () => Promise.resolve(),
});

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FeatureFlagsState>(defaultState);

  const loadFlags = useCallback(async () => {
    try {
      const flags = await window.electronAPI.featureFlags.getAll();
      const flagState: Partial<FeatureFlagsState> = { loading: false };
      for (const { flag, enabled } of flags) {
        flagState[flag as FeatureFlagName] = enabled;
      }
      setState((prev) => ({ ...prev, ...flagState }));
    } catch (error) {
      console.error('[FeatureFlags] Failed to load flags:', error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  // Load flags on mount
  useEffect(() => {
    void loadFlags();
  }, [loadFlags]);

  // Subscribe to flag changes
  useEffect(() => {
    const unsubscribe = window.electronAPI.featureFlags.onChange(({ flag, enabled }) => {
      setState((prev) => ({
        ...prev,
        [flag]: enabled,
      }));
    });

    return unsubscribe;
  }, []);

  const isEnabled = useCallback(
    (flag: FeatureFlagName): boolean => {
      return state[flag];
    },
    [state]
  );

  const value: FeatureFlagsContextValue = {
    ...state,
    isEnabled,
    refresh: loadFlags,
  };

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

/**
 * Hook to access feature flags
 */
export function useFeatureFlags(): FeatureFlagsContextValue {
  return useContext(FeatureFlagsContext);
}

/**
 * Hook to check if a specific feature flag is enabled
 */
export function useFeatureFlag(flag: FeatureFlagName): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flag);
}

export { FeatureFlagsContext };
export type { FeatureFlagName, FeatureFlagsContextValue };
