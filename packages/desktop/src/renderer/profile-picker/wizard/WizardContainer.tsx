/**
 * Wizard Container
 *
 * Main wizard shell that manages step navigation and state.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ProfileMode } from '@notecove/shared';
import type { WizardStep, WizardState, CloudProvider } from './types';
import { StepProfileName } from './StepProfileName';
import { StepModeSelection } from './StepModeSelection';
import { StepStorageConfig } from './StepStorageConfig';
import { StepUserSettings } from './StepUserSettings';
import { StepConfirmation } from './StepConfirmation';
import { wizardStyles } from './styles';

interface Profile {
  id: string;
  name: string;
  isDev: boolean;
  mode?: ProfileMode;
  created: number;
  lastUsed: number;
}

interface WizardContainerProps {
  onComplete: (profile: Profile) => void;
  onCancel: () => void;
}

const STEP_ORDER: WizardStep[] = [
  'profileName',
  'modeSelection',
  'storageConfig',
  'userSettings',
  'confirmation',
];

function getVisibleSteps(mode: ProfileMode | null): WizardStep[] {
  if (mode === 'paranoid') {
    // Skip userSettings for paranoid mode
    return ['profileName', 'modeSelection', 'storageConfig', 'confirmation'];
  }
  return STEP_ORDER;
}

export function WizardContainer({
  onComplete,
  onCancel,
}: WizardContainerProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState<WizardStep>('profileName');
  const [state, setState] = useState<WizardState>({
    profileName: '',
    mode: null,
    storagePath: null,
    cloudProvider: null,
    username: '',
    handle: '',
    availableCloudProviders: [],
    defaultStoragePath: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load cloud providers and default path on mount
  useEffect(() => {
    async function loadData(): Promise<void> {
      if (!window.profilePickerAPI) {
        setError('Profile API not available');
        setLoading(false);
        return;
      }

      try {
        const [cloudPaths, defaultPath] = await Promise.all([
          window.profilePickerAPI.getCloudStoragePaths(),
          window.profilePickerAPI.getDefaultStoragePath(),
        ]);

        const providers: CloudProvider[] = Object.entries(cloudPaths).map(([name, path]) => ({
          name,
          path,
        }));

        setState((prev) => ({
          ...prev,
          availableCloudProviders: providers,
          defaultStoragePath: defaultPath,
        }));
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load wizard data');
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const handleStateChange = useCallback((updates: Partial<WizardState>): void => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleNext = useCallback((): void => {
    const visibleSteps = getVisibleSteps(state.mode);
    const currentIndex = visibleSteps.indexOf(currentStep);
    if (currentIndex < visibleSteps.length - 1) {
      const nextStep = visibleSteps[currentIndex + 1];
      if (nextStep) {
        setCurrentStep(nextStep);
      }
    }
  }, [currentStep, state.mode]);

  const handleBack = useCallback((): void => {
    const visibleSteps = getVisibleSteps(state.mode);
    const currentIndex = visibleSteps.indexOf(currentStep);
    if (currentIndex > 0) {
      const prevStep = visibleSteps[currentIndex - 1];
      if (prevStep) {
        setCurrentStep(prevStep);
      }
    }
  }, [currentStep, state.mode]);

  const handleCreate = async (): Promise<void> => {
    if (!window.profilePickerAPI || !state.mode) {
      throw new Error('Invalid wizard state');
    }

    // Determine the storage path based on mode
    let storagePath: string | undefined;
    if (state.mode === 'local' || state.mode === 'paranoid') {
      storagePath = state.defaultStoragePath;
    } else if (state.mode === 'cloud' && state.storagePath) {
      storagePath = `${state.storagePath}/NoteCove`;
    } else if (state.mode === 'custom' && state.storagePath) {
      storagePath = state.storagePath;
    }

    // Build config object, only including optional properties if they have values
    // (required for TypeScript exactOptionalPropertyTypes)
    const config: {
      name: string;
      mode: ProfileMode;
      storagePath?: string;
      username?: string;
      handle?: string;
    } = {
      name: state.profileName.trim(),
      mode: state.mode,
    };

    if (storagePath) {
      config.storagePath = storagePath;
    }
    if (state.username.trim()) {
      config.username = state.username.trim();
    }
    if (state.handle.trim()) {
      config.handle = state.handle.trim();
    }

    const newProfile = await window.profilePickerAPI.createProfileWithConfig(config);

    onComplete(newProfile);
  };

  // Calculate step indicator
  const visibleSteps = getVisibleSteps(state.mode);
  const currentStepIndex = visibleSteps.indexOf(currentStep);

  if (loading) {
    return (
      <div style={{ ...wizardStyles.container, justifyContent: 'center', alignItems: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={wizardStyles.container}>
        <div style={wizardStyles.warningBox}>{error}</div>
        <button style={wizardStyles.buttonSecondary} onClick={onCancel}>
          Close
        </button>
      </div>
    );
  }

  const stepProps = {
    state,
    onStateChange: handleStateChange,
    onNext: handleNext,
    onBack: handleBack,
    onCancel,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Step indicator */}
      <div style={wizardStyles.stepIndicator}>
        {visibleSteps.map((step, index) => (
          <div
            key={step}
            style={{
              ...wizardStyles.stepDot,
              ...(index < currentStepIndex ? wizardStyles.stepDotCompleted : {}),
              ...(index === currentStepIndex ? wizardStyles.stepDotActive : {}),
            }}
          />
        ))}
      </div>

      {/* Current step */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {currentStep === 'profileName' && <StepProfileName {...stepProps} />}
        {currentStep === 'modeSelection' && <StepModeSelection {...stepProps} />}
        {currentStep === 'storageConfig' && <StepStorageConfig {...stepProps} />}
        {currentStep === 'userSettings' && <StepUserSettings {...stepProps} />}
        {currentStep === 'confirmation' && (
          <StepConfirmation {...stepProps} onCreate={handleCreate} />
        )}
      </div>
    </div>
  );
}
