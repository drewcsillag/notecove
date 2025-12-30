/**
 * Step 5: Confirmation
 *
 * Shows a summary of choices and creates the profile.
 */

import React, { useState } from 'react';
import type { StepProps } from './types';
import { wizardStyles } from './styles';

interface ConfirmationStepProps extends StepProps {
  onCreate: () => Promise<void>;
}

export function StepConfirmation({
  state,
  onBack,
  onCancel,
  onCreate,
}: ConfirmationStepProps): React.ReactElement {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (): Promise<void> => {
    setIsCreating(true);
    setError(null);
    try {
      await onCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
      setIsCreating(false);
    }
  };

  const getModeDisplayName = (): string => {
    switch (state.mode) {
      case 'local':
        return 'Local';
      case 'cloud':
        return 'Cloud';
      case 'paranoid':
        return 'Paranoid';
      case 'custom':
        return 'Custom';
      default:
        return 'Unknown';
    }
  };

  const getStoragePath = (): string => {
    if (state.mode === 'local' || state.mode === 'paranoid') {
      return state.defaultStoragePath;
    }
    if (state.mode === 'cloud' && state.storagePath) {
      return `${state.storagePath}/NoteCove`;
    }
    return state.storagePath ?? 'Not configured';
  };

  return (
    <div style={wizardStyles.container}>
      <div style={wizardStyles.header}>
        <h2 style={wizardStyles.title}>Review & Create</h2>
        <p style={wizardStyles.subtitle}>Confirm your profile settings</p>
      </div>

      <div style={wizardStyles.content}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={wizardStyles.summaryRow}>
            <span style={wizardStyles.summaryLabel}>Profile Name</span>
            <span style={wizardStyles.summaryValue}>{state.profileName}</span>
          </div>

          <div style={wizardStyles.summaryRow}>
            <span style={wizardStyles.summaryLabel}>Mode</span>
            <span style={wizardStyles.summaryValue}>{getModeDisplayName()}</span>
          </div>

          <div style={wizardStyles.summaryRow}>
            <span style={wizardStyles.summaryLabel}>Storage</span>
            <span
              style={{
                ...wizardStyles.summaryValue,
                fontFamily: 'monospace',
                fontSize: '12px',
                wordBreak: 'break-all',
              }}
            >
              {getStoragePath()}
            </span>
          </div>

          {state.mode === 'cloud' && state.cloudProvider && (
            <div style={wizardStyles.summaryRow}>
              <span style={wizardStyles.summaryLabel}>Cloud Provider</span>
              <span style={wizardStyles.summaryValue}>{state.cloudProvider}</span>
            </div>
          )}

          {state.mode !== 'paranoid' && (state.username || state.handle) && (
            <>
              {state.username && (
                <div style={wizardStyles.summaryRow}>
                  <span style={wizardStyles.summaryLabel}>Display Name</span>
                  <span style={wizardStyles.summaryValue}>{state.username}</span>
                </div>
              )}
              {state.handle && (
                <div style={wizardStyles.summaryRow}>
                  <span style={wizardStyles.summaryLabel}>Handle</span>
                  <span style={wizardStyles.summaryValue}>{state.handle}</span>
                </div>
              )}
            </>
          )}
        </div>

        {state.mode === 'paranoid' && (
          <div style={wizardStyles.warningBox}>
            <strong>Privacy Features Enabled:</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li>No link previews or network requests in notes</li>
              <li>Cloud storage options hidden</li>
              <li>User info not collected</li>
            </ul>
          </div>
        )}

        {error && (
          <div
            style={{
              ...wizardStyles.warningBox,
              backgroundColor: '#fee2e2',
              borderColor: '#fecaca',
              color: '#dc2626',
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div style={wizardStyles.footer}>
        <div style={wizardStyles.footerLeft}>
          <button
            type="button"
            style={wizardStyles.buttonSecondary}
            onClick={onCancel}
            disabled={isCreating}
          >
            Cancel
          </button>
        </div>
        <div style={wizardStyles.footerRight}>
          <button
            type="button"
            style={wizardStyles.buttonSecondary}
            onClick={onBack}
            disabled={isCreating}
          >
            Back
          </button>
          <button
            type="button"
            style={{
              ...wizardStyles.button,
              ...(isCreating ? wizardStyles.buttonDisabled : {}),
            }}
            disabled={isCreating}
            onClick={() => void handleCreate()}
          >
            {isCreating ? 'Creating...' : 'Create Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
