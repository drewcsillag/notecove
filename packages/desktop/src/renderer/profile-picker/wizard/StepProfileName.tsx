/**
 * Step 1: Profile Name
 *
 * Collects the profile name from the user.
 */

import React, { useState } from 'react';
import type { StepProps } from './types';
import { wizardStyles } from './styles';

export function StepProfileName({
  state,
  onStateChange,
  onNext,
  onCancel,
}: StepProps): React.ReactElement {
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (state.profileName.trim()) {
      onNext();
    }
  };

  const isValid = state.profileName.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} style={wizardStyles.container}>
      <div style={wizardStyles.header}>
        <h2 style={wizardStyles.title}>Create New Profile</h2>
        <p style={wizardStyles.subtitle}>Choose a name for your new profile</p>
      </div>

      <div style={wizardStyles.content}>
        <div style={wizardStyles.fieldGroup}>
          <label style={wizardStyles.label} htmlFor="profileName">
            Profile Name
          </label>
          <input
            id="profileName"
            type="text"
            value={state.profileName}
            onChange={(e) => {
              onStateChange({ profileName: e.target.value });
            }}
            onFocus={() => {
              setIsFocused(true);
            }}
            onBlur={() => {
              setIsFocused(false);
            }}
            style={{
              ...wizardStyles.input,
              ...(isFocused ? wizardStyles.inputFocused : {}),
            }}
            placeholder="e.g., Personal, Work, Side Project"
            autoFocus
          />
        </div>

        <div style={wizardStyles.infoBox}>
          Profiles let you keep different note collections separate. Each profile has its own
          storage location and settings.
        </div>
      </div>

      <div style={wizardStyles.footer}>
        <div style={wizardStyles.footerLeft}>
          <button type="button" style={wizardStyles.buttonSecondary} onClick={onCancel}>
            Cancel
          </button>
        </div>
        <div style={wizardStyles.footerRight}>
          <button
            type="submit"
            style={{
              ...wizardStyles.button,
              ...(isValid ? {} : wizardStyles.buttonDisabled),
            }}
            disabled={!isValid}
          >
            Next
          </button>
        </div>
      </div>
    </form>
  );
}
