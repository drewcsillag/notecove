/**
 * Step 3: Storage Configuration
 *
 * Mode-specific storage configuration:
 * - Local/Paranoid: Show default path (read-only)
 * - Cloud: Select cloud provider
 * - Custom: Directory picker
 */

import React from 'react';
import type { StepProps } from './types';
import { wizardStyles } from './styles';

export function StepStorageConfig({
  state,
  onStateChange,
  onNext,
  onBack,
  onCancel,
}: StepProps): React.ReactElement {
  const handleSelectCustomPath = async (): Promise<void> => {
    if (!window.profilePickerAPI) return;

    const selectedPath = await window.profilePickerAPI.selectStoragePath(state.defaultStoragePath);
    if (selectedPath) {
      onStateChange({ storagePath: selectedPath });
    }
  };

  const handleCloudProviderSelect = (providerName: string, path: string): void => {
    onStateChange({
      cloudProvider: providerName,
      storagePath: path,
    });
  };

  const canProceed = (): boolean => {
    switch (state.mode) {
      case 'local':
      case 'paranoid':
        return true; // Default path is always valid
      case 'cloud':
        return state.cloudProvider !== null && state.storagePath !== null;
      case 'custom':
        return state.storagePath !== null;
      default:
        return false;
    }
  };

  const renderLocalOrParanoidConfig = (): React.ReactElement => (
    <>
      <div style={wizardStyles.fieldGroup}>
        <label style={wizardStyles.label}>Storage Location</label>
        <div style={wizardStyles.pathDisplay}>{state.defaultStoragePath}</div>
      </div>

      <div style={wizardStyles.infoBox}>
        Your notes will be stored in this folder. You can access and backup this folder directly.
      </div>

      {state.mode === 'paranoid' && (
        <div style={wizardStyles.warningBox}>
          <strong>Paranoid Mode:</strong> This profile will not fetch link previews or make any
          network requests when displaying notes. Cloud storage options are disabled.
        </div>
      )}
    </>
  );

  const renderCloudConfig = (): React.ReactElement => (
    <>
      <div style={wizardStyles.fieldGroup}>
        <label style={wizardStyles.label}>Select Cloud Storage Provider</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {state.availableCloudProviders.map((provider) => (
            <div
              key={provider.name}
              onClick={() => {
                handleCloudProviderSelect(provider.name, provider.path);
              }}
              style={{
                ...wizardStyles.providerOption,
                ...(state.cloudProvider === provider.name
                  ? wizardStyles.providerOptionSelected
                  : {}),
              }}
            >
              <div>
                <div style={wizardStyles.providerName}>{provider.name}</div>
                <div style={wizardStyles.providerPath}>{provider.path}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {state.storagePath && (
        <div style={wizardStyles.fieldGroup}>
          <label style={wizardStyles.label}>Notes Folder</label>
          <div style={wizardStyles.pathDisplay}>{state.storagePath}/NoteCove</div>
        </div>
      )}

      <div style={wizardStyles.infoBox}>
        Your notes will sync automatically when changes are saved to your cloud storage.
      </div>
    </>
  );

  const renderCustomConfig = (): React.ReactElement => (
    <>
      <div style={wizardStyles.fieldGroup}>
        <label style={wizardStyles.label}>Storage Location</label>
        {state.storagePath ? (
          <div style={wizardStyles.pathDisplay}>{state.storagePath}</div>
        ) : (
          <div style={{ ...wizardStyles.pathDisplay, color: '#999', fontStyle: 'italic' }}>
            No folder selected
          </div>
        )}
      </div>

      <button
        type="button"
        style={wizardStyles.buttonSecondary}
        onClick={() => void handleSelectCustomPath()}
      >
        Choose Folder...
      </button>

      <div style={wizardStyles.infoBox}>
        Select any folder on your computer. You can choose a cloud-synced folder (like Dropbox) or a
        local folder.
      </div>
    </>
  );

  const getTitle = (): string => {
    switch (state.mode) {
      case 'local':
        return 'Local Storage';
      case 'cloud':
        return 'Cloud Storage';
      case 'paranoid':
        return 'Secure Storage';
      case 'custom':
        return 'Custom Storage';
      default:
        return 'Storage Configuration';
    }
  };

  return (
    <div style={wizardStyles.container}>
      <div style={wizardStyles.header}>
        <h2 style={wizardStyles.title}>{getTitle()}</h2>
        <p style={wizardStyles.subtitle}>Configure where to store your notes</p>
      </div>

      <div style={wizardStyles.content}>
        {(state.mode === 'local' || state.mode === 'paranoid') && renderLocalOrParanoidConfig()}
        {state.mode === 'cloud' && renderCloudConfig()}
        {state.mode === 'custom' && renderCustomConfig()}
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
              ...(canProceed() ? {} : wizardStyles.buttonDisabled),
            }}
            disabled={!canProceed()}
            onClick={onNext}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
