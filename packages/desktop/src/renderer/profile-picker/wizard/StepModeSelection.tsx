/**
 * Step 2: Mode Selection
 *
 * User selects between Local, Cloud, Paranoid, or Custom mode.
 */

import React from 'react';
import type { ProfileMode } from '@notecove/shared';
import type { StepProps } from './types';
import { wizardStyles } from './styles';

interface ModeOption {
  mode: ProfileMode;
  title: string;
  description: string;
  available: boolean;
}

export function StepModeSelection({
  state,
  onStateChange,
  onNext,
  onBack,
  onCancel,
}: StepProps): React.ReactElement {
  const hasCloudProviders = state.availableCloudProviders.length > 0;

  const modeOptions: ModeOption[] = [
    {
      mode: 'local',
      title: 'Local',
      description: 'Store notes in ~/Documents/NoteCove. Simple and private.',
      available: true,
    },
    {
      mode: 'cloud',
      title: 'Cloud',
      description: hasCloudProviders
        ? 'Store notes in your cloud storage for automatic sync across devices.'
        : 'No cloud storage detected. Install iCloud, Dropbox, Google Drive, or OneDrive to use this option.',
      available: hasCloudProviders,
    },
    {
      mode: 'paranoid',
      title: 'Paranoid',
      description:
        'Maximum privacy mode. Local storage only, no link previews, no network requests for note content.',
      available: true,
    },
    {
      mode: 'custom',
      title: 'Custom',
      description: 'Choose any folder on your computer for storage.',
      available: true,
    },
  ];

  const handleModeSelect = (mode: ProfileMode): void => {
    const option = modeOptions.find((o) => o.mode === mode);
    if (option?.available) {
      onStateChange({ mode });
    }
  };

  const handleNext = (): void => {
    if (state.mode) {
      onNext();
    }
  };

  return (
    <div style={wizardStyles.container}>
      <div style={wizardStyles.header}>
        <h2 style={wizardStyles.title}>Choose Profile Mode</h2>
        <p style={wizardStyles.subtitle}>
          Select how you want to store and manage notes in &quot;{state.profileName}&quot;
        </p>
      </div>

      <div style={wizardStyles.content}>
        {modeOptions.map((option) => (
          <div
            key={option.mode}
            onClick={() => {
              handleModeSelect(option.mode);
            }}
            style={{
              ...wizardStyles.modeCard,
              ...(state.mode === option.mode ? wizardStyles.modeCardSelected : {}),
              ...(option.available ? {} : { opacity: 0.5, cursor: 'not-allowed' }),
            }}
          >
            <div style={wizardStyles.modeCardTitle}>{option.title}</div>
            <div style={wizardStyles.modeCardDescription}>{option.description}</div>
          </div>
        ))}
      </div>

      <div style={wizardStyles.footer}>
        <div style={wizardStyles.footerLeft}>
          <button type="button" style={wizardStyles.buttonSecondary} onClick={onCancel}>
            Cancel
          </button>
        </div>
        <div style={wizardStyles.footerRight}>
          <button type="button" style={wizardStyles.buttonSecondary} onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            style={{
              ...wizardStyles.button,
              ...(state.mode ? {} : wizardStyles.buttonDisabled),
            }}
            disabled={!state.mode}
            onClick={handleNext}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
